'use strict';

const {
    chunk,
    reduce,
    groupBy,
    find,
} = require('lodash');

const path = require('path');
const logger = require('../../logger');
const remittanceAdviceProcessor = path.join(__dirname, '/remittanceAdviceProcessor');
const eraParser = require('../../server/data/ohip/ohip-era-parser');
const fork = require('child_process').fork;
// this is the high-level business logic and algorithms for OHIP
//  * use cases are defined here

const EBSConnector = require('./ebs');
const shared = require('./../../server/shared');
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
    getResourceFilename,
    // getNumberFromMoney,
} = require('./utils');



const ClaimsEncoder = require('./encoder/claims');
const mod10Check = require('./hcv/mod10Check');
const Parser = require('./parser');
const billingApi = require('../../server/data/ohip');
const validateClaimsData = require('../../server/data/claim/claim-workbench');
const claimWorkBenchController = require('../../server/controllers/claim/claim-workbench');
const _ = require('lodash');
const config = require('../../server/config');
/**
 * Global value declared for edi file resource_no
 */
global.nextResourceID = 60000;

/**
 * const getClaimSubmissionFilename - description
 *
 * @param  {type} args description
 * @returns {type}      description
 */
const getClaimSubmissionFilename = (args) => {

    const {
        groupNumber,
    } = args;

    return `H${getMonthCode(new Date())}${groupNumber}`;
};



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

    if (isDetailResult(service) || isDownloadResult(service) || isTypeListResult(service)) {
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
 * const getNewResourceIDs - a very expensive function that compares a list of
 * "existing" resource IDs to a very expensive list of all resource IDs to
 * determine which resources would be considered "new" to EXA.
 *
 * @param  {type} args     parameters to the list service
 * @param  {type} callback where to put the results of
 * @returns {type}          a very valuable list of resource IDs which would
 *                          be considered "new" to the EXA billing module
 */
const getNewResourceIDs = async (args, callback) => {

    const {
        resourceType,
        providerNumber
    } = args;

    const ohipConfig = await billingApi.getOHIPConfiguration(args);
    const ebs = new EBSConnector(ohipConfig.ebsConfig);

    const existingResourceIDs = await billingApi.getResourceIDs(args);

    const pages = [];
    let numPages = 1;

    const processListResults = (err, results) => {

        let {
            faults = []
        } = results || {};

        err = err || (faults.length && faults[0]) || null;

        if (err) {
            logger.error(`getNewResourceIDs: processListResults ${JSON.stringify(err)}`);
            return callback(err, []);
        }
        else {
            pages.push(results);
        }

        if (pages.length >= numPages) {

            const resourceIDs = pages.reduce((pageResults, currentPage) => {

                return currentPage.results.reduce((results, result) => {

                    return result.data.reduce((dataResults, currentData) => {
                        let {
                            resourceID
                        } = currentData || {};

                        if (!existingResourceIDs.includes(resourceID)) {
                            dataResults.push(currentData.resourceID);
                        }
                        return dataResults;

                    }, results);

                }, pageResults);

            }, []);

            callback(null, { resourceIDs });
        }
    };

    logger.info(`Fetching Files list for  MOH ID: ${providerNumber}`);
    await ebs[EDT_LIST](args, async (listErr, listResponse) => {
        // provides number of pages and first batch of downloadable resourceIDs
        let {
            providerNumber = '',
            resourceType
        } = args || {};

        let {
            faults = [],
            auditInfo,
            results = []
        } = listResponse || {};

        listErr = listErr || faults.length && faults[0] || null;

        if (listErr) {
            logger.error(`Error occured while fetching files list for  MOH ID ${providerNumber}: ${listErr.code} - ${listErr.message}`);
            return callback(listErr, []);
        }

        numPages = listResponse.results[0] && listResponse.results[0].resultSize || 0;

        for (let pageNo = 2; pageNo <= numPages; pageNo++) {
            // spin off a bunch of asynchronous service-calls and pass processListResults as the callback
            await ebs[EDT_LIST]({ providerNumber, resourceType, pageNo }, processListResults);
        }

        processListResults(listErr, listResponse);
    });
};

/**
 * const downloadNew - downloads resources from EBS servers which would be
 * considered "new" to EXA (i.e. resources that have not already been
 * downloaded and imported into EXA). An array with the following structure is
 * passed to the callback:
 *
 *     [
 *        {
 *            file_store_id: Number,
 *            edi_file_id: Number,
 *            absolutePath: String,
 *        },
 *        // ...
 *     ]
 *
 * @param  {type} args     description
 * @param  {type} callback description
 * @returns {type}          description
 */
const downloadNew = (args, callback) => {

    getNewResourceIDs(args, async (err, { resourceIDs }) => {
        let {
            providerNumber = ''
        } = args;

        if (err) {
            return callback(err, []);
        }

        const ohipConfig = await billingApi.getOHIPConfiguration(args);
        const ebs = new EBSConnector(ohipConfig.ebsConfig);

        if (resourceIDs && resourceIDs.length && resourceIDs[0]) {

            logger.info(`Downloading Ack/RA Files for MOH ID ${providerNumber}...`);
            await ebs[EDT_DOWNLOAD]({ providerNumber, resourceIDs }, async (downloadErr, downloadResponse) => {

                if (downloadErr) {
                    return callback(downloadErr, null);
                }

                const separatedDownloadResults = separateResults(downloadResponse, EDT_DOWNLOAD, responseCodes.SUCCESS);

                const ediFiles = separatedDownloadResults[responseCodes.SUCCESS] || [];
                let edifileList = [];

                for (const result of ediFiles) {

                    let base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
                    const data = base64regex.test(result.content) ? shared.base64Decode(result.content) : result.content;

                    // need to decode the content using base64 decoding before storing the file
                    const filename = result.description;
                    const resource_id = result.resourceID;
                    const file = await billingApi.storeFile({
                        data,
                        filename,
                        resource_id,
                        derivedMOHId: providerNumber
                    });

                    edifileList.push({
                        data,
                        filename,
                        ...file
                    });
                }

                if (edifileList.length) {
                    callback(null, (await Promise.all(edifileList)));
                } else {
                    callback(null, []);
                }
            });
        }
        else {
            let errMsg = `No Resource Ids found to files download for  MOH ID: ${providerNumber}`;

            logger.error(errMsg);
            callback({ error: errMsg }, null);
        }
    });
};

const downloadAckFile = async (params, callback) => {

    let {
        providerNumber = '',
        resourceType,
        applicator,
    } = params;

    downloadNew({ providerNumber, resourceType }, async (downloadErr, downloadResponse) => {

        if (downloadErr) {
            logger.error(`Error occured while downloading resource ${resourceType} for  MOH ID: ${providerNumber}`);
            return callback(downloadErr, []);
        }

        downloadResponse.forEach(async (download) => {

            const {
                filename,
                data,
                edi_file_id: responseFileId,
            } = (download);

            // always an array
            const parsedResponseFile = new Parser(filename).parse(data);

            await applicator({
                responseFileId,
                parsedResponseFile,
            });
        });

        callback(downloadErr, downloadResponse);
    });
};

const downloadResponseForProvider = (providerNumber, applicator, resourceType) => {
    return new Promise((reject, resolve) => {
        downloadAndProcessResponseFiles({
            providerNumber: providerNumber,
            applicator: applicator,
            resourceType: resourceType
        }, (err, res) => {
            logger.logInfo(err || res);
            logger.logInfo(`Completed downloading ${resourceType} files for MOH ID: ${providerNumber}...`);

            return resolve({
                err,
                res
            })
        });
    });

};

const downloadRemittanceForProvider = (providerNumber, resourceType) => {
    return new Promise((reject, resolve) => {
        downloadRemittanceAdvice({
            providerNumber: providerNumber,
            resourceType: resourceType
        }, (err, res) => {
            logger.logInfo(err || res);
            logger.logInfo(`Completed downloading ${resourceType} files for MOH ID: ${providerNumber}...`);

            if (err) {
                return reject({
                    error: err
                });
            }

            return resolve({
                res
            })
        });
    });
};

const downloadRemittanceFiles = async (providerNumbersList, callback) => {
    let downloadResults = [];

    for (let i = 0; i < providerNumbersList.length; i++) {
        logger.logInfo(`Fetching Remittance Advice files for MOH ID: ${providerNumbersList[i].providerNumber}...`);

        try {
            let response = await downloadRemittanceForProvider(providerNumbersList[i].providerNumber, REMITTANCE_ADVICE);
            downloadResults.push(response);

        } catch (error) {
            logger.logError(`Error connecting OHIP Endpoint for MOH ID ${providerNumbersList[i].providerNumber} - ${JSON.stringify(error)}`);
        }
    }

    return callback(null, downloadResults);
};

const downloadSubmittedFiles = async (providerNumbersList, callback) => {

    let downloadResourceTypes = [{
        resourceType: CLAIMS_MAIL_FILE_REJECT_MESSAGE,
        applicator: billingApi.applyRejectMessage
    }, {
        resourceType: ERROR_REPORTS,
        applicator: billingApi.applyErrorReport
    }, {
        resourceType: BATCH_EDIT,
        applicator: billingApi.applyBatchEditReport
    }];

    for (let j = 0; j < downloadResourceTypes.length; j++) {

        let downloadFileResults = [];

        for (let i = 0; i < providerNumbersList.length; i++) {
            logger.logInfo(`Fetching ${downloadResourceTypes[j].resourceType} files for MOH ID: ${providerNumbersList[i].providerNumber}...`);
            try {
                let response = await downloadResponseForProvider(providerNumbersList[i].providerNumber, downloadResourceTypes[j].applicator, downloadResourceTypes[j].resourceType);

                downloadFileResults.push(response);
            } catch (error) {
                logger.logError(`Error connecting OHIP Endpoint for provider ${providerNumbersList[i].providerNumber} - ${JSON.stringify(error)}`);
            }
        }

        logger.logInfo(`${downloadResourceTypes[j].resourceType} result ${downloadFileResults}...`);
    }

    return callback(null, []);
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

const downloadRemittanceAdvice = async (args, callback) => {
    let {
         providerNumber = ''
    } = args || {};
    await downloadNew({
            providerNumber,
            resourceType: REMITTANCE_ADVICE
        }, (downloadErr, ediFiles) => {

            if (downloadErr) {
                logger.error(`Error occurred while downloading resource ${REMITTANCE_ADVICE} for  MOH ID: ${providerNumber}`);
                return callback(downloadErr, []);
            }

            logger.logInfo(`Completed downloading ${REMITTANCE_ADVICE} files for MOH ID: ${providerNumber}...`);
            return callback(downloadErr, ediFiles);
        });
};

const downloadAndProcessResponseFiles = async (args, callback) => {

    let {
        providerNumber = '',
        applicator,
        resourceType
    } = args || {};

    logger.logInfo(`Initializing ${resourceType} download for  MOH ID ${providerNumber}....`);
    downloadAckFile({
        ...args,
        resourceType,
        applicator
    }, callback);
};

const processRemittanceAdviceFiles = async (filesList, callback) => {

    const promises = _.map(filesList, async (file) => {
        let {
            edi_file_id
        } = file;

        const fileData = await billingApi.loadFile({
            edi_files_id: edi_file_id
        });

        let processedResult = null;

        if (fileData.data) {
            logger.logInfo(`Decoding remittance advice file ${fileData.uploaded_file_name}`);
            const parser = new Parser(fileData.uploaded_file_name);
            fileData.ra_json = await parser.parse(fileData.data);

            logger.logInfo(`Decoding remittance advice file ${fileData.uploaded_file_name} completed...`);

            logger.logInfo(`Initiated file processing... ${edi_file_id} - ${fileData.uploaded_file_name}`);

            processedResult = await eraParser.processOHIPEraFile(fileData, {
                companyId: fileData.company_id,
                edi_files_id: edi_file_id,
				moduleName: 'era',
				screenName: 'Payments',
				entityName: 'Payments',
				company_id: fileData.company_id,
            });

            if (processedResult && processedResult.status === '23156') {
                return callback(processedResult, null);
            }

            logger.logInfo(`File processing completed for ${edi_file_id} - ${fileData.uploaded_file_name}...`);
        } else {
            logger.error(`Unable to read file data ${fileData.uploaded_file_name}`);

            processedResult = {
                error: `Unable to read file data ${fileData.uploaded_file_name}`
            };
        }

        return processedResult;
    });

    let results = await Promise.all(promises);

    callback(null, [...results]);

};

//
// *************************** PUBLIC **************************************
//

module.exports = {

    sandbox: (args, callback) => {
        getNewResourceIDs(args, callback);
    },
    /**
     * Change status of claims to claim submission queue after validation got success
     * @param {object} req
     * @param {function} callback
     * @returns rows of claims which got updated
     */
    submitClaimsToQueue: async (req, callback) => {
        let {
            isAllClaims,
            claimIds,
            userId,
            clientIp,
            companyId,
            screenName,
            entityName,
            moduleName,
        } = req.body;

        if (isAllClaims) {
            claimIds = await claimWorkBenchController.getClaimsForEDI(req.body);
        }

        let arrayClaimIds = claimIds.split(',');
        let validationData = await validateClaimsData.validateEDIClaimCreation(arrayClaimIds);
        validationData = _.get(validationData, 'rows[0]', {});

        let excludeClaimStatus = ['PS', 'SUBF'];
        let claimStatus = _.difference(_.uniq(validationData.claim_status), excludeClaimStatus); // (Pending Submission - PS) removed to check for other claim status availability
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
        const claimData = await billingApi.getClaimsData({ arrayClaimIds  });
        const validationMessages = claimData.reduce((validations, claim) => {
            if (!claim.claim_totalCharge) {
                validations.push(`Claim ${claim.claim_id} has no billable charges`);
            }

            if (claim.insurance_details.paymentProgram === 'RMB' && !claim.insurance_details.versionCode) {
                validations.push(`Claim ${claim.claim_id} has no version code`);
            }

            return validations;
        }, []);

        if (validationMessages.length) {
            return callback(null, { validationMessages });
        }

        // updating the claims status to submission queue
        let {rows = []} = await billingApi.updateClaimStatus({
            claimIds: arrayClaimIds,
            claimStatusCode: 'CQ',
            claimNote: 'Electronically submitted through MCEDT-EBS',
            userId,
            clientIp,
            companyId,
            screenName,
            entityName: 'claims',
            moduleName,
            auditDesc: 'Claim has been queued for Electronically submitted through MCEDT-EBS'
        });

        return callback(null, {results: rows});

    },

    // takes an array of Claim IDs
    submitClaims: async (req, callback) => {
        let args = req.query;
        let params = req.body;

        if (params.isAllClaims) {
            params.claimIds = await claimWorkBenchController.getClaimsForEDI(params);
        }

        /** Nerf engine throws constraint error when billing service restarted ,
         * to avoid this issue when global data is not available getting latest resource number from edi files
         * TO-DO: This is temp workaround later we can overwrite using redis cache memory or with real db data */
        if (global.nextResourceID === 60000 && !config.get('ebsProduction')) {
            let result = await claimWorkBenchController.getLatestResourceNumberForEDI(params);
            let {
                resource_no = null
            } = result && result.length && result[0] || {};

            resource_no ? global.nextResourceID = parseInt(resource_no) + 1 : '';
        }

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
        const claimData = await billingApi.getClaimsData({ claimIds });
        const validationMessages = claimData.reduce((validations, claim) => {
            if (!claim.claim_totalCharge) {
                validations.push(`Claim ${claim.claim_id} has no billable charges`);
            }

            return validations;
        }, []);
        if (validationMessages.length) {
            return callback(null, { validationMessages });
        }

        // 2 - run claim data through encoder
        const ohipConfig = await billingApi.getOHIPConfiguration();

        const claimEnc = new ClaimsEncoder(ohipConfig);
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
                    filename: getClaimSubmissionFilename({ groupNumber }),
                    providerNumber: file.batches[0].providerNumber,
                    fileSequenceOffset,
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
                    appendFileSequence: true,
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
                description: getResourceFilename(storedFile.absolutePath),
                edi_file_id: storedFile.edi_file_id,
                providerNumber: storedFile.providerNumber
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
        ebs[EDT_UPLOAD]({ uploads }, async (uploadErr, uploadResponse) => {

            allSubmitClaimResults.faults = allSubmitClaimResults.faults.concat(uploadResponse.faults);
            allSubmitClaimResults.auditInfo = allSubmitClaimResults.auditInfo.concat(uploadResponse.auditInfo);
            allSubmitClaimResults.results = allSubmitClaimResults.results.concat(uploadResponse.results);


            const {
                faults,
                results,
                auditInfo,
            } = uploadResponse;

            let uploadFiles = auditInfo.length && auditInfo[0].eventDetail && auditInfo[0].eventDetail.upload && auditInfo[0].eventDetail.upload.uploads || [];

            billingApi.auditTransaction(auditInfo);

            if (uploadErr || !uploadFiles.length) {
                // when OHIP file upload failure updating edi file status also failure
                await billingApi.updateFileStatus({
                    files: uploadFiles,
                    status: 'failure'
                });

                uploadResponse.error = "Error in File upload";

                return callback(uploadErr, null);
            }

            //OHIP data error getting in response , so finding that using Eror codes
            let err_matches = _.filter(
                ['ECLAM0003'],
                ( s ) => { return JSON.stringify(uploadResponse).indexOf( s ) > -1; }
            );

            if (faults.length || err_matches.length ) {
                // when OHIP file upload failure updating edi file status also failure
                await billingApi.updateFileStatus({
                    files: uploadFiles,
                    status: 'failure'
                });

                uploadResponse.error = "Error in File upload";
                return callback(uploadResponse, null);
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
                    const storedFile = find((storedFiles), (storedFile) => {
                        return uploadResult.description === getResourceFilename(storedFile.absolutePath);
                    });
                    storedFile.resource_id = uploadResult.resourceID;
                    return storedFile;
                }),
            });

            // TODO set file status for failed uploads (but not *all* failed uploads)
            // separatedUploadResults['other'] is an array of non-success results

            const resourceIDs = separatedUploadResults[responseCodes.SUCCESS].map((uploadResult) => {
                return uploadResult.resourceID;
            });


            // // 7 - submit file to OHIP
            return ebs[EDT_SUBMIT]({ resourceIDs, providerNumber: uploadFiles[0].providerNumber }, async (submitErr, submitResponse) => {

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
                            return submitResult.description === getResourceFilename(storedFile.absolutePath);
                        });
                    }),
                });

                const claimStatusCode = ohipConfig.pendAckCode || CLAIM_STATUS_PENDING_ACKNOWLEDGMENT_DEFAULT;

                storedFiles.forEach((storedFile) => {
                    storedFile.batches.forEach((batch) => {

                        billingApi.updateClaimStatus({
                            claimIds: batch.claimIds,
                            claimStatusCode,
                            claimNote: 'Electronically submitted through MCEDT-EBS',
                            userId: params.userId,
                            clientIp: params.clientIp,
                            companyId: params.companyId,
                            screenName: params.screenName,
                            entityName: 'claims',
                            moduleName: params.moduleName,
                            auditDesc: 'Electronically submitted through MCEDT-EBS'
                        });

                    })
                });

                return callback(null, allSubmitClaimResults);
            });
        });
    },

    fileManagement: async (args, callback) => {
        const fileData = await billingApi.getFileManagementData(args);
        const remittanceAdviceFileType = billingApi.getFileType({ resourceType: REMITTANCE_ADVICE });

        for (let i = 0; i < fileData.rows.length; i++) {
            let fileRow = fileData.rows[i];

            if (fileRow.file_type === remittanceAdviceFileType) {
                const loadFileData = await billingApi.loadFile({ edi_files_id: fileRow.id });

                if (loadFileData.data) {
                    try {
                        const parsedResponseFile = new Parser(loadFileData.uploaded_file_name).parse(loadFileData.data);
                        fileRow.totalAmountPayable = parsedResponseFile.totalAmountPayable;
                        fileRow.accountingTransactions = parsedResponseFile.accountingTransactions;
                    }
                    catch(e) {
                        logger.error('Payment file does not have transaction details', e);
                        fileRow.totalAmountPayable = null;
                        fileRow.accountingTransactions = [];
                    }
                }
                else {
                    // TODO either attempt to self-heal or remove the file from the results
                    // (removing from the results, for now)
                    fileRow.totalAmountPayable = null;
                    fileRow.accountingTransactions = [];
                }
            } else {
                fileRow.totalAmountPayable = null;
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

    downloadSubmittedFiles,

	downloadRemittanceFiles,

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
            ebs[HCV_REAL_TIME]({ hcvRequests }, async (hcvErr, hcvResponse) => {
                args.eligibility_response = hcvResponse;
                let {
                    results = [],
                    err = null,
                    faults = []
                } = hcvResponse || {};
                billingApi.saveEligibilityLog(args);

                if (!err && results.length) {
                    let {
                        responseID = null
                    } = results[0] || {};

                    if (responseID !== 'IS_IN_DISTRIBUTED_STATUS') {
                        await billingApi.updatePatientInsDetails({
                            ...args,
                            ...results[0] || {}
                        });
                    }
                }

                return callback(hcvErr, hcvResponse);
            });
        }
        else {
            result.isValid = false;
            const errMsg = "The Health number submitted does not exist on ministry's system";
            args.eligibility_response = {
                faults: [],
                auditInfo: [],
                results: [],
                err: [{
                    errDescription: errMsg
                }]
            };
            billingApi.saveEligibilityLog(args);
            return callback({ isValid: false, errMsg: errMsg }, {});
        }
    },

    applyRemittanceAdvice: async (args, callback) => {
        const f_c = await billingApi.loadFile(args);
        if (f_c.data) {
            const parser = new Parser(f_c.uploaded_file_name)
            f_c.ra_json = parser.parse(f_c.data);

            let remittanceAdviceFork = fork(remittanceAdviceProcessor);

            remittanceAdviceFork.send({
                f_c,
                args
            });

            remittanceAdviceFork.on('error', e => {
                logger.info(`OHIP Payment process error: ${remittanceAdviceFork.pid}`, e);

                return callback({
                    status: 'ERROR',
                    message: `OHIP Payment process error: ${remittanceAdviceFork.pid}`,
                    err: e
                });
            });

            remittanceAdviceFork.on('exit', (response) => {
                remittanceAdviceFork = null;
            });

            remittanceAdviceFork.on('message', callback);

        } else {
            callback(f_c);
        }
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
            const filestore = await billingApi.getFileStore({ filename: '' });
            const filePath = filestore.is_default ? 'OHIP' : '';

            const uploads = args.uploads.map((upload) => {
                const filename = filenamesByFixtureId[upload.fixtureID];
                const fullFixtureFilepath = path.join(filestore.root_directory, filePath, (filename === 'Custom') ? upload.description : filename);
                return {
                    resourceType: upload.resourceType,
                    filename: fullFixtureFilepath,
                    description: upload.description || path.basename(filename),
                };
            });
            args.uploads = uploads;
        }
        else if (service === EDT_UPDATE) {
            const filestore = await billingApi.getFileStore({ filename: '' });
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
            EDT_UPLOAD, EDT_INFO, EDT_UPDATE, EDT_DELETE,
            EDT_SUBMIT, EDT_LIST, EDT_DOWNLOAD, EDT_GET_TYPE_LIST,
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

        const ebs = new EBSConnector((await billingApi.getOHIPConfiguration({ muid })).ebsConfig);
        ebs[service](args, (ebsErr, ebsResponse) => {
            return callback(ebsErr, ebsResponse);
        });
    },

    remittanceAdviceFilesRefresh: downloadRemittanceAdvice,

    responseFilesRefresh: downloadAndProcessResponseFiles,

    processRemittanceFiles: processRemittanceAdviceFiles,
};
