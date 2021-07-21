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

    submitClaim: bcData.submitClaim,

    getCompanyFileStore: bcData.getCompanyFileStore,

    storeFile:  bcData.storeFile,

    ediFiles:  bcData.ediFiles,

    updateClaimsStatus: bcData.updateClaimsStatus,

    getAllClaims: async (args) =>  await bcData.getAllClaims(args.companyId),

    updateEDIFile: bcData.updateEDIFile,

    getLastUpdatedSequence: bcData.getLastUpdatedSequence,

    ediFilesNotes: async (args, submittedClaimDetails) => await bcData.ediFilesNotes(args, submittedClaimDetails),

    ediFilesCharges: bcData.ediFilesCharges,

    getAllpendingFiles: bcData.getAllpendingFiles,

    updateLastSequenceNumber: async(args, billing_provider_id, currentSequence) => await bcData.updateLastSequenceNumber(args, billing_provider_id, currentSequence),

    saveBatchEligibilitySequence: bcData.saveBatchEligibilitySequence,

    getediFileClaimId: async(claim_number, edi_file_id) => await bcData.getediFileClaimId(claim_number, edi_file_id),

    updateFileStatus: bcData.updateFileStatus,

    getFilesList: bcData.getFilesList,

    processRemittanceFile: bcData.processRemittance,

    saveEligibilityResponse:  bcData.saveEligibilityResponse,

    getAllscheduledClaims:  bcData.getAllscheduledClaims,

    getLastUpdatedSequenceByDataCenterNumber: bcData.getLastUpdatedSequenceByDataCenterNumber
};

module.exports = bcController;
