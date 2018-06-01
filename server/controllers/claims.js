const data = require('../data/claims');

module.exports = {

    getLineItemsDetails: (params) => { return data.getLineItemsDetails(params); },
    getPatientInsurances: (params) => {
        if (params.id) {
            return data.getPatientInsurancesById(params);
        }
        return data.getPatientInsurances(params);
    },
    getPatientInsurancesById: async (params) => {
        return data.getPatientInsurancesById(params);
    },
    getMasterDetails: (params) => { return data.getMasterDetails(params); },
    save: (params) => { return data.save(params); }
};
