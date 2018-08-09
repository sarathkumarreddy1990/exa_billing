const RemittanceAdviceDecoder = require('..');  // require previous module

/**
 * const Billing15Parser - description
 *
 * @param  {type} options description
 * @return {type}         description
 */
const Billing15Parser = function(options) {

    let currentBatch = null;
    let currentClaim = null;

    const remittanceAdvice = new RemittanceAdviceDecoder(options);

    const reset = () => {
        currentBatch = null;
        currentClaim = null;
    }

    const parserApi = {

        parseFileHeader: (obj) => {
            currentBatch = obj;
            currentClaim = null;
            return currentBatch;
        },

        parseAddressOne: (obj) => {
            currentBatch.addressOne = obj;
            return currentBatch;
        },

        parseAddressTwo: (obj) => {
            currentBatch.addressTwo = obj;
            return currentBatch;
        },

        parseClaimHeader: (obj) => {
            currentClaim = obj;
            (currentBatch.claims || (currentBatch.claims = [])).push(currentClaim);
            return currentClaim;
        },

        parseClaimItem: (obj) => {
            (currentClaim.items || (currentClaim.items = [])).push(obj);
            return currentClaim;
        },

        parseBalanceForward: (obj) => {
            currentBatch.balanceForward = obj;
            return currentBatch;
        },


        parseAccountingTransaction: (obj) => {
            (currentBatch.accountingTransaction || (currentBatch.accountingTransaction = [])).push(obj);
            return currentBatch;
        },

        parseMessageFacility: (obj) => {
            (currentBatch.messageFacility || (currentBatch.messageFacility = [])).push(obj);
            return currentBatch;
        },
    };

    return {

        /**
         * parse - description
         *
         * @param  {type} str description
         * @return {type}     description
         */
        parse: (dataStr) => {

            reset();

            records = dataStr.split('\n');


            return records.reduce((batchResult, recordStr) => {

                // console.log('Record String: ' + recordStr);
                const last = remittanceAdvice.decode(recordStr, parserApi);

                if (last === null) {
                    if (currentBatch) {
                        batchResult.push(currentBatch);
                    }
                    reset();
                }

                return batchResult;
            }, []);
        }
    }
};

module.exports = Billing15Parser;
