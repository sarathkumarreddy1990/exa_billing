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

        let processedResult = await Promise.all(promises);
        let erroneous_list = _.filter(processedResult, { 'error': true });
        let response;

        if (erroneous_list.length === processedResult.length) {
            response = {
                status: 'error',
                message: erroneous_list[0].message || 'Error on Remittance file process see billing log'
            };
        } else if (erroneous_list.length) {
            response = {
                status: 'error',
                message: 'Partial Remittance files processed, For other see billing log'
            };
        } else {
            response = {
                status: 'ok',
                message: 'MSP Remittance files processing successfully completed'
            };
        }

        return [response];

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
    },

    /**
    * submitBatchEligibility - To submit all batch eligible of claims
    * @param  {Object} args  
    */
    submitBatchEligibility: async (args) => {
        let result = await bcController.getAllscheduledClaims(args);

        if (!result || !result.length) {
            return [{ responseCode: 'noRecord' }];
        }

        args.isBatchEligibilityFile = true;
        let response = await bcModules.submitBatchEligibility(args, result);
        return [response];
        
    }

};

module.exports = bcCronService;
