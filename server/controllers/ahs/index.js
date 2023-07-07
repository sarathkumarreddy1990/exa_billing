'use strict';

const ahsData = require('../../data/ahs');
const parser = require('../../../modules/ahs/decoder/index');
const logger = require('../../../logger');
const fs = require('fs');
const _ = require('lodash');
const path = require('path');

const {
    promisify,
} = require('util');
const wcbParser = require('../../../modules/ahs/wcb/wcb-parser');

const readFileAsync = promisify(fs.readFile);
const statAsync = promisify(fs.stat);

const ahsController = {

     /***
     * Function used to process the Batch balance and ARD file  - called from Cron job
     * @param {data} Object {
     *                      ip
     *                      }
     *
     */
    processFile: async (args) => {
        const data = {
            status: 'pending',
            fileTypes: ['can_ahs_bbr', 'can_ahs_ard']
        };

        let filesList = await ahsData.getFilesList(data);

        if ( !filesList.rows || !filesList.rows.length ) {
            logger.info('Pending files not available to process');
            return {
                err: null,
                response: {
                    status: `ok`,
                    message: `No pending records found`
                },
            };
        }

        let ardFiles = [];
        let bbrFiles = [];

        filesList.rows.map(obj => {
            obj.file_type === 'can_ahs_ard' && ardFiles.push(obj);
            obj.file_type === 'can_ahs_bbr' && bbrFiles.push(obj);
        });

        let processBBRFiles = await ahsController.processFileData(bbrFiles, args) || []; // To Process all BBR Files
        let processARDFiles = await ahsController.processFileData(ardFiles, args) || []; // To Process all ARD Files

        return [...processBBRFiles, ...processARDFiles] || [];
    },

    /**
     * Function used to process the list of files with same type(ARD and BBR)
     * @param {data} filesList
     */
    processFileData: async (filesList, args) => {
        const { ip } = args;

        let promises = _.map(filesList, async (file) => {
            let {
                root_directory,
                file_path,
                uploaded_file_name,
                file_type,
                file_id,
                can_submitter_prefix,
                log_details
            } = file;

            let filePath = `${root_directory}/${file_path}/${uploaded_file_name}`;
            let fileContent;

            try {
                logger.info(`Reading the contents of the file ${file_type}: ${file_id} - ${uploaded_file_name} in location ${filePath}`);
                fileContent = await readFileAsync(filePath, 'utf8');
            }
            catch (e) {
                logger.error(`Error in file read - ${filePath}`, e);
            }

            logger.info(`Decoding the file ${file_id} - ${uploaded_file_name}`);

            let fileData = await ahsController.decode(file_type, fileContent, can_submitter_prefix);

            logger.info(`Decoding file ${file_id} - ${uploaded_file_name} Success!!`);

            await ahsData.updateFileStatus({
                status: 'in_progress',
                fileId: file_id
            });

            logger.info(`Initiated file processing... ${file_id} - ${uploaded_file_name}`);
            let processResult = await ahsController.process({
                company_id: args.company_id,
                companyId: args.companyId,
                fileData,
                file_type,
                file_id,
                log_details,
                ip
            });

            let status;

            if (file_type == 'can_ahs_bbr') {
                let [{
                    bbr_response = []
                }] = processResult && processResult.rows || [{}];
                status = bbr_response && bbr_response.length ? 'success' : 'failure';

            }
            else if(file_type == 'can_ahs_ard') {
                let [{
                    applied_payments = []
                }] = processResult && processResult.rows || [{}];
                status = applied_payments && applied_payments.length ? 'success' : 'failure';
            }

            logger.info(`${file_type} File Processing completed for ${file_id} - ${uploaded_file_name} with status ${status}`)
            return await ahsData.updateFileStatus({
                fileId: file_id,
                status
            });
        });

        return await Promise.all(promises);
    },

     /***
     * Function used to parse the Batch balance and ARD file to JSON format
     * @param {data} Object {
     *                      file_type,
     *                      fileData,
     *                      submitterPrefix
     *                      }
     *
     */
    decode: (fileType, fileData, submitterPrefix) => {

        if(fileType === 'can_ahs_bbr') {
            return parser.parseBatchBalanceFile(fileData, submitterPrefix);
        }
        else if(fileType === 'can_ahs_ard'){
            return parser.parseARDFile(fileData);
        }
    },

    /***
     * Function used to process the Batch balance and ARD file using JSON format
     * @param {data} Object {
     *                      file_type,
     *                      fileData
     *                      log_details
     *                      }
     *
     */
    process: async (data) => {
        let {
            file_type,
        } = data;

        if (file_type === 'can_ahs_bbr') {
            return await ahsData.batchBalanceClaims(data);
        }
        else if (file_type === 'can_ahs_ard') {
            return await ahsData.applyPayments(data);
        }
    },

    /***
    * Function used to process WCB payment file
    * @param {data} Object {
    *                      ip
    *                      }
    */
    processWCBFile: async (params) => {
        let processDetails = {};
        let { rows = [] } = await ahsData.getWCBFilePathById(params);

        if (!rows.length) {
            return { message: "Could not find file path by file id" };
        }

        let [{
            root_directory = '',
            file_path = '',
            uploaded_file_name = ''
        }] = rows;
        let dirFullPath = path.join(root_directory, file_path);

        try {
            let dirStat = await statAsync(dirFullPath);

            if (!dirStat.isDirectory()) {
                return { message: 'Directory not found in file store' };
            }

            let filePath = path.join(dirFullPath, params.file_id);
            let fileStat = await statAsync(filePath);

            if (!fileStat.isFile()) {
                return { message: 'File not found in directory' }
            }

            let fileData = await readFileAsync(filePath, 'utf8');
            let wcb_details = await wcbParser.getWCBData(fileData);

            if (wcb_details.message) {
                await ahsData.updateWCBFileStatus(params)
                return { message: 'Invalid XML file' };
            }

            let {
                payment_remittance = [],
                overpayment_remittance = []
            } = wcb_details;
            let isClaimNumInvalid = payment_remittance.some(val => val.ClaimNumber && !Number(val.ClaimNumber));
            let isOvpClaimNumInvalid = overpayment_remittance.some(val => val.OVPClaimNumber && !Number(val.OVPClaimNumber));
            let isRecoveredClaimNumInvalid = overpayment_remittance.some(val => val.RecoveredFromClaimNumber && !Number(val.RecoveredFromClaimNumber));

            params.uploaded_file_name = uploaded_file_name || '';
            params.payment = payment_remittance;
            params.overPayment = overpayment_remittance;

            if (isClaimNumInvalid) {
                return { message: 'WCB Claim Number should be numeric' };
            }

            if (isOvpClaimNumInvalid) {
                return { message: 'OVP Claim Number should be numeric' };
            }

            if (isRecoveredClaimNumInvalid) {
                return { message: 'Recovered from Claim Number should be numeric' };
            }

            processDetails = await ahsData.applyWCBPayments(params);

            if (processDetails.code === '22008') {
                return { message: 'Invalid Date Format' };
            }

            await ahsData.updateWCBFileStatus(params);

            return processDetails;

        } catch (err) {

            if (err.code == 'ENOENT') {
                return { message: 'No such file or directory' };
            }

            logger.error(err);
            return { message: err };
        }
    }
};

module.exports = ahsController;
