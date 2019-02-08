const constants = require('../constants').encoder;
const util = require('./util');

const BatchHeaderEncoder = require('./batchHeaderEncoder');
const ClaimHeader1Encoder = require('./claimHeader1Encoder');
const ClaimHeader2Encoder = require('./claimHeader2Encoder');
const ItemEncoder = require('./itemEncoder');
const BatchTrailerEncoder = require('./batchTrailerEncoder');

/**
 * const OHIPEncoderV03 - Encodes one EXA claim submission according to the
 * OHIP v3 technical specification. The options provide the data extraction
 * implementation (the only option at this time is the JSONExtractorBilling15).
 *
 * @param  {type} options encoder options
 * @return {type}         an encoder with an encode(data)
 */
const ClaimSubmissionEncoderV03 = function(options) {
    options = options || {

    };

    const batchHeader = new BatchHeaderEncoder(options);
    const claimHeader1 = new ClaimHeader1Encoder(options);
    const claimHeader2 = new ClaimHeader2Encoder(options);
    const item = new ItemEncoder(options);
    const batchTrailer = new BatchTrailerEncoder(options);

    return {
        getFilename: (batchData, context) => {

            let filename = 'H';
            filename += util.getMonthCode(context.batchDate);
            filename += batchData.groupNumber;
            filename += '.';
            filename += context.batchSequenceNumber;

            return filename;
        },

        encode: (batchData, context) => {
            let rCount = 0;
            let hCount = 0;
            let tCount = 0;

            let claimSubmissionStr = '';

            // BUILD BATCH RECORD
            claimSubmissionStr += batchHeader.encode(batchData, context);

            batchData.claims.forEach((claim) => {

                claimSubmissionStr += claimHeader1.encode(claim, context);
                hCount++;

                if (claim.paymentProgram === 'RMB') {
                    claimSubmissionStr += claimHeader2.encode(claim, context);
                }

                claim.items.forEach((claimItem) => {
                    claimSubmissionStr += item.encode(claimItem);
                    tCount++;
                });
            });

            claimSubmissionStr += batchTrailer.encode({
                hCount,
                rCount,
                tCount
            });

            return claimSubmissionStr + constants.endOfBatch;
        }
    };
};

module.exports = ClaimSubmissionEncoderV03;
