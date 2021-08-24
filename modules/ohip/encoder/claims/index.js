const {
    chunk,
    groupBy,
    reduce,
} = require('lodash');

const constants = require('./../../constants').encoder;
const util = require('./../util');
const data = require('../../../../server/data/ohip');
const logger = require('../../../../logger');

const BatchHeaderEncoder = require('./batchHeaderEncoder');
const ClaimHeader1Encoder = require('./claimHeader1Encoder');
const ClaimHeader2Encoder = require('./claimHeader2Encoder');
const ItemEncoder = require('./itemEncoder');
const BatchTrailerEncoder = require('./batchTrailerEncoder');

const CLAIMS_PER_BATCH_DEFAULT = 500;   // suggested "manageable size" mentioned in Interface to Health Care Systems Technical Specifications 6-5
const CLAIMS_PER_BATCH_MAX = 10000;
const BATCHES_PER_FILE_DEFAULT = 1;
const BATCHES_PER_FILE_MAX = 10000;
const BATCH_SEQUENCE_NUMBER_START_DEFAULT = 0;

const specilityMapping = {
    991000: 90,
    599993: 27
};

const getOption = (value, defaultValue, maxValue) => {

    if (value === 'max') {
        return maxValue;
    }
    try {
        return maxValue
            ? Math.min(parseInt(value || defaultValue), maxValue)
            : parseInt(value || defaultValue);
    }
    catch (e) {
        // TODO log info
        return defaultValue;
    }
};

