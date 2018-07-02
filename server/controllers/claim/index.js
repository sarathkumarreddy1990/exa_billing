const data = require('../../data/claim/index');
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

    save: async (params) => {
        let auditDetails = {
            company_id: params.companyId,
            screen_name: params.screenName,
            module_name: params.moduleName,
            client_ip: params.clientIp,
            user_id: params.userId
        };
        params.auditDetails = auditDetails;
        return await data.save(params);
    },

    update: async (params) => {
        
        let claimData = await data.getClaimVersion(params);

        if(claimData && claimData.rows.length > 0) {

            if(params.claim_row_version != claimData.rows[0].claim_row_version) {

                return {
                    'message' : 'Claim row version does not matched'
                };
            }
        }

        update_charges(params);

        async function update_charges(objects) {

            const charge_arr = [];

            await data.update(params);

            for (const obj1 of objects.charges) {

                if (!obj1.id) {

                    if (!obj1.study_id) {
                        charge_arr.push(data.saveChargesOnly(obj1));
                    } else {
                        charge_arr.push(data.saveCharges(obj1));
                    }

                }

            }

            return await Promise.all(charge_arr);
        }

    },
    getData: async (params) => { return await data.getClaimData(params); },

    eligibility: async (params) => {
        const model = await data.getFolderPath(params);
        model.account_no = model.rows[0].account_no;
        let pokitdokSecretKey = await data.getKeys();
        let insEligibility = pokitdokSecretKey.rows[0].info.value;
        let pokitdok_client_id = pokitdokSecretKey.rows[1].info.value;
        let pokitdok_client_secret = pokitdokSecretKey.rows[2].info.value;

        let pokitdok = new PokitDok(pokitdok_client_id, pokitdok_client_secret);
        const birthDate = moment(params.BirthDate);
        model.BirthDate = birthDate.format('YYYY-MM-DD');

        return await new Promise((resolve, reject ) => {

            pokitdok.eligibility({
                member: {
                    birth_date: moment(model.BirthDate).format('YYYY-MM-DD'),
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
    },

    getStudiesByPatientId: async (params) => { return await data.getStudiesByPatientId(params); },

};
