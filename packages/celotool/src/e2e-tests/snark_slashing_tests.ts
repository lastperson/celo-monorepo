import { ContractKit, newKitFromWeb3 } from '@celo/contractkit'
import { SnarkEpochDataSlasher } from '@celo/contractkit/lib/generated/SnarkEpochDataSlasher'
import { assert } from 'chai'
import Web3 from 'web3'
import { GethRunConfig } from '../lib/interfaces/geth-run-config'
import { getHooks, sleep, waitForBlock } from './utils'

const TMP_PATH = '/tmp/e2e'

const base = 0x1ae3a4617c510eac63b05c06ca1493b1a22d9f300f5138f1ef3622fba094800170b5d44300000008508c00000000001n

function modpow(base1: bigint, exponent: bigint, modulus: bigint) {
  let result = 1n
  base1 = base1 % modulus
  while (exponent > 0n) {
    if (exponent % 2n === 1n) {
      result = (result * base1) % modulus
    }
    exponent = exponent >> 1n
    base1 = (base1 * base1) % modulus
  }
  return result
}

function tonelli(n: bigint, p: bigint): [bigint, bigint, boolean] {
  if (modpow(n, (p - 1n) / 2n, p) !== 1n) {
    return [-1n, -1n, false]
  }

  let q = p - 1n
  let ss = 0n
  while (q % 2n === 0n) {
    ss = ss + 1n
    q = q >> 1n
  }

  if (ss === 1n) {
    const r1 = modpow(n, (p + 1n) / 4n, p)
    return [r1, p - r1, true]
  }

  let z = 2n
  while (modpow(z, (p - 1n) / 2n, p) !== p - 1n) {
    z = z + 1n
  }
  let c = modpow(z, q, p)
  let r = modpow(n, (q + 1n) / 2n, p)
  let t = modpow(n, q, p)
  let m = ss

  while (true) {
    if (t === 1n) {
      return [r, p - r, true]
    }
    let i = 0n
    let zz = t
    while (zz !== 1n && i < m - 1n) {
      zz = (zz * zz) % p
      i = i + 1n
    }
    let b = c
    let e = m - i - 1n
    while (e > 0n) {
      b = (b * b) % p
      e = e - 1n
    }
    r = (r * b) % p
    c = (b * b) % p
    t = (t * c) % p
    m = i
  }
}

function max(a: bigint, b: bigint): bigint {
  return a < b ? b : a
}

function min(a: bigint, b: bigint): bigint {
  return a > b ? b : a
}

function findY(x: bigint) {
  const [a, b] = tonelli((x ** 3n + 1n) % base, base)
  return [max(a, b), min(a, b)]
}

function uncompressSig(comp: Buffer) {
  const sig = [...comp].reverse()
  const greatest = (sig[0] & 0x80) !== 0
  sig[0] = sig[0] & 0x7f
  const x = BigInt('0x' + Buffer.from(sig).toString('hex'))
  const [a, b] = tonelli((x ** 3n + 1n) % base, base)
  const y = greatest ? max(a, b) : min(a, b)
  // console.log(x, a, b, greatest ? max(a,b) : min(a,b), a < b, greatest)
  return `0x${x.toString(16).padStart(128, '0')}${y.toString(16).padStart(128, '0')}`
}

async function jsonRpc(web3: Web3, method: string, params: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof web3.currentProvider !== 'string') {
      web3.currentProvider!.send!(
        {
          jsonrpc: '2.0',
          method,
          params,
          // salt id generation, milliseconds might not be
          // enough to generate unique ids
          id: new Date().getTime() + Math.floor(Math.random() * (1 + 100 - 1)),
        },
        (err, result) => {
          if (err) {
            return reject(err)
          }
          return resolve(result)
        }
      )
    } else {
      reject(new Error('Invalid Provider'))
    }
  })
}

export interface Info {
  inner: string
  extra: string
  sig: Buffer
  bitmap: number
}

async function getSlashingInfo(web3: Web3, bn: number): Promise<Info> {
  const res = (await jsonRpc(web3, 'istanbul_getEpochValidatorSetData', [`0x${bn.toString(16)}`]))
    .result
  const info = {
    inner: '0x' + Buffer.from(res.bhhash, 'base64').toString('hex'),
    extra:
      '0x' +
      res.attempts.toString(16).padStart(2, '0') +
      Buffer.from(res.extraData, 'base64').toString('hex'),
    sig: Buffer.from(res.sig, 'base64'),
    bitmap: res.bitmap,
  }
  return info
}

async function makeHint(instance: SnarkEpochDataSlasher, { inner, extra }: Info) {
  const res = await instance.methods.testHashing(extra, inner).call()
  const arr = [...Buffer.from(res.substr(2), 'hex')]
  const needed = arr.slice(0, 48).reverse()
  needed[0] = needed[0] & 0x01
  const x = BigInt('0x' + Buffer.from(needed).toString('hex'))
  const [y1, y2] = findY(x)
  const hints = `0x${y1.toString(16).padStart(128, '0')}${y2.toString(16).padStart(128, '0')}`
  return hints
}

