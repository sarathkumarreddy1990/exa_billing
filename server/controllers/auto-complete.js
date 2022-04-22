const data = require('../data/auto-complete');

module.exports = {
    getStudyStatus: function (params) {
        return data.getStudyStatus(params);
    },
    getCptAutoCompleteDetails: function (params) {
        return data.getCptAutoCompleteDetails(params);
    },
    getProviders: function (params) {
        return data.getProviders(params);
    },
    getProviderSkillCodes: function (params) {
        return data.getProviderSkillCodes(params);
    },
    getICDcodes: function (params) {
        return data.getICDcodes(params);
    },
    getInsurances: function (params) {
        return data.getInsurances(params);
    },
    getPatients: function (params) {
        return data.getPatients(params);
    },
    getUsers: function (params) {
        return data.getUsers(params);
    },
    getUserRoles: function (params) {
        return data.getUserRoles(params);
    },
    insurance_payer_types: function (params) {
        return data.insurance_payer_types(params);
    },
    getEDITemplateList: () => {
        return data.getEDITemplateList();
    },

    getProviderGroupDetail: (params) => {
        return data.getProviderGroupDetail(params);
    },

    getAdjustmentCodes: (params) => {
        return data.getAdjustmentCodes(params);
    },

    getWCBCodes: (params) => {
        return data.getWCBCodes(params);
    },

    getPatientAltAccounts: (params) => {
        return data.getPatientAltAccounts(params);
    },

    getOrderingFacilities: data.getOrderingFacilities,

    getOrderingFacilityContacts: data.getOrderingFacilityContacts,

    getServiceFacilities: data.getServiceFacilities,
};
