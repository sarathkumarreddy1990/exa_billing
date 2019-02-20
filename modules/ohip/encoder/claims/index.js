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

const MAX_BATCH_SIZE = 100;

//
// DEFAULTS
//
const BATCHES_PER_FILE_DEFAULT = 1;
const CLAIMS_PER_BATCH_DEFAULT = 1;

module.exports = function(options) {
    // HGAU73.441
    //

    options = options || {};

    const batchesPerFile = options.batchesPerFile || BATCHES_PER_FILE_DEFAULT;
    const claimsPerBatch = options.claimsPerBatch || CLAIMS_PER_BATCH_DEFAULT;
    const claimsPerFile = claimsPerBatch * batchesPerFile;


    const batchHeader = new BatchHeaderEncoder(options);
    const claimHeader1 = new ClaimHeader1Encoder(options);
    const claimHeader2 = new ClaimHeader2Encoder(options);
    const item = new ItemEncoder(options);
    const batchTrailer = new BatchTrailerEncoder(options);

    //
    // [{
    //     "insuranceDetails": {
    //         "referringProviderNumber": null,
    //         "payee": "P",
    //         "accountingNumber": 12,
    //         "dateOfBirth": "1954-07-22",
    //         "registrationNumber": "9876543217",
    //         "patientFirstName": "William",
    //         "patientSex": "M",
    //         "paymentProgram": "RMB",
    //         "serviceLocationIndicator": "HOP",
    //         "provinceCode": null,
    //         "healthNumber": "9876543217",
    //         "masterNumber": "HOP",
    //         "patientLastName": "Burns",
    //         "versionCode": "OK"
    //     },
    //     "items": [
    //         {
    //             "feeSubmitted": "$37.25",
    //             "diagnosticcodes": null,
    //             "serviceDate": "2019-02-15T04:00:00-05:00",
    //             "serviceCode": "X009B",
    //             "numberOfServices": 1
    //         },
    //         {
    //             "feeSubmitted": "$16.40",
    //             "diagnosticcodes": null,
    //             "serviceDate": "2019-02-15T04:00:00-05:00",
    //             "serviceCode": "X009C",
    //             "numberOfServices": 1
    //         }
    //     ]
    // }]

    const encodeBatch = (batch, context) => {

        // console.log(JSON.stringify(batch));

        const {
            batchSequenceNumber,
        } = context;

        let rCount = 0;
        let hCount = 0;
        let tCount = 0;

        let batchStr = '';

        // BUILD BATCH RECORD

        // TODO ensure that specialtyCode is present

        // batchStr += batchHeader.encode(batch, context);

        batchStr+= JSON.stringify({
            batchSequenceNumber,
            claimIds: batch.map((b) => {
                return b.claim_id;
            }),
        });
        // batch.forEach((b) => {
        //     // console.log('claim: ', claim);
        //     const claim = b.claims[0];
        //     console.log(claim.insuranceDetails);
        //
        //     const header1 = claimHeader1.encode(claim.insuranceDetails, context);
        //     console.log(`HEADER 1: "${header1}"`);
        //     batchStr += header1;
        //     hCount++;
        //
        //     if (claim.paymentProgram === 'RMB') {
        //         batchStr += claimHeader2.encode(claim.insuranceDetails, context);
        //         rCount++;
        //     }
        //
        //     claim.items.forEach((claimItem) => {
        //         batchStr += item.encode(claimItem);
        //         tCount++;
        //     });
        // });

        // batchStr += batchTrailer.encode({
        //     hCount,
        //     rCount,
        //     tCount,
        // });

        return batchStr;
    };

    const encodeClaimFile = (fileBatches, context) => {
        // console.log('claimFile: ', context.batchSequenceNumber);
        // console.log('fileBatches: ', JSON.stringify(fileBatches, '\n\n'));
        // console.log('fileBatches.length: ', fileBatches.length);

        let data = '';

        const batches = reduce(fileBatches, (result, batch) => {
;
            data += encodeBatch(batch, {...context});

            result.push({
                batchSequenceNumber: context.batchSequenceNumber,
                claimIds: batch.map((claim) => {
                    // console.log(claim);
                    return claim.claim_id;
                }),
            });


            context.batchSequenceNumber++;

            return result;
        }, []);

        // console.log('file data: ', fileData);
        // console.log('batches: ', batches);

        return {
            data,
            batches,
        };

    };

    return {

        // {
        //      ((groupNumber)) : {
        //          ((providerNumber)) : {
        //              ((specialtyCode)) : {
        //                  claims: [],
        //              },
        //              ... other specialtyCodes
        //          },
        //          ... other provider numbers
        //      },
        //      ... other group numbers
        // }

        // {
        //      groupNumber: [
        //          {
        //              data,
        //              batches: [
        //                  {
        //                      batchSequenceNumber:Number,
        //                      claimsIds:[Number]
        //                  },
        //                  ...
        //              ],
        //          },
        //          ...
        //      ],
        //
        //      ...
        // }

        encode: (claimData, context) => {

            // build and return a map of files keyed by group
            return reduce(groupBy(claimData, 'groupNumber'), (groupResult, groupClaims, groupNumber)=> {

                groupResult[groupNumber] = []; // create an array for this group

                // get all the files for this billing number (group + provider number)
                const providerFiles = reduce(groupBy(groupClaims, 'providerNumber'), (providerResult, providerClaims, providerNumber) => {

                    // TODO use less files when possible (if claimsPerFile > providerClaims.length ...)

                    const claimsBySpecialtyCode = groupBy(providerClaims, 'specialtyCode');

                    // get all the files for this license# (provider number + specialty code)
                    const specialtyFiles = reduce(claimsBySpecialtyCode, (specialtyResult, specialtyClaims, specialtyCode) => {

                        // batch all the claims for this billing number / license number combo
                        const fileChunks = chunk(chunk(specialtyClaims, claimsPerBatch), batchesPerFile);

                        context.batchSequenceNumber = (context.batchSequenceNumber || 0);
                        // console.log('encoding specialty batch sequence #: ', context.batchSequenceNumber);

                        context.specialtyCode = specialtyCode;
                        // encode and add append the files to the specialty files
                        return specialtyResult.concat(fileChunks.map((fileChunk) => {
                            return encodeClaimFile(fileChunk, context);
                        }));

                    }, []);

                    // add the specialty files to the provider files
                    return providerResult.concat(specialtyFiles);
                }, []);

                // add the provider files to the group files
                groupResult[groupNumber] = groupResult[groupNumber].concat(providerFiles);
                return groupResult;
            }, {});
        },
    };
};
