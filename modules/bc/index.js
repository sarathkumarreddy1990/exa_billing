'use strict';
const _ = require('lodash');
const bcController = require('../../server/controllers/bc');
const processClaim = require('./encoder/claims');
const fs = require('fs');
const logger = require('../../logger');
const moment = require('moment');
const crypto = require('crypto');
const fse = require('fs-extra');
const path = require('path');
const {
    promisify,
} = require('util');
const parser = require('./decoder');
const bcData = require('../../server/data/bc');
const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);

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

    /**
    * To process the Batch Eligibility Response from remittance file
    */
    processEligibilityResponse: async (response, params) => {
        const eligibilityDetails = response && response.batchEligibilityResponse || [];

        try {
            if (!eligibilityDetails.length) {
                logger.logInfo('No Eligibility Response found');
                return;
            }

            return await bcData.storeEligibilityResponse(eligibilityDetails, params);
        }
        catch (err) {
            logger.error('Error Occured in Batch Eligibility Response Processing');
            return err;
        }

    },

    /**
    * To reading the contents of the file
    */
    getFileContents: async (filePath, params) => {
        let contents;

        try {
            contents = await readFileAsync(filePath, 'utf8');
            return parser.processFile(contents, params);
        }
        catch (e) {
            logger.error('Error in file Processing', e);
            return e;
        }
    },

    /***
    * Function used to process the ERA file
    * @param {data} Object {
    *                      ip,
    *                      file_id
    *                      }
    */
    processRemittanceFile: async (params) => {
        let processDetails;
        let eraPath;
        let rootDir;
        let message = [];
        const { rows = [] } = await bcData.getRemittanceFilePathById(params);

        if (rows.length) {
            const {
                root_directory,
                file_path,
                uploaded_file_name
            } = rows[0];
            rootDir = root_directory || '';
            eraPath = file_path || '';
            params.uploaded_file_name = uploaded_file_name || '';
        }

        eraPath = path.join(rootDir, eraPath);

        try {
            let dirExists = await fse.pathExists(eraPath);

            if (!dirExists) {
                message.push({
                    status: 100,
                    message: 'Directory not found in file store'
                });

                return message;
            }

            const fileName = params.isCron ? params.uploaded_file_name : params.file_id;
            eraPath = path.join(eraPath, fileName);
            let remittanceResponse = await bcModules.getFileContents(eraPath, params);

            logger.logInfo('File processing finished...');

            await bcController.updateFileStatus({
                status: 'in_progress',
                fileId: params.file_id
            });

            logger.info('Processing Eligibility Response...');

            const eligibilityResponse = await bcModules.processEligibilityResponse(remittanceResponse, params);

            if (!(eligibilityResponse && eligibilityResponse.rows && eligibilityResponse.rows.length)) {
                logger.info(`Eligibility Records not matched in file - ${fileName}`);
            }

            logger.logInfo('Applying payments started...');
            let status;

            //Applying payments from the payment file
            processDetails = await bcData.processRemittance(remittanceResponse, params);

            //Again we call to create payment application for unapplied charges from Remittance claims
            await bcData.unappliedChargePayments(params);

            let {
                can_bc_process_remittance = []
            } = processDetails && processDetails.rows && processDetails.rows.length && processDetails.rows[0] || {};
            status = can_bc_process_remittance && can_bc_process_remittance.length && can_bc_process_remittance[0] !== null ? 'success' : 'failure';

            logger.logInfo('Applying payments finished...');
            logger.logInfo('Payment application Result : ', can_bc_process_remittance);

            return await bcData.updateFileStatus({
                fileId: params.file_id,
                status
            });

        }
        catch (err) {
            logger.error(err);
            return err;
        }
    }

};

module.exports = bcModules;
