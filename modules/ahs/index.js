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
const wcbWorkBenchController = require('./wcb/index').submitClaims;
const validateClaimsData = require('../../server/data/claim/claim-workbench');
const sftp = require('./sftp');
const claimEncoder = require('./encoder/claims');
const logger = require('../../logger');
const siteConfig = require('../../server/config');
const uploadDirPath = siteConfig.get('ahsSFTPSendFolder') || `UPLOAD`;
const sftpClient = require('ssh2-sftp-client');
const privateKeyPath = siteConfig.get('ahsSFTPPrivateKeyPath');
const config = {
    host: siteConfig.get('ahsSFTPAddress'),
    user: siteConfig.get('ahsSFTPUser'),
    password: siteConfig.get('ahsSFTPPassword'),
    port: siteConfig.get('ahsSFTPPort'),
    algorithms: { cipher: ['aes128-cbc'] },
    privateKey: fs.existsSync(privateKeyPath) && fs.readFileSync(privateKeyPath, 'utf8'),
    passphrase: siteConfig.get('ahsSFTPPrivateKeyPassPhrase') || undefined // wont be needed in production
};

const ahsmodule = {

    submitClaims: async (args) => {

        if (args.isAllClaims) {
            let ediResponse = await claimWorkBenchController.getClaimsForEDI(args);

            if (ediResponse.isInvalidBillingMethod || ediResponse.isMultipleInsurances) {
                return ediResponse;
            }

            if (ediResponse.isWCBBilling) {
                ediResponse.companyId = args.companyId;
                ediResponse.source = args.source;
                ediResponse.userId = args.userId;
                let wcbResponse =  await wcbWorkBenchController(ediResponse) || {};
                wcbResponse.isWCBBilling = true;
                return wcbResponse;
            }

            args.claimIds = ediResponse.claimIds;
        }

        args.claimIds = args.claimIds && args.claimIds.split(',');

        const validationResponse = {
            validationMessages: [],
        };
        let validationData = await validateClaimsData.validateEDIClaimCreation(args.claimIds);
        validationData = validationData && validationData.rows && validationData.rows.length && validationData.rows[0] || [];

        let ahsClaimResults = await ahs.validateAhsClaim(args.claimIds);
        ahsClaimResults = ahsClaimResults && ahsClaimResults.rows && ahsClaimResults.rows.length && ahsClaimResults.rows[0] || {};

        const invalid_claims = ahsClaimResults.incorrect_claims || {};
        const unique_frequency = ahsClaimResults.unique_frequency_count || {};

        /* allowed to submit claim when claim is in any one of the following status:
            PS  - Pending Submission
            APP - AHS Partially Paid
            AZP - AHS Zero Paid
            AOP - AHS Over Paid
            PIF - Paid In Full
            R   - Rejected
            D   - Denied */
        const excludeClaimStatus = ['PS', 'APP', 'AZP', 'PIF', 'R', 'D', 'AOP'];

        let claimStatus = _.difference(_.uniq(validationData.claim_status), excludeClaimStatus); // removed excluded claim status to check other status availability
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

        if (invalid_claims.length > 0) {
            const invalidClaimIds = _.map(invalid_claims, 'id').join(',');
            validationResponse.validationMessages.push(`${invalidClaimIds} are not processed by AHS, Please correct the frequency of claims`);
        }

        if (unique_frequency.length > 1) {
            validationResponse.validationMessages.push('Please select claims of similar claim action');
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

            if (claim.billing_method !== 'electronic_billing') {
                validations.push('Please select valid billing method');
            }

            return validations;
        }, []);

        if (validationMessages.length) {
            return validationMessages;
        }


        let invalidClaims = claimData.filter((data) => ((data.oop_referral_indicator === '' && !data.provider_prid) || !data.service_provider_prid) && data.claim_id) || [];

        if (invalidClaims.length) {
            let uniqueInvalidClaims = _.uniq(invalidClaims.map(obj => obj.claim_id)) || [];
            validationResponse.validationMessages.push(`Claim ${uniqueInvalidClaims.join(',')} does not have service provider prid`);
            return validationResponse;
        }

        if (args.source === 'submit') {
            if (ahsClaimResults && !invalid_claims.length && unique_frequency.length === 1) {
                if (unique_frequency[0].frequency === 'corrected') {
                    args.source = 'change';
                } else {
                    args.source = 'add';
                }
            }
        }

        let sftp_client = new sftpClient;

        try {
            await sftp_client.connect(config);
        } catch (error) {
            logger.error(error);
            return { isConnectionFailed: true };
        }

        const isFolderExists = await sftp_client.exists(uploadDirPath);

        if (!isFolderExists) {
            logger.error('AHS Remote folder not found for upload');
            return { isFolderNotExists: true };
        }

        const {
            companyId,
            screenName,
            clientIp,
            userId,
            entityName,
        } = args;

        args.auditDetails = JSON.stringify({
            company_id: companyId,
            screen_name: screenName,
            module_name: 'claims',
            client_ip: clientIp,
            user_id: userId,
            entity_name: entityName,
        });

        const ahs_claim_ids  = await ahs.saveAHSClaims(args);

        if (ahs_claim_ids?.length) {
            await ahs.deleteCharges(args);
            args.claimIds = args.claimIds.concat(ahs_claim_ids);
        }

        let submitResponse = await ahs.saveAddedClaims(args);
        await ahs.updateAHSClaimNumbers(args);

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
        const {
            targetId,
            claimStatusCode,
        } = args;

        const claimDeleteAccess = await ahs.getPendingTransactionCount(args);
        const {
            pending_transaction_count = 0,
            payment_entry_count = 0,
            claim_balance_amount = 0,
            claim_total_amount = 0,
            claim_applied = 0,
            claim_adjustment = 0
        } = claimDeleteAccess.rows && claimDeleteAccess.rows[0] || {};

        let allowDelete = (payment_entry_count > 0 && (claim_balance_amount === claim_total_amount) && claimStatusCode === 'D')
                            || (payment_entry_count == 0 && ['R', 'BR'].indexOf(claimStatusCode) !== -1)
                            || (pending_transaction_count == 0 && payment_entry_count == 0);

        if (!allowDelete && claimStatusCode === 'AD' && claim_applied !== 0 && claim_adjustment !== 0) {
            return {
                message: 'Claim has payment, Please unapply before delete'
            };
        }

        if (allowDelete) {
            const claimDeletedResult = await ahs.purgeClaim(args);
            const {
                purge_claim_or_charge = false
            } = claimDeletedResult.rowCount && claimDeletedResult.rows[0] || {};

            return {
                message: 'Claim deleted successfully',
                isClaimDeleted: purge_claim_or_charge
            };

        } else if (pending_transaction_count > 0 && payment_entry_count == 0) {
            return {
                message: 'Could not delete claim, Pending Transaction Found in AHS'
            };
        }

        args.claimIds = targetId || null;
        args.source = 'delete';

        try {
            const deleteClaimAhsResult = await ahsmodule.submitClaims(args);
            return deleteClaimAhsResult;
        }
        catch(err){
            logger.error(err);
            return err;
        }

    }
};

module.exports = ahsmodule;
