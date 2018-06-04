const data = require('../data/claims');
const Promise = require('bluebird');

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

    save: async (params) => {

        charges(params);

        async function charges(objects) {

            const results = [];
            const claimResult = await data.save(params);

            for (const obj of objects.charges) {

                if (claimResult.rows.length && claimResult.rows[0]) {

                    obj.claim_id = claimResult.rows[0].id;

                }

                results.push(data.saveCharges(obj));
            }

            return await Promise.all(results);
        }
    },

    getData: async (params) => { return data.getClaimData(params); },
};
