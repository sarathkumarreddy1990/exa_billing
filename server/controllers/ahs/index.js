'use strict';

const ahsData = require('../../data/ahs');
const parser = require('../../../modules/ahs/decoder/index');
const logger = require('../../../logger');
const fs = require('fs');
const _ = require('lodash');

const {
    promisify,
} = require('util');

const readFileAsync = promisify(fs.readFile);

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

        const { ip } = args;

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

        const promises = _.map(filesList.rows, async (file) => {
            let {
                root_directory,
                file_path,
                uploaded_file_name,
                file_type,
                file_id,
                log_details
            } = file;

            let filePath = `${root_directory}/${file_path}/${uploaded_file_name}`;
            let fileContent;

            try {
                fileContent = await readFileAsync(filePath, 'utf8');
            }
            catch (e) {
                logger.error(`Error in file read - ${filePath}`, e);
            }

            let fileData = ahsController.decode(file_type, fileContent);

            await ahsData.updateFileStatus({
                status: 'in_progress',
                fileId: file_id
            });

            let result = await ahsController.process({
                company_id: args.company_id,
                companyId: args.companyId,
                fileData,
                file_type,
                file_id,
                log_details,
                ip
            });

            return await ahsData.updateFileStatus({
                status: result.rows && result.rows.length ? 'success' : 'failure',
                fileId: file_id
            });
        });

        return await Promise.all(promises);

    },

     /***
     * Function used to parse the Batch balance and ARD file to JSON format
     * @param {data} Object {
     *                      file_type,
     *                      fileData
     *                      }
     *
     */
    decode: (fileType, fileData) => {

        if(fileType === 'can_ahs_bbr') {
            return parser.parseBatchBalanceFile(fileData);
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
    }

};

module.exports = ahsController;
