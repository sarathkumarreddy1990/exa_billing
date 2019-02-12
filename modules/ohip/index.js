const EBSConnector = require('./ebs');
const {
    BATCH_EDIT,
    CLAIMS_MAIL_FILE_REJECT_MESSAGE,
    ERROR_REPORTS,
} = require('./constants').resourceTypes;

const responseCodes = require('./hcv/responseCodes');

const ClaimsEncoder = require('./encoder/claims');
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
        submitClaims: async (args, callback) => {


            // TODO
            // 1 - convert args.claimIds to claim data (getClaimsData)
            const claimData = await billingApi.getClaimsData(args);

            // 2 - run claim data through encoder
            const claimEnc = new ClaimsEncoder();
            const lastSubmissionSequenceNumber = 123;   // i.e. 'HBAU73.123'
            let submissionSequenceOffset = 0;
            const context = {
                batchDate: new Date(),
                batchSequenceNumber: 0, // TODO this needs to be set in the encoder
            };
            const claimSubmissions = claimEnc.encode(claimData, context).map((submission) => {
                submissionSequenceOffset++;
                return {
                    filename: 'HGAU73.' + (lastSubmissionSequenceNumber + submissionSequenceOffset),
                    data: submission,
                };
            });
            // console.log('claimSubmissions: ', claimSubmissions);

            // 3 - store the file(s) that encoder produces (storeFile)
            // TODO this is really hacky but EBS connector doesn't support
            // multiple uploads yet.
            const {
                filename,
                data,
            } = claimSubmissions[0];
            const {
                edi_file_id,
                fullPath,
            } = await billingApi.storeFile({
                filename,
                data,
            });

            // console.log(fileInfo);
            // return callback(null, claimSubmissions);

            const ebs = new EBSConnector(ebsConfig);
            //
            // // TODO
            // // 1 - create claims file from claims with propper date format
            const uploads = [
                {
                    resourceType: 'CL',
                    // TODO: EXA-12673
                    filename: fullPath,
                    description: filename,
                }
            ];

            // // 4 - upload file to OHIP
            //
            ebs.upload({uploads}, (uploadErr, uploadResponse) => {

                if (uploadErr){
                    console.log('error uploading: ', uploadErr);
                    //      a. failure -> update file status ('error'), return callback
                    billingApi.updateFileStatus({edi_file_id, status: 'failure'});
                    return callback(uploadErr, uploadResponse);
                }

                //      b. success -> update file status ('uploaded'), proceed
                billingApi.updateFileStatus({edi_file_id, status: 'in_progress'});

                const resourceIDs = getResourceIDs(uploadResponse);

                // 5 - submit file to OHIP
                return ebs.submit({resourceIDs}, (submitErr, submitResponse) => {

                    if (submitErr) {
                        console.log('error submitting: ', submitErr);
                        //      a. failure -> update file status ('error'), delete file from ohip
                        billingApi.updateFileStatus({edi_file_id, status: 'failure'});
                        return callback(submitErr, submitResponse);
                    }

                    //      b. success -> update file status ('submitted'), proceed
                    billingApi.updateFileStatus({edi_file_id, status: 'success'});


                    // 6 - check if response file exists yet
                    //      a. yes -> apply response file
                    // 7 - return callback

                    const resourceIDs = getResourceIDs(submitResponse);

                    return callback(null, submitResponse);
                });
            });
        },

        sandbox: async (args, callback) => {
            const ebs = new EBSConnector(ebsConfig);
            const f = await billingApi.loadFile({edi_files_id: 38});
            console.log(f);
            //
            // ebs.list({status:'UPLOADED', resourceType:'CL'}, (listErr, listResponse) => {
            //     console.log(listResponse);
            // });
            //
            // return ebs.download({resourceIDs:[62152]}, (downloadErr, downloadResponse) => {
            // // return ebs.list({resourceType:'ER'}, (downloadErr, downloadResponse) => {
            //     return callback(downloadErr, downloadResponse);
            // });
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

            if (healthNumber.length === 10) {
                if (versionCode === 'OK') {
                    result.isValid = true;
                    // yes, there are multiple "sufficiently valid" results
                    result.responseCode = getRandomValidHealthNumberResponseCode();
                }
                else {
                    result.responseCode = 65;
                }
            }
            else {
                result.responseCode = 25;
            }

            result.descriptiveText = responseCodes[result.responseCode];

            return callback(null, result);
        },
    };
};
