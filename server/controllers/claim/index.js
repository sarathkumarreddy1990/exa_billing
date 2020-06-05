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

        if ((claimData && claimData.rows.length > 0) && (params.claim_row_version != claimData.rows[0].claim_row_version)) {

            return {
                'message': 'This claim has been already updated by some other user - please refresh the page and try again'
            };
        }

        let existingPayers = await data.getExistingPayer(params);

        if (existingPayers && existingPayers.rows.length) {
            params.claims.existing_payer_type = existingPayers.rows[0].payer_type;
        }

        return await data.update(params);

    },

    getData: async (params) => { return await data.getClaimData(params); },

    /// TODO: have to include benefitOnDate & relationshipCode
    eligibility: async (params) => {
        const payerInfoResponse = await data.getProviderInfo(params.billingProviderId, params.insuranceProviderId);

        if (payerInfoResponse && !payerInfoResponse.length) {
            throw new Error('Unknown provider..');
        }

        const payerInfo = payerInfoResponse && payerInfoResponse.length && payerInfoResponse[0] || {};

        /// TODO: need to rescratch
        let pokitdokSecretKey = await data.getKeys();
        let pokitdokResponse = pokitdokSecretKey && pokitdokSecretKey.rows || [];
        let insEligibility = false;
        let pokitdok_client_id = '';
        let pokitdok_client_secret = '';

        pokitdokResponse.forEach(function (data) {
            
            if (data.info) {
                if (data.info.id === "pokitdok_client_id") {
                    pokitdok_client_id = data.info.value;
                }
                else if (data.info.id === "pokitdok_client_secret") {
                    pokitdok_client_secret = data.info.value;
                }
                else if (data.info.id === "insPokitdok") {
                    insEligibility = data.info.value;
                }
            }
        });

        let pokitdok = new PokitDok(pokitdok_client_id, pokitdok_client_secret);
        let birthDate = params.birthDate;

        return await new Promise((resolve, reject) => {

            pokitdok.eligibility({
                member: {
                    birth_date: moment(birthDate).format('YYYY-MM-DD'),
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

    getIcd9To10: async function (params) {
        let pokitdokSecretKey = await data.getKeys();
        let pokitdok_client_id = pokitdokSecretKey.rows[1].info.value;
        let pokitdok_client_secret = pokitdokSecretKey.rows[2].info.value;

        let pokitdok = new PokitDok(pokitdok_client_id, pokitdok_client_secret);

        if (!pokitdok.clientId || !pokitdok.clientSecret) {
            return 'Pokitdok credentials not yet set.';
        }

        return await new Promise((resolve, reject) => {
            pokitdok.icdConvert({ code: params.icd9Code }, function (err, res) {
                if (err) {
                    return reject(err);
                }

                if (res && res.data && res.data.destination_scenarios && res.data.destination_scenarios.length && res.data.destination_scenarios[0].choice_lists && res.data.destination_scenarios[0].choice_lists.length) {
                    let icd10Data = [];

                    for (let i = 0; i < res.data.destination_scenarios[0].choice_lists.length; i++) {
                        if (res.data.destination_scenarios[0].choice_lists[i].length) {
                            for (let j = 0; j < res.data.destination_scenarios[0].choice_lists[i].length; j++) {
                                icd10Data.push(res.data.destination_scenarios[0].choice_lists[i][j]);
                            }
                        }
                    }

                    resolve(icd10Data);
                } else {
                    resolve(res);
                }
            });
        }).catch(function (result) {
            return result;
        });
    },

    saveICD: async (params) => {

        await data.saveICD(params);

        return await data.getICD(params);
    },

    getApprovedReportsByPatient: async (params) => {
        return await data.getApprovedReportsByPatient(params);
    },

    deleteInsuranceProvider: async (params) => {
        return await data.deleteInsuranceProvider(params);
    },

    getClaimAppliedPayments: async (params) => {
        return await data.getClaimAppliedPayments(params);
    },

    updateNotes: async (params) => {
        if (params.billingRegionCode === 'can_MB') {
            return await data.updateNotesMB(params);
        } else if (params.billingRegionCode === 'can_BC') {
            return await data.updateNotesBC(params);
        }
    },


    getChargesByPatientId: data.getChargesByPatientId

};