module.exports = function (options) {

    options = options || {};

    const claimsPerBatch = getOption(options.claimsPerBatch, CLAIMS_PER_BATCH_DEFAULT, CLAIMS_PER_BATCH_MAX);
    const batchesPerFile = getOption(options.batchesPerFile, BATCHES_PER_FILE_DEFAULT, BATCHES_PER_FILE_MAX);
    const batchSequenceNumberStart = getOption(options.batchSequenceNumber, BATCH_SEQUENCE_NUMBER_START_DEFAULT);

    const batchHeader = new BatchHeaderEncoder(options);
    const claimHeader1 = new ClaimHeader1Encoder(options);
    const claimHeader2 = new ClaimHeader2Encoder(options);
    const item = new ItemEncoder(options);
    const batchTrailer = new BatchTrailerEncoder(options);

    /**
     * const encodeBatch - encodes one batch of claims.
     *
     * @param  {array} batch    an array of claims
     * @param  {object} context description an object with information about the
     * @returns {string}        the string contents of an encoded batch
     */
    const encodeBatch = (batch, context, batchHeaderData) => {

        let rCount = 0;
        let hCount = 0;
        let tCount = 0;

        let batchStr = '';

        batchStr += batchHeader.encode(batch, context, batchHeaderData);

        batch.forEach((claim) => {
            claim = { ...claim, ...claim.insurance_details };
            const header1 = claimHeader1.encode(claim, context);
            batchStr += header1;
            hCount++;

            if (claim.insurance_details.paymentProgram === 'RMB') {
                batchStr += claimHeader2.encode(claim, context);
                rCount++;
            }

            claim.items.forEach((claimItem) => {
                batchStr += item.encode(claimItem);
                tCount++;
            });
        });

        batchStr += batchTrailer.encode({
            hCount,
            rCount,
            tCount,
        });

        return batchStr;
    };

    /**
     * const encodeClaimFile - encodes an array of batches.
     *
     * @param  {array} fileBatches an array of batches to be encoded in one file
     * @param  {object} context     description
     * @returns {object} an object with the encoded file data and batch tracking information
     *       {
     *           data: String,
     *           batches: [
     *               {
     *                   batchSequenceNumber: Number,
     *                   claimsIds: [Number, Number, Number...]
     *               },
     *               ...
     *           ],
     *       },
     */
    const encodeClaimFile = (fileBatches, context, batchHeader) => {

        let data = '';

        const batches = reduce(fileBatches, (result, batch) => {

            data += encodeBatch(batch, context, batchHeader);

            result.push({
                batchSequenceNumber: context.batchSequenceNumber,
                providerNumber: context.providerNumber,
                claimIds: batch.map((claim) => {
                    return claim.claim_id;
                }),
            });

            context.batchSequenceNumber++;

            return result;
        }, []);

        return {
            data,
            batches,
        };
    };

    const getSequenceNumber = async (reference, providerNumber, groupNumber, specialityCode) => {
        let sequenceNumber = '';
        let findNumber = [providerNumber, groupNumber, specialityCode].join('~')

        if (reference[findNumber]) {
            sequenceNumber = reference[findNumber]++;
        }
        else {
            try {
                const { sequence_number } = await data.getSequenceNumber(providerNumber, groupNumber, specialityCode)
                reference[findNumber] = sequence_number;
                return sequence_number;
            }
            catch (e) {
                logger.logError(`Error occurred while fetching sequence number ${e}`);
            }
        }
    };

    return {

        encodeV1: async (claimData, context) => {

            let encodedData = [];

            try {

                const sequenceNumberRef = {};

                return await reduce(groupBy(claimData, 'claim_type'), async (groupResult, groupClaims, claim_type) => {

                    logger.logInfo('claim type received...', claim_type);

                    await reduce(groupBy(groupClaims, 'rendering_provider_contact_id'), async (providerResult, providerClaims, rendering_provider_contact_id) => {

                        logger.logInfo('Provider contact id received...', rendering_provider_contact_id);

                        let providerNumber = providerClaims && providerClaims[0].providerNumber;
                        let providerSpeciality = specilityMapping[providerNumber] || providerClaims[0].defaultSpecialtyCode;

                        await reduce(groupBy(providerClaims, 'claim_facility_id'), async (facilityResult, facilityClaims, claim_facility_id) => {

                            logger.logInfo('Received claims of facility...', claim_facility_id);

                            let groupNumber = facilityClaims && facilityClaims[0].groupNumber;
                            let professionalGroupNumber = facilityClaims && facilityClaims[0].professionalGroupNumber;

                            const batches = chunk(facilityClaims, claimsPerBatch || CLAIMS_PER_BATCH_MAX);

                            const fileChunks = chunk(batches, batchesPerFile || BATCHES_PER_FILE_MAX);

                            //Finding Group Number based on Workflow
                            let derivedGroupNumber = '';
                            let derivedMOHId = '';

                            if (claim_type == 'technical') {
                                derivedGroupNumber = groupNumber;
                                derivedMOHId = ['27', '76', '85', '90'].includes(providerSpeciality)
                                    ? groupNumber
                                    : providerNumber;
                            }
                            else if (claim_type == 'professional_provider') {
                                if (['27', '76', '85', '90'].includes(providerSpeciality)) {
                                    derivedGroupNumber = '0000' || groupNumber;
                                    derivedMOHId = professionalGroupNumber;
                                }
                                else {
                                    derivedGroupNumber = professionalGroupNumber || '0000';
                                    derivedMOHId = providerNumber;
                                }
                            }
                            else if (claim_type == 'professional_facility') {
                                if (['27', '76', '85', '90'].includes(providerSpeciality)) {
                                    derivedGroupNumber = '0000' || groupNumber;
                                    derivedMOHId = professionalGroupNumber;
                                }
                                else {
                                    derivedGroupNumber = professionalGroupNumber || '0000';
                                    derivedMOHId = professionalGroupNumber || providerNumber;
                                }
                            }

                            const sequence_number = await getSequenceNumber(sequenceNumberRef, providerNumber, derivedGroupNumber, providerSpeciality)

                            let claimIds = facilityClaims.map((claim) => {
                                return claim.claim_id
                            });

                            let batchHeader = {
                                claim_type,
                                claim_facility_id,
                                rendering_provider_contact_id,
                                providerNumber,
                                derivedGroupNumber,
                                groupNumber,
                                professionalGroupNumber,
                                providerSpeciality,
                                batchSequenceNumber: util.formatAlphanumeric(sequence_number, 4, '0'),
                                derivedMOHId,
                                claimIds
                            }

                            let file_data = fileChunks.map((fileChunk) => {
                                return encodeClaimFile(fileChunk, context, batchHeader);
                            });

                            encodedData.push({
                                file_data,
                                ...batchHeader
                            })

                        }, []);

                    }, []);

                    return encodedData;

                }, {});
            }
            catch (e) {
                logger.logError('Error occured while file/claim encoding', e);
            }
        },

        encode: (claimData, context) => {

            // build and return a map of files keyed by group
            return reduce(groupBy(claimData, 'groupNumber'), (groupResult, groupClaims, groupNumber) => {

                context.groupNumber = groupNumber;
                groupResult[groupNumber] = []; // create an array for this group

                // get all the files for this billing number (group + provider number)
                // const groupProviderFiles = reduce(groupBy(groupClaims, 'providerNumber'), (providerResult, providerClaims, providerNumber) => {

                // TODO use less files when possible (if claimsPerFile > providerClaims.length ...)

                const claimsBySpecialtyCode = groupBy(groupClaims, 'specialtyCode');

                // get all the files for this license# (provider number + specialty code)
                const providerSpecialtyFiles = reduce(claimsBySpecialtyCode, (specialtyResult, specialtyClaims, specialtyCode) => {

                    context.specialtyCode = specialtyCode;

                    // batch all the claims for this billing number / license number combo

                    // specialtyBatches is an array of all batches (arrays of claims) for this specialty
                    // example (when claimsPerBatch == 2):
                    // specialtyBatches = [[claim1, claim2], [claim3, claim4], [claim5, claim6], [claim7, claim8], ...]
                    const specialtyBatches = chunk(specialtyClaims, claimsPerBatch || CLAIMS_PER_BATCH_MAX);

                    // fileChunks is an array of all files (arrays of arrays of claims) for this specialty
                    // example (when batchesPerFile == 3):
                    // fileChunks = [[[claim1, claim2], [claim3, claim4], [claim5, claim6]], [[claim7, claim8], ...], ...]
                    const fileChunks = chunk(specialtyBatches, batchesPerFile || BATCHES_PER_FILE_MAX);

                    // reset batchSequenceNumber
                    context.batchSequenceNumber = batchSequenceNumberStart;
                    context.providerNumber = specialtyClaims[0].providerNumber;

                    // add the encoded Claims Files for this specialty to the the array of Claims Files for the current Provider
                    return specialtyResult.concat(fileChunks.map((fileChunk) => {
                        return encodeClaimFile(fileChunk, context);
                    }));

                }, []);

                // add the encoded Claims Files for the current Provider to the array of Claims Files for the current Group
                // providerResult.concat(providerSpecialtyFiles);
                // }, []);

                // add the provider files to the group files
                groupResult[groupNumber] = groupResult[groupNumber].concat(providerSpecialtyFiles);
                return groupResult;
            }, {});
        },
    };
};
