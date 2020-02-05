'use strict';

const mhsData = require('../../data/mhs');
const claimdata = require('../../data/claim/claim-workbench');

const mhsController = {
    getFilePath: async (args) => {
        return await mhsData.getFilePath(args.fileStoreId);
    },

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
};

module.exports = mhsController;
