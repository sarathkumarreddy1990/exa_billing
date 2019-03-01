const {
    chunk,
    reduce,
    groupBy,
    find,
} = require('lodash');
const sprintf = require('sprintf');

// this is the high-level business logic and algorithms for OHIP
//  * use cases are defined here

const EBSConnector = require('./ebs');
const {

    resourceTypes: {
        BATCH_EDIT,
        CLAIMS_MAIL_FILE_REJECT_MESSAGE,
        ERROR_REPORTS,
        REMITTANCE_ADVICE
    },
} = require('./constants');

const {
    getMonthCode,
} = require('./utils');



const ClaimsEncoder = require('./encoder/claims');
const mod10Check = require('./hcv/mod10Check');
const Parser = require('./parser');
const validateClaimsData = require('../../server/data/claim/claim-workbench');
const _ = require('lodash');


const getRandomResponseCode = (codes) => {
    return codes[Math.floor(Math.random()*codes.length)];
};

const getRandomValidHealthNumberResponseCode = () => {
    return getRandomResponseCode([50, 51, 52, 53, 54, 55]);
};

/**
 * const getClaimSubmissionFilename - description
 *
 * @param  {type} args description
 * @returns {type}      description
 */
const getClaimSubmissionFilename = (args) => {

    const {
        groupNumber,
        fileSequenceOffset,
    } = args;

    const NOT_GOOD = fileSequenceOffset;
    const fileSequence = sprintf(`%'03s`, NOT_GOOD);
    return `H${getMonthCode(new Date())}${groupNumber}.${fileSequence}`;
};



/**
 * module - creates a new OHIP module
 *
 * @param  {type} billingApi provides a high level billing API for this module
 * @return {type}            description
 */
