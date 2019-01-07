const {
    parseRecord,
    getOrCreateArray,
} = require('../utils');

const claimHeader1Fields = require('./claimHeader1Fields');
const claimHeader2Fields = require('./claimHeader2Fields');
const explanationCodeMessageFields = require('./explanationCodeMessageFields');
const headerFields = require('./headerFields');
const itemFields = require('./itemFields');
const trailerRecordFields = require('./trailerRecordFields');

const defaultParser = (recordStr, context) => {
    console.log(`Parser could not be determined for record type: '${recordStr.charAt(2)}'`);
    console.log(`'${recordStr}'`);
    console.log(`context: '${JSON.stringify(context)}'`);
};

/**
 * getErrorCodes - returns each of 'errorCode1' through 'errorCode5' for the
 * specified parse object as a new array.
 *
 * @param  {object} parseObj an object returned by parseRecord
 * @return {array}           an array of error codes
 */
const getErrorCodes = (parseObj) => {
    // copy the error codes into the error code array
    const errorCodes = [];
    for (let i = 1; i <= 5; i++) {
        let errorCode = (parseObj[`errorCode${i}`] || '').trim();
        if (errorCode) {
            errorCodes.push(errorCode);
        }
    }
    return errorCodes;
};

const validateRecordCount = (recordType, expected, actual) => {
    if (expected !== actual) {
        console.log(`Parsed ${actual} ${recordType} records, but Error Report indicates there should be ${expected}.`);
        // TODO this should be noted in the EXA Audit Log and potentially the MoH Audit Log
    }
};

