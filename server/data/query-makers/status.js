'use strict';

const regComma = /,/g;
const statusMap = new Map([
    ['ORDERED', 'ORD'],
    ['SCHEDULED', 'SCH'],
    ['CONFIRMED', 'CON'],
    ['CHECKEDIN', 'CHI'],
    ['CHECKEDOUT', 'CHO'],
    ['START', 'TS'],
    ['END', 'TE'],
    ['UNREAD', 'UNR'],
    ['READ', 'RE'],
    ['DICTATED', 'DIC'],
    ['DRAFT', 'DRFT'],
    ['TRANSCRIBED', 'TRAN'],
    ['APPROVED', 'APP'],
    ['PRE-APPROVED', 'PRAP'],
    ['QUEUED', 'QU'],
    ['IN-PROGRESS', 'IP'],
    ['FAILED', 'FA'],
    ['ERROR', 'ER'],
    ['COMPLETED', 'CO'],
    ['MANUAL EDIT', 'ME'],
    ['INCOMPLETE', 'INC'],
    ['REQUEUE', 'RQ'],
    ['ABORTED', 'ABRT'],
    ['CANCELLED', 'CAN'],
    ['NOSHOWS', 'NOS'],
    ['CONFLICTS', 'CX']
]);

const statusFromDesc = (fieldID, fieldValue) => {
    let statusQuery = '';
    let splitValues = fieldValue.split(regComma);
    let i = 0;
    const total = splitValues.length;
    let currentStatus = '';

    for (; i < total; ++i) {

        currentStatus = statusMap.get(splitValues[i]);

        if (statusQuery) {
            statusQuery += ' OR ';
        }

        if (currentStatus === 'INC') {
            statusQuery += ` ${fieldID} = 'TE' OR ${fieldID} = 'INC'`;
        }
        else if (currentStatus === 'TE') {
            statusQuery += ` ${fieldID} = 'TE' OR ${fieldID} = 'INC'`;
        }
        else if (currentStatus === 'QU') {
            statusQuery += ` ${fieldID} = 'QU' OR ${fieldID} = 'RQ'`;
        }
        else if (currentStatus === 'CX') {
            statusQuery += ` ${fieldID} = 'CX' OR ${fieldID} = 'MM'`;
        }
        else {
            statusQuery += ` ${fieldID} = '${currentStatus}'`;
        }
    }

    return statusQuery.length > 0 ? ` (${statusQuery})` : '';
};

const statusFromCode = (fieldID, fieldValue) => {
    let statusQuery = '';
    let i = 0;
    const total = fieldValue.length;
    let currentCode;

    for (; i < total; i++) {
        currentCode = fieldValue[i];

        if (statusQuery) {
            statusQuery += ' OR ';
        }

        if (currentCode === 'INC') {
            statusQuery += ` ${fieldID} = 'TE' OR ${fieldID} = 'INC'`;
        }
        else if (currentCode === 'TE') {
            statusQuery += ` ${fieldID} = 'TE' OR ${fieldID} = 'INC'`;
        }
        else if (currentCode === 'QU') {
            statusQuery += ` ${fieldID} = 'QU' OR ${fieldID} = 'RQ'`;
        }
        else if (currentCode === 'CHO') {
            statusQuery += ` ${fieldID} = 'CHO' OR orders.order_status = 'CHO'`;
        }
        else {
            statusQuery += ` ${fieldID} = '${currentCode}'`;
        }
    }

    return statusQuery.length > 0 ? ` (${statusQuery})` : '';
};

module.exports = (fieldID, fieldValue, { options }) =>
    options.isFrom === 'Studies' && options.statusCode && options.statusCode.length ? statusFromCode(fieldID, options.statusCode) : statusFromDesc(fieldID, fieldValue);
