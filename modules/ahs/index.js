'use strict';

const {
    promisify,
} = require('util');

const fs = require('fs');
const writeFileAsync = promisify(fs.writeFile);
const statAsync = promisify(fs.stat);
const crypto = require('crypto');
const _ = require('lodash');
const ahs = require('../../server/data/ahs/index');
const claimWorkBenchController = require('../../server/controllers/claim/claim-workbench');
const validateClaimsData = require('../../server/data/claim/claim-workbench');
const sftp = require('./sftp');
const claimEncoder = require('./encoder/claims');

const ahsmodule = {

    submitClaims: async (args) => {

        if (args.isAllClaims) {
            args.claimIds = await claimWorkBenchController.getClaimsForEDI(args);
        }

        args.claimIds = args.claimIds && args.claimIds.split(',');

        const validationResponse = {
            validationMessages: [],
        };
        let validationData = await validateClaimsData.validateEDIClaimCreation(args.claimIds);
        validationData = validationData && validationData.rows && validationData.rows.length && validationData.rows[0] || [];

        let ahsClaimResults = await ahs.validateAhsClaim(args.claimIds);
        ahsClaimResults = ahsClaimResults && ahsClaimResults.rows && ahsClaimResults.rows.length && ahsClaimResults.rows[0] || [];

        const invalid_claims = ahsClaimResults && ahsClaimResults.incorrect_claims || [];
        const unique_frequency = ahsClaimResults && ahsClaimResults.unique_frequency_count || [];

        let claimStatus = _.without(_.uniq(validationData.claim_status), 'PS'); // (Pending Submission - PS) removed to check for other claim status availability
        // Claim validation

        if (validationData) {

            if (claimStatus.length) {
                validationResponse.validationMessages.push('All claims must be validated before submission');
            }

            if (validationData.unique_billing_method_count > 1) {
                validationResponse.validationMessages.push('Please select claims with same type of billing method');
            }

            if (validationData.invalid_claim_count > 0) {
                validationResponse.validationMessages.push('Claim date should not be greater than the current date');
            }

        }

        if (ahsClaimResults) {
            if (invalid_claims.length > 0) {
                const invalidClaimIds = _.map(invalid_claims, 'id').join(',');
                validationResponse.validationMessages.push(`${invalidClaimIds} are not processed by AHS, Please correct the frequency of claims`);
            }

            if (unique_frequency.length > 1) {
                validationResponse.validationMessages.push('Please select claims of similar claim type');
            }
        }

        if (validationResponse.validationMessages.length) {
            return validationResponse;
        }

        const claimData = await ahs.getClaimsData({claimIds: args.claimIds});

        const validationMessages = claimData.reduce((validations, claim) => {

            const claimItems = claim.claim_totalCharge;

            if (!claimItems) {
                validations.push(`Claim ${claim.claim_id} has no billable charges`);
            }

            return validations;
        }, []);

        if (validationMessages.length) {
            return validationMessages;
        }

        if (args.source === 'submit') {
            if (ahsClaimResults && !invalid_claims.length && unique_frequency.length === 1) {
                if (unique_frequency[0].frequency === 'corrected') {
                    args.source = 'change';
                } else {
                    args.source = 'submit';
                }
            }
        }

        let submitResponse = await ahs.saveAddedClaims(args);

        const {
            dir_path,
            file_name,
            edi_file_id,
            rows,
        } = submitResponse;

        const fullPath = `${dir_path}/${file_name}`;
        const encoded_text = claimEncoder.encode(rows);
        await writeFileAsync(fullPath, encoded_text, { 'encoding': 'utf8' });
        const statAfter = await statAsync(fullPath);
        const file_size = statAfter.size;
        const file_md5 = crypto
            .createHash('MD5')
            .update(encoded_text, 'utf8')
            .digest('hex');

        const fileInfo = {
            file_size,
            file_md5,
        };

        let sftpdata = {
            fileName: file_name,
            folderPath: dir_path
        };

        let sftpResult = await sftp.upload(sftpdata);

        if ( sftpResult && sftpResult.response && sftpResult.response.status === 'ok' ) {

            await ahs.updateClaimsStatus({
                claimIds: args.claimIds,
                statusCode: 'PA',
                claimNote: 'Electronically submitted through SFTP',
                userId: args.userId,
            });

            await ahs.updateEDIFile({
                status: 'success',
                ediFileId: edi_file_id,
                fileInfo,
            });

        }
        else {
            await ahs.updateEDIFile({
                status: 'failure',
                ediFileId: edi_file_id,
                fileInfo,
            });
        }

        return sftpResult;
    },

    //Submitting the claim again to AHS using the supporting text
    reassessClaim: async (args) => {

        let reAssessResponse = await ahs.updateSupportingText({
            claimId: args.claimIds,
            supportingText: args.supportingText
        });

        if (reAssessResponse instanceof Error) {
            return reAssessResponse;
        }

        return await ahsmodule.submitClaims(args);
    },

    // Submitting the claim delete request to AHS for already Paid Claim
    deleteAhsClaim: async (args) => {
        const claimDeleteAccess = await ahs.getPendingTransactionCount(args);
        const deleteData = claimDeleteAccess.rows && claimDeleteAccess.rows[0];

        if (deleteData.pending_transaction_count > 0) {
            return { message: 'Could not delete claim, Pending Transaction Found in AHS' };
        }

        args.claimIds = args.targetId || null;
        args.source = 'delete';

        const deleteClaimAhsResult = await ahsmodule.submitClaims(args);

        ahs.updateClaimsStatus({
            claimIds: args.claimIds,
            statusCode: 'ADP',
            claimNote: 'AHS Delete Pending',
            userId: args.userId,
        });

        return deleteClaimAhsResult;
    }
};

module.exports = ahsmodule;
