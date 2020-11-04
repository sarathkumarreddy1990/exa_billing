const _ = require('lodash');
const bcModules = require('./');
const bcController = require('../../server/controllers/BC');
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
            case 'download':
                return bcModules.downloadFiles(data);
            case 'process':
                return bcCronService.processFile(data);
        }
    }

};

module.exports = bcCronService;
