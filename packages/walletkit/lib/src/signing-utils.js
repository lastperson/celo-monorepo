"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var eth_lib_1 = require("eth-lib");
var lodash_1 = require("lodash");
var util = __importStar(require("util"));
var helpers = __importStar(require("web3-core-helpers"));
var utils = __importStar(require("web3-utils"));
var logger_1 = require("./logger");
var new_web3_utils_1 = require("./new-web3-utils");
// Original code taken from
// https://github.com/ethereum/web3.js/blob/1.x/packages/web3-eth-accounts/src/index.js
// Debug-mode only: Turn this on to verify that the signing key matches the sender
// before signing as well as the recovered signer matches the original signer.
var DEBUG_MODE_CHECK_SIGNER = false;
function isNot(value) {
    return lodash_1.isUndefined(value) || lodash_1.isNull(value);
}
function trimLeadingZero(hex) {
    while (hex && hex.startsWith('0x0')) {
        hex = '0x' + hex.slice(3);
    }
    return hex;
}
function makeEven(hex) {
    if (hex.length % 2 === 1) {
        hex = hex.replace('0x', '0x0');
    }
    return hex;
}
function ensureCorrectSigner(sender, privateKey) {
    if (DEBUG_MODE_CHECK_SIGNER) {
        logger_1.Logger.debug('signing-utils@ensureCorrectSigner', "Checking that sender (" + sender + ") and " + privateKey + " match...");
        var generatedAddress = new_web3_utils_1.getAccountAddressFromPrivateKey(privateKey);
        if (sender.toLowerCase() !== generatedAddress.toLowerCase()) {
            throw new Error("Address from private key: " + generatedAddress + ", " + ("address of sender " + sender));
        }
        logger_1.Logger.debug('signing-utils@ensureCorrectSigner', 'sender and private key match');
    }
}
function signTransaction(txn, privateKey) {
    return __awaiter(this, void 0, void 0, function () {
        var result, signed, chainId, gasPrice, nonce;
        return __generator(this, function (_a) {
            ensureCorrectSigner(txn.from, privateKey);
            logger_1.Logger.debug('SigningUtils@signTransaction', "Received " + util.inspect(txn));
            if (!txn) {
                throw new Error('No transaction object given!');
            }
            signed = function (tx) {
                if (isNot(tx.feeCurrency)) {
                    logger_1.Logger.info('SigningUtils@signTransaction', "Invalid transaction: fee currency is \"" + tx.feeCurrency + "\"");
                    throw new Error("Invalid transaction: Fee currency is \"" + tx.feeCurrency + "\"");
                }
                if (isNot(tx.gatewayFeeRecipient)) {
                    logger_1.Logger.info('SigningUtils@signTransaction', "Invalid transaction: Gateway fee recipient is \"" + tx.gatewayFeeRecipient + "\"");
                    throw new Error("Invalid transaction: Gateway fee recipient is \"" + tx.gatewayFeeRecipient + "\"");
                }
                if (isNot(tx.gatewayFee)) {
                    logger_1.Logger.info('SigningUtils@signTransaction', "Invalid transaction: Gateway fee value is \"" + tx.gatewayFee + "\"");
                    throw new Error("Invalid transaction: Gateway fee value is \"" + tx.gatewayFee + "\"");
                }
                if (!tx.gas && !tx.gasLimit) {
                    logger_1.Logger.info('SigningUtils@signTransaction', "Invalid transaction: Gas is \"" + tx.gas + "\" and gas limit is \"" + tx.gasLimit + "\"");
                    throw new Error('"gas" is missing');
                }
                if (tx.nonce < 0 || tx.gas < 0 || tx.gasPrice < 0 || tx.chainId < 0) {
                    logger_1.Logger.info('SigningUtils@signTransaction', 'Gas, gasPrice, nonce or chainId is lower than 0');
                    throw new Error('Gas, gasPrice, nonce or chainId is lower than 0');
                }
                try {
                    tx = helpers.formatters.inputCallFormatter(tx);
                    var transaction = tx;
                    transaction.to = tx.to || '0x';
                    transaction.data = tx.data || '0x';
                    transaction.value = tx.value || '0x';
                    transaction.chainId = utils.numberToHex(tx.chainId);
                    var rlpEncoded = eth_lib_1.RLP.encode([
                        eth_lib_1.bytes.fromNat(transaction.nonce),
                        eth_lib_1.bytes.fromNat(transaction.gasPrice),
                        eth_lib_1.bytes.fromNat(transaction.gas),
                        transaction.feeCurrency.toLowerCase(),
                        transaction.gatewayFeeRecipient.toLowerCase(),
                        eth_lib_1.bytes.fromNat(transaction.gatewayFee),
                        transaction.to.toLowerCase(),
                        eth_lib_1.bytes.fromNat(transaction.value),
                        transaction.data,
                        eth_lib_1.bytes.fromNat(transaction.chainId || '0x1'),
                        '0x',
                        '0x',
                    ]);
                    var hash = eth_lib_1.hash.keccak256(rlpEncoded);
                    var signature = eth_lib_1.account.makeSigner(eth_lib_1.nat.toNumber(transaction.chainId || '0x1') * 2 + 35)(eth_lib_1.hash.keccak256(rlpEncoded), privateKey);
                    var rawTx = eth_lib_1.RLP.decode(rlpEncoded)
                        .slice(0, 9)
                        .concat(eth_lib_1.account.decodeSignature(signature));
                    rawTx[9] = makeEven(trimLeadingZero(rawTx[9]));
                    rawTx[10] = makeEven(trimLeadingZero(rawTx[10]));
                    rawTx[11] = makeEven(trimLeadingZero(rawTx[11]));
                    var rawTransaction = eth_lib_1.RLP.encode(rawTx);
                    var values = eth_lib_1.RLP.decode(rawTransaction);
                    result = {
                        messageHash: hash,
                        v: trimLeadingZero(values[9]),
                        r: trimLeadingZero(values[10]),
                        s: trimLeadingZero(values[11]),
                        rawTransaction: rawTransaction,
                    };
                }
                catch (e) {
                    throw e;
                }
                if (DEBUG_MODE_CHECK_SIGNER) {
                    logger_1.Logger.debug('transaction-utils@getRawTransaction@Signing', "Signed result of \"" + util.inspect(tx) + "\" is \"" + util.inspect(result) + "\"");
                    var recoveredSigner = recoverTransaction(result.rawTransaction).toLowerCase();
                    if (recoveredSigner !== txn.from) {
                        throw new Error("transaction-utils@getRawTransaction@Signing: Signer mismatch " + recoveredSigner + " != " + txn.from + ", retrying...");
                    }
                    else {
                        logger_1.Logger.debug('transaction-utils@getRawTransaction@Signing', "Recovered signer is same as sender, code is working correctly: " + txn.from);
                    }
                }
                return result;
            };
            // Resolve immediately if nonce, chainId and price are provided
            if (txn.nonce !== undefined && txn.chainId !== undefined && txn.gasPrice !== undefined) {
                return [2 /*return*/, signed(txn)];
            }
            chainId = txn.chainId;
            gasPrice = txn.gasPrice;
            nonce = txn.nonce;
            if (isNot(chainId) || isNot(gasPrice) || isNot(nonce)) {
                throw new Error('One of the values "chainId", "gasPrice", or "nonce" couldn\'t be fetched: ' +
                    JSON.stringify({ chainId: chainId, gasPrice: gasPrice, nonce: nonce }));
            }
            return [2 /*return*/, signed(lodash_1.extend(txn, { chainId: chainId, gasPrice: gasPrice, nonce: nonce }))];
        });
    });
}
exports.signTransaction = signTransaction;
// Recover sender address from a raw transaction.
function recoverTransaction(rawTx) {
    var values = eth_lib_1.RLP.decode(rawTx);
    logger_1.Logger.debug('signing-utils@recoverTransaction', "Values are " + values);
    var signature = eth_lib_1.account.encodeSignature(values.slice(9, 12));
    var recovery = eth_lib_1.bytes.toNumber(values[9]);
    // tslint:disable-next-line:no-bitwise
    var extraData = recovery < 35 ? [] : [eth_lib_1.bytes.fromNumber((recovery - 35) >> 1), '0x', '0x'];
    var signingData = values.slice(0, 9).concat(extraData);
    var signingDataHex = eth_lib_1.RLP.encode(signingData);
    return eth_lib_1.account.recover(eth_lib_1.hash.keccak256(signingDataHex), signature);
}
exports.recoverTransaction = recoverTransaction;