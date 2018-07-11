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
        let auditDetails = {
            company_id: params.companyId,
            screen_name: params.screenName,
            module_name: params.moduleName,
            client_ip: params.clientIp,
            user_id: params.userId
        };
        params.auditDetails = auditDetails;

        let claimData = await data.getClaimVersion(params);

        if (claimData && claimData.rows.length > 0) {

            if (params.claim_row_version != claimData.rows[0].claim_row_version) {

                return {
                    'message': 'This claim has been already updated by some other user. please refresh the page and try again'
                };
            }
        }

        let existingPayers = await data.getExistingPayer(params);

        if(existingPayers && existingPayers.rows.length) {
            params.claims.existing_payer_type = existingPayers.rows[0].payer_type;
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

    /// TODO: have to include benefitOnDate & relationshipCode
    eligibility: async (params) => {
        const payerInfoResponse = await data.getProviderInfo(params.billingProviderId, params.insuranceProviderId);

        if (!payerInfoResponse.length) {
            throw new Error('Unknown provider..');
        }

        const payerInfo = payerInfoResponse[0];

        /// TODO: need to rescratch
        let pokitdokSecretKey = await data.getKeys();
        let insEligibility = pokitdokSecretKey.rows[0].info.value;
        let pokitdok_client_id = pokitdokSecretKey.rows[1].info.value;
        let pokitdok_client_secret = pokitdokSecretKey.rows[2].info.value;

        let pokitdok = new PokitDok(pokitdok_client_id, pokitdok_client_secret);
        let birthDate = moment(params.birthDate).format('YYYY-MM-DD');

        return await new Promise((resolve, reject) => {

            pokitdok.eligibility({
                member: {
                    birth_date: birthDate,
                    first_name: params.firstName,
                    last_name: params.lastName,
                    id: params.policyNo
                },
                provider: {
                    organization_name: payerInfo.name,
                    npi: payerInfo.npi_no
                },
                service_types: params.serviceTypes,
                trading_partner_id: payerInfo.trading_partner_id
            }, function (err, res) {
                res.insPokitdok = insEligibility;
                let eligibility_response = res;

                if (err) {
                    eligibility_response = err;
                    reject(eligibility_response);
                }

                resolve(eligibility_response);
            });
        }).catch(function (result) {
            return result;
        });
    },

    getStudiesByPatientId: async (params) => { return await data.getStudiesByPatientId(params); },

};
