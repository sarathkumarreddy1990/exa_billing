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
    getProvidersAc: function (params) {
        return data.getProvidersAc(params);
    },
    getUsers: function (params) {
        return data.getUsers(params);
    }
};