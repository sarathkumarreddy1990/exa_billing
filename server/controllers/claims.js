const data = require('../data/claims');

module.exports = {
    
    getLineItemsDetails: (params) => { return data.getLineItemsDetails(params); },
    getPatientInsurances: (params) => { return data.getPatientInsurances(params); },
    getMasterDetails: (params) => { return data.getMasterDetails(params); },
    save: (params) => { return data.save(params); }
};
