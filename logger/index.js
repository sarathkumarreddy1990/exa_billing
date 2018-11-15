const ln = require('ln')
    , path = require('path')
    , moment = require('moment');

const getFilePath = () => {
    const logPath = path.join(__dirname, '../../log');
    return `[${logPath}/exa-billing.]YYMMDD[.log]`;
};

/**
 * Formatter options
 * n: name of the logger
 * h: hostname
 * p: process id
 * v: version of the format
 * t: timestamp in UTC
 * l: level
 * m: message
 * j: json
 */
const getFormatter = (json) => {
    return `${json.p} ${moment(json.t).format()} ${ln.LEVEL[json.l]} ${json.m} ${json.j ? JSON.stringify(json.j) : ''}\r`;
};

const appenders = [{
    'type': 'file',
    'isUTC': true,
    'path': getFilePath(),
    'formatter': (json) => getFormatter(json)
}, {
    'type': 'console',
    //'formatter': (json) => getFormatter(json)
}];

const log = new ln({
    'name': 'exa-billing',
    'appenders': appenders
});

// log.info('Log files goes here', { 'a': 10 });
log.info(getFilePath());

log.logInfo = log.info;

module.exports = log;
