const {
    chunk,
    groupBy,
    reduce,
} = require('lodash');

const constants = require('./../../constants').encoder;
const util = require('./../util');

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
    const encodeBatch = (batch, context) => {

        let rCount = 0;
        let hCount = 0;
        let tCount = 0;

        let batchStr = '';

        batchStr += batchHeader.encode(batch, context);

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
    const encodeClaimFile = (fileBatches, context) => {

        let data = '';

        const batches = reduce(fileBatches, (result, batch) => {

            data += encodeBatch(batch, context);

            result.push({
                batchSequenceNumber: context.batchSequenceNumber,
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

    return {

        encode: (claimData, context) => {

            // build and return a map of files keyed by group
            return reduce(groupBy(claimData, 'groupNumber'), (groupResult, groupClaims, groupNumber) => {

                context.groupNumber = groupNumber;
                groupResult[groupNumber] = []; // create an array for this group

                // get all the files for this billing number (group + provider number)
                const groupProviderFiles = reduce(groupBy(groupClaims, 'providerNumber'), (providerResult, providerClaims, providerNumber) => {

                    context.providerNumber = providerNumber;

                    // TODO use less files when possible (if claimsPerFile > providerClaims.length ...)

                    const claimsBySpecialtyCode = groupBy(providerClaims, 'specialtyCode');

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

                        // add the encoded Claims Files for this specialty to the the array of Claims Files for the current Provider
                        return specialtyResult.concat(fileChunks.map((fileChunk) => {
                            return encodeClaimFile(fileChunk, context);
                        }));

                    }, []);

                    // add the encoded Claims Files for the current Provider to the array of Claims Files for the current Group
                    return providerResult.concat(providerSpecialtyFiles);
                }, []);

                // add the provider files to the group files
                groupResult[groupNumber] = groupResult[groupNumber].concat(groupProviderFiles);
                return groupResult;
            }, {});
        },
    };
};
