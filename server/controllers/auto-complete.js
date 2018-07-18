const data = require('../data/auto-complete');

module.exports = {

    getCptAutoCompleteDetails: function (params) {
        return data.getCptAutoCompleteDetails(params);
    },
    getProviders: function (params) {
        return data.getProviders(params);
    },
    getICDcodes: function (params) {
        return data.getICDcodes(params);
    },
    getProviderGroups:function(params){
        return data.getProviderGroups(params);
    },
    getInsurances:function(params){
        return data.getInsurances(params);
    },
    getPatients: function (params) {
        return data.getPatients(params);
    },
    getOrderingFacility: function (params) {
        return data.getOrderingFacility(params);
    },
    getUsers: function (params) {
        return data.getUsers(params);
    },
    getUserRoles: function (params) {
        return data.getUserRoles(params);
    },
    insurance_payer_types: function (params) {
        return data.insurance_payer_types(params);
    }
};