module.exports = function(billingApi) {

    //
    // ************************** PRIVATE **************************************
    //

    let ohipConfig = null;
    const getConfig = async () => {
        if (!ohipConfig) {
            ohipConfig = await billingApi.getOHIPConfiguration();
        }
        return ohipConfig;
    };

    /**
     * const download - downloads the available resources which match the
     * specified resourceType. When the downloads succeed, then an array of
     * file information objects is passed to the callback. Example:
     *     [
     *        {
     *            file_store_id: Number,
     *            edi_file_id: Number,
     *            absolutePath: String,
     *        },
     *        // ...
     *     ]
     *
     * @param  {object} args    {
     *                              resourceType: String
     *                          }
     * @param  {function} callback  standard callback mechanism;
     */
    const download = async (args, callback) => {

        const ebs = new EBSConnector(await getConfig());

        await ebs.list(args, async (listErr, listResponse) => {

            if (listErr) {
                await billingApi.storeFile({
                    filename:'listResponse-error.txt',
                    data: JSON.stringify(listResponse),
                    isTransient: true,
                });
                return callback(listErr, null);
            }
            else {
                await billingApi.storeFile({
                    filename:'listResponse.txt',
                    data: JSON.stringify(listResponse),
                    isTransient: true,
                });
            }

            const resourceIDs = listResponse.data.map((detailResponse) => {
                return detailResponse.resourceID;
            });

            await ebs.download({resourceIDs}, async (downloadErr, downloadResponse) => {

                if (downloadErr) {
                    await billingApi.storeFile({
                        filename:'downloadResponse-error.txt',
                        data: JSON.stringify(downloadResponse),
                        isTransient: true,
                    });
                    return callback(downloadErr, null);
                }

                downloadResponse.results.forEach((result) => {

                    result.data.forEach((download) => {
                        billingApi.storeFile({
                            filename: download.description,
                            data: download.content,
                        });
                    });
                });

                const ediFiles = await downloadResponse.results.reduce(async (ediFilesResult, result) => {
                    const files = result.data.map(async (d) => {
                        const data = d.content;
                        const filename = d.description;
                        return {
                            data,
                            filename,
                            ...await billingApi.storeFile({
                                data,
                                filename,
                            }),
                        };
                    });

                    return ediFilesResult.concat(await files);
                }, []);

                callback(null, ediFiles);
            });

        });
    };

    /**
     * const createEncoderContext - description
     *
     * @param  {type} args description
     * @returns {type}      description
     */
    const createEncoderContext = async () => {

        return {
            [billingApi.OHIP_CONFIGURATION_MODE.CONFORMANCE_TESTING]: {
                batchDate: new Date(),
            },
            [billingApi.OHIP_CONFIGURATION_MODE.DEMO]: {
                batchDate: new Date('2012-03-31'),
                batchSequenceNumber: 5, // matches OHIP Batch Edit sample
            },

        }[(await getConfig()).mode];
    };



    //
    // *************************** PUBLIC **************************************
    //


    return {

        // takes an array of Claim IDs
        submitClaims: async (req, callback) => {
            let args = req.query;
            let params = req.body;

            let claimIds = params.claimIds.split(',');  // NOTE this will explode when 'All_Claims' are checked

            let validationData = await validateClaimsData.validateEDIClaimCreation(claimIds, req.session.country_alpha_3_code);
            validationData = validationData && validationData.rows && validationData.rows.length && validationData.rows[0] || [];
            let claimStatus = _.uniq(validationData.claim_status);
            // Claim validation
            if (validationData) {
                if (claimStatus.length != 1 && claimStatus[0] != 'PS') {
                    return new Error('Please validate claims');
                } else if (validationData.unique_billing_method_count > 1) {
                    return new Error('Please select claims with same type of billing method');
                } else if (validationData.claim_status.length != claimIds.length) {
                    return new Error('Claim date should not be greater than the current date');
                }
            }

            // 1 - convert args.claimIds to claim data (getClaimsData)
            const claimData = await billingApi.getClaimsData({claimIds});

            // 2 - run claim data through encoder
            const claimEnc = new ClaimsEncoder(); // default 1:1/1:1
            // const claimEnc = new ClaimsEncoder({batchesPerFile:5});
            // const claimEnc = new ClaimsEncoder({claimsPerBatch:5});
            const encoderContext = await createEncoderContext();
            const submissionsByGroup = claimEnc.encode(claimData, encoderContext);

            // 3 - manifest claim files
            //
            // in: {'AZ12':[submission...], 'BY23':[submission...], ...}
            // out: [{data:String, filename:String,batches:[batchSequenceNumber,claimIds:[Number]]}]
            const allFiles = reduce(submissionsByGroup, (result, groupSubmissions, groupNumber) => {

                // in: [{batches:[], data:String}]
                // out: [{batches:[], data:String, filename:String}]
                const groupFiles = groupSubmissions.map((file, fileSequenceOffset) => {
                    return {
                        filename: getClaimSubmissionFilename({groupNumber, fileSequenceOffset}),
                        ...file,
                    };
                });

                return result.concat(groupFiles);

            }, []);

            // 4 - store and register claim files
            //
            // in: [{data:String, filename:String, batches:[batchSequenceNumber, claimIds:[Number]]}]
            // out [{data:String, filename:String, edi_file_id, file_store_id, absolutePath, batches: [batchSequenceNumber, claimIds:[Number]]}]
            const storedFiles = reduce(allFiles, async (storedResult, file) => {
                const storedFile = {
                    ...await billingApi.storeFile({
                        createdDate: encoderContext.batchDate,
                        ...file
                    }),
                    ...file,
                };

                // TODO add edi_file_claims entry
                await billingApi.applyClaimSubmission(storedFile);

                (await storedResult).push(storedFile);
                return storedResult;
            }, []);

            // 5 - generate EBS upload service paramaters
            //
            // in [{data:String, filename:String, edi_file_id, file_store_id, absolutePath, batches:[batchSequenceNumber,claimIds:[Number]]}]
            // >> [{resourceType:'CL', filename: (absolutePath), description: (filename)}]
            const uploadServiceParams = reduce((await storedFiles), (result, storedFile) => {
                result.push({
                    resourceType: 'CL',
                    filename: storedFile.absolutePath,
                    description: storedFile.filename,
                });
                return result;
            }, []);

            (await storedFiles).forEach((storedFile) => {

                billingApi.updateFileStatus({edi_file_id:storedFile.edi_file_id, status: 'success'});

                storedFile.batches.forEach(async (batch) => {
                        await billingApi.updateClaimStatus({
                        claimIds: batch.claimIds,
                        claimStatusCode: 'PACK',    // TODO use a constant
                    });
                });
            });

            // // 6 - upload file to OHIP
            const uploads = uploadServiceParams.slice(0, 1);    // TODO enable multi-file uploads in EBS module

            const ebs = new EBSConnector(await getConfig());
            ebs.upload({uploads}, async (uploadErr, uploadResponse) => {

                billingApi.auditTransaction(uploadResponse.auditInfo);

                if (uploadErr) {
                    billingApi.updateFileStatus({edi_file_id, status: 'failure'});
                    return callback(uploadErr, uploadResponse);
                }

                const uploadResultsByStatusCode = groupBy(uploadResponse.results, 'code');

                // mark files that were successfully uploaded to "in_progress" status
                billingApi.updateFileStatus({
                    status: 'in_progress',
                    files: await uploadResultsByStatusCode['IEDTS0001'].map(async (uploadResult) => {
                        return find((await storedFiles), (storedFile) => {
                            return uploadResult.description === storedFile.filename;
                        });
                    }),
                });

                const resourceIDs = uploadResultsByStatusCode['IEDTS0001'].map((uploadResult) => {
                    return uploadResult.resourceID;
                });

                // 7 - submit file to OHIP
                return ebs.submit({resourceIDs}, (submitErr, submitResponse) => {

                    if (submitErr) {
                        //      a. failure -> update file status ('error'), delete file from ohip
                        billingApi.updateFileStatus({
                            status: 'failed',
                            files: uploadResultsByStatusCode['IEDTS0001'].map(async (uploadResult) => {
                                return find((await storedFiles), (storedFile) => {
                                    return uploadResult.description === storedFile.filename;
                                });
                            }),
                        });
                        return callback(submitErr, submitResponse);
                    }

                    // mark files that were successfully uploaded to "in_progress" status
                    billingApi.updateFileStatus({
                        status: 'success',
                        files: uploadResultsByStatusCode['IEDTS0001'].map(async (uploadResult) => {
                            return find((await storedFiles), (storedFile) => {
                                return uploadResult.description === storedFile.filename;
                            });
                        }),
                    });

                    return callback(null, submitResponse);
                });
            });
        },

        fileManagement: async (args, callback) => {
            return callback(null, await billingApi.getFileManagementData(args));
        },

        /**
         * downloadRemittanceAdvice - description
         *
         * @param  {type} args     description
         * @param  {type} callback description
         * @returns {type}          description
         */
        downloadRemittanceAdvice: async (args, callback) => {
            download({resourceType:REMITTANCE_ADVICE}, (downloadErr, ediFiles) => {
                return callback(downloadErr, ediFiles);
            });
        },




        // TODO: EXA-12016
        downloadAndProcessResponseFiles: async (args, callback) => {

            // TODO: "zero results" yields an error at the encryption level

            // download({resourceType: CLAIMS_MAIL_FILE_REJECT_MESSAGE}, (downloadErr, downloadResponse) => {
            //     downloadResponse.forEach(async (download) => {
            //         await billingApi.applyRejectMessage(download);
            //     });
            // });

            download({resourceType:BATCH_EDIT}, (downloadErr, downloadResponse) => {
                downloadResponse.forEach(async (download) => {

                    const {
                        filename,
                        data,
                    } = (await download);

                    const decodedBatchEdit = new Parser(filename).parse(data);

                    await billingApi.applyBatchEditReport({
                        responseFileId: download.edi_file_id,
                        ...decodedBatchEdit[0],
                    });

                    return callback(null, 'batch edit reports downloaded');
                });
            });

            download({resourceType:ERROR_REPORTS}, (downloadErr, downloadResponse) => {
                downloadResponse.forEach(async (download) => {
                    await billingApi.applyErrorReport(download);
                });
            });
        },


        // TODO: EXA-12016
        // processResponseFiles,
        //
        // responseFilesRefresh: processResponseFiles,
        //
        // remittanceAdviceFilesRefresh: processResponseFiles,
        //
        // genericGovernanceReportsRefresh: processResponseFiles,

        validateHealthCard: async (args, callback) => {
            const ebs = new EBSConnector(await getConfig());

            /* This is stub/mock functionality for the Health Card Validation
             * endpoint. Theory of operation: for the sake of the demo, an
             * arbitrary 10-digit health number and two character version code is
             * specified. If the version code is "OK" and the health number is
             * exactly 10 digits, then "isValid:true" is returned. For any other
             * conditition, "isValid:false" is returned.
             */
            const {
                healthNumber,
                versionCode,
            } = args;

            let result = {
                isValid: false,
            };

            const isValid = mod10Check.isValidHealthNumber(healthNumber)

            if (isValid) {
                result.isValid = true
                ebs.hcvValidation(args, (hcvErr, hcvResponse) => {
                    console.log(hcvResponse);
                    return callback(hcvResponse);
                });
            }
            else {
                result.isValid = false;
                return callback({ isValid: false, errMsg: "Invalid Heath card number" });
            }
        },

        applyRemittanceAdvice: async (args, callback) => {
            const f_c = await billingApi.loadFile(args);
            if(f_c.data){
                const parser = new Parser(f_c.uploaded_file_name)
                f_c.ra_json = parser.parse(f_c.data);
                let response =  await billingApi.handlePayment(f_c, args);
                return callback(response)
            }
            callback(f_c)
        },
    };
};