async function infoToData(instance: SnarkEpochDataSlasher, info: Info) {
  const hint = await makeHint(instance, info)
  const sig = uncompressSig(info.sig)
  const header = `0x${info.extra.substr(2)}${info.inner.substr(2)}${info.bitmap
    .toString(16)
    .padStart(64, '0')}${sig.substr(2)}${hint.substr(2)}`
  return header
}

describe('snark slashing tests', function(this: any) {
  const instances = [
    {
      name: 'validator0',
      validating: true,
      syncmode: 'full',
      port: 30303,
      rpcport: 8545,
    },
    {
      name: 'validator1',
      validating: true,
      syncmode: 'full',
      port: 30305,
      rpcport: 8547,
    },
    {
      name: 'validator2',
      validating: true,
      syncmode: 'full',
      port: 30307,
      rpcport: 8549,
    },
    {
      name: 'validator3',
      validating: true,
      syncmode: 'full',
      port: 30309,
      rpcport: 8551,
    },
  ]

  const gethConfig: GethRunConfig = {
    network: 'local',
    networkId: 1101,
    runPath: TMP_PATH,
    migrate: true,
    instances,
  }

  const gethConfigDown1: GethRunConfig = {
    ...gethConfig,
    instances: [instances[0], instances[2], instances[3]],
  }

  const gethConfigDown2: GethRunConfig = {
    ...gethConfig,
    instances: instances.slice(0, 3),
  }

  const hooks: any = getHooks(gethConfig)
  const hooks1: any = getHooks(gethConfigDown1)
  const hooks2: any = getHooks(gethConfigDown2)
  let web3: Web3
  let kit: ContractKit

  let info1: any
  let info2: any

  before(async function(this: any) {
    this.timeout(0)
    // Comment out the following line after a test run for a quick rerun.
    await hooks.before()
  })

  after(async function(this: any) {
    this.timeout(0)
    await hooks.after()
  })
  const restart1 = async () => {
    await hooks1.restart()
    web3 = new Web3('http://localhost:8545')
    kit = newKitFromWeb3(web3)
    await sleep(1)
  }

  const restart2 = async () => {
    await hooks2.restart()
    web3 = new Web3('http://localhost:8545')
    kit = newKitFromWeb3(web3)
    await sleep(1)
  }

  describe('when running a network', () => {
    before(async function(this: any) {
      this.timeout(0) // Disable test timeout
      await restart1()
    })

    it('should get correct validator address using the precompile', async function(this: any) {
      this.timeout(0) // Disable test timeout
      await waitForBlock(web3, 350)

      info1 = await getSlashingInfo(web3, 340)

      const contract = await kit._web3Contracts.getElection()
      const validators = await kit._web3Contracts.getValidators()
      const addr = await contract.methods.validatorSignerAddressFromSet(0, 10).call()
      const blsPublicKey = await contract.methods.validatorBLSPublicKeyFromSet(0, 10).call()
      const compressed = await validators.methods.getValidatorBlsPublicKeyFromSigner(addr).call()
      const uncompressed = Buffer.from(
        [...Buffer.from(compressed.substr(2, 94), 'hex')].reverse()
      ).toString('hex')
      assert.equal(blsPublicKey.substr(36, 94), uncompressed)
    })
  })

  describe('test slashing for double signing with contractkit', () => {
    before(async function(this: any) {
      this.timeout(0) // Disable test timeout
      await restart2()
    })

    it('slash for double signing with contractkit', async function(this: any) {
      this.timeout(0) // Disable test timeout
      const slasher = await kit.contracts.getSnarkEpochDataSlasher()
      const slasher0 = await kit._web3Contracts.getSnarkEpochDataSlasher()
      const election = await kit.contracts.getElection()
      await waitForBlock(web3, 350)

      info2 = await getSlashingInfo(web3, 340)

      const signerIdx = 0
      const signer = await election.validatorSignerAddressFromSet(signerIdx, 200)

      const lockedGold = await kit.contracts.getLockedGold()
      const validator = (await kit.web3.eth.getAccounts())[0]
      await kit.web3.eth.personal.unlockAccount(validator, '', 1000000)

      const header = await infoToData(slasher0, info1)
      const other = await infoToData(slasher0, info2)

      const tx = await slasher.slashSigner(signer, header, other)
      const txResult = await tx.send({ from: validator, gas: 5000000 })
      const txRcpt = await txResult.waitReceipt()
      assert.equal(txRcpt.status, true)

      // Penalty is defined to be 9000 cGLD in migrations, locked gold is 10000 cGLD for a validator, so after slashing locked gold is 1000cGld
      // Gets also two rewards, so the eventual balance is 3000 cGLD
      const balance = await lockedGold.getAccountTotalLockedGold(signer)
      assert.equal(balance.toString(10), '3000000000000000000000')
    })
  })
})
