const RemittanceAdviceDecoder = require('..');

const DefaultParser = function(options) {

    const remittanceAdvice = new RemittanceAdviceDecoder(options);

    const parserApi = {

        parseFileHeader: (obj) => {
            console.log(JSON.stringify(obj));
        },

        parseAddressOne: (obj) => {
            console.log(JSON.stringify(obj));
        },

        parseAddressTwo: (obj) => {
            console.log(JSON.stringify(obj));
        },

        parseClaimHeader: (obj) => {
            console.log(JSON.stringify(obj));
        },

        parseClaimItem: (obj) => {
            console.log(JSON.stringify(obj));
        },

        parseBalanceForward: (obj) => {
            console.log(JSON.stringify(obj));
        },

        parseAccountingTransaction: (obj) => {
            console.log(JSON.stringify(obj));
        },

        parseMessageFacility: (obj) => {
            console.log(JSON.stringify(obj));
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

            records = dataStr.split('\n');

            return records.reduce((batchResult, recordStr) => {

                remittanceAdvice.decode(recordStr, parserApi);

                return batchResult;
            }, []);
        }
    };
};
module.exports = DefaultParser;
