const {
    chunk,
    reduce,
    groupBy,
    find,
    filter,
    flatten,
    flattenDeep
} = require('lodash');
const logger = require('../../logger');
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
const ohip = require('../ohip');
const EBSConnector = require('./ebs');
const config = require('../../server/config');
const ClaimsEncoder = require('./encoder/claims');
const ohipData = require('../../server/data/ohip');

const submissionLimit = 100;
const {
    getResourceFilename,
    getMonthCode,
} = require('./utils');

const { resolve } = require('bluebird');

const fetchErrors = (claimData) => {

    let validationsResult = {
        validClaims: [],
        errorClaims: []
    };

    claimData.forEach((claim) => {
        let validations = [];
        if (!claim.claim_totalCharge) {
            validations.push({
                error: `Claim ${claim.claim_id} has no billable charges`
            });
        }

        if (!claim.groupNumber) {
            validations.push({
                error: `Group number not available in facility for Claim ${claim.claim_id} `
            });
        }

        if (!claim.providerNumber) {
            validations.push({ error: `Rendering Provider of claim ${claim.claim_id} does not have provider Number` });
        }

        if (validations.length) {
            if (!validationsResult.errorClaims[claim.claim_id]) {
                validationsResult.errorClaims[claim.claim_id] = [];
            }
            validationsResult.errorClaims[claim.claim_id].push(validations)
        } else {
            validationsResult.validClaims.push(claim);
        }
            
    });

    return validationsResult;

};

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

const getClaimSubmissionFilename = (args) => {

    const {
        groupNumber,
        professionalGroupNumber,
        providerNumber,
        batchSequenceNumber,
        providerSpeciality,
        claim_type
    } = args;

    let fileName = ''

    if (claim_type == 'technical') {
        fileName = `${groupNumber}`;
    }
    else if (claim_type == 'professional') {
        if (['27', '76', '85', '90'].includes(providerSpeciality))
            fileName = `${providerNumber}`;
        else
            fileName = `${professionalGroupNumber || providerNumber}`;
    }

    return `H${getMonthCode(new Date())}${fileName}`;
};


