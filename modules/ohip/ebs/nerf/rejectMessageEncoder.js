
const {
    formatDate,
    formatAlphanumeric,
} = require('../../encoder/util');


const record1Fields = require('../../parser/claimFileRejectMessage/rejectMessageRecord1Fields');
const record2Fields = require('../../parser/claimFileRejectMessage/rejectMessageRecord2Fields');

const sampleParams = {
    "messageReason": "0123456789ABCDEF0123",  // 20 chars
    "invalidRecordLength": "00004",    // 5 chars
    "messageType": "???",    // 3 chars
    "recordImage": "HEBV03 201904280001000000AU7301221033",    // 37 chars

    "providerFileName": "HG123456.000",   // 12 chars
    "mailFileDate": formatDate(new Date()),   // 8 chars
    "mailFileTime": "101000",   // 6 chars
    "processDate": formatDate(new Date()),    // 8 chars
};


// const record2 = Object.keys(record2Fields);



module.exports = (params) => {


    params = {
        // recordImage: "HEBV03 201904280001000000AU7301221033",    // 37 chars
        // providerFileName: "HG123456.000",   // 12 chars
        // mailFileDate: formatDate(new Date()),   // 8 chars
        // mailFileTime: "101000",   // 6 chars

        messageReason: "0123456789ABCDEF0123",  // 20 chars
        invalidRecordLength: "00004",    // 5 chars
        messageType: "???",    // 3 chars

        processDate: formatDate(new Date()),    // 8 chars
        ...params,
    };
    const paramKeys = Object.keys(params);

    const record1 = Object.keys(record1Fields).map((key) => {
        const fieldDescriptor = record1Fields[key];
        return formatAlphanumeric((fieldDescriptor.constant || params[key]), fieldDescriptor.fieldLength);
    }).join('');

    const record2 = Object.keys(record2Fields).map((key) => {
        const fieldDescriptor = record2Fields[key];
        return formatAlphanumeric((fieldDescriptor.constant || params[key]), fieldDescriptor.fieldLength);
    }).join('');

    return [record1, record2].join('\n');
};
