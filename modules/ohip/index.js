const EBSConnector = require('./ebs');
const {
    BATCH_EDIT,
    CLAIMS_MAIL_FILE_REJECT_MESSAGE,
    ERROR_REPORTS,
} = require('./constants').resourceTypes;

const responseCodes = require('./hcv/responseCodes');
const mod10Check = require('./hcv/mod10Check');
// const ClaimSubmissionEncoder = require('./encoder/claim');
const Parser = require('./parser');


// this is the high-level business logic and algorithms for OHIP
//  * use cases are defined here
//  *

const ebsConfig = {
    // TODO: EXA-12674
    softwareConformanceKey: 'b5dc648e-581a-4886-ac39-c18832d12e06',
    auditID:124355467675,
    serviceUserMUID: 614200,
    username: "confsu+355@gmail.com",
    password: "Password1!",
};


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
 * module - creates a new OHIP module
 *
 * @param  {type} billingApi provides a high level billing API for this module
 * @return {type}            description
 */
module.exports = function(billingApi) {

    return {

        // takes an array of Claim IDs
        submitClaim: async (args, callback) => {

            const ebs = new EBSConnector(ebsConfig);

            // TODO
            // 1 - create claims file from claims with propper date format
            const uploads = [
                {
                    resourceType: 'CL',
                    // TODO: EXA-12673
                    filename: 'modules/ohip/ebs/HGAU73.441',
                    description: 'HGAU73.441',
                }
            ];

            // const data = await billingApi.getClaimData({claimIds:'10'});
            //
            //
            // ebs.upload({uploads}, (uploadErr, uploadResponse) => {
            //
            //     if (uploadErr) {
            //         return callback(uploadErr, uploadResponse);
            //     }
            //
            //     const resourceIDs = getResourceIDs(uploadResponse);
            //
            //     return ebs.submit({resourceIDs}, (submitErr, submitResponse) => {
            //
            //         if (submitErr) {
            //             return callback(submitErr, submitResponse);
            //         }
            //         const resourceIDs = getResourceIDs(submitResponse);
            //
            //         // 4 - update database mark as 'pending acknowledgment'
            //         //
            //
            //         // 5 - move file from proper filename to final filename and save
            //         // to edi_file_claims
            //
            //         // 6 - move response file to final filename and save
            //         // to edi_file_related (or whatever it's called)
            //
            //         return callback(null, submitResponse);
            //     });
            // });
        },

        sandbox: async (args, callback) => {

            const ebs = new EBSConnector(ebsConfig);
            const f = await billingApi.applyBatchEditReport({
                batchCreateDate: new Date(),
                batchSequenceNumber: 0,
            });

            return callback(null, {message:'hello, world'});

        },
        // TODO: EXA-12016
        processResponseFiles: (args, callback) => {

            const ebs = new EBSConnector(ebsConfig);

            ebs.list({resourceType: BATCH_EDIT}, (listErr, listResponse) => {

                const resourceIDs = listResponse.data.map((detailResponse) => {
                    return detailResponse.resourceID;
                });

                ebs.download({resourceIDs}, async (downloadErr, downloadResponse) => {

                    if (downloadErr) {
                        await billingApi.storeFile({filename:'downloadResponse-error.txt',data:downloadResponse});
                    }
                    else {
                        await billingApi.storeFile({filename:'downloadResponse.json',data:JSON.stringify(downloadResponse)});
                    }

                    const filepaths = [];
                    downloadResponse.data.forEach(async (downloadData) => {

                        await billingApi.storeFile({
                            data: downloadData.content,
                            filename: downloadData.description,
                        });
                    });

                    callback(null, downloadResponse);
                });
            });

            // ebs.list({resourceType: ERROR_REPORTS}, (listErr, listResponse) => {
            //     const resourceIDs = listResponse.data.map((detailResponse) => {
            //         return detailResponse.resourceID;
            //     });
            //
            //     ebs.download({resourceIDs}, (downloadErr, downloadResponse) => {
            //         // TODO: billingApi.handleClaimsErrorReportFile
            //         console.log(`Claims Error Report downloaded with resource ID: ${detailResponse.resourceID}`);
            //
            //     });
            // });
            //
            // ebs.list({resourceType: CLAIMS_MAIL_FILE_REJECT_MESSAGE}, (listErr, listResponse) => {
            //     const resourceIDs = listResponse.data.map((detailResponse) => {
            //         return detailResponse.resourceID;
            //     });
            //
            //     ebs.download({resourceIDs}, (downloadErr, downloadResponse) => {
            //         // TODO: billingApi.handleClaimsErrorReportFile
            //         console.log(`Claims File Reject Message downloaded with resource ID: ${detailResponse.resourceID}`);
            //
            //     });
            // });

        },

        validateHealthCard: (args, callback) => {
            const ebs = new EBSConnector(ebsConfig);

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
    };
};
