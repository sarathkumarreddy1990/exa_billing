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
        CLAIMS,
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
        HCV_REAL_TIME,
    },
    CLAIM_STATUS_PENDING_ACKNOWLEDGMENT_DEFAULT,

} = require('./constants');

const {
    getMonthCode,
    // getNumberFromMoney,
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
        const ohipConfig = await billingApi.getOHIPConfiguration()
        const ebs = new EBSConnector(ohipConfig.ebsConfig);

        ebs[EDT_LIST](args, async (listErr, listResponse) => {

            if (listErr) {
                return callback(listErr, null);
            }

            const separatedListResults = separateResults(listResponse, EDT_LIST, responseCodes.SUCCESS);
            const successfulListResults =  separatedListResults[responseCodes.SUCCESS];;

            if (successfulListResults) {

                const resourceIDs = successfulListResults.map((detailResponse) => {
                    return detailResponse.resourceID;
                });

                // TODO something with separatedListResults['other']

                ebs[EDT_DOWNLOAD]({resourceIDs}, async (downloadErr, downloadResponse) => {

                    if (downloadErr) {
                        return callback(downloadErr, null);
                    }

                    const separatedDownloadResults = separateResults(downloadResponse, EDT_DOWNLOAD, responseCodes.SUCCESS);

                    const ediFiles = separatedDownloadResults[responseCodes.SUCCESS].map(async (result) => {

                        const data = result.content;
                        const filename = result.description;
                        const file = await billingApi.storeFile({
                            data,
                            filename,
                        });

                        return {
                            data,
                            filename,
                            ...file
                        };
                    });

                    callback(null, ediFiles);
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

            downloadResponse.forEach(async (download) => {

                const {
                    filename,
                    data,
                    edi_file_id: responseFileId,
                } = (await download);

                // always an array
                const parsedResponseFile = new Parser(filename).parse(data);

                applicator({
                    responseFileId,
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
            batchDate: new Date(),

            // NOTE uncomment for EBS conformance test environment e2e test
            // batchDate: new Date('2012-03-31'),
            // batchSequenceNumber: 5,
        };
    };



    //
    // *************************** PUBLIC **************************************
    //


    const downloadRemittanceAdvice = async ( args, callback ) => {
        download({ resourceType: REMITTANCE_ADVICE }, ( downloadErr, ediFiles ) => {
            return callback(downloadErr, ediFiles);
        });
    };

    const downloadAndProcessResponseFiles = async (args, callback) => {

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
    };

    return {

        // takes an array of Claim IDs
        submitClaims: async (req, callback) => {
            let args = req.query;
            let params = req.body;

            let claimIds = params.claimIds.split(',');

            let validationData = await validateClaimsData.validateEDIClaimCreation(claimIds);
            validationData = validationData && validationData.rows && validationData.rows.length && validationData.rows[0] || [];

            let claimStatus = _.without(_.uniq(validationData.claim_status), 'PS'); // (Pending Submission - PS) removed to check for other claim status availability
            // Claim validation
            if (validationData) {

                const validationResponse = {
                    validationMessages: [],
                };
                if (claimStatus.length) {
                    validationResponse.validationMessages.push('All claims must be validated before submission');
                }
                if (validationData.unique_billing_method_count > 1) {
                    validationResponse.validationMessages.push('Please select claims with same type of billing method');
                }
                if (validationData.invalid_claim_count > 0) {
                    validationResponse.validationMessages.push('Claim date should not be greater than the current date');
                }

                if (validationResponse.validationMessages.length) {
                    return callback(null, validationResponse);
                }
            }

            // 1 - convert args.claimIds to claim data (getClaimsData)
            const claimData = await billingApi.getClaimsData({claimIds});
            const validationMessages = claimData.reduce((validations, claim) => {
                const claimItems = claim.claims[0].items;
                if (!claimItems || !claimItems.length) {
                    validations.push(`Claim ${claim.claim_id} has no billable charges`);
                }
                // else {
                //
                //     const invalidClaimItems = claimItems.filter((item) => {
                //         console.log('Comparing money: ', getNumberFromMoney(item.feeSubmitted));
                //         return getNumberFromMoney(item.feeSubmitted) <= 0.00;
                //     });
                //     if (invalidClaimItems.length) {
                //         validations.push(`Claim ${claim.claim_id} has at least one invalid charge`);
                //     }
                // }
                return validations;
            }, []);
            if (validationMessages.length) {
                return callback(null, {validationMessages});
            }

            // 2 - run claim data through encoder
            const ohipConfig = await billingApi.getOHIPConfiguration();
            logger.debug('ohipConfig: ', ohipConfig);

            const claimEnc = new ClaimsEncoder(ohipConfig); // default 1:1/1:1
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
            const uploads = reduce((await storedFiles), (result, storedFile) => {
                result.push({
                    resourceType: CLAIMS,
                    filename: storedFile.absolutePath,
                    description: storedFile.filename,
                });
                return result;
            }, []);



            // // 6 - upload file to OHIP
            const allSubmitClaimResults = {
                faults: [],
                auditInfo: [],
                results: [],
            };
            const ebs = new EBSConnector(ohipConfig.ebsConfig);
            ebs[EDT_UPLOAD]({uploads}, async (uploadErr, uploadResponse) => {

                allSubmitClaimResults.faults = allSubmitClaimResults.faults.concat(uploadResponse.faults);
                allSubmitClaimResults.auditInfo = allSubmitClaimResults.auditInfo.concat(uploadResponse.auditInfo);
                allSubmitClaimResults.results = allSubmitClaimResults.results.concat(uploadResponse.results);


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

                if (faults.length) {
                    // TODO note various CT scenarios
                    return callback(null, uploadResponse);
                }

                const separatedUploadResults = separateResults(uploadResponse, EDT_UPLOAD, responseCodes.SUCCESS);
                const successfulUploadResults = (separatedUploadResults)[responseCodes.SUCCESS];

                // // mark files that were successfully uploaded to "in_progress" status
                if (!successfulUploadResults) {
                    return callback(null, uploadResponse);
                }

                await billingApi.updateFileStatus({
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
                return ebs[EDT_SUBMIT]({resourceIDs}, async (submitErr, submitResponse) => {

                    allSubmitClaimResults.faults = allSubmitClaimResults.faults.concat(submitResponse.faults);
                    allSubmitClaimResults.auditInfo = allSubmitClaimResults.auditInfo.concat(submitResponse.auditInfo);
                    allSubmitClaimResults.results = allSubmitClaimResults.results.concat(submitResponse.results);


                    const separatedSubmitResults = separateResults(submitResponse, EDT_SUBMIT, responseCodes.SUCCESS);
                    const successfulSubmitResults = separatedSubmitResults[responseCodes.SUCCESS];
                    if (submitErr) {
                        return callback(submitErr, allSubmitClaimResults);
                    }


                    // mark files that were successfully submitted to "success" status
                    await billingApi.updateFileStatus({
                        status: 'success',
                        files: successfulSubmitResults.map((submitResult) => {
                            return find((storedFiles), (storedFile) => {
                                return submitResult.description === storedFile.filename;
                            });
                        }),
                    });

                    const claimStatusCode = ohipConfig.pendAckCode || CLAIM_STATUS_PENDING_ACKNOWLEDGMENT_DEFAULT;

                    storedFiles.forEach((storedFile) => {
                        storedFile.batches.forEach((batch) => {

                            billingApi.updateClaimStatus({
                                claimIds: batch.claimIds,
                                claimStatusCode,
                            });

                        })
                    });

                    return callback(null, allSubmitClaimResults);
                });
            });
        },

        fileManagement: async (args, callback) => {
            const fileData = await billingApi.getFileManagementData(args);

            const remittanceAdviceFileType = billingApi.getFileType({resourceType:REMITTANCE_ADVICE});

            for (let i = 0; i < fileData.rows.length; i++) {
                if (fileData.rows[i].file_type === remittanceAdviceFileType) {
                    const loadFileData = await billingApi.loadFile({edi_files_id: fileData.rows[i].id});
                    const parsedResponseFile = new Parser(loadFileData.uploaded_file_name).parse(loadFileData.data);
                    fileData.rows[i].totalAmountPayable = parsedResponseFile.totalAmountPayable;
                    fileData.rows[i].accountingTransactions = parsedResponseFile.accountingTransactions;
                } else {
                    fileData.rows[i].totalAmountPayable = null;
                }
            }

            return callback(null, fileData);
        },

        /**
         * downloadRemittanceAdvice - description
         *
         * @param  {type} args     description
         * @param  {type} callback description
         * @returns {type}          description
         */
        downloadRemittanceAdvice,

        downloadAndProcessResponseFiles,

        validateHealthCard: async (args, callback) => {
            const ebs = new EBSConnector((await billingApi.getOHIPConfiguration()).ebsConfig);

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

            const hcvRequests = [{
                healthNumber,
                versionCode,
            }];

            if (isValid) {
                result.isValid = true
                ebs[HCV_REAL_TIME]({hcvRequests}, (hcvErr, hcvResponse) => {
                    args.eligibility_response = hcvResponse;
                    billingApi.saveEligibilityLog(args);
                    return callback(hcvErr, hcvResponse);
                });
            }
            else {
                result.isValid = false;
                return callback({ isValid: false, errMsg: "Invalid Heath card number" }, {});
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
                '6': 'MOH_LARGE_CLAIMS.TXT',
                '7': 'SDAU73.000',
                '8': 'OBECA000.dat',
                '9': 'HCAU73.000-malformed_header',
                '10': 'HCAU73.000-invalid_length',
                '11': 'Stale_Dated_Claim_File.txt-malformed_header',
                '12': 'Stale_Dated_Claim_File.txt-invalid_length',
                '13': 'HCAU73.000-missing_csn',
                '14': 'HCAU73.000-header1_count',
                '15': 'HCAU73.000-item_count',
                '16': 'OBECFILE.blob-invalid_health_number_length',
                '17': 'OBECFILE.blob-non_numeric_health_number',
                '18': 'HCAU73.000-header2_count',
                '19': 'OBECFILE.blob-invalid_transaction_code',
            };

            if (service === EDT_UPLOAD) {
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
            else if (service === EDT_UPDATE) {
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
            const validServices = [
                EDT_UPLOAD,     EDT_INFO,   EDT_UPDATE,     EDT_DELETE,
                EDT_SUBMIT,     EDT_LIST,   EDT_DOWNLOAD,   EDT_GET_TYPE_LIST,
                HCV_REAL_TIME,
            ];
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

            const ebs = new EBSConnector((await billingApi.getOHIPConfiguration({muid})).ebsConfig);
            ebs[service](args, (ebsErr, ebsResponse) => {
                return callback(ebsErr, ebsResponse);
            });
        },

        remittanceAdviceFilesRefresh: downloadRemittanceAdvice,

        responseFilesRefresh: downloadAndProcessResponseFiles,
    };
};
