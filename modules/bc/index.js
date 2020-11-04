'use strict';
const _ = require('lodash');
const bcController = require('../../server/controllers/bc');
const processClaim = require('./encoder/claims');
const fs = require('fs');
const logger = require('../../logger');
const moment = require('moment-timezone');
const crypto = require('crypto');
const fse = require('fs-extra');
const mkdirp = require('mkdirp');
const path = require('path');
const {
    promisify,
} = require('util');
const parser = require('./decoder');
const bcData = require('../../server/data/bc');
const eraData = require('../../server/data/era');
const request = require('request-promise-native');
const downtime = require('../bc/resx/downtime.json');
const siteConfig = require('../../server/config');
const externalUrlBc = siteConfig.get('externalUrlBc');
const externalUrlBcUserName = siteConfig.get('externalUrlBcUserName');
const externalUrlBcPassword = siteConfig.get('externalUrlBcPassword');

const writeFileAsync = promisify(fs.writeFile);
const mkdirpAsync = promisify(mkdirp);
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
     * isDownTime - to check down time of MSP
     *
     * @param  {String} startTime  Start down time
     * @param  {String} endTime  End down time
     * @param  {String} tmz  Time zone
     */
    isDownTime: (startTime, endTime, tmz) => {

        let format  = 'HH:mm';
        let curTime = moment().tz(tmz).format(format);
        let time = moment(curTime, format, tmz);
        let beforeTime = moment(startTime, format, tmz);
        let afterTime = moment(endTime, format, tmz);

        return time.isBetween(beforeTime, afterTime);
    },


    /**
     * doRequest - Request third part application
     *
     * @param  {String} args
     * @param {String} time zone
     */
    doRequest: async (requestOptions, tmz) => {
        let weekDay = moment.tz(tmz).day();
        let downtimeWeekDay = downtime[weekDay];
        let isDownTime = false;

        if(!externalUrlBcUserName || !externalUrlBcPassword || !externalUrlBc){
            logger.error('MSP Username/Password/URL missing in web config');
            return { error: 'webConfigError' };
        }

        for (let i = 0; i < downtimeWeekDay.length; i++) {
            let value = downtimeWeekDay[i];

            if (bcModules.isDownTime(value.startTime, value.endTime, tmz)) {
                isDownTime = true;
                break;
            }
        }

        if (isDownTime) {
            return { error: 'isDownTime' };
        }

        try {

            let enableSessionOptions = {
                method: 'POST',
                uri: externalUrlBc,
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                form: {
                    ExternalAction: 'AsignOn'
                }
            };

            //MSP Teleplan Web Service sign in

            enableSessionOptions.form = {
                ...enableSessionOptions.form,
                username: externalUrlBcUserName,
                password: externalUrlBcPassword
            };

            let enableSessionResponse = await request(enableSessionOptions);
            let sessionResponse = await bcModules.convertToJson(enableSessionResponse.body);

            if (sessionResponse.Result == 'SUCCESS') {
                let cookieMSP = enableSessionResponse.headers['set-cookie'];
                //MSP Teleplan Web Service accessing
                let webServiceResponse = await request({
                    ...requestOptions,
                    headers: { Cookie: cookieMSP }
                });

                let disableSessionOptions = {
                    method: 'POST',
                    uri: externalUrlBc,
                    rejectUnauthorized: false,
                    resolveWithFullResponse: true,
                    form: {
                        ExternalAction: 'AsignOff'
                    },
                    headers: { Cookie: enableSessionResponse.headers['set-cookie'] }
                };

                //MSP Teleplan Web Service sign off
                let disableResponse = await request(disableSessionOptions);
                disableResponse = bcModules.convertToJson(disableResponse.body);

                if (disableResponse.Result == 'SUCCESS') {
                    return { data: webServiceResponse };
                }

                return { error: 'apiFailed' };
            }

            return { error: 'apiFailed' };
        } catch (err) {
            return { error: 'exceptionErrors' };
        }
    },

    /**
     * convertToJson - Converting response from thirparty to json
     *
     * @param  {String} args
     * @param {String} time zone
     */
    convertToJson(args) {
        try {
            let data = args.split(';');
            let response = {};

            data.forEach((value) => {
                let result = value.split('=');
                response[result[0]] = result[1];
            });

            return response;
        } catch (err) {
            logger.error('Error in processing for the response', err);
            return { error: 'exceptionErrors' };
        }
    },

    /**
     * WriteToFile - Writing the encoded contents into a file
     *
     * @param  {String} args
     * @param {String} time zone
     */
    writeToFile: async(args, companyFileStoreDetails, encoderResult) => {
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
        let filePath;
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
            filePath = file_path || '';
            params.uploaded_file_name = uploaded_file_name || '';
        }

        let dirPath = path.join(rootDir, filePath);

        try {
            let dirExists = await fse.pathExists(dirPath);

            if (!dirExists) {
                message.push({
                    status: 100,
                    message: 'Directory not found in file store'
                });

                return message;
            }

            const fileName = params.isCron ? params.uploaded_file_name : params.file_id;
            let fullFilePath = path.join(dirPath, fileName);
            let remittanceResponse = await bcModules.getFileContents(fullFilePath, params);

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
    },

    /*
    * Used to throw custom error
    * {@param} Error Message
    */
    sendDataError: (messge) => {
        logger.error(messge);
        throw new Error(messge);
    },

    /**
    * Download the files from MSP portal
    * {@param} params - which contains fileName, companyId of uploading file
    */

    downloadFiles: async (params) => {
        let {
            companyId,
        } = params;

        let fileStoreDetails = await bcController.getCompanyFileStore(companyId);
        let {
            file_store_id,
            root_directory,
            time_zone
        } = fileStoreDetails[0];

        if (!root_directory) {
            bcModules.sendDataError(`Company file store missing for companyId ${companyId}`);
        }

        try {
            await statAsync(root_directory);
        }
        catch (e) {
            bcModules.sendDataError(`Company file store folder missing in server file system ${e}`);
        }

        let downloadParams = {
            uri: externalUrlBc,
            method: 'POST',
            rejectUnauthorized: false,
            form: {
                ExternalAction: 'AgetRemit',
                remittance: true,
                retrieve: 'Retrieve'
            }
        };

        // Connect MSP Portal and Download Remittance File.
        logger.info('Establishing connectivity with MSP Portal');
        const {
            data = null,
            error = null
        } = await bcModules.doRequest(downloadParams, time_zone);

        //Error Validations in MSP portal connectivity
        if (error) {
            logger.error(`MSP Portal Response Error: ${error}`);

            return {
                err: error
            };
        }

        if (data) {
            let mspFileResponse = data.split('#');

            if (mspFileResponse && mspFileResponse.length) {
                let fileContent = mspFileResponse[0] || '';
                let fileProperties = bcModules.convertToJson(mspFileResponse[1]);

                if (fileProperties.Result !== 'SUCCESS') {
                    logger.error('No file downloaded from MSP Portal');

                    return {
                        err: null,
                        message: 'No file downloaded from msp portal'
                    };
                }

                // Reading the file content after gets downloaded
                const bufferString = fileContent && fileContent.trim() || '';
                const fileName = fileProperties.Filename;

                //check for valid file content
                let isInValidFileContent = bufferString.indexOf('M01') == -1 || bufferString.indexOf('VTC') == -1;
                let fileBuffer = bufferString.split('/n');
                let isEmptyRemittance = !isInValidFileContent && fileBuffer.length <= 2;

                if (isInValidFileContent) {
                    logger.error(`Invalid Remittance File ${fileName}`);

                    return {
                        status: 'INVALID_FILE'
                    };
                }

                let fileMd5 = crypto.createHash('MD5').update(bufferString, 'utf8').digest('hex');

                let {
                    rows = []
                } = await eraData.isProcessed(fileMd5, 1);

                const {
                    file_store_info = [],
                    file_exists = []
                } = rows.length && rows[0];

                if (!file_store_info.length) {
                    return {
                        file_store_status: 'FILE_STORE_NOT_EXISTS'
                    };
                }

                const fileStorePath = file_store_info[0].root_directory;
                const fileStoreId = file_store_info[0].file_store_id;
                const fileExist = file_exists.length && file_exists[0];
                const created_dt = moment().format('YYYY/MM/DD');
                const fileDir = `MSP/Remittance/${created_dt}`;
                let filePath = `${root_directory}/${fileDir}`;

                await mkdirpAsync(filePath);

                if (fileExist) {
                    logger.info(`Duplicate Remittance file: ${fileMd5}`);

                    return {
                        status: 'DUPLICATE_FILE',
                        duplicate_file: true
                    };
                }

                logger.info(`Writing file in Disk - ${filePath}/${fileName}`);
                try {
                    await writeFileAsync(`${filePath}/${fileName}`, bufferString, 'utf8');
                } catch (err) {
                    logger.error(`Error occurred on writing file into disk ${err}`);
                    return err;
                }

                const statAfter = await statAsync(`${filePath}/${fileName}`);
                let fileSize = statAfter.size;

                logger.info('Writing file in DB');

                try {
                    await bcController.storeFile({
                        file_name: fileName,
                        file_store_id: fileStoreId,
                        file_path: fileDir,
                        file_md5: fileMd5,
                        file_size: fileSize,
                        companyId,
                        file_type: 'can_bc_remit'
                    });

                } catch (err) {
                    logger.error(`Error occured on writing file into db: ${err}`);
                    return err;
                }

                logger.info(`Remittance File ${fileName} downloaded successfully`);
                return {
                    status: `ok`,
                    message: `Remittance File ${fileName} downloaded successfully`
                };
            }
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
    }

};

module.exports = bcModules;
