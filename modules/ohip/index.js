const {
    chunk,
    reduce,
} = require('lodash');
const sprintf = require('sprintf');

// this is the high-level business logic and algorithms for OHIP
//  * use cases are defined here

const EBSConnector = require('./ebs');
const {

    MAX_DOWNLOADS_PER_REQUEST,

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


const getRandomResponseCode = (codes) => {
    return codes[Math.floor(Math.random()*codes.length)];
};

const getRandomValidHealthNumberResponseCode = () => {
    return getRandomResponseCode([50, 51, 52, 53, 54, 55]);
};

/**
 * const getResourceIDs - description
 *
 * @param  {type} resourceResult description
 * @return {type}                description
 */
const getResourceIDs = (resourceResult) => {

    const {
        auditID,
        responses,
    } = resourceResult;

    return responses.reduce((result, response) => {

        if (response.code === 'IEDTS0001') {
            result.push(response.resourceID);
        }
        else {
            // console.log(response);
            // TODO this needs to be logged and handled
            //  * update status codes in database
            //  * do we keep the file around?
            //  *
        }

        return result;
    }, []);
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

        const {
            resourceType,
        } = args;

        const ebs = new EBSConnector(await getConfig());

        await ebs.list({resourceType}, async (listErr, listResponse) => {

            if (listErr) {
                await billingApi.storeFile({filename:'listResponse-error.txt', data: JSON.stringify(downloadResponse)});
                return callback(listErr, null);
            }
            else {
                await billingApi.storeFile({filename:'listResponse.txt', data: JSON.stringify(listResponse)});
            }

            const allResourceIDs = listResponse.data.map((detailResponse) => {
                return detailResponse.resourceID;
            });

            chunk(allResourceIDs, MAX_DOWNLOADS_PER_REQUEST).forEach(async (resourceIDs) => {

                await ebs.download({resourceIDs}, async (downloadErr, downloadResponse) => {

                    if (downloadErr) {
                        await billingApi.storeFile({filename:'downloadResponse-error.txt', data: JSON.stringify(downloadResponse)});
                        return callback(downloadErr, null);
                    }
                    else {
                        await billingApi.storeFile({filename:'downloadResponse.json', data: JSON.stringify(downloadResponse)});
                    }

                    const ediFiles = await downloadResponse.data.reduce(async (result, downloadData) => {
                        const d = await billingApi.storeFile({
                            data: downloadData.content,
                            filename: downloadData.description,
                        });
                        result.push(d);
                        return result;
                    }, []);

                    callback(null, ediFiles);
                });
            });
        });
    };


    /**
     * const upload - description
     *
     * @param  {type} args     description
     * @param  {type} callback description
     * @returns {type}          description
     */
    const upload = async (args, callback) => {

        const {
            uploads,
        } = args;

        const ebs = new EBSConnector(await getConfig());


        chunk(uploads, MAX_UPLOADS_PER_REQUEST).forEach((uploadBatch) => {
            ebs.upload({uploads:uploadsBatch}, async (uploadErr, uploadResponse) => {
                if (uploadErr) {
                    await billingApi.storeFile({filename:'uploadResponse-error.txt', data: JSON.stringify(uploadResponse)});
                    return callback(uploadErr, null);
                }
                else {
                    await billingApi.storeFile({filename:'uploadResponse.json', data: JSON.stringify(uploadResponse)});
                }

                // TODO set file statuses

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

        /**
         * submitClaims - generates claim submission files for the specified
         * array of claimIds and
         *
         * @param  {object} args    {
         *                              claimIds,
         *                          }
         *
         * @param  {function} callback standard callback
         */
        submitClaims: async (args, callback) => {

            // 1 - convert args.claimIds to claim data (getClaimsData)
            const claimData = await billingApi.getClaimsData({claimIds:[10,11,12,14,15]});
            // console.log(claimData);

            // 2 - run claim data through encoder
            // const claimEnc = new ClaimsEncoder(); // default 1:1/1:1
            const claimEnc = new ClaimsEncoder({batchesPerFile:5});
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
            // int: [{data:String, filename:String, batches:[batchSequenceNumber, claimIds:[Number]]}]
            // out [{data:String, filename:String, edi_file_id, file_store_id, absolutePath, batches: [batchSequenceNumber, claimIds:[Number]]}]
            const storedFiles = reduce(allFiles, async (storedResult, file) => {
                const storedFile = {
                    ...await billingApi.storeFile({createdDate: encoderContext.batchDate, ...file}),
                    ...file,
                };

                // TODO add edi_file_claims entry
                await billingApi.applyClaimSubmission(storedFile);

                (await storedResult).push(storedFile);
                return storedResult;
            }, []);
            // console.log('stored files: ', JSON.stringify((await storedFiles)));

            // 5 - generate EBS upload service paramaters
            //
            // in [{data:String, filename:String, edi_file_id, file_store_id, absolutePath, batches:[batchSequenceNumber,claimIds:[Number]]}]
            // >> [{resourceType:'CL', filename: (absolutePath), description: (filename)}]
            const uploadServiceParams = reduce((await storedFiles), (uploadedServiceResult, storedFile) => {
                uploadedServiceResult.push({
                    resourceType: 'CL',
                    filename: storedFile.absolutePath,
                    description: storedFile.filename,
                });
                return uploadedServiceResult;
            }, []);

            (await storedFiles).forEach((storedFile) => {
                storedFile.batches.forEach(async (batch) => {

                    await billingApi.updateClaimStatus({
                        claimIds: batch.claimIds,
                        claimStatusCode: 'PACK',

                    });

                });
            });

            callback(null, uploadServiceParams);

            // // // 6 - upload file to OHIP
            // const uploads = uploadServiceParams.slice(0, 1);    // TODO enable multi-file uploads in EBS module
            // ebs.upload({uploads}, (uploadErr, uploadResponse) => {
            //     billingApi.auditTransaction(uploadResponse.audit);
            //
            //     if (uploadErr) {
            //         console.log('error uploading: ', uploadErr);
            //         billingApi.updateFileStatus({edi_file_id, status: 'failure'});
            //         return callback(uploadErr, uploadResponse);
            //     }
            //     billingApi.updateFileStatus({edi_file_id, status: 'in_progress'});
            //
            //
            //     const resourceIDs = getResourceIDs(uploadResponse);
            //
            //     // 7 - submit file to OHIP
            //     return ebs.submit({resourceIDs}, (submitErr, submitResponse) => {
            //
            //         if (submitErr) {
            //             console.log('error submitting: ', submitErr);
            //             //      a. failure -> update file status ('error'), delete file from ohip
            //             billingApi.updateFileStatus({edi_file_id, status: 'failure'});
            //             return callback(submitErr, submitResponse);
            //         }
            //
            //         //      b. success -> update file status ('submitted'), proceed
            //         billingApi.updateFileStatus({edi_file_id, status: 'success'});
            //
            //         // TODO
            //         // 8 - check if response file exists yet
            //         //      a. yes -> apply response file
            //         // 9 - return callback
            //
            //         const resourceIDs = getResourceIDs(submitResponse);
            //
            //         return callback(null, submitResponse);
            //     });
            // });
        },

        fileManagement: async (args, callback) => {
            return callback(null, await billingApi.getFileManagementData());
        },

        sandbox: async (args, callback) => {

            // 1 - convert args.claimIds to claim data (getClaimsData)
            const claimData = await billingApi.getClaimsData({claimIds:[10,11,12,14,15]});
            // console.log(claimData);

            // 2 - run claim data through encoder
            const claimEnc = new ClaimsEncoder(); // default 1:1/1:1
            // const claimEnc = new ClaimsEncoder({batchesPerFile:5});
            // const claimEnc = new ClaimsEncoder({claimsPerBatch:5});

            const context = {
                batchDate: new Date(),  // TODO hard-code this to CT RA for demo
            };

            const submissionsByGroup = claimEnc.encode(claimData, context);

            // in: {'AZ12':[], 'BY23':[], ...}
            // out: [{batches:[], data:String, filename:String}]
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

            // [{batches:[], data:String, filename:String}]
            // >> [{batches:[], data:String, filename:String, edi_file_id, file_store_id, absolutePath}]
            const storedFiles = reduce(allFiles, async (storedResult, file) => {
                const storedFile = {
                    ...await billingApi.storeFile(file),
                    ...file,
                };

                // TODO add edi_file_claims entry
                await billingApi.applyClaimSubmission(storedFile);

                (await storedResult).push(storedFile);
                return storedResult;
            }, []);
            // console.log('stored files: ', JSON.stringify((await storedFiles)));

            // [{batches:[], data:String, filename:String, edi_file_id, file_store_id, absolutePath}]
            // >> [{resourceType:'CL', filename: (absolutePath), description: (filename)}]
            const uploadServiceParams = reduce((await storedFiles), (uploadedServiceResult, storedFile) => {
                uploadedServiceResult.push({
                    resourceType: 'CL',
                    filename: storedFile.absolutePath,
                    description: storedFile.filename,
                });
                return uploadedServiceResult;
            }, []);
            // console.log('uploaded service params: ', uploadServiceParams);

            return callback(null, allFiles);
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

            const ebs = new EBSConnector(await getConfig());

            download({resourceType:BATCH_EDIT}, (downloadErr, ediFiles) => {
                console.log(ediFiles);
                // console.log(`err: ${downloadErr}`);
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
                    await billingApi.applyBatchEditReport(download);
                });
            });

            download({resourceType:ERROR_REPORTS}, (downloadErr, downloadResponse) => {
                downloadResponse.forEach(async (download) => {
                    await billingApi.applyErrorReport(download);
                });
            });
        },


        // TODO: EXA-12016
        processResponseFiles,

        responseFilesRefresh: processResponseFiles,

        remittanceAdviceFilesRefresh: processResponseFiles,

        genericGovernanceReportsRefresh: processResponseFiles,

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
