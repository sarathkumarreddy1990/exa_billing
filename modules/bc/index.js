'use strict';
const _ = require('lodash');
const bcController = require('../../server/controllers/bc');
const processClaim = require('./encoder/claims');
const fs = require('fs');
const logger = require('../../logger');
const moment = require('moment');
const crypto = require('crypto');
const fse = require('fs-extra');
const {
    promisify,
} = require('util');
const statAsync = promisify(fs.stat);

const bcModules = {
    /**
     * Claim submission
     *
     * @param  {Object} args  encoder object
     */
    submitClaims: async (args) => {
        try {
            logger.info('Initiated claim submission process...');

            if (args.isAllClaims) {
                let ediResponse = await bcController.getClaimsForEDI(args);

                if (ediResponse.isNotpendingSubmission) {
                    return { responseCode: 'isNotpendingSubmission' };
                }

                args.claimIds = ediResponse.claimIds;
            }

            // Get company and file store Details
            const companyFileStoreDetails = await bcController.getCompanyFileStore(args.companyId);

            if (!companyFileStoreDetails || companyFileStoreDetails.length === 0) {
                return { responseCode: 'isFileStoreError' };
            }

            if (!args.isCron) {
                args.claimIds = args.claimIds.split(',');
            }

            let result = await bcController.submitClaim(args);

            if (!result) {
                return { responseCode: 'noRecord' };
            }

            let claimData = _.groupBy(result, 'can_bc_data_centre_number');

            let encodeData = {
                claimData
            };

            // Encode Process
            const encoderResult = await processClaim.encoder(encodeData);

            return await bcModules.writeToFile(args, companyFileStoreDetails, encoderResult);
        } catch (err) {
            logger.error('Could not submit claim - ', err);
            return { responseCode: 'exceptionErrors' };
        }
    },

    /**
     * convertToJson - Converting response from thirparty to json
     *
     * @param  {String} args
     * @param {String} time zone
     */
    writeToFile: async (args, companyFileStoreDetails, encoderResult) => {
        let {
            submittedClaim = [],
            totalClaimIdsSubmitted = [],
            errorData: { commonError = [], encoderErrorArray = [], reciprocalErrorArray = [] } = {}
        } = encoderResult;
        let submissionFailedIds = [];

        if (args.isCron && !args.isBatchEligibilityFile) {
            submissionFailedIds = _.difference(args.claimIds, totalClaimIdsSubmitted);
        }

        if ((commonError.length || Object.keys(encoderErrorArray).length || Object.keys(reciprocalErrorArray).length) || submissionFailedIds.length) {

            let claimIds = submissionFailedIds || args.claimIds;

            await bcController.updateClaimsStatus({
                claimIds: claimIds,
                statusCode: 'SF',
                claimNote: 'Submission failed',
                userId: args.userId,
            });

            if (!args.isCron) {
                return { errorData: encoderResult.errorData };
            }
        }

        const {
            file_store_id,
            root_directory,
        } = companyFileStoreDetails.pop();

        try {
            await statAsync(root_directory);
        } catch (e) {
            logger.error('Unable to find file store- ', e);
            return { responseCode: 'unableToWriteFile' };
        }


        let {
            encodedText,
            submittedClaimIds = [],
            dataCentreNumber
        } = submittedClaim;

        if (encodedText.length && (submittedClaimIds.length || args.isBatchEligibilityFile)) {
            const now = moment();
            /* file_name generated to support in format XXXXXXYYYYMMDDXX
                XXXXXX - Datacenter number
                YYYY - year
                MM - month
                DD - date
                XX - some random numbers, here it is current hour(HH) minute(mm) second(ss) and millisecond(SSS)
            */
            const file_name = `${dataCentreNumber}_${now.format('YYYYMMDD_HHmmssSSS')}.txt`;
            const file_path = `MSP/Claims/${now.format('YYYY/MM/DD')}`;
            const fullPath = `${root_directory}/${file_path}/${file_name}`;

            await fse.outputFile(fullPath, encodedText);

            const statAfter = await statAsync(fullPath);
            const file_size = statAfter.size;
            const file_md5 = crypto
                .createHash('MD5')
                .update(encodedText, 'utf8')
                .digest('hex');

            let ediFileId = await bcController.storeFile({
                file_store_id,
                file_path,
                file_name,
                file_md5,
                file_size,
                companyId: args.companyId
            });

            if (!args.isBatchEligibilityFile) {
                await bcController.ediFiles({
                    ediFileId,
                    claimIds: submittedClaimIds
                });

                await bcController.updateClaimsStatus({
                    claimIds: submittedClaimIds,
                    statusCode: 'SU',
                    claimNote: 'Electronic claim submitted',
                    userId: args.userId,
                });
            }

            return { responseCode: 'unableToWriteFile' };
        }

    },

};

module.exports = bcModules;
