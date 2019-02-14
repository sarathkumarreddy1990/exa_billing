
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
    chunk,
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
 * module - creates a new OHIP module
 *
 * @param  {type} billingApi provides a high level billing API for this module
 * @return {type}            description
 */
module.exports = function(billingApi) {

    let ohipConfig = null;
    const getConfig = async () => {
        if (!ohipConfig) {
            ohipConfig = await billingApi.getOHIPConfiguration();
        }
        return ohipConfig;
    };

    /**
     * const download - description
     *
     * @param  {type} args     description
     * @param  {type} callback description
     * @returns {type}          description
     */
    const download = async (args, callback) => {

        const {
            resourceType,
        } = args;

        const ebs = new EBSConnector(await getConfig());

        ebs.list({resourceType}, async (listErr, listResponse) => {

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

            chunk(allResourceIDs, MAX_DOWNLOADS_PER_REQUEST).forEach((resourceIDs) => {

                ebs.download({resourceIDs}, async (downloadErr, downloadResponse) => {

                    // console.log("Download response: ${downloadResponse}");

                    if (downloadErr) {
                        await billingApi.storeFile({filename:'downloadResponse-error.txt', data: JSON.stringify(downloadResponse)});
                        return callback(downloadErr, null);
                    }
                    else {
                        await billingApi.storeFile({filename:'downloadResponse.json', data: JSON.stringify(downloadResponse)});
                    }

                    const ediFiles = [];

                    downloadResponse.data.forEach(async (downloadData) => {
                        ediFiles.push(await billingApi.storeFile({
                            data: downloadData.content,
                            filename: downloadData.description,
                        }));

                    });

                    callback(null, ediFiles);
                });
            });



        });
    };

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

            const ebs = new EBSConnector(await getConfig());
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

        fileManagement: async (args, callback) => {
            return callback(null, await billingApi.getFileManagementData());
        },

        sandbox: async (args, callback) => {
            const ebs = new EBSConnector(await getConfig());
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

        downloadRemittanceAdvice: async (args, callback) => {

            const ebs = new EBSConnector(await getConfig());
            download({resourceType:BATCH_EDIT}, (downloadErr, ediFiles) => {
                // console.log(ediFiles);
                // console.log(`err: ${downloadErr}`);
                return callback(downloadErr, ediFiles);
            });
        },

        // TODO: EXA-12016
        processResponseFiles: async (args, callback) => {
            const ebs = new EBSConnector(await getConfig());

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
            args.clientIp = '127.0.0.1' // will remove later once the API called from GUI. To skip not null constraint adding it
            const f_c = await billingApi.getRelatedFile(args.edi_file_id, 'can_ohip_p');
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
