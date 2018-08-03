const constants = require('../constants').records.remittanceAdvice;

const MessageFacilityDecoder = function(options) {

    const getTransactionIdentifier = () => {
        return 'HR';    // Always 'HR'
    };

    const getRecordType = () => {
        return '8';
    }

    const getMessageTest = (data) => {
        return data.substr(3, 70);
    };

    const getReservedForMOHUse = (data) => {
        return data.substr(73, 6);
    };


    return {
        decode: (messageFacilityStr, parser) => {
            return parser.parseMessageFacility({
                messageText: getMessageTest(messageFacilityStr)
            });
        }
    };
};

module.exports = MessageFacilityDecoder;
