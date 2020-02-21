const xml = require('./xml');

const logger = require('../../../../logger');
const moment = require('moment');

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

    },
    resourceTypes: {
        CLAIMS,
    }
} = require('./../constants');

const MILLISECONDS_SINCE_EPOCH = 0;
const DATE_TIME_FORMAT = 'YYYY-MM-DDThh:mm:ss';

const hcvResponseTemplatesByCode = {
    '05': {
        responseIDs: ['NOT_10_DIGITS'],
        responseDescription: 'The Health Number submitted is not 10 numeric digits',
        responseAction: 'No payment for services, bill the cardholder directly.',
    },
    '10': {
        responseIDs: ['FAILED_MOD10'],
        responseDescription: 'The Health Number submitted does not exist on the ministry’s system',
        responseAction: 'No payment for services, bill the cardholder directly. ',
    },
    '15': {
        responseIDs: ['IS_IN_DISTRIBUTED_STATUS'],
        responseDescription: 'Pre-assigned newborn Health Number',
        responseAction: 'No payment will be made for services until registration is completed.',
    },
    '20': {
        responseIDs: ['IS_NOT_ELIGIBLE',],
        responseDescription: 'Eligibility does not exist for this Health Number',
        responseAction: 'No payment for services, bill the cardholder directly.',
    },
    '50': {
        responseIDs: ['NOT_ON_ACTIVE_ROSTER',],
        responseDescription: 'Health card passed validation',
        responseAction: 'You will receive payment for billable services rendered on this day subject to adjudication by the ministry.',
    },
    '51': {
        responseIDs: ['IS_ON_ACTIVE_ROSTER',],
        responseDescription: 'Health card passed validation',
        responseAction: 'You will receive payment for billable services rendered on this day subject to adjudication by the ministry',
    },
    '52': {
        responseIDs: ['HAS_NOTICE',],
        responseDescription: 'Health card passed validation; Cardholder did not respond to notice to register',
        responseAction: 'You will receive payment for billable services rendered on this day subject to adjudication by the ministry.',
    },
    '53': {
        responseIDs: ['IS_RQ_HAS_EXPIRED', 'IS_THC',],
        responseDescription: 'Health card passed validation; card is expired',
        responseAction: 'You will receive payment for billable services rendered on this day subject to adjudication by the ministry.',
    },
    '54': {
        responseIDs: ['IS_RQ_FUTURE_ISSUE',],
        responseDescription: 'Health card passed validation; card is future dated',
        responseAction: 'You will receive payment for billable services rendered on this day subject to adjudication by the ministry.',
    },
    '55': {
        responseIDs: ['RETURNED_MAIL',],
        responseDescription: 'Health card passed validation; cardholder required to update address with ministry',
        responseAction: 'You will receive payment for billable services rendered on this day subject to adjudication by the ministry.',
    },
    '65': {
        responseIDs: ['INVALID_VERSION_CODE',],
        responseDescription: 'Invalid version code',
        responseAction: 'No payment for services on this Health Number and Version Code combination.',
    },
    '70': {
        responseIDs: ['IS_STOLEN',],
        responseDescription: 'Health card reported stolen',
        responseAction: 'No payment for services on this Health Number and Version Code combination.',
    },
    '75': {
        responseIDs: ['IS_CANCELLED_OR_VOIDED', 'IS_VOID_NEVER_ISS',],
        responseDescription: 'Health card cancelled or voided',
        responseAction: 'No payment for services on this Health Number and Version Code combination.',
    },
    '80': {
        responseIDs: ['DAMAGED_STATE',],
        responseDescription: 'Health card reported damaged',
        responseAction: 'No payment for services on this Health Number and Version Code combination.',
    },
    '83': {
        responseIDs: ['LOST_STATE',],
        responseDescription: 'Health card reported lost ',
        responseAction: 'No payment for services on this Health Number and Version Code combination.',
    },
    '90': {
        responseIDs: ['INFO_NOT_AVAIL'],
        responseDescription: 'Information is not available',
        responseAction: 'Try the scan again',
    },
};


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

// this is really crummy and should be reconsidered
const REMITTANCE_ADVICE_RESOURCE_ID = nextResourceID++;


