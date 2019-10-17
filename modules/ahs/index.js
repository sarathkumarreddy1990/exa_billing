'use strict';

const _ = require('lodash');
const ahs = require('../../server/data/ahs/index');
const claimWorkBenchController = require('../../server/controllers/claim/claim-workbench');
const validateClaimsData = require('../../server/data/claim/claim-workbench');
const {
    CLAIM_STATUS_PENDING_ACKNOWLEDGMENT_DEFAULT,
} = require('./constants');

module.exports = {

    submitClaims: async (args, callback) => {

        if (args.isAllClaims) {
            args.claimIds = await claimWorkBenchController.getClaimsForEDI(args);
        }

        args.claimIds = args.claimIds && args.claimIds.split(',');

        let validationData = await validateClaimsData.validateEDIClaimCreation(args.claimIds);
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

        const claimData = await ahs.getClaimsData({claimIds:args.claimIds});

        const validationMessages = claimData.reduce((validations, claim) => {

            const claimItems = claim.claim_totalCharge;

            if (!claimItems) {
                validations.push(`Claim ${claim.claim_id} has no billable charges`);
            }

            return validations;
        }, []);

        if (validationMessages.length) {
            return callback(null, {validationMessages});
        }


        let submitResponse = await ahs.saveAddedClaims(args);

        // SFTP  connection
        // statusCode ='PS';// if STFP is not connected/error
        //statusCode ='PA'; //if STFP is  connected/Success
        // await ahs.updateEDIFileStatus({
        //                     status:suceess,
        //                     ediFileId: submitResponse.edi_file_id
        //})
        //const statusCode = CLAIM_STATUS_PENDING_ACKNOWLEDGMENT_DEFAULT;
        // await ahs.updateClaimsStatus({
        //                     claimIds: args.claimIds,
        //                     statusCode,
        //                     ediFileId: submitResponse.edi_file_id
        //                     claimNote: 'Electronically submitted through SFTP',
        //                     userId: args.userId,
        //                 }); //update claim status based on SFTP response

        return callback(null, submitResponse);
    }
};
