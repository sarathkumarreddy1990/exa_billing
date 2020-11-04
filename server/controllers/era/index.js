const data = require('../../data/era/index');
const ediConnect = require('../../../modules/edi');
const paymentController = require('../payments/payments');
const eraParser = require('./era-parser');
const logger = require('../../../logger');
const shared = require('../../shared');
const mhsData = require('../../data/mhs');
const mhsController = require('../mhs/index');

const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const statAsync = promisify(fs.stat);

const createDir = function (fileStorePath, filePath) {
    return new Promise(function(resolve, reject) {
        const dirPath = `${fileStorePath}\\${filePath}`;

        logger.info(`File store: ${fileStorePath}, ${filePath}`);

        let dirExists = fs.existsSync(fileStorePath);

        if (!dirExists) {
            logger.info(`Root directory not found in file store -  ${fileStorePath}`);

            return reject({
                file_store_status: 'Root directory not found in file store'
            });
        }

        if (fileStorePath) {
            const folderExist = fs.existsSync(dirPath);

            if (folderExist) {
                return resolve({ status: true });
            }

            mkdirp(dirPath, function (err) {
                if (err) {
                    return reject({
                        file_store_status: 'Directory not found in file store'
                    });
                }

                return resolve({ status: true });
            });

        } else {
            logger.info(`Directory not found -  ${dirPath}`);

            return reject({
                file_store_status: 'Directory not found in file store'
            });
        }
    });
};

const checkInvalidFileContent = (fileString, billingRegionCode) => {

    switch(billingRegionCode) {
        case 'can_ON':
            return (fileString.indexOf('HR1') == -1 || fileString.indexOf('HR4') == -1 || fileString.indexOf('HR7') == -1);
        case 'can_MB':
            return false;
        case 'can_BC':
            return (fileString.indexOf('M01') == -1 || fileString.indexOf('VTC') == -1);
        default:
            return (fileString.indexOf('ISA') == -1 || fileString.indexOf('CLP') == -1);
    }

};

const getProvinceBasedProperties = (billingRegionCode) => {
    if (billingRegionCode === 'can_BC') {
        return 'can_bc_remit';
    }

    return '835';
};

