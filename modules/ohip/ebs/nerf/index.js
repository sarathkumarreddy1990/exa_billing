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
const _ = require('lodash');

const resources = [];

let nextResourceID = 60000;

let nextBatchEditSequenceNumber = 0;


// matches service codes beginning with 'X' -- used to determine if an entire Claims File should be rejected
const rejectionFlagMatcher = /X[0-9]{3}[A-Z]/;

// matches service codes beginning with 'E' -- used to determine if a claim (within a batch) should be rejected
const correctionFlagMatcher = /E[0-9]{3}[A-Z]/;

// matches service codes beginning with 'Z' -- used to determine if an entire batch (within a submission) should be rejected
const badBatchFlagMatcher = /Z[0-9]{3}[A-Z]/;


const batchEditTemplate = _.template(`HB1V0300001000000<%=batchId%>J207315781257822HCP/WCBBGAA170332<%=numClaims%><%=numRecords%><%=batchProcessDate%>     ***  BATCH TOTALS  ***`);


const remittanceAdviceEncoder = require('./remittanceAdviceEncoder');
const rejectMessageEncoder = require('./rejectMessageEncoder');

const getClaimFileStats = (resource) => {

    const claimFileData = fs.readFileSync(resource.filename, 'ascii');
    const claimFileRecords = claimFileData.split('\r');

    let shouldRejectSubmission = false;
    let recordImage = null;
    let groupNumber = null;

    let currentBatch = null;
    let currentClaim = null;

    const batches = claimFileRecords.reduce((results, record, index) => {
        if (/^HEBV03/.test(record)) {

            currentBatch = {
                batchId: record.substr(7, 12),  // for Batch Edit reports
                providerNumber: record.substr(29, 6),
                groupNumber: record.substr(25, 4),
                specialty: record.substr(35, 2),
                claims: [],

                // shouldReject: false,
                rejects: [],
            };

            if (!index) {
                // the recordImage of a Reject Message corresponds to the
                // first 37 characters of the first record of a claims file
                recordImage = record.substr(0, 37);
                groupNumber = recordImage.substr(25, 4);
            }
            results.push(currentBatch);
        }
        else if (/^HEH/.test(record)) {

            currentClaim = {
                healthRegistrationNumber: record.substr(3, 10), // this or use Registration Number from header-2 record.substr(3,12)
                versionCode: record.substr(13, 2),    // from claim header - 1
                accountingNumber: record.substr(23, 8),   // from claim header - 1
                paymentProgram: record.substr(31, 3),
                serviceLocationIndicator: record.substr(58, 4), // from claim header - 1

                items: [],
                shouldReject: false,
            };

            currentBatch.claims.push(currentClaim);
        }
        else if (/^HER/.test(record)) {
            // const currentBatch = results[results.length-1];
            // currentClaim = currentBatch.claims[currentBatch.claims.length - 1];

            currentClaim.patientLastName = record.substr(15, 9);    // "spaces except for RMB claims" (from claim header - 2)
            currentClaim.patientFirstName = record.substr(24, 5);   // "spaces except for RMB claims" (from claim header - 2)
            currentClaim.provinceCode = record.substr(30, 2);   // from claim header - 1
        }

        else if (/^HET/.test(record)) {

            // const currentBatch = results[results.length - 1];
            // const currentClaim = currentBatch.claims[currentBatch.claims.length - 1];


            // determine if this Claims File was intended to be corrected, if
            // the Claim itself should be rejected, or neither
            const serviceCode = record.substr(3, 5);
            if (rejectionFlagMatcher.test(serviceCode)) {
                console.log(`\n\n****NERF**** bad submission flag set (${serviceCode})`);
                shouldRejectSubmission = true;
            }
            else if (badBatchFlagMatcher.test(serviceCode)) {
                console.log(`\n\n****NERF**** bad batch flag set (${serviceCode})`);
                // currentBatch.shouldReject = true;
            }
            else if (correctionFlagMatcher.test(serviceCode)) {
                console.log(`\n\n****NERF**** bad claim flag set (${serviceCode})`);
                currentBatch.rejects.push(currentClaim);
            }

            currentClaim.items.push({
                serviceCode,
                feeSubmitted: record.substr(10, 6),
                numberOfServices: record.substr(16, 2),
                serviceDate: record.substr(18, 8),
            });
        }
        else if (/^HEE/.test(record)) {

            // const currentBatch = results[results.length - 1];

            currentBatch.numClaims = parseInt(record.substr(3, 4));
            currentBatch.numRecords = currentBatch.numClaims
                                    + parseInt(record.substr(7, 4))
                                    + parseInt(record.substr(11, 5))
                                    + 2; // batch header and batch trailer

        }

        return results;
    }, []);

    return {
        batches,
        recordImage,
        groupNumber,
        shouldRejectSubmission,
        totalRecordLength: claimFileRecords.length,
    };
};


const handleSubmission = (resource, processDate) => {

    resource.claimFileStats = getClaimFileStats(resource);

    if (resource.claimFileStats.shouldRejectSubmission) {
        resources.push({
            resourceID: nextResourceID++,
            status: 'DOWNLOADABLE',
            content: rejectMessageEncoder({
                recordImage: resource.claimFileStats.recordImage,
                providerFileName: getResourceFilename(resource.filename),
                mailFileDate: formatDate(resource.createTimestamp),
                mailFileTime: formatTime(resource.createTimestamp),

            }),
            description: `X${getMonthCode(processDate)}${resource.claimFileStats.groupNumber}.${formatAlphanumeric(nextBatchEditSequenceNumber++, 3, '0')}`,
            resourceType: 'MR',
            createTimestamp: processDate,
            modifyTimestamp: processDate,
        });
    }
    else {
        const batchEditReports = resource.claimFileStats.batches.forEach((batch) => {
            // console.log('NERF processing claimFileStats batch: ', batch);
            resources.push({
                resourceID: nextResourceID++,
                status: 'DOWNLOADABLE',
                content: batchEditTemplate({
                    batchId: batch.batchId,
                    numClaims: formatAlphanumeric(batch.numClaims, 5, '0'),
                    numRecords: formatAlphanumeric(batch.numRecords, 6, '0'),
                    batchProcessDate: formatDate(new Date()),
                }),
                description: `B${getMonthCode(processDate)}${batch.groupNumber}.${formatAlphanumeric(nextBatchEditSequenceNumber++, 3, '0')}`,
                resourceType: 'BE',
                createTimestamp: new Date(),
                modifyTimestamp: new Date(),
            });
        });
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
