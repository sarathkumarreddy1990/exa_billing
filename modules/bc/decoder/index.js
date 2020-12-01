const _ = require('lodash');
const util = require('./utils');
const {
    getcasReasonGroupCodes
    } = require('./../../../server/data/era');

const recordSet = {
    'B14': {
        type: 'eligibility_response',
        name: 'batchEligibilityResponse',
        value: require('./batchEligibilityRequestReplyRecord')
    },
    'C12': {
        type: 'pre_edit_response',
        name: 'claimsRefusalRecords',
        value: require('./claimsRefusalRecord')
    },
    'M01': {
        type: 'msp_message',
        name: 'dataCentreMessageRecords',
        value: require('./dataCentreMessageRecord')
    },
    'X02': {
        type: 'patient_data',
        name: 'patientDemographicRecords',
        value: require('./patientDemographicRecord')
    },
    'S01': {
        type: 'remittance_advice',
        name: 'remittancePartialDetailRecords',
        value: require('./RemittanceCodes/remittancePartialDetailRecord')
    },
    'S00': {
        type: 'remittance_advice',
        name: 'remittanceWithDataCentreChangeRecords',
        value: require('./RemittanceCodes/remittanceFullDetailRecords')
    },
    'S02': {
        type: 'remittance_advice',
        name: 'remittanceWithExplanationRecords',
        value: require('./RemittanceCodes/remittanceFullDetailRecords')
    },
    'S03': {
        type: 'remittance_advice',
        name: 'remittanceWithAdjudicationRefusalRecords',
        value: require('./RemittanceCodes/remittanceFullDetailRecords')
    },
    'S04': {
        type: 'remittance_advice',
        name: 'inHoldProcessRecords',
        value: require('./RemittanceCodes/inHoldProcessRecord')
    },
    'S21': {
        type: 'remittance_summary',
        name: 'payeePaymentSummaryRecords',
        value: require('./RemittanceCodes/payeePaymentSummaryRecord')
    },
    'S22': {
        type: 'remittance_summary',
        name: 'practionerSummaryRecords',
        value: require('./RemittanceCodes/practitionerSummaryRecord')
    },
    'S23': {
        type: 'remittance_advice',
        name: 'adjustmentDetailRecords',
        value: require('./RemittanceCodes/adjustmentRecords')
    },
    'S24': {
        type: 'remittance_summary',
        name: 'adjustmentSummaryRecords',
        value: require('./RemittanceCodes/adjustmentRecords')
    },
    'S25': {
        type: 'remittance_comments',
        name: 'payeePractionerBroadCastRecords',
        value: require('./RemittanceCodes/payeePractitionerBroadcastRecord')
    },
    'VRC': {
        type: 'batch_trailer',
        name: 'batchTrailerRecords',
        value: require('./batchTrailerRecord')
    },
    'VTC': {
        type: 'file_trailer',
        name: 'fileTrailerRecords',
        value: require('./fileTrailerRecord')
    }
};

const parser = {

    /**
     * Function used to parse the payment file from BC
     * @param fileData
     * @param params
     */

    processFile: async (fileContent, params) => {
        let result = {};
        let records = fileContent.split('\n');
        const {rows} = await getcasReasonGroupCodes(params);
        const {
            cas_group_codes = [],
            cas_reason_codes = []
        } = rows && rows.length ? rows[0] : {};
        const msp_adj_group = _.filter(cas_group_codes, (obj) => obj.code === 'MSP_ADJ');
        const msp_exp_group = _.filter(cas_group_codes, (obj) => obj.code === 'MSP_EOB');

        for (let recordCode in recordSet) {
            let parserKeys = recordSet[recordCode];
            result[parserKeys.name] = [];
            let recordSegment = [];

            _.forEach(records, (record) => {
                if (recordCode === record.substring(0, 3)) {
                    let parsedData = util.parseRecord(record, parserKeys.value);
                    const casDetails = new Set();
                    const adjustmentDetails = new Set();
                    const adjustments = [];

                    if (['remittance_advice', 'pre_edit_response'].indexOf(parserKeys.type) !== -1) {
                        if (parsedData.eob) {

                            for (let i = 0; i < 14; i += 2) {
                                const code = parsedData.eob.slice(i, i + 2).trim();
                                const validReasonCodes = _.filter(cas_reason_codes, {code: code});

                                if (code) {
                                    casDetails.add({
                                        code,
                                        groupCode: 'MSP_EOB',
                                        group_code_id: msp_exp_group.length ? msp_exp_group[0].id : null,
                                        reason_code_id: validReasonCodes.length ? validReasonCodes[0].id : null,
                                        amount: 0
                                    });
                                }
                            }
                        }

                        parsedData.explanationCodes = Array.from(casDetails).map(obj => obj.code) || [];

                        for ( let i = 1; i <= 7; i++ ) {
                            const adjustmentCode = parsedData['adjustmentCode_' + i] || null;
                            const adjustmentAmount = parsedData['adjustmentAmount_' + i] || 0.00;
                            const validAdjustmentCodes = _.filter(cas_reason_codes, {code: adjustmentCode});

                            if (adjustmentCode) {
                                adjustments.push(adjustmentAmount);
                                adjustmentDetails.add({
                                    code: adjustmentCode,
                                    groupCode: 'MSP_ADJ',
                                    group_code_id: msp_adj_group.length ? msp_adj_group[0].id : null,
                                    reason_code_id: validAdjustmentCodes.length ? validAdjustmentCodes[0].id : null,
                                    amount: adjustmentAmount
                                });
                            }
                        }

                        parsedData.explanatoryDetails = [...casDetails, ...adjustmentDetails];
                        parsedData.totalAdjustmentAmount = adjustments.length ? _.sum(adjustments) : 0.00;
                    }

                    recordSegment.push(parsedData);
                }
            });


            // grouping the multiple reason codes of same charges using sequence_number
            _.forEach(recordSegment, (item) => {

                let matchedRecord = item.dataCentreNumber && item.dataCentreSequenceNumber ? result[parserKeys.name].find(data => data.dataCentreNumber === item.dataCentreNumber
                && data.dataCentreSequenceNumber === item.dataCentreSequenceNumber) : null;

                if (matchedRecord) {
                    matchedRecord.explanatoryCodes = matchedRecord.explanatoryCodes.concat(item.explanatoryCodes);
                    matchedRecord.explanatoryDetails = matchedRecord.explanatoryDetails.concat(item.explanatoryDetails);
                } else {
                    result[parserKeys.name].push(item);
                }
            });
        }

        result.remittanceFullDetailRecords = [
            ...result.remittanceWithDataCentreChangeRecords,
            ...result.remittanceWithAdjudicationRefusalRecords,
            ...result.remittanceWithExplanationRecords
        ];

        let notes = '';
        let paymentDate = null;
        let fileTrailerData = result.fileTrailerRecords.length  && result.fileTrailerRecords[0] || {};

        result.batchTrailerRecords.length && result.batchTrailerRecords.map(function (data) {
            notes += `VRC Count of ${data.remittanceRecordChar} remittance records transmitted on ${data.timestamp || ''} : ${data.totalRemittanceRecordCount} \n`;
        });

        if (fileTrailerData) {
            notes += `Total ${fileTrailerData.record_type_1 || 'S'} remittance records in file: ${fileTrailerData.record_type_1_count || 0} \n`;
            paymentDate = fileTrailerData.timestamp || null;
        }

        notes += `File Name: ${params.uploaded_file_name || ''}`;

        result.notes = notes;
        result.paymentDate = paymentDate;

        return result;
    }
};

module.exports = parser;
