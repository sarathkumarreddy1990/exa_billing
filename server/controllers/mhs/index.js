'use strict';

const mhsData = require('../../data/mhs');
const claimdata = require('../../data/claim/claim-workbench');
const eraData = require('../../data/era/index');
const {promisify} = require('util');
const parser = require('../../../modules/mhs/decoder/index');
const logger = require('../../../logger');
const fs = require('fs');
const readFile = promisify(fs.readFile);
const path = require('path');

const mhsController = {
    getFilePath: async (args) => await mhsData.getFilePath(args.fileStoreId),

    getClaimsForEDI: async (params) => {
        params.isCount = false;
        const claims = await claimdata.getData(params);
        let claimIds = [];

        for (let i = 0; i < claims.rows.length; i++) {
            claimIds.push(claims.rows[i].id);

            if (claims.rows[i].claim_status !== 'Pending Submission') {
                return { isNotpendingSubmission: true };
            }
        }

        return { claimIds: claimIds.toString() };
    },

    storeFile: async (args) => {
        return await mhsData.storeFile(args);
    },

    ediFiles: async(args) => {
        return await mhsData.ediFiles(args);
    },

    updateClaimsStatus: async(args) => {
        return await mhsData.updateClaimsStatus(args);
    },

    submitClaim: async (args) => {
        return await mhsData.submitClaim(args);
    },

    getCompanyFileStore: async (args) => {
        return await mhsData.getCompanyFileStore(args);
    },
    
    /**
     * Tor reading the contents of the file
    */
    getFile: async (filePath, params) => {
        let contents;

        try {
            contents = await readFile(filePath, 'utf8');
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
    *                      ip
    *                      } 
    */
    processEraFile: async (params) => {
        let processDetails,
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
            let dirExists = fs.existsSync(eraPath);

            if (!dirExists) {
                message.push({
                    status: 100,
                    message: 'Directory not found in file store'
                });

                return message;
            }

            eraPath = path.join(eraPath, params.file_id);
            let eraResponseJson = await mhsController.getFile(eraPath, params);

            logger.logInfo('File processing finished...');

            //Create New charges for interest payments
            await mhsData.createInterestCharges(eraResponseJson.processedServiceRecord, params);

            await mhsData.updateFileStatus({
                status: 'in_progress',
                fileId: params.file_id
            });

            logger.logInfo('Applying payments started...');

            //Applying payments from the payment file
            processDetails = await mhsData.applyPayments(eraResponseJson, params);

            //Again we call to create payment application for unapplied charges from ERA claims
            await mhsData.unappliedChargePayments(params);

            await eraData.updateERAFileStatus(params);

            logger.logInfo('Applying payments finished...');

            return processDetails;
        }
        catch (err) {
            logger.error(err);
            return err;
        }
    }
};

module.exports = mhsController;
