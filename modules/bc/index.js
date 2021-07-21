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
const processBatchEligibility = require('./encoder/batchEligibility');
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

            if (!result || !result.length) {
                return { responseCode: 'noRecord' };
            }

            let claimData = _.groupBy(result, 'can_bc_data_centre_number');

            let encodeData = {
                claimData
            };

            // Encode Process
            const encoderResult = await processClaim.encoder(encodeData, args.isCron);

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
     * validateHealthCard - To validate Haath card number
     *
     * @param  {String} args
     */
    validateHealthCard: async (args) => {
        let {
            patient_id,
            patient_insurance_id,
            eligibility_dt,
            phn,
            birth_date,
            companyId
        } = args;

        let dateOfServiceyyyy;
        let dateOfServicemm;
        let dateOfServicedd;
        let dateOfBirthyyyy;
        let dateOfBirthmm;
        let dateOfBirthdd;
        let eligibilityDt = eligibility_dt ? moment(eligibility_dt) : null;
        birth_date = birth_date ? moment(birth_date) : null;

        if(eligibilityDt && eligibilityDt.isValid()){
            dateOfServiceyyyy = eligibilityDt.format('YYYY');
            dateOfServicemm = eligibilityDt.format('MM');
            dateOfServicedd = eligibilityDt.format('DD');
        }

        if(birth_date && birth_date.isValid()){
            dateOfBirthyyyy = birth_date.format('YYYY');
            dateOfBirthmm = birth_date.format('MM');
            dateOfBirthdd = birth_date.format('DD');
        }

        let options = {
            method: 'POST',
            uri: externalUrlBc,
            rejectUnauthorized: false,
            form: {
                ExternalAction: 'AcheckE45',
                PHN: phn,
                dateOfServiceyyyy,
                dateOfServicemm,
                dateOfServicedd,
                dateOfBirthyyyy,
                dateOfBirthmm,
                dateOfBirthdd
            }
        };

        try {
            let companyDetails = await bcController.getCompanyFileStore(companyId);
            let webServiceResponse = await bcModules.doRequest(options, companyDetails[0].time_zone);
            let { data, error } = webServiceResponse;

            if (error) {
                return { responseCode: error };
            }

            let webServiceResponseJSON = {};
            let startWithFlag = data.startsWith('#TID');

            // converting text response to json
            if (!startWithFlag) {
                let response = data.split('\r\n');

                response.forEach((value) => {
                    if (value.startsWith('#TID')) {
                        let jsonResponse = bcModules.convertToJson(value);
                        webServiceResponseJSON = { ...webServiceResponseJSON, ...jsonResponse };
                    } else if (value) {
                        let keyValue = value.split(':');
                        webServiceResponseJSON[keyValue[0]] = keyValue[1];
                    }
                });
            } else if (startWithFlag) {
                webServiceResponseJSON = bcModules.convertToJson(data);
            }

            let eligibilityResponse;

            if (webServiceResponseJSON.Result === 'SUCCESS') {
                eligibilityResponse = {
                    results: [webServiceResponseJSON]
                };
            } else {
                eligibilityResponse = {
                    err: [{
                        ...webServiceResponseJSON,
                        errDescription: webServiceResponseJSON.Msgs
                    }]
                };
            }

            let result = {
                ...{ eligibilityResponse },
                patient_id,
                patient_insurance_id,
                eligibility_dt
            };

            if (patient_insurance_id != 0) {
                await bcController.saveEligibilityResponse(result);
            }

            return { data: eligibilityResponse };
        } catch (err) {
            logger.error('Failed to access MSP portal', err);
        }
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

            logger.debug(`Sign in to MSP portal.. ${JSON.stringify(enableSessionOptions)}`);
            let enableSessionResponse = await request(enableSessionOptions);
            let sessionResponse = await bcModules.convertToJson(enableSessionResponse.body);

            if (sessionResponse.Result === 'SUCCESS') {
                let cookieMSP = enableSessionResponse.headers['set-cookie'];
                logger.debug(`Requesting MSP portal for web service... ${JSON.stringify(requestOptions)}`);
                //MSP Teleplan Web Service accessing
                let webServiceResponse = await request({
                    ...requestOptions,
                    headers: { Cookie: cookieMSP }
                });

                logger.debug(`Response from MSP portal web service... ${JSON.stringify(webServiceResponse)}`);
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
                logger.debug(`Sign out from MSP portal... ${JSON.stringify(disableSessionOptions)}`);
                let disableResponse = await request(disableSessionOptions);
                disableResponse = bcModules.convertToJson(disableResponse.body);
                logger.debug(`Received Success Response from MSP Portal... ${JSON.stringify(webServiceResponse)}`);

                if (disableResponse.Result === 'SUCCESS') {
                    return { data: webServiceResponse };
                }

                return { error: 'apiFailed' };
            }

            return { error: 'apiFailed' };
        } catch (err) {
            logger.error(`Error occured while requesting MSP portal web service.. ${err}`);
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
            logger.error('Error occured while processing the response', err);
            return { error: 'exceptionErrors' };
        }
    },

    /**
     * writeToFile - Writing file in filestore
     *
     * @param {Object} args
     * @param {Array} companyFileStoreDetails
     * @param {Object} encoderResult
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

            logger.error(`Claim submission failed - ${JSON.stringify(encoderResult.errorData)}`);

            await bcController.updateClaimsStatus({
                claimIds: claimIds,
                statusCode: 'SF',
                claimNote: 'Submission failed',
                userId: args.userId,
            });

            if (!args.isCron) {
                return { errorData: encoderResult.errorData };
            }
        } else if(args.isBatchEligibilityFile && !submittedClaim.length){
            logger.info('No claims found for submission');
            return { responseCode: 'noRecord' };
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


        let response = {
            error: [],
            data: []
        };

        for(let i=0; i<submittedClaim.length; i++){
            let claim = submittedClaim[i];

            try {
                let {
                    encodedText,
                    submittedClaimIds = [],
                    dataCentreNumber,
                } = claim;

                if (!encodedText.length) {
                    response.error.push(true);
                } else if (
                    encodedText.length &&
                    (submittedClaimIds.length || args.isBatchEligibilityFile)
                ) {
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
                        file_type: args.isBatchEligibilityFile ? 'can_bc_be' : 'can_bc_submit',
                        companyId: args.companyId
                    });

                    if (!args.isBatchEligibilityFile) {
                        await bcController.ediFiles({
                            ediFileId,
                            claimIds: submittedClaimIds
                        });

                        logger.info(`Electronic Claims Submitted into filestore...${submittedClaimIds.join(',')}`);
                        await bcController.updateClaimsStatus({
                            claimIds: submittedClaimIds,
                            statusCode: 'SU',
                            claimNote: 'Electronic claim submitted',
                            userId: args.userId,
                        });
                    }

                    response.data.push(true);
                }
            } catch (err) {
                response.error.push(err);
            }
        }

        if(response.error.length){
            logger.error('Error occured in wrting file', response.error);
            return { responseCode: 'exceptionErrors' };
        }
        return { responseCode: 'submitted' };
    },


    /**
     * transferFileToMsp - Transfer file from local storage to MSP portal
     *
     * @param  {String} args
     * @param  {String} rows
     */
    transferFileToMsp: async (args, rows) => {
        try {

            let fileTransferResponse = [];

            for (let i = 0; i < rows.length; i++) {
                let row = rows[i];

                let {
                    edi_file_id
                    , root_directory
                    , file_path
                    , uploaded_file_name
                    , time_zone
                    , billing_provider_id
                    , can_bc_data_centre_number
                } = row;

                try {
                    let filePath = `${root_directory}/${file_path}/${uploaded_file_name}`;

                    await statAsync(filePath);

                    let lastSequenceNumber;

                    if (billing_provider_id) {
                        let { can_bc_data_centre_sequence_number } = await bcController.getLastUpdatedSequence(billing_provider_id);
                        lastSequenceNumber = can_bc_data_centre_sequence_number;
                    } else if (uploaded_file_name) {
                        can_bc_data_centre_number = uploaded_file_name.split('_')[0];
                        let { can_bc_data_centre_sequence_number, id } = await bcController.getLastUpdatedSequenceByDataCenterNumber(can_bc_data_centre_number);
                        billing_provider_id = id;
                        lastSequenceNumber = can_bc_data_centre_sequence_number;
                    } else {
                        logger.error('Billing provider is not found.....');
                        return { responseCode: 'exceptionErrors' };
                    }

                    let sequenceMapping = {
                        VS1: [],
                        C02: [],
                        N01: [],
                        B04: []
                    };

                    let isBatchEligibilityFile = false;

                    let fileTextValue = await fse.readFile(filePath, 'utf8');

                    let fileTextArray = fileTextValue.split('\r\n');
                    let currentSequence;
                    let claimNumber;
                    let totalClaimNumber = [];

                    for (let i = 0; i < fileTextArray.length; i++) {
                        let record = fileTextArray[i];
                        currentSequence = (((lastSequenceNumber + 1).toString()).padStart(7, '0')).slice(0, 7);
                        let recordCode = record.substring(0, 3);

                        switch (recordCode) {
                            case 'VS1': {
                                fileTextArray[i] = `${record.substring(0, 8)}${currentSequence}${record.substring(15)}`;
                                sequenceMapping[recordCode].push(currentSequence);
                                break;
                            }

                            case 'C02': {
                                let chargeId = record.substring(8, 15);
                                claimNumber = record.substring(139, 146);
                                totalClaimNumber.push(claimNumber);
                                let { id } = await bcController.getediFileClaimId(claimNumber, edi_file_id);

                                fileTextArray[i] = `${record.substring(0, 8)}${currentSequence}${record.substring(15)}`;

                                sequenceMapping[recordCode].push({
                                    charge_id: chargeId,
                                    current_sequence: currentSequence,
                                    edi_file_claim_id: id,
                                    can_bc_data_centre_number
                                });

                                break;
                            }

                            case 'N01': {

                                let { id } = await bcController.getediFileClaimId(claimNumber, edi_file_id);
                                fileTextArray[i] = `${record.substring(0, 8)}${currentSequence}${record.substring(15)}`;

                                sequenceMapping[recordCode].push({
                                    current_sequence: currentSequence,
                                    edi_file_claim_id: id,
                                    can_bc_data_centre_number
                                });

                                break;
                            }

                            case 'B04': {
                                isBatchEligibilityFile = true;
                                let studyId = record.substring(54, 61);
                                fileTextArray[i] = `${record.substring(0, 8)}${currentSequence}${record.substring(15)}`;

                                sequenceMapping[recordCode].push({
                                    current_sequence: currentSequence,
                                    edi_file_id,
                                    can_bc_data_centre_number,
                                    study_id: studyId
                                });

                                break;
                            }
                        }

                        lastSequenceNumber++;
                    }

                    await fse.outputFile(filePath, fileTextArray.join('\r\n'));

                    let buffer = fs.createReadStream(filePath);

                    let response = await bcModules.doRequest({
                        method: 'POST',
                        uri: externalUrlBc,
                        rejectUnauthorized: false,
                        formData: {
                            submitFile: buffer,
                            ExternalAction: 'AputRemit'
                        }
                    }, time_zone);

                    let { data, error } = response;

                    if (error) {
                        fileTransferResponse.push({ responseCode: error });
                        await fse.outputFile(filePath, fileTextValue);
                    } else {
                        let jsonResponse = bcModules.convertToJson(data);

                        /* MSP portal send API response status in Result {
                            SUCCESS - api transaction successful
                            FAILURE - api transaction failed
                        }*/
                        if (jsonResponse.Result === 'FAILURE') {
                            if (isBatchEligibilityFile) {
                                fileTransferResponse.push({ responseCode: 'batchEligiblityFailed' });
                            } else {
                                await bcController.updateClaimsStatus({
                                    claimIds: totalClaimNumber,
                                    statusCode: 'MV',
                                    claimNote: 'MSP Validation Failed',
                                    userId: 1
                                });

                                logger.info(`MSP Validation failed for claims ${totalClaimNumber.join(',')}`);

                                fileTransferResponse.push({ responseCode: 'ediFileFailed' });
                            }
                        } else if (jsonResponse.Result === 'SUCCESS') {

                            if (isBatchEligibilityFile && sequenceMapping.B04.length) {
                                await bcController.saveBatchEligibilitySequence(sequenceMapping.C02);
                                fileTransferResponse.push({ responseCode: 'batchEligibilitySubmitted' });
                            } else {
                                if (sequenceMapping.C02.length) {
                                    await bcController.ediFilesCharges(sequenceMapping.C02);
                                }

                                if (sequenceMapping.N01.length) {
                                    args.moduleName = 'claims';
                                    args.screenName = 'claims submission(cron service)';
                                    args.logDescription = 'Add: New sequence number inserted for corresponding claim notes';
                                    await bcController.ediFilesNotes(args, sequenceMapping.N01);
                                }

                                await bcController.updateClaimsStatus({
                                    claimIds: totalClaimNumber,
                                    statusCode: 'PP',
                                    claimNote: 'Pending payment',
                                    userId: 1
                                });

                                fileTransferResponse.push({ responseCode: 'ediFileSubmitted' });
                            }

                            await bcController.updateLastSequenceNumber(args, billing_provider_id, currentSequence);

                        }

                        await bcController.updateEDIFile({
                            status: jsonResponse.Result.toLowerCase(),
                            ediFileId: edi_file_id
                        });
                    }
                } catch (e) {
                    logger.error('Unable to find file store- ', e);

                    await bcController.updateEDIFile({
                        status: 'failure',
                        ediFileId: edi_file_id
                    });

                    fileTransferResponse.push({ responseCode: 'unableToWriteFile' });
                }
            }

            return fileTransferResponse;

        } catch (err) {
            logger.error('Error in transfering file to MSP portal', err);
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
            logger.logInfo('Initiated File Processing ...')
            return parser.processFile(contents, params);
        }
        catch (e) {
            logger.error(`Error in file Processing... ${e}`);
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
        let errorObj = {};
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
                errorObj = {
                    status: 100,
                    message: 'Directory not found in file store'
                };
                message = params.isCron && message.push(errorObj) || errorObj;

                return message;
            }

            const fileName = params.isCron ? params.uploaded_file_name : params.file_id;
            let fullFilePath = path.join(dirPath, fileName);

            logger.logInfo(`Decoding the file... ${fileName}`);
            let remittanceResponse = await bcModules.getFileContents(fullFilePath, params);

            if (remittanceResponse instanceof Error) {
                await bcController.updateFileStatus({
                    status: 'failure',
                    fileId: params.file_id
                });
                
                errorObj = {
                    status: 100,
                    message: remittanceResponse.message
                };

                message = params.isCron && message.push(errorObj) || errorObj;

                return message;
            }

            logger.logInfo('File processing finished...');

            await bcController.updateFileStatus({
                status: 'in_progress',
                fileId: params.file_id
            });

            let {
                invalidRemittanceRecords = []
            } = remittanceResponse;
 
            if (invalidRemittanceRecords.length) {
                logger.logInfo(`Unable to proceed remittance file process with following remittance records ${JSON.stringify(invalidRemittanceRecords)}`);

                await bcController.updateFileStatus({
                    status: 'failure',
                    fileId: params.file_id
                });

                errorObj = {
                    status: 100,
                    message: 'Invalid Remittance Records found'
                };

                message = params.isCron && message.push(errorObj) || errorObj;

                return message;
            }

            logger.info('Processing Eligibility Response...');

            const eligibilityResponse = await bcModules.processEligibilityResponse(remittanceResponse, params);

            if (!eligibilityResponse || !eligibilityResponse.length) {
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
            status = (can_bc_process_remittance.length && can_bc_process_remittance[0] !== null) 
                    || (eligibilityResponse && eligibilityResponse.length) ? 'success' : 'failure';

            logger.logInfo('Applying payments finished...');
            logger.logInfo('Payment application Result : ', JSON.stringify(can_bc_process_remittance));

            await bcData.updateFileStatus({
                fileId: params.file_id,
                status
            });

            logger.info(`Processing Remittance file ${params.file_id} completed with status ${status}`);
            return [{
                can_bc_process_remittance,
                fileId: params.file_id || null,
                status
            }];

        }
        catch (err) {
            logger.error(err);
            return [{
                error: true,
                message: err
            }];
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

        if (!fileStoreDetails || !fileStoreDetails.length) {
            return [{
                error: true,
                responseCode: 'isFileStoreError'
            }];
        }

        let {
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
            error = null,
            isDownTime
        } = await bcModules.doRequest(downloadParams, time_zone);

        //Error Validations in MSP portal connectivity
        if (isDownTime) {
            logger.error(`MSP Portal connection downtime`);
            return [{
                error: true,
                responseCode: 'isDownTime'
            }];
        }

        if (error) {
            logger.error(`MSP Portal Response Error: ${error}`);

            return [{
                error: true,
                message: error
            }];
        }

        if (data) {
            let mspFileResponse = data.split('#');

            if (mspFileResponse && mspFileResponse.length) {
                let fileContent = mspFileResponse[0] || '';
                let fileProperties = bcModules.convertToJson(mspFileResponse[1]);

                if (fileProperties.Result !== 'SUCCESS') {
                    logger.error('No file downloaded from MSP Portal');

                    return [{
                        err: null,
                        message: 'No file downloaded from MSP Portal'
                    }];
                }

                // Reading the file content after gets downloaded
                const bufferString = fileContent && fileContent.trim() || '';
                const fileName = fileProperties.Filename;

                //check for valid file content
                let fileBuffer = bufferString.split('\r\n');
                let remittanceSets = [];
                let remittanceHeaderSets = [];
                let validRemittanceHeaders = ['M01', 'VRC', 'VTC', 'X02'];
                let validRemittanceElements = ['B14', 'C12', 'S00', 'S01', 'S02', 'S03', 'S04', 'S21', 'S22', 'S23', 'S24', 'S25'];

                fileBuffer.filter(function (record) {
                    let recordHeader = record.substring(0,3);
                    if (validRemittanceHeaders.includes(recordHeader)) {
                        remittanceHeaderSets.push(record);
                    }
                    if (validRemittanceElements.includes(recordHeader)) {
                        remittanceSets.push(record);
                    }
                });

                if (!remittanceHeaderSets.length) {
                    logger.error(`Invalid Remittance File ${fileName}`);

                    return [{
                        error: true,
                        status: 'INVALID_FILE',
                        message: `Invalid Remittance File`,
                        response: {}
                    }];
                } else if (!remittanceSets.length) {
                    logger.error(`No Payment data available in the Remittance File ${fileName}`);
                    return [{
                        error: true,
                        status: 'NO_PAYMENT_AVAILABLE',
                        message: `No Payment data available in the Remittance File`,
                        response: {}
                    }];
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
                    logger.error('File Store Not Configured');

                    return [{
                        error: true,
                        responseCode: 'isFileStoreError'
                    }];
                }

                const fileStoreId = file_store_info[0].file_store_id;
                const fileExist = file_exists.length && file_exists[0];
                const created_dt = moment().format('YYYY/MM/DD');
                const fileDir = `MSP/Remittance/${created_dt}`;
                let filePath = `${root_directory}/${fileDir}`;

                await mkdirpAsync(filePath);

                if (fileExist) {
                    logger.info(`Duplicate Remittance file: ${fileMd5}`);

                    return [{
                        error: true,
                        status: 'DUPLICATE_FILE',
                        duplicate_file: true
                    }];
                }

                logger.info(`Writing file in Disk - ${filePath}/${fileName}`);
                try {
                    await writeFileAsync(`${filePath}/${fileName}`, bufferString, 'utf8');
                } catch (err) {
                    logger.error(`Error occurred on writing file into disk ${err}`);
                    return [{
                        error: true,
                        message: err
                    }];
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
                    return [{
                        error: true,
                        message: err
                    }];
                }

                logger.info(`Remittance File ${fileName} downloaded successfully`);
                return [{
                    error: null,
                    response: {
                        status: `ok`,
                        message: `Remittance File ${fileName} downloaded successfully`
                    }
                }];
            }
        }
    },

    /**
     * submitBatchEligibility - to submit batch elibility B04 records
     *
     * @param  {Object} args  Incoming arguments
     * @param  {Object} result  study record data to be submited in B04
     */
    submitBatchEligibility: async (args, result) => {

        // Get company and file store Details
        const companyFileStoreDetails = await bcController.getCompanyFileStore(args.companyId);

        if (!companyFileStoreDetails || companyFileStoreDetails.length === 0) {
            return { responseCode: 'isFileStoreError' };
        }

        let data = _.groupBy(result, 'can_bc_data_centre_number');

        let encoderResult = await processBatchEligibility.encoder(data, args.isBatchEligibilityFile);

        return await bcModules.writeToFile(args, companyFileStoreDetails, encoderResult);
    }

};

module.exports = bcModules;