const ErrorReportParser = function(options) {

    this.options = options || {};

    const createNewContext = () => {
        return {
            header1Count: 0,
            header2Count: 0,
            itemCount: 0,
            messageCount: 0,
        };
    };

    const recordParsersByType = {

        /**
         * 'HX1' record parser - parses an Error Report 'HX1' record.
         *
         * @param  {string} recordStr a single 79-character Error Report record
         *                            that begins with 'HX1'
         * @return {type}             description
         */
        [headerFields.recordIdentifier.constant]: (recordStr, context) => {
            const parseObj = parseRecord(recordStr, headerFields);
            context.currentLicense = {
                groupNumber: parseObj.groupNumber,
                providerNumber: parseObj.providerNumber,
                specialtyCode: parseObj.specialtyCode,
                operatorNumber: parseObj.operatorNumber,
                claimProcessDate: parseObj.claimProcessDate,
            }
        },

        /**
         * 'HXH' record parser - parses an Error Report 'HX1' record.
         *
         * @param  {string} recordStr a single 79-character Error Report record
         *                            that begins with 'HXH'
         * @return {type}             description
         */
        [claimHeader1Fields.recordIdentifier.constant]: (recordStr, context) => {
            const parseObj = parseRecord(recordStr, claimHeader1Fields);
            context.currentClaim = {
                healthNumber: parseObj.healthNumber,
                versionCode: parseObj.versionCode,
                patientDateOfBirth: parseObj.patientDateOfBirth,
                accountingNumber: parseObj.accountingNumber,
                paymentProgram: parseObj.paymentProgram,
                payee: parseObj.payee,
                referringProviderNumber: parseObj.referringProviderNumber,
                masterNumber: parseObj.masterNumber,
                patientAdmissionDate: parseObj.patientAdmissionDate,
                referringLabLicense: parseObj.referringLabLicense,
                serviceLocationIndicator: parseObj.serviceLocationIndicator,
                errorCodes: getErrorCodes(parseObj)
            };
            getOrCreateArray(context.currentLicense, 'claims').push(context.currentClaim);
            context.header1Count++;
        },

        /**
         * 'HXR' record parser - parses an Error Report 'HX9' record.
         *
         * @param  {string} recordStr a single 79-character Error Report record
         *                            that begins with 'HXR'
         * @return {type}             description
         */
        [claimHeader2Fields.recordIdentifier.constant]: (recordStr, context) => {
            const parseObj = parseRecord(recordStr, claimHeader2Fields);
            const currentClaim = context.currentClaim;

            currentClaim.registrationNumber = parseObj.registrationNumber;
            currentClaim.patientLastName = parseObj.patientLastName;
            currentClaim.patientFirstName = parseObj.patientFirstName;
            currentClaim.patientSex = parseObj.patientSex;
            currentClaim.provinceCode = parseObj.provinceCode;

            context.header2Count++;
        },

        /**
         * 'HXT' record parser - parses an Error Report 'HX9' record.
         *
         * @param  {string} recordStr a single 79-character Error Report record
         *                            that begins with 'HXT'
         * @return {type}             description
         */
        [itemFields.recordIdentifier.constant]: (recordStr, context) => {
            const parseObj = parseRecord(recordStr, itemFields);

            // parse the static fields
            context.currentClaimItem = {
                serviceCode: parseObj.serviceCode,
                feeSubmitted: parseObj.feeSubmitted,    // parseMoney
                numberOfServices: parseObj.numberOfServices,
                serviceDate: parseObj.serviceDate,
                diagnosticCode: parseObj.diagnosticCode,
                explanatoryCode: parseObj.explanatoryCode,
                errorCodes: getErrorCodes(parseObj)
            };

            getOrCreateArray(context.currentClaim, 'items').push(context.currentClaimItem);

            context.itemCount++;
        },

        /**
         * 'HX8' record parser - parses an Error Report 'HX9' record.
         *
         * @param  {string} recordStr a single 79-character Error Report record
         *                            that begins with 'HX8'
         * @return {type}             description
         */
        [explanationCodeMessageFields.recordIdentifier.constant]: (recordStr, context) => {
            const parseObj = parseRecord(recordStr, explanationCodeMessageFields);

            getOrCreateArray(context.currentClaimItem, 'explanations').push({
                explanatoryCode: parseObj.explanatoryCode,
                explanatoryDescription: parseObj.explanatoryDescription
            });

            context.messageCount++;
        },

        /**
         * 'HX9' record parser - parses an Error Report 'HX9' record.
         *
         * @param  {string} recordStr a single 79-character Error Report record
         *                            that begins with 'HX9'
         * @return {type}             description
         */
        [trailerRecordFields.recordIdentifier.constant]: (recordStr, context) => {
            const parseObj = parseRecord(recordStr, trailerRecordFields);

            validateRecordCount('HXH', parseObj.header1Count, context.header1Count);
            validateRecordCount('HXR', parseObj.header2Count, context.header2Count);
            validateRecordCount('HXT', parseObj.itemCount, context.itemCount);
            validateRecordCount('HX8', parseObj.messageCount, context.messageCount);

            context.trailerRecordEncountered = true;
        }

    };

    return {

        /*
        [
            {
                groupNumber: 'AU73',
                providerNumber: '123456',
                specialtyCode: '33',
                operatorNumber: 'AZ1234',
                claimProcessDate: "2018-12-31",
                claims: [
                    {
                        healthNumber: '1234567890',
                        versionCode: 3Y,
                        patientDateOfBirth: '1982-09-23',
                        accountingNumber: '12345678',
                        paymentProgram: 'HCP',
                        payee: '',
                        referringProviderNumber: '123456',
                        masterNumber": '1234',
                        patientAdmissionDate: '2018-11-30',
                        referringLabLicense: 'QZ42',
                        serviceLocationIndicator: 'B001',
                        errorCodes: ['C4Z', ...],
                        items: [
                            {
                                serviceCode: 'J139B',
                                feeSubmitted: 1234.56,    // parseMoney
                                numberOfServices: 99,
                                serviceDate: "2018-12-31",
                                diagnosticCode: 'ABCD',
                                explanatoryCode: 19,
                                errors: ['A7X','B7P'],
                                explanations: [
                                    {
                                        explanatoryCode: 17,
                                        explanatoryDescription: 'must have slipped my mind'
                                    }, // end explanation
                                    ...
                                ]
                            }, // end claim item
                            ...
                        ] // end items array
                    }, // end claim
                    ...
                ]// end claims
            }, // end license (group-provider-specialty)
            ...
        ] // end error report

        */
        parse: (dataStr) => {
            const records = dataStr.split('\n');
            let context = createNewContext();

            return records.reduce((errorReport, recordStr) => {

                if (recordStr) {
                    const recordType = recordStr.charAt(2);

                    // the record-parser that corresponds to the record type
                    const recordParser = recordParsersByType[recordType];

                    // parse the record
                    (recordParser || defaultParser)(recordStr, context);

                    // only push the current license
                    if (context.trailerRecordEncountered) {
                        errorReport.push(context.currentLicense);
                        context = createNewContext();
                    }
                }

                return errorReport;
            }, []);
        },
    };
};

module.exports = ErrorReportParser;
