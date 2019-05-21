const xml = require('./xml');

const logger = require('../../../../logger');

const {
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
    responseCodes: {
        SUCCESS,
        FILE_UPLOAD_FAILED,
        NO_DATA_FOR_PROCESSING,
        DATA_PROCESSING_FAILED,
        DATA_NOT_PROCESSED,

    }
} = require('./../constants');

const {
    formatDate,
    formatAlphanumeric,
    formatTime,
} = require('./../../encoder/util');

const {
    getMonthCode,
    getResourceFilename,
} = require('./../../utils');


const fs = require('fs');

const resources = [];
let nextResourceID = 60000;

// matches service codes beginning with 'X' -- used to determine if an entire Claims File should be rejected
const rejectionFlagMatcher = /X[0-9]{3}[A-Z]/;

// matches service codes beginning with 'E' -- used to determine if a claim (within a batch) should be rejected
const correctionFlagMatcher = /E[0-9]{3}[A-Z]/;

// matches service codes beginning with 'Z' -- used to determine if an entire batch (within a submission) should be rejected
const badBatchFlagMatcher = /Z[0-9]{3}[A-Z]/;


// const remittanceAdviceEncoder = require('./remittanceAdviceEncoder');
const getRejectMessages = require('./rejectMessageProcessor');
const getBatchEditReports = require('./batchEditProcessor');
const getErrorReports = require('./errorReportProcessor');

const getClaimFileInfo = (resource) => {

    const claimFileData = fs.readFileSync(resource.filename, 'ascii');
    const claimFileRecords = claimFileData.split('\r');

    let recordImage = null;
    let groupNumber = null;

    // assume this will be false until we hit a submission rejection flag
    let shouldReject = false;

    const rejectBatches = [];
    // const acceptBatches = [];

    let currentBatch = null;
    let currentClaim = null;

    const acceptBatches = claimFileRecords.reduce((acceptBatches, record, index) => {
        if (/^HEBV03/.test(record)) {

            currentBatch = {
                batchId: record.substr(7, 12),  // for Batch Edit reports
                providerNumber: record.substr(29, 6),
                groupNumber: record.substr(25, 4),
                specialty: record.substr(35, 2),
                operatorNumber: record.substr(19, 6),

                shouldReject: false,
                rejectClaims: [],
                acceptClaims: [],
            };

            if (!index) {
                // the recordImage of a Reject Message corresponds to the
                // first 37 characters of the first record of a claims file
                recordImage = record.substr(0, 37);
                groupNumber = recordImage.substr(25, 4);
            }

            // assume it will end up here until we hit a batch-rejection flag
            acceptBatches.push(currentBatch);
        }
        else if (/^HEH/.test(record)) {

            currentClaim = {
                healthRegistrationNumber: record.substr(3, 10), // this or use Registration Number from header-2 record.substr(3,12)
                versionCode: record.substr(13, 2),    // from claim header - 1
                patientDOB: record.substr(15, 8),
                accountingNumber: record.substr(23, 8),   // from claim header - 1
                paymentProgram: record.substr(31, 3),
                serviceLocationIndicator: record.substr(58, 4), // from claim header - 1

                items: [],
                shouldReject: false,
            };

            // assume it will end up here until we hit a claim-rejection flag
            currentBatch.acceptClaims.push(currentClaim);
        }
        else if (/^HER/.test(record)) {

            currentClaim.patientLastName = record.substr(15, 9);    // "spaces except for RMB claims" (from claim header - 2)
            currentClaim.patientFirstName = record.substr(24, 5);   // "spaces except for RMB claims" (from claim header - 2)
            currentClaim.provinceCode = record.substr(30, 2);   // from claim header - 1
        }

        else if (/^HET/.test(record)) {

            // determine if this Claims File was intended to be corrected, if
            // the Claim itself should be rejected, or neither
            const serviceCode = record.substr(3, 5);
            if (rejectionFlagMatcher.test(serviceCode)) {
                logger.info(`****NERF**** bad submission flag set (${serviceCode})`);
                shouldReject = true;    // useful for Remittance Advice encoder
            }
            else if (badBatchFlagMatcher.test(serviceCode)) {
                logger.info(`****NERF**** bad batch flag set (${serviceCode})`);
                rejectBatches.push(acceptBatches.pop());   // useful for Batch Edit encoder
            }
            else if (correctionFlagMatcher.test(serviceCode)) {
                logger.info(`****NERF**** bad claim flag set (${serviceCode})`);
                currentBatch.rejectClaims.push(currentBatch.acceptClaims.pop());   // useful for Error Reports encoder
            }

            currentClaim.items.push({
                serviceCode,
                feeSubmitted: record.substr(10, 6),
                numberOfServices: record.substr(16, 2),
                serviceDate: record.substr(18, 8),
            });
        }
        else if (/^HEE/.test(record)) {

            currentBatch.numClaims = parseInt(record.substr(3, 4));
            currentBatch.numRecords = currentBatch.numClaims
                                    + parseInt(record.substr(7, 4))
                                    + parseInt(record.substr(11, 5))
                                    + 2; // batch header and batch trailer
        }

        return acceptBatches;
    }, []);

    return {
        acceptBatches,
        rejectBatches,
        recordImage,
        groupNumber,
        shouldReject,
        totalRecordLength: claimFileRecords.length,
    };
};

