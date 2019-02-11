const RemittanceAdviceParser = require('./remittanceAdvice');
const ClaimFileRejectMessageParser = require('./claimFileRejectMessage');
const BatchClaimsEditReportParser = require('./batchClaimsEditReport');
const ErrorReportParser = require('./errorReport');
const OBECResponseParser = require('./obec');

const {
    getType,
} = require('./utils');

const parserImpl = {
    'P': RemittanceAdviceParser,
    'X': ClaimFileRejectMessageParser,
    'B': BatchClaimsEditReportParser,
    'E': ErrorReportParser,
    'F': ErrorReportParser,
    'R': OBECResponseParser,
};

const Parser = function(filename, options) {

    const impl = parserImpl[getFileType(filename)];

    if (!impl) {
        console.log('Could not determine which parser implementation to use');
        return null;
    }

    return (impl && new impl(options));
};

module.exports = Parser;
