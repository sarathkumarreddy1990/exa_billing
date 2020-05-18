const RemittanceAdviceParser = require('./utils');
const RemittanceAdviceFields = require('./claimItemFields');
const BatchBalanceFields = require('./batchBalanceFields');
const logger = require('./../../../logger');
const _ = require('lodash');

const Parser = {

    /***
     * {param} String Data need to parse
     * {Array} Returns array of parsed claim data
     */
    parseARDFile: (dataStr) => {

        let claims = [];
        const records = dataStr.split(/\n/gm);

        records.forEach((recordStr) => {

            try {
                /**
                 * Don't include the header, trailer or empty rows
                 */
                let value = recordStr.trim();
                if ( value && !/(HEADER|TRAILER)\s*$/i.test(value) && value.length === 234 ) {
                    const ardRecord = RemittanceAdviceParser.parseRecord(recordStr, RemittanceAdviceFields);
                    const codes = [];
                    if ( ardRecord.explanationCodes ) {
                        for ( let i = 0; i < ardRecord.explanationCodes.length; i += 5 ) {
                            const code = ardRecord.explanationCodes.slice(i, i + 5);
                            if ( code ) {
                                codes.push({"code": code, "amount": 0});
                            }
                        }
                        ardRecord.explanationCodes = codes || [];
                    }

                    ardRecord.explanationCodes = codes || [];

                    if ( ardRecord.feeModifiers ) {
                        const mods = [];
                        for ( let i = 0; i < ardRecord.feeModifiers.length; i += 6 ) {
                            const mod = ardRecord.feeModifiers.slice(i, i + 6);
                            if ( mod ) {
                                mods.push(mod);
                            }
                        }
                        ardRecord.feeModifiers = mods.join();
                    }

                    claims.push(ardRecord);
                }
            }
            catch (err) {
                logger.error(` Error occurred in file parsing '${err}'`);
            }
        });

        return claims;
    },

    /***
     * Below function used to parse segments and pushing segments into batches based on
     * Customer submitter Prefix, Current year, Submitter Sequence #, start Seq #, End Seq #
     * {param} string - Segment string from batch balance File
     * {param} ARRAY - Parsed Batch Information
     */
    parseSegment: (segmentStr, batch) => {
        let segment = RemittanceAdviceParser.parseRecord(segmentStr, BatchBalanceFields.segmentConfig);

        let {
            submitterPrefix,
            serviceProviderNumber,
            sequenceNumber,
            currentYear
        } = segment;

        let batchInfo = _.find(batch, (_ele) => {
            let {
                startSubmitterPrefix,
                startCurrentYear,
                startServiceProviderNumber,
                startSequenceNumber,
                endSequenceNumber
            } = _ele;

            return (startCurrentYear == currentYear &&
                startSubmitterPrefix == submitterPrefix &&
                startServiceProviderNumber == serviceProviderNumber &&
                (sequenceNumber >= startSequenceNumber && sequenceNumber <= endSequenceNumber)
            )
        });

        batchInfo.segments.push(segment);
    },

    /***
     * Below function used to parse Batch Balance File
     * Identify batch row based on Submitter Prefix (i.e first 3 charecter should match with configured customer Prefix)
     * {param} File data
     */
    parseBatchBalanceFile: (dataStr) => {
        let result = { batches: [] };
        let records = dataStr.split('\n');
        let segmentIndex;
        let isSegmentPresent;
        let customerPrefix = 'HYO' //To Do: Get submitter Prefix from Company settings

        /**
         * Parse Batch Informations based on First 3 character should match with customer prefix (eg: 'HYO')
         */
        _.forEach(records, (recordStr, index) => {
            try {

                /**Identifying Segments data based More data follows segment */
                if (recordStr.indexOf('More data follows') > -1) {
                    isSegmentPresent = recordStr.charAt(36) === 'Y';
                    segmentIndex = index;
                    return false;
                }

                /**Matching customer prefix to identify batch row */
                if (recordStr.trim().length && recordStr.substring(0, 3) == customerPrefix) {
                    let batch = RemittanceAdviceParser.parseRecord(recordStr, BatchBalanceFields.batchConfig);
                    batch.segments = [];
                    result.batches.push(batch);
                }
            }
            catch (err) {
                logger.error(` Error occured in file parsing '${err}'`);
            }
        });

        /** Parsing segments, header and trailer based on Segment code (2-Header, 3-Segments, 4-Trailer)*/
        if (isSegmentPresent && segmentIndex > -1) {
            let segmentData = records.splice(segmentIndex, records.length);

            _.forEach(segmentData, (data) => {
                switch (data.charAt(0)) {
                    case '2':
                        result.headerRecord = RemittanceAdviceParser.parseRecord(data, BatchBalanceFields.headerConfig);
                        break;
                    case '3':
                        Parser.parseSegment(data, result.batches);
                        break;
                    case '4':
                        result.trailerRecord = RemittanceAdviceParser.parseRecord(data, BatchBalanceFields.trailerConfig);
                        break;
                }
            });
        }

        return result;
    }
};

module.exports = Parser;
