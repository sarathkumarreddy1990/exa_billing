const data = require('../data/claims');
const Promise = require('bluebird');

module.exports = {

    getLineItemsDetails: async (params) => { return await data.getLineItemsDetails(params); },

    getPatientInsurances: async (params) => {

        if (params.id) {
            return data.getPatientInsurancesById(params);
        }

        return await data.getPatientInsurances(params);
    },

    getPatientInsurancesById: async (params) => {

        return await data.getPatientInsurancesById(params);
    },

    getMasterDetails: async (params) => { return await data.getMasterDetails(params); },

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

    update: async (params) => {

        update_charges(params);

        async function update_charges(objects) {

            const charge_arr = [];
            await data.update(params);

            for (const obj1 of objects.charges) {

                if (obj1.id) {

                    charge_arr.push(data.saveCharges(obj1));

                }

                
            }

            return await Promise.all(charge_arr);
        }
        
    },
    getData: async (params)=> { return await data.getClaimData(params); }
};
