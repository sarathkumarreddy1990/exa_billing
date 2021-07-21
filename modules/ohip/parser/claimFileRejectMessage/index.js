const {
    parseRecord,
} = require('../utils');

const rejectMessageRecord1Fields = require('./rejectMessageRecord1Fields');
const rejectMessageRecord2Fields = require('./rejectMessageRecord2Fields');

const ClaimFileRejectMessageParser = function(options) {

    this.options = options || {};

    return {
        parse: (dataStr) => {
            const records = dataStr.split('\n');
            return {
                // the Claim File Reject Message is very simple:
                // there is one of each type of record per message
                rejectMessageRecord1: parseRecord(records[0], rejectMessageRecord1Fields),
                rejectMessageRecord2: parseRecord(records[1], rejectMessageRecord2Fields),
            };
        },
    };
};

module.exports = ClaimFileRejectMessageParser;
