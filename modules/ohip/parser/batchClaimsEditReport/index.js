/*
This is by far the stupidest of all the OHIP file formats. Here are the Notes
from page 6-10 in "Technical Specifications Interface to Health Care Systems."

NOTE 1
Batch edit reports for accepted batches which contain
both HCP/WCP and RMB claims will show three lines:
~ one line with HCP/WCB totals
~ one line with RMB totals
~ one line with batch totals

NOTE 2
Record count will be zeros if it is a sub-total record.

NOTE 3
When a batch has an error, two or more records will be produced. One record
for each error encountered will indicate an error message and the claim and
record counts pointing to the error position within the batch. The last
record will indicate ‘BATCH TOTALS’ with a count of the total claims and
total records within the batch.

Now, NOTE the field description for "Number of Claims" and "Edit Message:"
 ~ "Total number of claims in the batch as calculated by
   the ministry – see Note 1"
 ~ "‘BATCH TOTALS’ left justified in the field to indicate
   an accepted batch or blank if a sub-total line or ‘R’ at
   position 40 to indicate a rejected batch, preceded by a
   reason for the batch rejection – see Note 1 and Note 3"

NOTE the both Real World and Conformance Testing example of an Edit Message field
from BAAU73.295 (RW):     "     ***  BATCH TOTALS  ***             "
from BATCH EDIT.txt (CT): "     ***  BATCH TOTALS  ***             "
*/

const {
    parseRecord,
} = require('../utils');

const {
    getValue,
} = require('../fields');

const batchEditReportFields = require('./batchEditReportFields');

const getEditMessage = (recordStr)=> {
    return getValue(batchEditReportFields.editMessage, recordStr);
};
const getRecordCount = (recordStr)=> {
    // getValue will automatically determine from the field-type (Number of
    // Records) if the value should be parsed as a date, number, or text,
    // but in this case its more useful to override the default field type
    // (this is useful for NOTE 2)
    return parseInt(getValue(batchEditReportFields.numberOfRecords, recordStr));
};



const BatchClaimEditReportParser = function(options) {

    this.options = options || {

    };

    let currentBatch = null;

    const parseHCPWCPTotals = (recordStr) => {
        currentBatch.HCPWCPTotals = parseRecord(recordStr, batchEditReportFields);
    };

    const parseRMBTotals = (recordStr) => {
        currentBatch.RMBTotals = parseRecord(recordStr, batchEditReportFields);
    };

    const parseRejectedRecord = (recordStr) => {
        currentBatch.rejectedBatches.push(parseRecord(recordStr, batchEditReportFields));
    };

    const parseBatchTotalsRecord = (recordStr) => {
        currentBatch.batchTotals = parseRecord(recordStr, batchEditReportFields);
    };


    const isSubtotalLine = (recordStr) => {
        // console.log(`record count: ${getRecordCount(recordStr)}`);
        return getRecordCount(recordStr) === 0;
    };

    const isBatchRejected = (recordStr) => {
        return recordStr.charAt(82+40-1) === 'R';
    };

    const isBatchAccepted = (recordStr) => {
        const editMessage = getEditMessage(recordStr);
        return editMessage.indexOf('BATCH TOTALS') !== -1;
    };


    return {
        parse: (dataStr) => {

            const records = dataStr.split('\n');

            return records.reduce((result, recordStr) => {
                if (recordStr) {
                    const parseObj = parseRecord(recordStr, batchEditReportFields);
                    console.log(`parseObj: ${JSON.stringify(parseObj)}`);

                    console.log(`isSubtotalLine: ${isSubtotalLine(recordStr)}`);
                    console.log(`isBatchAccepted: ${isBatchAccepted(recordStr)}`);

                }
                return result;
            }, []);

        },
    };
};

module.exports = BatchClaimEditReportParser;
