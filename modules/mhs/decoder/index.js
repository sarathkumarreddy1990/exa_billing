const _ = require('lodash');
const logger = require('../../../logger');
const util = require('./utils');
const recordFields = require('./recordFields');

const parser = {

    /**
     * Function used to parse the payment file from MHSAL
     * @param fileData
     */
    processFile: (fileContent) => {
        logger.logInfo('Initialize payment file parsing...');
        let result = {
            processedSociologicalRecord: {
                details: []
            },
            processedServiceRecord: {
                services: []
            },
            pendingSociologicalRecord: {
                details: []
            },
            pendingServiceRecord: {
                services: []
            }
        };
        let record = fileContent.split('\n');

        /**
         * Parse Information in the file using record code
         * 0 - Header, 
         * 2 - Processed sociological record, 
         * 3 - Processed service record,
         * 5 - Pending Sociological record,
         * 6 - Pending Service record,
         * 9 - Trailer
         */
        _.forEach(record, (data) => {
            let recordCode = data.charAt(0); //get Record code

            try {
                if (data && data.trim().length) {
                    switch (recordCode) {
                        case '0':
                            result.fileExchangeHeader = util.parseRecord(data, recordFields.fileExchangeHeader);
                            break;
                        case '2':
                            result.processedSociologicalRecord.recordCode = recordCode;
                            result.processedSociologicalRecord.details.push(util.parseRecord(data, recordFields.processedSociologicalRecord));
                            break;
                        case '3':
                            result.processedServiceRecord.recordCode = recordCode;
                            result.processedServiceRecord.services.push(util.parseRecord(data, recordFields.processedServiceRecord));
                            break;
                        case '5':
                            result.pendingSociologicalRecord.recordCode = recordCode;
                            result.pendingSociologicalRecord.details.push(util.parseRecord(data, recordFields.pendingSociologicalRecord));
                            break;
                        case '6':
                            result.pendingServiceRecord.recordCode = recordCode;
                            result.pendingServiceRecord.services.push(util.parseRecord(data, recordFields.pendingServiceRecord));
                            break;
                        case '9':
                            result.fileExchangeTrailer = util.parseRecord(data, recordFields.fileExchangeTrailer);
                            break;
                    }
                }
            }
            catch (err) {
                logger.error(`Error occured in file parsing '${err}'`);
                return err;
            }

        });

        return result;
    }
};

module.exports = parser;
