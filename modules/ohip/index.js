const {
    chunk,
    reduce,
    groupBy,
    find,
} = require('lodash');
const sprintf = require('sprintf');
const path = require('path');
const logger = require('../../logger');

// this is the high-level business logic and algorithms for OHIP
//  * use cases are defined here

const EBSConnector = require('./ebs');
const {
    responseCodes,
    resourceTypes: {
        BATCH_EDIT,
        CLAIMS_MAIL_FILE_REJECT_MESSAGE,
        ERROR_REPORTS,
        REMITTANCE_ADVICE
    },
    services: {
        EDT_UPLOAD,
        EDT_SUBMIT,
        EDT_LIST,
        EDT_DOWNLOAD,
        EDT_INFO,
        EDT_UPDATE,
        EDT_DELETE,
        EDT_GET_TYPE_LIST,
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

    const isResourceResult = (service) => {
        return [EDT_UPLOAD, EDT_UPDATE, EDT_DELETE, EDT_SUBMIT].includes(service);
    };

    const isDetailResult = (service) => {
        return [EDT_INFO, EDT_LIST].includes(service);
    };

    const isDownloadResult = (service) => {
        return [EDT_DOWNLOAD].includes(service);
    };

    const isTypeListResult = (service) => {
        return [EDT_GET_TYPE_LIST].includes(service);
    }

    const getDataPlucker = (service) => {

        if (isDetailResult(service)|| isDownloadResult(service) || isTypeListResult(service)) {
            return (result) => {
                return result.data;
            }
        }
        else if (isResourceResult(service)) {
            return (result) => {
                return result.response;
            }
        }
        else {
            return null;
        }
    }

    const separateResults = (ebsResponse, service, responseCode) => {

        const dataPlucker = getDataPlucker(service);

        return reduce(ebsResponse.results, (results, result) => {
            const pluckedData = dataPlucker(result);
            if (pluckedData) {
                pluckedData.forEach((data) => {
                    if (data.code === responseCode) {
                        results[responseCode] = (results[responseCode] || []).concat(data);
                    }
                    else {
                        results['other'] = (results['other'] || []).concat(data);
                    }
                });
            }
            return results;
        }, {});
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

        const ebs = new EBSConnector(await billingApi.getOHIPConfiguration());

        ebs.list(args, async (listErr, listResponse) => {

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

            const separatedListResults = separateResults(listResponse, EDT_LIST, responseCodes.SUCCESS);
            const successfulListResults =  separatedListResults[responseCodes.SUCCESS];;

            if (successfulListResults) {

                const resourceIDs = successfulListResults.map((detailResponse) => {
                    return detailResponse.resourceID;
                });

                // TODO something with separatedListResults['other']

                ebs.download({resourceIDs}, async (downloadErr, downloadResponse) => {

                    if (downloadErr) {
                        await billingApi.storeFile({
                            filename:'downloadResponse-error.txt',
                            data: JSON.stringify(downloadResponse),
                            isTransient: true,
                        });
                        return callback(downloadErr, null);
                    }

                    const separatedDownloadResults = separateResults(downloadResponse, EDT_DOWNLOAD, responseCodes.SUCCESS);

                    const ediFiles = await separatedDownloadResults[responseCodes.SUCCESS].reduce(async (ediFilesResult, result) => {

                        const data = result.content;
                        const filename = result.description;

                        const files = await {
                            data,
                            filename,
                            ...(await billingApi.storeFile({
                                data,
                                filename,
                            })),
                        };

                        return (await ediFilesResult).concat(await files);
                    }, []);
                    callback(null, (await ediFiles));
                });
            }
            else {
                callback(null, []);
            }
        });
    };

    const downloadAckFile = (params, callback) => {

        const {
            resourceType,
            applicator,
        } = params;

        download({resourceType}, async (downloadErr, downloadResponse) => {

            (await downloadResponse).forEach(async (download) => {

                const {
                    filename,
                    data,
                } = (await download);

                // always an array
                const parsedResponseFile = new Parser(filename).parse(data);

                applicator({
                    responseFileId: download.edi_file_id,
                    parsedResponseFile,
                });
            });

            return callback(null, downloadResponse);

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

        }[(await billingApi.getOHIPConfiguration()).mode];
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
            const storedFiles = await reduce(allFiles, async (storedResult, file) => {
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


            // // 6 - upload file to OHIP
            const uploads = uploadServiceParams.slice(0, 1);    // TODO enable multi-file uploads in EBS module

            const ebs = new EBSConnector(await billingApi.getOHIPConfiguration());
            ebs.upload({uploads}, async (uploadErr, uploadResponse) => {


                const {
                    faults,
                    results,
                    auditInfo,
                } = uploadResponse;

                billingApi.auditTransaction(auditInfo);

                if (uploadErr) {
                    // billingApi.updateFileStatus({edi_file_id, status: 'failure'});
                    return callback(uploadErr, null);
                }

                // (await storedFiles).forEach((storedFile) => {
                //     billingApi.updateFileStatus({edi_file_id:storedFile.edi_file_id, status: 'in_progress'});
                // });

                if (faults.length) {
                    // TODO note various CT scenarios
                    return callback(null, uploadResponse);
                }

                const separatedUploadResults = separateResults(uploadResponse, EDT_UPLOAD, responseCodes.SUCCESS);
                const successfulUploadResults = (separatedUploadResults)[responseCodes.SUCCESS];

                // // mark files that were successfully uploaded to "in_progress" status
                if (!successfulUploadResults) {
                    return callback(null, separatedUploadResults);
                }

                billingApi.updateFileStatus({
                    status: 'in_progress',
                    files: successfulUploadResults.map((uploadResult) => {
                        return find((storedFiles), (storedFile) => {
                            return uploadResult.description === storedFile.filename;
                        });
                    }),
                });

                // TODO set file status for failed uploads (but not *all* failed uploads)
                // separatedUploadResults['other'] is an array of non-success results

                const resourceIDs = separatedUploadResults[responseCodes.SUCCESS].map((uploadResult) => {
                    return uploadResult.resourceID;
                });

                // // 7 - submit file to OHIP
                return ebs.submit({resourceIDs}, (submitErr, submitResponse) => {

                    const separatedSubmitResults = separateResults(submitResponse, EDT_SUBMIT, responseCodes.SUCCESS);
                    const successfulSubmitResults = separatedSubmitResults[responseCodes.SUCCESS];
                    if (submitErr) {
                        return callback(submitErr, submitResponse);
                    }

                    if (!successfulSubmitResults) {
                        return callback(null, separatedSubmitResults);
                    }

                    // mark files that were successfully submitted to "success" status
                    billingApi.updateFileStatus({
                        status: 'success',
                        files: successfulSubmitResults.map((submitResult) => {
                            return find((storedFiles), (storedFile) => {
                                return submitResult.description === storedFile.filename;
                            });
                        }),
                    });

                    storedFiles.forEach((storedFile) => {
                        storedFile.batches.forEach((batch) => {

                            billingApi.updateClaimStatus({
                                claimIds: batch.claimIds,
                                claimStatusCode: 'PACK',    // TODO use a constant
                            });

                        })
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

            downloadAckFile({
                resourceType: CLAIMS_MAIL_FILE_REJECT_MESSAGE,
                applicator: billingApi.applyRejectMessage
            }, (err, results) => {
                // TODO logging etc
            });

            downloadAckFile({
                resourceType: BATCH_EDIT,
                applicator: billingApi.applyBatchEditReport
            }, (err, results) => {
                // TODO logging etc
            });

            downloadAckFile({
                resourceType: ERROR_REPORTS,
                applicator: billingApi.applyErrorReport
            }, (err, results) => {
                // TODO logging etc
            });

            callback(null, {});
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
            const ebs = new EBSConnector(await billingApi.getOHIPConfiguration({hcv:true}));

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
            // console.log('healthNumber', healthNumber);

            if (isValid) {
                result.isValid = true
                ebs.validateHealthCard(args, (hcvErr, hcvResponse) => {
                    args.eligibility_response = hcvResponse;
                    billingApi.saveEligibilityLog(args);
                    return callback(null, hcvResponse);
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


        conformanceTesting: async (args, callback) => {
            const {
                muid,   // MoH User ID,
                service,
                description,
            } = args;

            const filenamesByFixtureId = {
                '1': 'Custom',
                '2': 'Claim_File.txt',
                '3': 'Stale_Dated_Claim_File.txt',
                '4': 'OBEC FILE.txt',
                '5': 'HCAU73.000',
            };

            if (service === 'upload') {
                const filestore =  await billingApi.getFileStore({filename: ''});
                const filePath = filestore.is_default ? 'OHIP' : '';

                const uploads = args.uploads.map((upload) => {
                    const filename = filenamesByFixtureId[upload.fixtureID];
                    const fullFixtureFilepath = path.join(filestore.root_directory, filePath, (filename === 'Custom') ? upload.description : filename );
                    return {
                        resourceType: upload.resourceType,
                        filename: fullFixtureFilepath,
                        description: upload.description || path.basename(filename),
                    };
                });
                args.uploads = uploads;
            }
            else if (service === 'update') {
                const filestore =  await billingApi.getFileStore({filename: ''});
                const filePath = filestore.is_default ? 'OHIP' : '';

                const updates = args.updates.map((update) => {
                    const filename = path.join(filestore.root_directory, filePath, filenamesByFixtureId[update.fixtureID]);
                    return {
                        filename,
                        resourceID: update.resourceID,
                    };
                });
                args.updates = updates;
            }

            args.unsafe = true;

            // we may add more functionality to EBS module one day,
            // no need to open ourselves up to vulnerabilities
            const validServices = ['upload', 'update', 'delete', 'submit', 'list', 'info', 'download', 'getTypeList'];
            if (!validServices.includes(service)) {
                // do error stuff
                return callback(null, {
                    problems: [
                        {
                            code: 'EXACT0001',  // 'EXA Conformance Testing 1' but 'exact' is cool ;)
                            msg: 'invalid conformance testing service',
                        }
                    ]
                });
            }
            const ebs = new EBSConnector(await billingApi.getOHIPConfiguration({muid}));
            ebs[service](args, (ebsErr, ebsResponse) => {
                ebsResponse.auditInfo.forEach((audit) => {
                    logger.info(audit);
                });
                return callback(ebsErr, ebsResponse);
            });
        },


    };
};