// matches service codes beginning with 'X' -- used to determine if an entire Claims File should be rejected
const rejectionFlagMatcher = /X999[BC]/;

// matches service codes beginning with 'E' -- used to determine if a claim (within a batch) should be rejected
// first group = claim level error codes, second group = item explanatory codes, third group = item level error codes
const correctionFlagMatcher = /E([0-9])([0-9])([0-9])[BC]/;
const CLAIM_ERROR_KEY = 1;
const ITEM_EXPLANATORY_KEY = 2;
const ITEM_ERROR_KEY = 3;



// matches service codes beginning with 'Z' -- used to determine if an entire batch (within a submission) should be rejected
const badBatchFlagMatcher = /Z999[BC]/;


const updateRemittanceAdvice = require('./remittanceAdviceProcessor');
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

                rejected: false,
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

                errors: [], // claim correction at the header level
                items: [],
                rejectItems: [],
                rejected: false,
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

            // Per section 6.2 of the Interface to Health Care Systems Technical Specifications,
            // Claims data in electronic input form may be subject to rejection by the ministry at three levels:
            // 1 - Rejection of entire file submission
            // 2 - Rejection of batch within a file
            // 3 - Rejection of a claim within a batch

            if (rejectionFlagMatcher.test(serviceCode)) {
                logger.info(`****NERF**** bad submission flag set; submission to be rejected (${serviceCode})`);
                shouldReject = true;    // useful for Remittance Advice encoder
            }
            else if (badBatchFlagMatcher.test(serviceCode) && !currentBatch.rejected) {
                logger.info(`****NERF**** bad batch flag set; batch to be rejected (${serviceCode})`);
                rejectBatches.push(acceptBatches.pop());   // useful for Batch Edit encoder
                currentBatch.rejected = true;   // don't be in this branch for this batch again
            }
            else {
                const results = correctionFlagMatcher.exec(serviceCode) || [];

                const claimErrorKey = results[CLAIM_ERROR_KEY];
                const itemExplanatoryKey = results[ITEM_EXPLANATORY_KEY];
                const itemErrorKey = results[ITEM_ERROR_KEY];

                if (claimErrorKey || itemExplanatoryKey || itemErrorKey) {

                    logger.info(`****NERF**** bad claim flag set; claim to be rejected (${serviceCode})`);

                    if (!currentClaim.rejected) {
                        currentBatch.rejectClaims.push(currentBatch.acceptClaims.pop());   // useful for Error Reports encoder
                        currentClaim.rejected = true;   // don't be in this branch for this claim again
                    }

                    currentClaim.errorKey = claimErrorKey;


                    // NOTE that this else-block is very similar to the else-block below, except that
                    // in this context, we're only processing 'items with errors' for 'claims that require correction

                    currentClaim.rejectItems.push({

                        explanatoryKey: itemExplanatoryKey,
                        errorKey: itemErrorKey,   // error report encoder will know to access errorKey for items within rejectItems

                        serviceCode,
                        feeSubmitted: record.substr(10, 6),
                        numberOfServices: record.substr(16, 2),
                        serviceDate: record.substr(18, 8),
                    });
                }
                else {
                    // only process acceptItems for accepted/non-rejected claims

                    currentClaim.items.push({
                        serviceCode,
                        feeSubmitted: record.substr(10, 6),
                        numberOfServices: record.substr(16, 2),
                        serviceDate: record.substr(18, 8),
                    });
                }

            }

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
            ...(newResources.pop()),
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

const getResourcesByID = (resourceIDs) => {
    return resources.filter((resource) => {
        return resourceIDs.includes(parseInt(resource.resourceID));
    });
};


const getRandomElement = (arr) => {
    return arr[Math.floor(Math.random() * arr.length)];
};

const getResponseCode = (hcvRequest) => {

    const {
        healthNumber,
    } = hcvRequest;

    return healthNumber.substr(8, 2);
};



