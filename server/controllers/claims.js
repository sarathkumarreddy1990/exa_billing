const data = require('../data/claims');
const Promise = require('bluebird');
const PokitDok = require('pokitdok-nodejs');
const moment = require('moment');

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


                if (!obj1.id) {

                    charge_arr.push(data.saveCharges(obj1));

                }

            }

            return await Promise.all(charge_arr);
        }

    },
    getData: async (params) => { return await data.getClaimData(params); },

    eligibility: async (params) => {
        let pokitdokSecretKey = await data.getKeys();
        let insEligibility = pokitdokSecretKey.rows[0].info.value;
        let pokitdok_client_id = pokitdokSecretKey.rows[1].info.value;
        let pokitdok_client_secret = pokitdokSecretKey.rows[2].info.value;

        let pokitdok = new PokitDok(pokitdok_client_id, pokitdok_client_secret);
        const birthDate = moment(params.BirthDate);

        return await new Promise((resolve, reject ) => {

            pokitdok.eligibility({
                member: {
                    birth_date: birthDate.format('YYYY-MM-DD'),
                    first_name: params.FirstName,
                    last_name: params.LastName,
                    id: params.PolicyNo
                },
                provider: {
                    organization_name: params.InsuranceCompanyName,
                    npi: params.NpiNo
                },
                service_types: params.ServiceTypes, 
                trading_partner_id: params.tradingPartnerId
            }, function (err, res) {
                res.insPokitdok = insEligibility;
                let eligibility_response =  res;

                if(err){
                    eligibility_response = err;                    
                    reject(eligibility_response);
                }

                resolve(eligibility_response);
            });

        }).catch(function(result){
            return result;
        });
    }
};