module.exports = {

    getEraFiles: function (params) {
        return data.getEraFiles(params);
    },

    getDetailedEob: async function (params) {

        if (!params.f) {
            return new Error('Invalid ERA file');
        }

        const fileName = shared.base64Decode(params.f);
        const eraResponseJson = await this.getRawEobResponse(fileName);

        return eraResponseJson;
    },

    getRawEobResponse: async function (fileName) {
        const eraRequestText = await readFile(fileName, 'utf8');
        const templateName = await ediConnect.getDefaultEraTemplate();

        if (!templateName) {
            return new Error('ERA template not found to process file');
        }

        const eraResponseJson = await ediConnect.parseEra(templateName, eraRequestText);

        return eraResponseJson;
    },

    uploadFile: async function (params) {
        if (!params.file) {
            return {
                status: 'INVALID_FILE',
            };
        }

        const modeParamStr = params.body.mode.toUpperCase();
        const isPreviewMode = modeParamStr === 'PREVIEW_EOB';
        const isEob = modeParamStr.indexOf('_PDF') > -1;

        const uploadingMode = isEob ? 'EOB' : 'ERA';
        const ediFileId = modeParamStr.split('_')[0];

        const buffer = params.file.buffer;
        const fileSize = params.file.size;
        const fileName = params.file.originalname;

        let tempString = buffer.toString();
        let bufferString = (['can_MB', 'can_BC'].indexOf(params.billingRegionCode) !== -1 && tempString) || tempString.replace(/(?:\r\n|\r|\n)/g, '');

        bufferString = bufferString.trim() || '';

        if (!isEob && checkInvalidFileContent(bufferString, params.billingRegionCode)) {
            return {
                status: 'INVALID_FILE',
            };
        }

        let fileMd5 = crypto.createHash('MD5').update(bufferString, 'utf8').digest('hex');

        const dataRes = await data.isProcessed(fileMd5, 1);

        if (!(dataRes.rows[0].file_store_info && dataRes.rows[0].file_store_info.length)) {
            return {
                file_store_status: 'FILE_STORE_NOT_EXISTS'
            };
        }

        const fileStorePath = dataRes.rows[0].file_store_info[0].root_directory;
        const fileStoreId = dataRes.rows[0].file_store_info[0].file_store_id;
        const fileExist = dataRes.rows[0].file_exists[0];

        const currentTime = new Date();
        let fileDirectory = null;

        switch(params.billingRegionCode) {
            case 'can_MB':
                fileDirectory = 'MHSAL/Returns';
                break;
            case 'can_BC':
                fileDirectory = 'MSP/Remittance';
                break;
            default:
                fileDirectory = uploadingMode.toLowerCase();
                break;
        }

        let fileRootPath = `${fileDirectory}/${currentTime.getFullYear()}/${currentTime.getMonth() + 1}/${currentTime.getDate()}`;

        if (isPreviewMode) {
            logger.info('ERA Preview MODE');
            fileRootPath = `trash/${currentTime.getFullYear()}/${currentTime.getMonth()}`;

            try {
                await createDir(fileStorePath, fileRootPath);
            } catch (err) {
                return err;
            }

            let diskFileName = params.session.id + '__' + fileName;

            let filePath = path.join(fileStorePath, fileRootPath, diskFileName);
            logger.info(`Writing file in Disk -  ${filePath}`);

            await writeFile(filePath, bufferString, 'binary');

            logger.info(`File uploaded successfully. ${filePath}`);

            return {
                previewFileName: shared.base64Encode(filePath),
                status: 'PREVIEW',
            };
        }

        logger.info(`${uploadingMode} Process MODE`);

        try {
            await createDir(fileStorePath, fileRootPath);
        } catch (err) {
            return err;
        }

        if (fileExist != false && !isEob) {
            logger.info(`${uploadingMode} Duplicate file: ${fileMd5}`);

            return {
                status: 'DUPLICATE_FILE',
                duplicate_file: true,
            };
        }

        logger.info('Writing file in DB');
        const dataResponse = await data.saveERAFile({
            file_store_id: fileStoreId,
            company_id: params.audit.companyId,
            status: isEob ? 'success' : 'pending',
            file_type: isEob ? 'EOB' : getProvinceBasedProperties(params.billingRegionCode),
            file_path: fileRootPath,
            file_size: fileSize,
            file_md5: fileMd5,
            fileName: fileName,
            isEOB : isEob,
            id: ediFileId
        });

        if (typeof dataResponse === 'object' && dataResponse.constructor.name === 'Error') {
            return {
                status: 'ERROR',
            };
        }

        let filePath = path.join(fileStorePath, fileRootPath, dataResponse.rows[0].id);
        logger.info(`Writing file in Disk -  ${filePath}`);

        if (isEob) {
            await writeFile(`${filePath}`, buffer);
        } else {
            await writeFile(filePath, bufferString, 'binary');
        }

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
                const start = Date.now();
                logger.logInfo('ERA payment process | started');

                processDetails = await self.applyERAPayments(eraResponseJson, params);
                processDetailsArray.push(processDetails);

                const finish = Date.now();

                logger.logInfo(`ERA payment process | finished in ${finish - start}ms`);

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
            let result = await self.processPayments(params, eraObject);
            results.push(result);
        }

        return results;

    },

    checkExistInsurance: async function (params, eraResponseJson) {

        let payerDetails = {};
        let reassociation = eraResponseJson.length ? eraResponseJson[0].reassociationTraceNumber : {};
        let payerIdentification = reassociation.originatingCompanyID ? reassociation.originatingCompanyID : '';

        const existsInsurance = await data.selectInsuranceEOB({
            payer_id: payerIdentification
            , company_id: params.companyId || params.company_id
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
        payerDetails.facility_id = params.facility_id;
        payerDetails.patient_id = null;
        payerDetails.insurance_provider_id = payerDetails.payer_id;
        payerDetails.provider_group_id = null;
        payerDetails.provider_contact_id = null;
        payerDetails.payment_reason_id = null;
        payerDetails.amount = 0;
        payerDetails.accounting_date = financialInfo.date || 'now()';
        payerDetails.invoice_no = '';
        payerDetails.display_id = null;  // alternate_payment_id
        payerDetails.payer_type = 'insurance';
        payerDetails.notes = notes;
        payerDetails.payment_mode = 'eft';
        payerDetails.credit_card_name = null;
        payerDetails.credit_card_number = reassociation.referenceIdent || null; // card_number
        payerDetails.clientIp = params.clientIp;
        payerDetails.screenName = params.screenName;
        payerDetails.moduleName = params.moduleName;
        payerDetails.logDescription = 'Payment created via ERA';
        payerDetails.isERAPayment = true;
        payerDetails.file_id = params.file_id;

        try {

            paymentResult = await paymentController.createOrUpdatePayment(payerDetails);
            paymentResult = paymentResult && paymentResult.rows && paymentResult.rows.length ? paymentResult.rows[0] : {};
            paymentResult.file_id = params.file_id;
            paymentResult.created_by = payerDetails.created_by;
            paymentResult.company_id = payerDetails.company_id;
            paymentResult.uploaded_file_name = params.uploaded_file_name;
            paymentResult.payer_type = payerDetails.payer_type;
            paymentResult.messageText = ''; // this column only for ohip payment.
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

        logger.logInfo(`ERA payment process | root payment(${paymentDetails.id}) created`);

        let claimLists = eraObject && eraObject.headerNumber ? eraObject.headerNumber : {};

        let lineItemsAndClaimLists = await eraParser.getFormatedLineItemsAndClaims(claimLists, params);

        paymentDetails.code = 'ERA';
        paymentDetails.from = 'EOB';

        let processedClaims = await data.createPaymentApplication(lineItemsAndClaimLists, paymentDetails);

        logger.logInfo('ERA payment process | payment applied');

        /**
         *  again we call to create payment application for unapplied charges form ERA claims
         */
        await data.applyPaymentApplication(lineItemsAndClaimLists.audit_details, paymentDetails);

        logger.logInfo('ERA payment process | zero payment applied for non exist charges');

        await data.updateERAFileStatus(paymentDetails);

        logger.logInfo('ERA payment process | file status updated');

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
    },

    getProcessedEraFileDetails: async function (params) {
        let eraResponse = await data.getProcessedFileData(params);
        let eraResponseValues = eraResponse.rows && eraResponse.rows[0].payer_details;

        if (eraResponseValues && eraResponseValues.file_name && params.billingRegionCode !== 'can_MB') {
            const filePath = path.join(eraResponseValues.root_directory, eraResponseValues.file_path, eraResponseValues.file_name);

            try {
                const eraResponseJson = await this.getRawEobResponse(filePath);
                eraResponse.rows[0].rawResponse = eraResponseJson;
            } catch (err) {
                logger.error(err);
                eraResponse.rows[0].rawResponse = { err };
            }
        }

        return eraResponse;
    },

    getEOBFile: async function (params) {
        let eobFileDetails = await data.getERAFilePathById(params);

        if (eobFileDetails.rows && eobFileDetails.rows.length) {
            const filePath = path.join(eobFileDetails.rows[0].root_directory, eobFileDetails.rows[0].file_path, eobFileDetails.rows[0].id);

            if (!fs.existsSync(filePath)) {
                throw new Error('Root directory not found in file store');
            }

            return fs.createReadStream(filePath);
        }

        throw new Error('EOB File Not Found');
    },

    createPayment: async function(eraObject, params){
        let paymentResult;
        let payerDetails = {};
        let totalAmountPayable = eraObject.totalAmountPayable ? Math.round( eraObject.totalAmountPayable * 100) / 10000 : 0.00;
        let notes = 'Amount shown in EOB:$' + totalAmountPayable;

        payerDetails.paymentId = null;
        payerDetails.company_id = params.company_id || null;
        payerDetails.user_id = params.user_id || null;
        payerDetails.facility_id = params.facility_id || null;
        payerDetails.created_by = params.created_by || null;
        payerDetails.patient_id = null;
        payerDetails.insurance_provider_id = params.insurance_provider_id || null;  // ToDo:: params from UI
        payerDetails.provider_group_id = null;
        payerDetails.provider_contact_id = null;
        payerDetails.payment_reason_id = null;
        payerDetails.amount = 0;
        payerDetails.accounting_date = eraObject.paymentDate || 'now()';
        payerDetails.invoice_no = '';
        payerDetails.display_id = null;  // alternate_payment_id
        payerDetails.payer_type = 'insurance';
        payerDetails.notes = notes;
        payerDetails.payment_mode = 'eft';
        payerDetails.credit_card_name = null;
        payerDetails.credit_card_number = eraObject.chequeNumber || null; // card_number
        payerDetails.clientIp = params.clientIp;
        payerDetails.screenName = params.screenName;
        payerDetails.moduleName = params.moduleName;

        payerDetails.logDescription = 'Payment created via ERA';
        payerDetails.isERAPayment = true;
        payerDetails.file_id = 0; // ToDo:: uploaded ERA file id


        try {

            paymentResult = await paymentController.createOrUpdatePayment(payerDetails);
            paymentResult = paymentResult && paymentResult.rows && paymentResult.rows.length ? paymentResult.rows[0] : {};
            paymentResult.file_id =  payerDetails.file_id; // imported ERA file id
            paymentResult.created_by = payerDetails.created_by;
            paymentResult.company_id = payerDetails.company_id;
            paymentResult.uploaded_file_name =  'Canada_ERA.txt';
            paymentResult.payer_type = payerDetails.payer_type;
            paymentResult.messageText = eraObject.messageText || '';
            paymentResult.code = 'ERA';

            await data.createEdiPayment(paymentResult);

        } catch (err) {

            throw err;
        }

        return paymentResult;
    },

    getEraFileJson: async (params) => {
        let
            eraPath,
            rootDir,
            message = [];
        const eraFileDir = await mhsData.getERAFilePathById(params);

        if (eraFileDir && eraFileDir.rows && eraFileDir.rows.length) {
            rootDir = eraFileDir.rows[0].root_directory || '';
            eraPath = eraFileDir.rows[0].file_path || '';
            params.uploaded_file_name = eraFileDir.rows[0].uploaded_file_name || '';
        }

        eraPath = path.join(rootDir, eraPath);

        try {
            let dirExists = await statAsync(eraPath);

            if (!dirExists) {
                message.push({
                    status: 100,
                    message: 'Directory not found in file store'
                });
            }

            eraPath = path.join(eraPath, params.file_id);
            let eraResponseJson = await mhsController.getFile(eraPath, params);
            eraResponseJson.errno ? logger.info('Failed to Download the Json OutPut...') : logger.info('Json Downloaded Successfully...');
            return eraResponseJson;
        } catch (err) {
            logger.error('Failed to Download the Json OutPut...', err);
        }
    },

    getEOBFileId: data.getEOBFileId
};
