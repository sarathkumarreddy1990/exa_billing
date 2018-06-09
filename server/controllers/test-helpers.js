const data = require('../data/test-helpers');

module.exports = {

    getStudyIds: function () {
        return data.getStudyIds();
    },

    getPatientId: function () {
        return data.getPatientId();
    },

    getinsuranceProviderId: function () {
        return data.getinsuranceProviderId();
    },

    getProviderGroupId: function () {
        return data.getProviderGroupId();
    },

    getProviderContactId: function () {
        return data.getProviderContactId();
    },

    getPaymentReasonId: function () {
        return data.getPaymentReasonId();
    },

    getCompanyId: function () {
        return data.getCompanyId();
    },

    getFacilityId: function () {
        return data.getFacilityId();
    },

    getUserId: function () {
        return data.getUserId();
    },

    getClaimId: function () {
        return data.getClaimId();
    },

    getAdjustmentCodeId: function () {
        return data.getAdjustmentCodeId();
    }

};