const path = require('path');

const {
    resourceTypes: {
        CLAIMS_MAIL_FILE_REJECT_MESSAGE,
    },
} = require('./../constants');

const {
    formatDate,
    formatAlphanumeric,
    formatTime,
} = require('./../../encoder/util');

const {
    getMonthCode,
    getResourceFilename,
} = require('./../../utils');

const record1Fields = require('../../parser/claimFileRejectMessage/rejectMessageRecord1Fields');
const record2Fields = require('../../parser/claimFileRejectMessage/rejectMessageRecord2Fields');

let nextRejectMessageFileSequenceNumber = 0;


module.exports = (resource, processDate) => {

    params = {
        // recordImage: "HEBV03 201904280001000000AU7301221033",    // 37 chars
        recordImage: resource.claimFileInfo.recordImage,

        // providerFileName: "HG123456.000",   // 12 chars
        providerFileName: path.basename(resource.filename),

        // mailFileDate: formatDate(new Date()),   // 8 chars
        mailFileDate: formatDate(processDate),

        // mailFileTime: "101000",   // 6 chars
        mailFileTime: formatTime(processDate),

        messageReason: "0123456789ABCDEF0123",  // 20 chars
        invalidRecordLength: "00004",    // 5 chars
        messageType: "???",    // 3 chars

        processDate: formatDate(processDate),    // 8 chars
    };

    const record1 = Object.keys(record1Fields).map((key) => {
        const fieldDescriptor = record1Fields[key];
        return formatAlphanumeric((fieldDescriptor.constant || params[key]), fieldDescriptor.fieldLength);
    }).join('');

    const record2 = Object.keys(record2Fields).map((key) => {
        const fieldDescriptor = record2Fields[key];
        return formatAlphanumeric((fieldDescriptor.constant || params[key]), fieldDescriptor.fieldLength);
    }).join('');

    return [{
        status: 'DOWNLOADABLE',
        content: [record1, record2].join('\n'),
        description: `X${getMonthCode(processDate)}${resource.claimFileInfo.groupNumber}.${formatAlphanumeric(nextRejectMessageFileSequenceNumber++, 3, '0')}`,
        resourceType: CLAIMS_MAIL_FILE_REJECT_MESSAGE,
        createTimestamp: processDate,
        modifyTimestamp: processDate,
    }];
};
