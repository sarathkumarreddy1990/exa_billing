'use strict';
const moment = require('moment');
const fse = require('fs-extra');
const crypto = require('crypto');
const fs = require('fs');
const mhsController = require('../../server/controllers/mhs');
const processClaim = require('./encoder/claims');
const logger = require('../../logger');
const {
    promisify,
} = require('util');

const statAsync = promisify(fs.stat);


const mhsmodules = {
    /**
     * Claim submission
     *
     * @param  {Object} args  encoder object
     */
    submitClaims: async (args) => {
        try {
            logger.info('Initiated claim submition process...');

            if (args.isAllClaims) {
                let ediResponse = await mhsController.getClaimsForEDI(args);

                if (ediResponse.isNotpendingSubmission) {
                    return { isNotpendingSubmission: true };
                }

                args.claimIds = ediResponse.claimIds;
            }

            args.claimIds = args.claimIds.split(',');
            let result = await mhsController.submitClaim(args);
            let claimData = {};
            let fileTotalBillFee = 0;

            // Get company and file store Details
            const companyFileStoreDetails = await mhsController.getCompanyFileStore(args.companyId);

            if (!companyFileStoreDetails || companyFileStoreDetails.length === 0) {
                return  { isFileStoreError: true };
            }

            // Grouping claims based on practitioner and calculating total bill fee

            for (let i = 0; i < result.length; i++) {
                let claim = result[i];
                let claimFee = parseFloat(claim.claim_total_bill_fee);
                fileTotalBillFee = claimFee + parseFloat(fileTotalBillFee);

                // Restricting based on max allowed size for claim fee in encoder
                if (claimFee > 9999.99) {
                    return { isClaimBillFeeError: true };
                }

                if (!claimData[`${claim.practitioner.prid}`]) {
                    claimData[`${claim.practitioner.prid}`] = [];
                }

                claimData[`${claim.practitioner.prid}`].push(claim);
            }

            // Restricting based on max allowed size for batch and file total fee in encoder
            if (fileTotalBillFee > 99999999.99) {
                return { isTotalBillFeeError: true };
            }

            let encodeData = {
                claimData,
                companyInfo: companyFileStoreDetails[0]
            };

            // Encode Process
            const encoderResult = await processClaim.encoder(encodeData);

            const {
                file_store_id,
                root_directory,
            } = companyFileStoreDetails.pop();

            const now = moment();
            const today = now.format('YYYY/MM/DD');
            let alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'; // file name must only start with alphabets 

            const randomFileName = alphabet[Math.floor(Math.random() * alphabet.length)] + alphabet[Math.floor(Math.random() * alphabet.length)];
            const file_name = `${randomFileName}${now.format('hhmmss')}.txt`;
            const file_path = `MHSAL/Claims/${today}`;
            const fullPath = `${root_directory}/${file_path}/${file_name}`;

            try {
                await statAsync(root_directory);
            } catch (e) {
                logger.error('Unable to find file store- ', e);
                return { unableToWriteFile: true };
            }

            await fse.outputFile(fullPath, encoderResult.encodedText);

            const statAfter = await statAsync(fullPath);
            const file_size = statAfter.size;
            const file_md5 = crypto
                .createHash('MD5')
                .update(encoderResult.encodedText, 'utf8')
                .digest('hex');

            let ediFileId = await mhsController.storeFile({
                file_store_id,
                file_path,
                file_name,
                file_md5,
                file_size,
                companyId: args.companyId
            });

            await mhsController.ediFiles({
                ediFileId,
                claimIds: args.claimIds
            });

            await mhsController.updateClaimsStatus({
                claimIds: args.claimIds,
                statusCode: 'PP',
                claimNote: 'Electronic claim to MHSAL (primary)',
                userId: args.userId,
            });

            return {
                id: ediFileId
            };
        } catch (err) {
            logger.error('Could not submit claim - ', err);
            return {
                error: true
            };
        }
    }
};

module.exports = mhsmodules;
