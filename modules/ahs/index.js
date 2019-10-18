'use strict';

const _ = require('lodash');
const ahs = require('../../server/data/ahs/index');
const claimWorkBenchController = require('../../server/controllers/claim/claim-workbench');
const validateClaimsData = require('../../server/data/claim/claim-workbench');
const sftp = require('./sftp');
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

        let sftpdata = {
            fileName:submitResponse.file_name,
            folderPath:submitResponse.dir_path
        };

        let sftpResult = await sftp.upload(sftpdata);

        if(sftpResult && sftpResult && sftpResult.response.status === 'ok') {              

            await ahs.updateClaimsStatus({
                claimIds: args.claimIds,
                CLAIM_STATUS_PENDING_ACKNOWLEDGMENT_DEFAULT,
                claimNote: 'Electronically submitted through SFTP',
                userId: args.userId,
            });

            await ahs.updateEDIFileStatus({
                status:'success',
                ediFileId: submitResponse.edi_file_id
            });

        } else {
            await ahs.updateEDIFileStatus({
                status:'failure',
                ediFileId: submitResponse.edi_file_id
            });
        }

        return callback(null, sftpResult);
    }
};