const submitClaims = async (callback) => {

    // 1 - fetching claims available in claim submission queued status to be encoded
    const claimData = await ohipData.getClaimsData({ submissionLimit }) || [];

    // 2 - validation of claims having any details missing for encoding

    const { validClaims, errorClaims } = fetchErrors(claimData);

    let errorClaimIds = Object.keys(errorClaims);

    if (errorClaimIds.length) {
        ohipData.updateClaimStatus({
            claimIds: errorClaimIds,
            claimStatusCode: 'SUBF',
            claimNote: 'Electronic claim submission failed due to errors in claim data',
            userId: 1,
        });
    }

    if (!validClaims.length) {
        logger.logInfo('No records found to process');
        return callback(null, 'No records found to process');
    }

    // 3 - fetching ohip configuration details and initializing the encoder
    const ohipConfig = await ohipData.getOHIPConfiguration();
    const claimEnc = new ClaimsEncoder(ohipConfig);

    const submissionsByGroup = await claimEnc.encodeV1(validClaims, new Date());

    // TODO: grouping of claims based on the group number and provider number

    const allFiles = submissionsByGroup.map((groupSubmissions, index) => {

        let {
            derivedGroupNumber,
            groupNumber,
            providerNumber,
            providerSpeciality,
            professionalGroupNumber,
            claim_type,
            batchSequenceNumber,
            derivedMOHId
        } = groupSubmissions

        try {

            return {
                filename: getClaimSubmissionFilename({
                    groupNumber,
                    providerNumber,
                    professionalGroupNumber,
                    providerSpeciality,
                    claim_type,
                    professionalGroupNumber,
                    batchSequenceNumber
                }),
                providerNumber: providerNumber,
                fileSequenceOffset: index,
                ...groupSubmissions,
                errorData: {}, //claimSubmissionFailures
                derivedGroupNumber,
                derivedMOHId
            };
        }
        catch (e) {
            logger.error('Error occured while fetching file details', e);
        }
    });

    try {
        const storedFiles = await reduce(allFiles, async (storedResult, file) => {
            logger.debug('file details before storeFile calling... ', file);
            const storedFile = {
                ...await ohipData.storeFile({
                    createdDate: new Date(),
                    appendFileSequence: true,
                    ...file
                }),
                ...file,
            };

            await ohipData.applyClaimSubmission(storedFile);

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
                providerNumber: storedFile.providerNumber,
                derivedMOHId: storedFile.derivedMOHId,
                claimIds: storedFile.claimIds
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

        const groupByMOHIdUploads = groupBy(uploads, 'derivedMOHId');

        let promises = Object.entries(groupByMOHIdUploads).map(([MOHId, groupUploads], index) => {

            return new Promise((reject, resolve) => {
                ebs[EDT_UPLOAD]({ uploads: groupUploads, MOHId }, async (uploadErr, uploadResponse) => {

                    let claimIds = groupUploads.map((claimDetails, index) => {
                        return claimDetails.claimIds;
                    });

                    claimIds = flatten(claimIds) || [];

                    allSubmitClaimResults.faults = allSubmitClaimResults.faults.concat(uploadResponse.faults);
                    allSubmitClaimResults.auditInfo = allSubmitClaimResults.auditInfo.concat(uploadResponse.auditInfo);
                    allSubmitClaimResults.results = allSubmitClaimResults.results.concat(uploadResponse.results);

                    const {
                        faults,
                        results,
                        auditInfo,
                    } = uploadResponse;

                    let uploadFiles = auditInfo.length && auditInfo[0].eventDetail && auditInfo[0].eventDetail.upload && auditInfo[0].eventDetail.upload.uploads || [];

                    ohipData.auditTransaction(auditInfo);

                    if (uploadErr || !uploadFiles.length) {
                        // when OHIP file upload failure updating edi file status also failure
                        await ohipData.updateFileStatus({
                            files: uploadFiles,
                            errors: uploadErr,
                            status: 'failure'
                        });

                        await ohipData.updateClaimStatus({
                            claimIds: claimIds,
                            claimStatusCode: 'SUBF',
                            claimNote: 'Submission failed in MCEDT file upload',
                            userId: 1,
                        });

                        uploadResponse.error = "Error in file upload";

                        return reject(uploadErr, null);
                    }

                    //OHIP data error getting in response , so finding that using Eror codes
                    let err_matches = filter(
                        ['ECLAM0003'],
                        (s) => { return JSON.stringify(uploadResponse).indexOf(s) > -1; }
                    );

                    if (faults.length || err_matches.length) {
                        // when OHIP file upload failure updating edi file status also failure
                        await ohipData.updateFileStatus({
                            files: uploadFiles,
                            errors: faults || err_matches || results,
                            status: 'failure'
                        });

                        await ohipData.updateClaimStatus({
                            claimIds: claimIds,
                            claimStatusCode: 'SUBF',
                            claimNote: 'Submission failed in MCEDT file upload',
                            userId: 1,
                        });

                        uploadResponse.error = "Error in file upload";
                       return reject(uploadResponse, null);
                    }

                    const separatedUploadResults = separateResults(uploadResponse, EDT_UPLOAD, responseCodes.SUCCESS);
                    const successfulUploadResults = (separatedUploadResults)[responseCodes.SUCCESS];

                    // // mark files that were successfully uploaded to "in_progress" status
                    if (!successfulUploadResults) {
                        await ohipData.updateFileStatus({
                            files: uploadFiles,
                            errors: results || [],
                            status: 'failure'
                        });

                        await ohipData.updateClaimStatus({
                            claimIds: claimIds,
                            claimStatusCode: 'SUBF',
                            claimNote: 'Submission failed in MCEDT file upload',
                            userId: 1,
                        });

                        return reject(uploadResponse, null);
                    }

                    await ohipData.updateFileStatus({
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
                    return ebs[EDT_SUBMIT]({ resourceIDs, providerNumber: MOHId }, async (submitErr, submitResponse) => {

                        allSubmitClaimResults.faults = allSubmitClaimResults.faults.concat(submitResponse.faults);
                        allSubmitClaimResults.auditInfo = allSubmitClaimResults.auditInfo.concat(submitResponse.auditInfo);
                        allSubmitClaimResults.results = allSubmitClaimResults.results.concat(submitResponse.results);


                        const separatedSubmitResults = separateResults(submitResponse, EDT_SUBMIT, responseCodes.SUCCESS);
                        const successfulSubmitResults = separatedSubmitResults[responseCodes.SUCCESS];
                        if (submitErr) {
                           return reject(submitErr, allSubmitClaimResults);
                        }


                        // mark files that were successfully submitted to "success" status
                        await ohipData.updateFileStatus({
                            status: 'success',
                            files: successfulSubmitResults.map((submitResult) => {
                                return find((storedFiles), (storedFile) => {
                                    return submitResult.description === getResourceFilename(storedFile.absolutePath);
                                });
                            }),
                        });

                        storedFiles.forEach(async (storedFile) => {
                            const claimStatusCode = storedFile.resource_id > 0 && ohipConfig.pendAckCode || 'SUBF';
                            const claimNote = storedFile.resource_id > 0 && 'Electronically submitted in MCEDT-EBS file submission' || 'Electronically submission failed in MCEDT-EBS file submission';

                            await ohipData.updateClaimStatus({
                                claimIds: storedFile.claimIds,
                                claimStatusCode,
                                claimNote: claimNote,
                                userId: 1,
                            });
                        });

                       return resolve(null, allSubmitClaimResults);
                    });
                });
            });
        });

        Promise.all(promises).then((result) => {
            return callback(null, result);
        }).catch((err) => {
            return callback(err, null);
        });
    }
    catch (e) {
        logger.logError(`Error occured at claim submission... ${e}`);
    }

}

module.exports = {
    submitClaims
};