/**
 * const isNoData - determines if any "Personal Characteristics" should be
 * returned with a validation result. According to the "Technical Specifications
 * for Health Card Validation (HCV) Service via Electronic Business Services
 * (EBS)", appendix A, response codes 05, 10, & 15 never return "Personal
 * Characteristics."
 *
 * For testing purposes, if the user specifies that the "Version Code" is "ND",
 * then
 *
 * @param  {object}  hcvRequest the HCV request parameters
 * @return {boolean}            true if the version code is "ND" OR one of the
 *                              response code (determined from the HCV
     *                          parameters) is '05', '10', or '15'
 */
const isNoData = (hcvRequest) => {

    const {
        versionCode,
    } = hcvRequest;

    return versionCode === 'ND' || ['05', '10', '15'].includes(getResponseCode(hcvRequest));
};

/**
 * const hasNDResponseID - determines if there are any response IDs with "_ND" at the
 * end associated with the response code produced from the specified HCV request
 * parameters. According to the "Technical Specifications for Health Card
 * Validation (HCV) Service via Electronic Business Services (EBS)", appendix A,
 * the only response codes that don't have a response ID with "_ND" at the end
 * are '05', '10', '15', and '90'
 *
 * @param  {object} hcvRequest the HCV request parameters
 * @return {boolean}           if the response code produced from the specified
 *                             HCV parameters is not '05', '10', '15', or '90'
 */
const hasNDResponseID = (hcvRequest) => {
    return !['05', '10', '15', '90'].includes(getResponseCode(hcvRequest));
};

const generateCategory1HCVResult = (hcvRequest) => {

    const {
        healthNumber,
        versionCode,
    } = hcvRequest;

    const responseCode = getResponseCode(hcvRequest);
    const hcvResponseTemplate = hcvResponseTemplatesByCode[responseCode]
                             || hcvResponseTemplatesByCode[getRandomElement(Object.keys(hcvResponseTemplatesByCode))];
    const responseIDs = hcvResponseTemplate.responseIDs;

    let responseID = getRandomElement(responseIDs);
    if (versionCode === 'ND' && hasNDResponseID(hcvRequest)) {
        // only return an ND responseID if the tester requested this with
        // an ND version code and there's an ND response ID associated with
        // the response code
        responseID += '_ND';
    }

    return {
        responseCode,
        responseID,
        responseAction: hcvResponseTemplate.responseAction,
        responseDescription: hcvResponseTemplate.responseDescription,
    };
};


const generateCategory2HCVResult = (hcvRequest) => {

    const {
        healthNumber,
        versionCode,
    } = hcvRequest;


    return {
        ...generateCategory1HCVResult(hcvRequest),
        healthNumber,
        versionCode,
        firstName: 'Nerfy',
        secondName: 'Nerf',
        lastName: 'McNerferson',
        gender: 'M',
        dateOfBirth: moment(MILLISECONDS_SINCE_EPOCH).format(DATE_TIME_FORMAT),
        expiryDate: moment().add(1, 'days').format(DATE_TIME_FORMAT),
    };
};

const generateHCVResults = (hcvRequests) => {
    return hcvRequests.map((hcvRequest) => {

        const {
            versionCode,
        } = hcvRequest;

        return isNoData(hcvRequest) ? generateCategory1HCVResult(hcvRequest) : generateCategory2HCVResult(hcvRequest);
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

        updateRemittanceAdvice(resources).forEach((resource) => {
            resources.push({
                resourceID: nextResourceID++,
                ...resource,
            });
        });

        return xml[EDT_SUBMIT](submitResults);
    },

    [EDT_LIST]: (ctx) => {
        logger.debug('OHIP EBS Nerf list', ctx.eventDetail);

        const {
            resourceType,
            status,
            pageNo,
        } = ctx.eventDetail.list;

        const results = resources.filter((resource) => {

            return (!resourceType || resource.resourceType === resourceType)
                && (!status || resource.status === status);

        }).reduce((listResults, resource) => {

            return listResults.concat({
                resource,
                responseCode: SUCCESS,
            });
        }, []);

        return xml[EDT_LIST]({results, pageNo});
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
        const hcvResults = generateHCVResults(ctx.eventDetail[HCV_REAL_TIME].hcvRequests);

        const foo = xml[HCV_REAL_TIME](hcvResults);
        return foo;
    },
};
