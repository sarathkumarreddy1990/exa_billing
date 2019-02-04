const EBSConnector = require('./ebs');

const responseCodes = require('./hcv/responseCodes');

// const Encoder = require('./encoders/batchClaimSubmission');
// const Parser = require('./parser');

// this is the high-level business logic and algorithms for OHIP
//  * use cases are defined here
//  *

const ebsConfig = {
    // TODO: load these from configuration
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
            console.log(response);
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
        submitClaims: (args, callback) => {

            const ebs = new EBSConnector(ebsConfig);

            // ebs.download({resourceIDs:[62160]}, (downloadErr, downloadResponse) => {
            //     console.log(downloadResponse);
            // });
            //
            // ebs.getTypeList({}, (gtlErr, gtlResponse) => {
            //     // console.log(gtlResponse);
            // });

            // TODO
            // 1 - create claims file from claims with propper date format

            const uploads = [
                {
                    resourceType: 'CL',
                    filename: 'modules/ohip/ebs/HGAU73.441',
                    description: 'HGAU73.441',
                }
            ];

            ebs.upload({uploads}, (uploadErr, uploadResponse) => {

                if (uploadErr) {
                    return callback(uploadErr, uploadResponse);
                }

                const resourceIDs = getResourceIDs(uploadResponse);


                // ebs.list({status:'UPLOADED', resourceType:'CL'}, (listErr, listResponse) => {
                //     console.log(listResponse);
                // });

                ebs.submit({resourceIDs}, (submitErr, submitResponse) => {

                    if (submitErr) {
                        return callback(submitErr, submitResponse);
                    }
                    const resourceIDs = getResourceIDs(submitResponse);


                    // ebs.info({resourceIDs}, (infoErr, infoResponse) => {
                    //     console.log(infoResponse);
                    // });

                    // ebs.list({status:'SUBMITTED'}, (listErr, listResponse) => {
                    //     console.log(listResponse);
                    // });

                    // 4 - update database mark as 'pending acknowledgment'
                    //

                    // 5 - move file from proper filename to final filename and save
                    // to edi_file_claims

                    // 6 - move response file to final filename and save
                    // to edi_file_related (or whatever it's called)

                    return callback(null, submitResponse);
                });
            });
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

        downloadGenericGovernanceReport: () => {
            console.log('TODO implement downloadGenericGovernanceReport');
        },

        downloadRemittanceAdvice: () => {
            console.log('TODO implement downloadRemittanceAdvice');
        },
    };
};
