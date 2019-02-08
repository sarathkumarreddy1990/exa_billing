const RemittanceAdviceParser = require('./remittanceAdvice');
const ClaimFileRejectMessageParser = require('./claimFileRejectMessage');
const BatchClaimsEditReportParser = require('./batchClaimsEditReport');
const ErrorReportParser = require('./errorReport');

const {
    getType,
} = require('./utils');

const parserImpl = {
    'P': RemittanceAdviceParser,
    'X': ClaimFileRejectMessageParser,
    'B': BatchClaimsEditReportParser,
    'E': ErrorReportParser,
    'F': ErrorReportParser,
};

const Parser = function(filename, options) {

    const impl = parserImpl[getType(filename)];

    if (!impl) {
        console.log('Could not determine which parser implementation to use');
        return null;
    }

    return (impl && new impl(options));
};

module.exports = Parser;
