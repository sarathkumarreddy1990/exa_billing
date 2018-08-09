const types = require('../constants').records.remittanceAdvice.types;

const FileHeaderDecoder = require('./fileHeaderDecoder');
const AddressOneDecoder = require('./addressOneDecoder');
const AddressTwoDecoder = require('./addressTwoDecoder');
const ClaimHeaderDecoder = require('./claimHeaderDecoder');
const ClaimItemDecoder = require('./claimItemDecoder');
const BalanceForwardDecoder = require('./balanceForwardDecoder');
const AccountingTransactionDecoder = require('./accountingTransactionDecoder');
const MessageFacilityDecoder = require('./messageFacilityDecoder');

const RemittanceAdviceDecoder = function(options) {

    this.options = options || {};

    const decoders = {
        [types.FILE_HEADER]: new FileHeaderDecoder(options),
        [types.ADDRESS_ONE]: new AddressOneDecoder(options),
        [types.ADDRESS_TWO]: new AddressTwoDecoder(options),
        [types.CLAIM_HEADER]: new ClaimHeaderDecoder(options),
        [types.CLAIM_ITEM]: new ClaimItemDecoder(options),
        [types.BALANCE_FORWARD]: new BalanceForwardDecoder(options),
        [types.ACCOUNTING_TRANSACTION]: new AccountingTransactionDecoder(options),
        [types.MESSAGE_FACILITY]: new MessageFacilityDecoder(options),

        [types.UNKNOWN]: {
            decode: (recordStr) => {
                if (recordStr && recordStr.length) {
                    // console.error('Unknown record type: ' + recordStr.substr(0, 3));
                    return options.endOnUknown? null : recordStr;
                }
                else {
                    return null;
                }
            }
        }
    };

    return {
        decode: (recordStr, parser) => {
            return (decoders[recordStr.charAt(2)] || decoders[types.UNKNOWN]).decode(recordStr, parser);
        }
    };
};

module.exports = RemittanceAdviceDecoder;