const addResources = (newResources) => {
    while (newResources.length) {
        resources.push({
            ...newResources.pop(),
            resourceID: nextResourceID++,
        });
    }
};

const handleSubmission = (resource, processDate) => {

    resource.claimFileInfo = getClaimFileInfo(resource);

    if (resource.claimFileInfo.shouldReject) {
        addResources(getRejectMessages(resource, processDate));
    }
    else {
        addResources(getErrorReports(resource, processDate));

        addResources(getBatchEditReports(resource, processDate));
    }
};

const updateRemittanceAdvice = () => {
    // remittanceAdviceEncoder(resources).forEach((remittanceAdvice) => {
    //     resources.push({
    //         resourceID: nextResourceID++,
    //         status: 'DOWNLOADABLE',
    //         ...remittanceAdvice,
    //         resourceType: 'RA',
    //         createTimestamp: new Date(),
    //         modifyTimestamp: new Date(),
    //     });
    // });
}

const getResourcesByID = (resourceIDs) => {
    return resources.filter((resource) => {
        return resourceIDs.includes(parseInt(resource.resourceID));
    });
};


module.exports = {

    [EDT_UPLOAD]: (ctx) => {
        logger.debug('OHIP EBS Nerf upload', ctx.eventDetail);

        const uploadDate = new Date();

        const uploadResults = ctx.eventDetail[EDT_UPLOAD].uploads.reduce((results, upload, index) => {

            const {
                filename,
                description,
                resourceType,
            } = upload;

            // Create a new resource
            const resource = {
                resourceID: nextResourceID++,
                status: 'UPLOADED',
                filename,
                description,
                resourceType,

                createTimestamp: uploadDate,
                modifyTimestamp: uploadDate,
            };
            // Add it to the universal resource cache
            resources.push(resource);

            return results.concat({
                resource,
                responseCode: SUCCESS,
            });
        }, []);

        return xml[EDT_UPLOAD](uploadResults);
    },

    [EDT_UPDATE]: (ctx) => {
        logger.debug('OHIP EBS Nerf update', ctx.eventDetail);
        // TODO
        return xml[EDT_UPDATE]([]);
    },

    [EDT_DELETE]: (ctx) => {
        logger.debug('OHIP EBS Nerf delete', ctx.eventDetail);
        const deleteResults = getResourcesByID(ctx.eventDetail[EDT_DELETE].resourceIDs).reduce((results, resource) => {
            return results.concat({
                resource,
                responseCode: SUCCESS,
            });
        }, []);
        // TODO
        return xml[EDT_DELETE](deleteResults);
    },

    [EDT_SUBMIT]: (ctx) => {
        logger.debug('OHIP EBS Nerf submit', ctx.eventDetail);

        const submitResults = getResourcesByID(ctx.eventDetail[EDT_SUBMIT].resourceIDs).reduce((results, resource) => {

            const processDate = new Date();
            resource.modifyTimestamp = processDate;
            resource.status = 'SUBMITTED';

            handleSubmission(resource, processDate);

            return results.concat({
                resource,
                responseCode: SUCCESS,
            });
        }, []);

        updateRemittanceAdvice();

        return xml[EDT_SUBMIT](submitResults);
    },

    [EDT_LIST]: (ctx) => {
        logger.debug('OHIP EBS Nerf list', ctx.eventDetail);

        const {
            resourceType,
            status,
            pageNo,
        } = ctx.eventDetail.list;

        const listResults = resources.filter((resource) => {

            return (!resourceType || resource.resourceType === resourceType)
                && (!status || resource.status === status);

        }).reduce((results, resource) => {

            return results.concat({
                resource,
                responseCode: SUCCESS,
            });
        }, []);

        return xml[EDT_LIST](listResults);
    },

    [EDT_INFO]: (ctx) => {
        logger.debug('OHIP EBS Nerf info', ctx.eventDetail);

        const resourceIDs = ctx.eventDetail.info.resourceIDs;

        const infoResults = getResourcesByID(ctx.eventDetail[EDT_INFO].resourceIDs).reduce((results, resource) => {
            return results.concat({
                resource,
                responseCode: SUCCESS,
            });
        }, []);

        return xml[EDT_INFO](infoResults);
    },

    [EDT_GET_TYPE_LIST]: (ctx) => {
        logger.debug('OHIP EBS Nerf getTypeList', ctx.eventDetail);
        return xml[EDT_GET_TYPE_LIST]([]);
    },

    [EDT_DOWNLOAD]: (ctx) => {
        logger.debug('OHIP EBS Nerf dowload', ctx.eventDetail);

        const downloadResults = getResourcesByID(ctx.eventDetail[EDT_DOWNLOAD].resourceIDs).reduce((results, resource) => {
            return results.concat({
                resource,
                responseCode: SUCCESS,
            });
        }, []);

        return xml[EDT_DOWNLOAD](downloadResults);
    },

    [HCV_REAL_TIME]: (ctx) => {
        logger.debug('OHIP EBS Nerf validate', ctx.eventDetail);
        const hcvRequests = ctx.eventDetail.hcvRequests;

        return xml[HCV_REAL_TIME]([]);
    },
};
