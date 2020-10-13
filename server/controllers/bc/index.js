'use strict';

const claimdata = require('../../data/claim/claim-workbench');
const bcData = require('../../data/bc');

const bcController = {
    getClaimsForEDI: async (params) => {
        params.isCount = false;
        const claims = await claimdata.getData(params);
        let claimIds = [];
        let claimResultLength = claims.rows && claims.rows.length;

        if (claimResultLength) {
            for (let i = 0; i < claims.rows.length; i++) {
                claimIds.push(claims.rows[i].id);

                if (['PS', 'SF'].indexOf(claims.rows[i].claim_status_code) === -1) {
                    return { isNotpendingSubmission: true };
                }
            }
        }

        return { claimIds: claimIds.toString() };
    },

    submitClaim: async (args) => {
        return await bcData.submitClaim(args);
    },

    getCompanyFileStore: async (args) => {
        return await bcData.getCompanyFileStore(args);
    },

    storeFile: async (args) => {
        return await bcData.storeFile(args);
    },

    ediFiles: async (args) => {
        return await bcData.ediFiles(args);
    },

    updateClaimsStatus: async (args) => {
        return await bcData.updateClaimsStatus(args);
    }
};

module.exports = bcController;
