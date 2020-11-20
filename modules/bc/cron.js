const bcModules = require('./');
const _ = require('lodash');
const bcController = require('../../server/controllers/bc');
const logger = require('../../logger');

const bcCronService = {

    /**
     * Function used to process the remittance file - called from Cron job
     * @param {data} Object {
     *                      ip
     *                      }
     */
    processFile: async (args) => {
        const data = {
            status: 'pending',
            fileTypes: ['can_bc_remit']
        };

        let filesList = await bcController.getFilesList(data);

        if (!filesList.rows || !filesList.rows.length) {
            logger.info('Pending Remittance files not available to process');

            return {
                err: null,
                response: {
                    status: `ok`,
                    message: `No pending records found`
                },
            };
        }

        const promises = _.map(filesList.rows, async (file) => {
            args = {
                ...args,
                ...file,
                company_id: args.companyId
            };
            let {
                uploaded_file_name,
                file_id,
            } = file;

            await bcModules.processRemittanceFile(args);
            logger.info(`Remittance File ${file_id}-${uploaded_file_name} processed successfully`);
        });

        return await Promise.all(promises);

    },

    /**
     * events - used to identify the cron action
     * @param  {Object} data  event object
     */
    events: async (data) => {
        let {
            action
        } = data;

        switch (action) {
            case 'BCCLAIMSUBMISSIONSERVICE':
                return bcCronService.submitPendingSubmission(data);
            case 'BCFILESUPLOADSERVICE':
                return bcCronService.transferFileToMsp(data);
            case 'BCBATCHELIGIBILITYSERVICE':
                return bcCronService.submitBatchEligibility(data);
            case 'BCFILESDOWNLOADSERVICE':
                return bcModules.downloadFiles(data);
            case 'BCFILESPROCESSSERVICE':
                return bcCronService.processFile(data);
        }
    },

    /**
     * submitPendingSubmission -
      To submit all pending submission claims
     * @param  {Object} args
     */
    submitPendingSubmission: async (args) => {
        let result = await bcController.getAllClaims(args);
        let [{ ids }] = result.length && result || [{}];

        if (ids && ids.length) {
            args.claimIds = ids;
            let response = await bcModules.submitClaims(args);
            return [response];
        } 

        return [{ responseCode: 'noRecord' }];
    },

    /**
     * transferFileToMsp - To submit edi files to MSP portal
     * @param  {Object} args  
     * @param  {Object} data
     */
    transferFileToMsp: async (data) => {
        let fileList = await bcController.getAllpendingFiles(data);

        if (!fileList.rows || !fileList.rows.length) {
            return [{ responseCode: 'noPendingEdiFile' }];
        }

        return await bcModules.transferFileToMsp(data, fileList.rows);
    }
};

module.exports = bcCronService;