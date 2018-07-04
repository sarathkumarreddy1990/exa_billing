const data = require('../../data/era/index');
const ediConnect = require('../../../modules/edi');
const paymentController = require('../payments/payments');
const eraParser = require('./era-parser');
const logger = require('../../../logger');

const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

module.exports = {

    getEraFiles: function (params) {
        return data.getEraFiles(params);
    },

    uploadFile: async function (params) {
        if (!params.file) {
            return {
                status: 'INVALID_FILE',
            };
        }

        const buffer = params.file.buffer;
        const fileSize = params.file.size;
        const fileName = params.file.originalname;

        let tempString = buffer.toString();
        let bufferString = tempString.replace(/(?:\r\n|\r|\n)/g, '');

        let fileMd5 = crypto.createHash('MD5').update(bufferString, 'utf8').digest('hex');

        const dataRes = await data.isProcessed(fileMd5, 1);

        const fileStorePath = dataRes.rows[0].file_store_info[0].root_directory;
        const fileStoreId = dataRes.rows[0].file_store_info[0].file_store_id;
        const fileExist = dataRes.rows[0].file_exists[0];

        const currentTime = new Date();

        const localPath = `${currentTime.getFullYear()}\\${currentTime.getMonth()}\\${currentTime.getDate()}`;
        const dirPath = `${fileStorePath}\\${localPath}`;

        logger.info(`ERA File store: ${fileStorePath}`);

        if (fileStorePath) {
            if (!fs.exists(dirPath)) {
                mkdirp(dirPath);
            } else {
                throw new Error('Directory not found');
            }
        } else {
            throw new Error('Directory not found in file store');
        }

        if (fileExist != false) {
            logger.info(`ERA Duplicate file: ${fileMd5}`);

            return {
                status: 'DUPLICATE_FILE',
                duplicate_file: true,
            };
        }

        logger.info('Writing file in DB');
        const dataResponse = await data.saveERAFile({
            file_store_id: fileStoreId,
            company_id: params.audit.companyId,
            status: 'pending',
            file_type: '835',
            file_path: localPath,
            file_size: fileSize,
            file_md5: fileMd5,
            fileName: fileName
        });

        if (typeof dataResponse === 'object' && dataResponse.constructor.name === 'Error') {
            return {
                status: 'ERROR',
            };
        }

        let filePath = path.join(dirPath, dataResponse.rows[0].id);
        logger.info(`Writing file in Disk -  ${filePath}`);

        await writeFile(filePath, bufferString, 'binary');

        logger.info(`File uploaded successfully. ${filePath}`);

        return {
            fileNameUploaded: dataResponse.rows[0].id,
            status: 'OK',
        };
    },

    processERAFile: async function (params) {
        let self = this,
            processDetails,
            eraPath,
            rootDir;
        let processDetailsArray = [];
        let message = [];

        const eraFileDir = await data.getERAFilePathById(params);

        rootDir = eraFileDir.rows && eraFileDir.rows.length && eraFileDir.rows[0].root_directory ? eraFileDir.rows[0].root_directory : '';
        eraPath = eraFileDir.rows && eraFileDir.rows.length && eraFileDir.rows[0].file_path ? eraFileDir.rows[0].file_path : '';
        params.uploaded_file_name = eraFileDir.rows && eraFileDir.rows.length && eraFileDir.rows[0].uploaded_file_name ? eraFileDir.rows[0].uploaded_file_name : '';

        eraPath = path.join(rootDir, eraPath);

        try {
            let dirExists = fs.existsSync(eraPath);

            if (!dirExists) {

                message.push({
                    status: 100,
                    message: 'Directory not found in file store'
                });

                return message;

            }

            eraPath = path.join(eraPath, params.file_id);

            let eraRequestText = await readFile(eraPath, 'utf8');

            let templateName = await ediConnect.getDefaultEraTemplate();

            if (!templateName) {
                message.push({
                    status: 100,
                    message: 'ERA template not found to process file'
                });

                return message;
            }

            const eraResponseJson = await ediConnect.parseEra(templateName, eraRequestText);

            if (params.status != 'applypayments') {
                processDetails = await self.checkExistInsurance(params, eraResponseJson);
                processDetailsArray.push(processDetails);
            }
            else {
                processDetails = await self.applyERAPayments(eraResponseJson, params);
                processDetailsArray.push(processDetails);
            }

            return processDetailsArray;

        } catch (err) {

            if (err.message && err.message == 'Invalid template name') {
                logger.error(err);

                message.push({
                    status: 100,
                    message: 'Invalid template name'
                });
            }
            else if (err.code == 'ENOENT') {
                message.push({
                    status: 100,
                    message: err.message
                });
            } else {
                message = err;
            }

            return message;
        }

    },

    applyERAPayments: async function (eraResponseJson, params) {
        let self = this;

        const results = [];

        for (const eraObject of eraResponseJson) {

            results.push(self.processPayments(params, eraObject));
        }

        return await Promise.all(results);

    },

    checkExistInsurance: async function (params, eraResponseJson) {

        let payerDetails = {};
        let reassociation = eraResponseJson.length ? eraResponseJson[0].reassociationTraceNumber : {};
        let payerIdentification = reassociation.originatingCompanyID ? reassociation.originatingCompanyID : '';

        const existsInsurance = await data.selectInsuranceEOB({
            payer_id: payerIdentification
            , company_id: 1
            , file_id: params.file_id
        });

        if (existsInsurance && existsInsurance.rows && existsInsurance.rows.length) {

            payerDetails.type = 'exists';
            payerDetails.payer_id = existsInsurance.rows[0].id;
            payerDetails.payer_code = existsInsurance.rows[0].insurance_code;
            payerDetails.payer_name = existsInsurance.rows[0].insurance_name;
            payerDetails.payer_Identification = params.status != 'pending' ? existsInsurance.rows[0].payer_id : payerIdentification;

        }
        else {
            payerDetails.type = 'none';
        }

        return payerDetails;
    },

    createPaymentFromERA: async function (params, eraResponseJson) {

        let paymentResult;
        let payerDetails = JSON.parse(params.payer_details);

        let reassociation = eraResponseJson.reassociationTraceNumber ? eraResponseJson.reassociationTraceNumber : {};
        let financialInfo = eraResponseJson.financialInformation && eraResponseJson.financialInformation.length ? eraResponseJson.financialInformation[0] : {};

        let monetoryAmount = financialInfo.monetoryAmount ? parseFloat(financialInfo.monetoryAmount).toFixed(2) : 0.00;
        let notes = 'Amount shown in EOB:' + monetoryAmount;

        // notes += '\n \n' + params.file_id + '.ERA';
        payerDetails.paymentId = null;
        payerDetails.company_id = payerDetails.company_id;
        payerDetails.user_id = payerDetails.created_by;
        payerDetails.facility_id = 1;
        payerDetails.patient_id = null;
        payerDetails.insurance_provider_id = payerDetails.payer_id;
        payerDetails.provider_group_id = null;
        payerDetails.provider_contact_id = null;
        payerDetails.payment_reason_id = 2;
        payerDetails.amount = 0;
        payerDetails.accounting_date = 'now()';
        payerDetails.invoice_no = '';
        payerDetails.display_id = null;  // alternate_payment_id
        payerDetails.payer_type = 'insurance';
        payerDetails.notes = notes;
        payerDetails.payment_mode = 'check';
        payerDetails.credit_card_name = null;
        payerDetails.credit_card_number = reassociation.referenceIdent || null; // card_number
        payerDetails.clientIp = params.clientIp;
        payerDetails.screenName = params.screenName;
        payerDetails.moduleName = params.moduleName;
        payerDetails.logDescription = 'Payment created via ERA';

        try {

            paymentResult = await paymentController.createOrUpdatePayment(payerDetails);
            paymentResult = paymentResult && paymentResult.rows && paymentResult.rows.length ? paymentResult.rows[0] : {};
            paymentResult.file_id = params.file_id;
            paymentResult.created_by = payerDetails.created_by;
            paymentResult.company_id = payerDetails.company_id;
            paymentResult.uploaded_file_name = params.uploaded_file_name;

            await data.createEdiPayment(paymentResult);

            return paymentResult;

        } catch (err) {

            throw err;
        }


    },

    processPayments: async function (params, eraObject) {
        let self = this;
        //let message = [];

        let paymentDetails = await self.createPaymentFromERA(params, eraObject);

        let claimLists = eraObject && eraObject.headerNumber ? eraObject.headerNumber : {};

        let LineItemsAndClaimLists = await eraParser.getFormatedLineItemsAndClaims(claimLists, params);

        // ToDo:: Have to return Error Message on Multi TRN payment
        // if (LineItemsAndClaimLists.lineItems && !LineItemsAndClaimLists.lineItems.length) {
        //     message.push({
        //         status: 100,
        //         message: 'Error on getting service segment in ERA file'
        //     });

        //     return message;
        // } 

        let processedClaims = await data.createPaymentApplication(LineItemsAndClaimLists, paymentDetails);

        return processedClaims;
    },

    isProcessed: async function (fileMd5, company_id) {
        return data.isProcessed(fileMd5, company_id);
    },

    saveERAFile: async function (params) {
        return data.saveERAFile(params);
    },

    getFileStorePath: async function (params) {
        return data.getFileStorePath(params);
    }

};
