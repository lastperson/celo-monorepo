import { flags } from '@oclif/command'
import { BigNumber } from 'bignumber.js'
import { BaseCommand } from '../../base'
import { displaySendTx } from '../../utils/cli'
import { Args, Flags } from '../../utils/command'

export default class MultiSigCall extends BaseCommand {
  static description =
    'Ability to make custom calls from multisig. Submit transaction or approve a matching existing transaction'

  static flags = {
    ...BaseCommand.flags,
    to: Flags.address({ required: true, description: 'Recipient of a call' }),
    amount: flags.string({ required: true, description: 'Amount of native CELO to transfer, e.g. 10e18' }),
    data: Flags.hexString({ description: 'Call input data' }),
    from: Flags.address({ required: true, description: 'account performing transaction' }),
  }

  static args = [Args.address('address')]

  static examples = [
    'call <multiSigAddr> --to 0x5409ed021d9299bf6814279a6a1411a7e866a631 --amount 200000e18 --data 0xd0e30db0 --from 0x123abc',
  ]

  async run() {
    const {
      args,
      flags: { to, amount, data, from },
    } = this.parse(MultiSigCall)
    const amountWei = (new BigNumber(amount)).toFixed(0)
    const multisig = await this.kit.contracts.getMultiSig(args.address)

    const callTx = {
      encodeABI: () => data || '0x'
    }
    const multiSigTx = await multisig.submitOrConfirmTransaction(to, callTx, amountWei)
    await displaySendTx<any>('submitOrApproveCall', multiSigTx, { from }, 'tx Sent')
  }
}
