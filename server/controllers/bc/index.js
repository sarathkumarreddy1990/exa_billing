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
    },

    getAllClaims: async (args) => {
        return await bcData.getAllClaims(args.companyId);
    },

    updateEDIFile: async (args) => {
        return await bcData.updateEDIFile(args);
    },

    getLastUpdatedSequence: async (args) => {
        return await bcData.getLastUpdatedSequence(args);
    },

    ediFilesNotes: async (args, submittedClaimDetails) => {
        return await bcData.ediFilesNotes(args, submittedClaimDetails);
    },

    ediFilesCharges: async(submittedClaimDetails) => {
        return await bcData.ediFilesCharges(submittedClaimDetails);
    },

    getAllpendingFiles: async(args) => {
        return await bcData.getAllpendingFiles(args);
    },

    updateLastSequenceNumber: async(args, billing_provider_id, currentSequence) => {
        return await bcData.updateLastSequenceNumber(args, billing_provider_id, currentSequence);
    },

    saveBatchEligibilitySequence: async(args) => {
        return await bcData.saveBatchEligibilitySequence(args);
    },

    getediFileClaimId: async(claim_number, edi_file_id) => {
        return await bcData.getediFileClaimId(claim_number, edi_file_id);
    },


};

module.exports = bcController;
