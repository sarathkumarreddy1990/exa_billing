const data = require('../../data/claim/index');
const Promise = require('bluebird');
const PokitDok = require('./chcPokitdok');
const Redis = require('ioredis');
const config = require('../../config/index');
const logger = require('../../../logger');
const moment = require('moment');
const redisInfo = config.get(config.keys.RedisStore);
const api= {

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
    
    findModifier: ({
        modifier1_id,
        modifier2_id,
        modifier3_id
    }) => {
        if (modifier1_id === null) {
            return 'modifier1_id';
        }

        if (modifier2_id === null) {
            return 'modifier2_id';
        }

        if (modifier3_id === null) {
            return 'modifier3_id';
        }

        return 'modifier4_id';
    },

    splitClaim: async (claim, charges, insurances, isMobileBillingEnabled) => {
        let claimsDetails = [];
        let { professional_modifier_id, technical_modifier_id } = (await data.getTechnicalAndProfessionalModifier()).pop();

        if (isMobileBillingEnabled && claim.billing_type !== 'facility') {
            let professionalClaimCharges = [];
            let technicalClaimCharges = [];
            let ofRespClaimCharges = [];

            let orderingFacilityInvoiceCharges = [];
            let noSplitCharges = [];
            let otherCharges = [];
            let isInsuranceAvailable = insurances.some(item => item.coverage_level === 'primary');

            charges.forEach(item => {
                if (item.charge_type === 'ordering_facility_invoice') {
                    orderingFacilityInvoiceCharges.push(item);
                    return;
                }

                if (item.charge_type === 'no_split') {
                    if (isInsuranceAvailable && item.is_billing_rule_applied && item.is_billing_rule_cpt_add_fee) {
                        item.is_custom_bill_fee = false;
                        item.bill_fee = 0;
                    }

                    noSplitCharges.push(item);
                    return;
                }

                otherCharges.push(item);
            });

            if (claim.billing_type === 'split' || (claim.billing_type === 'global' && claim.is_split_claim_enabled)) {
                otherCharges.forEach(charge => {
                    let modifier_id = api.findModifier(charge);
                    let professionalCharge = {
                        ...charge,
                        bill_fee: 0,
                        allowed_amount: 0
                    };

                    professionalCharge[modifier_id] = professional_modifier_id;
                    professionalClaimCharges.push(professionalCharge);

                    let technicalCharge = {
                        ...charge,
                        bill_fee: 0,
                        allowed_amount: 0
                    };

                    technicalCharge[modifier_id] = technical_modifier_id;
                    technicalClaimCharges.push(technicalCharge);
                });

                otherCharges = [];
            }

            if (orderingFacilityInvoiceCharges.length) {
                if (claim.billing_type === 'split') {
                    technicalClaimCharges.push(...orderingFacilityInvoiceCharges);
                } else {
                    ofRespClaimCharges.push(...orderingFacilityInvoiceCharges);
                }
            }

            if (noSplitCharges.length) {
                if (isInsuranceAvailable) {
                    if (otherCharges.length) {
                        otherCharges.push(...noSplitCharges);
                    } else {
                        professionalClaimCharges.push(...noSplitCharges);
                    }
                } else {
                    if (claim.billing_type === 'split') {
                        technicalClaimCharges.push(...noSplitCharges);
                    } else {
                        ofRespClaimCharges.push(...noSplitCharges);
                    }
                }
            }

            if (otherCharges.length) {
                claimsDetails.push({
                    ...claim,
                    claim_charges: otherCharges
                });
            }

            if (professionalClaimCharges.length) {
                claimsDetails.push({
                    ...claim,
                    claim_charges: professionalClaimCharges
                });
            }

            if (technicalClaimCharges.length) {
                claimsDetails.push({
                    ...claim,
                    claim_charges: technicalClaimCharges,
                    place_of_service_id: claim.technical_place_of_service || null,
                    billing_method: claim.billing_type !== 'global' ? 'direct_billing' : claim.billing_method,
                    payer_type: claim.billing_type !== 'global' ? 'ordering_facility' : claim.payer_type
                });
            }

            if (ofRespClaimCharges.length) {
                claimsDetails.push({
                    ...claim,
                    claim_charges: ofRespClaimCharges,
                    place_of_service_id: claim.technical_place_of_service || null,
                    billing_method: 'direct_billing',
                    payer_type: 'ordering_facility'
                });
            }
        } else {
            charges.forEach(item => {
                if (item.charge_type === 'no_split'&& item.is_billing_rule_applied && item.is_billing_rule_cpt_add_fee) {
                    item.bill_fee = item.billing_rule_fee;
                }
            });
        
            claimsDetails.push({
                ...claim,
                claim_charges: charges
            });
        }

        return claimsDetails;
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
        let {
            claims
            , insurances
            , claim_icds
            , charges
            , is_alberta_billing
            , is_ohip_billing
            , isMobileBillingEnabled
        } = params;        

        let claimsDetails = await api.splitClaim(claims, charges, insurances, isMobileBillingEnabled);

        return await data.save({
            claims: claimsDetails
            , insurances
            , claim_icds
            , auditDetails
            , is_alberta_billing
            , is_ohip_billing
        });
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

    refreshToken: async (model) => {

        try {
            const combinedOptions = {
                db: 0,
                keyPrefix: `${String(model.companyId).padStart(10, '0')}:web:chcPokitdokAccessToken:`
            };

            let chcPokitdokAccessToken = new Redis({
                ...combinedOptions,
                host: redisInfo.host,
                port: redisInfo.port
            });
            chcPokitdokAccessToken.hdel(`accessToken`, model.userId);
        } catch (err) {
            const message = `Cannot Access token delete in chcPokitdok (${model.userId})`;
            logger.logError(message, err);
            return {
                err
            };
        }

        model.refreshToken = true;
        return await api.getEligibility(model);
    },

    getEligibility: async (model) => {

        // build the default url for the requests
        let accessToken = null;
        let accessTokenList = null;
        const combinedOptions = {
            db: 0,
            keyPrefix: `${String(model.companyId).padStart(10, '0')}:web:chcPokitdokAccessToken:`
        };

        let chcPokitdokAccessToken = new Redis({
            ...combinedOptions,
            host: redisInfo.host,
            port: redisInfo.port
        });

        if (!model.refreshToken) {
            accessTokenList = await chcPokitdokAccessToken.hmget('accessToken', model.userId);
            accessToken = accessTokenList && accessTokenList[0] && JSON.parse(accessTokenList[0]).access_token;
        }

        const baseUrl = model.CHCPokitdokBaseURL;
        const accessUrl = model.CHCPokitdokAccessTokenURL;

        if (!baseUrl || !accessUrl) {
            return {
                error: 'CHC pokitdok base url/access token url is not configure'
            };
        }

        if (!accessToken) {
            let result =  await PokitDok.getPokitdokAccessToken({
                clientId:model.pokitdok_client_id,
                clientSecret:model.pokitdok_client_secret,
                accessUrl:accessUrl,
                baseUrl:baseUrl,
            });
            const {
                err,
                res
            } = result;

            if (err) {
                return {
                    err,
                    res
                };
            }

            model.eligibility_response = err ? JSON.stringify(err) : JSON.stringify(res);

            try {
                model.refreshToken = false;
                chcPokitdokAccessToken.hmset(`accessToken`, model.userId, JSON.stringify(res));
                accessToken = res.access_token;
            }
            catch (e) {
                logger.error(`CHC Pokitdok AccessToken failure - could not write to redis`, e);
                return {
                    e,
                    res
                };
            }
        }

        const result = await PokitDok.eligibility(model.userId, {
            accessToken:accessToken,
            baseUrl: model.CHCPokitdokBaseURL
        }, {
            member: {
                birth_date: moment(model.birthDate).format('YYYY-MM-DD'),
                first_name: model.firstName,
                last_name: model.lastName,
                id: model.policyNo
            },
            provider: {
                organization_name:  model.payerInfo.name,
                npi: model.payerInfo.npi_no
            },
            payer: {
                id: model.payerInfo.trading_partner_id
            },
            service_types: model.serviceTypes, // ['health_benefit_plan_coverage'],    // service type Foramt : ['health_benefit_plan_coverage']

            correlation_id: "ELIGIBILITYID"

        });

        if(result.res){
            result.res.insPokitdok = model.insEligibility;
        }

        return {
            err:result.err,
            res: result.res
        };
    },


    /// TODO: have to include benefitOnDate & relationshipCode
    eligibility: async (params) => {
        const payerInfoResponse = await data.getProviderInfo(params.billingProviderId, params.insuranceProviderId);

        if (payerInfoResponse && !payerInfoResponse.length) {
            throw new Error('Unknown provider..');
        }

        params.payerInfo = payerInfoResponse && payerInfoResponse.length && payerInfoResponse[0] || {};

        /// TODO: need to rescratch
        let pokitdokSecretKey = await data.getKeys();
        let pokitdokResponse = pokitdokSecretKey && pokitdokSecretKey.rows || [];
        params.insEligibility = false;


        pokitdokResponse.forEach(function (data) {

            if (data.info) {
                if (data.info.id === "pokitdok_client_id") {
                    params.pokitdok_client_id = data.info.value;
                }
                else if (data.info.id === "pokitdok_client_secret") {
                    params.pokitdok_client_secret = data.info.value;
                }
                else if (data.info.id === "insPokitdok") {
                    params.insEligibility = data.info.value;
                }
                else if (data.info.id === "CHCPokitdokBaseURL") {
                    params.CHCPokitdokBaseURL = data.info.value;
                }
                else if (data.info.id === "CHCPokitdokAccessTokenURL") {
                    params.CHCPokitdokAccessTokenURL = data.info.value;
                }
            }
        });

        const result = await api.getEligibility(params);

        let {
            err,
            res
        } = result;

        if (err && err.error && ['invalid_access_token', 'access_token_expired'].indexOf(err.error.error) === -1) {

            return {
                err,
                res
            };
        }


        if (err && (err.statusCode === 401 || (err.statusCode === 400 && !err.meta))) {
            let result = await api.refreshToken(params);
            return {
                err: result.err,
                res: result.res
            };
        }

        return {
            err,
            res
        };
    },

    getStudiesByPatientId: async (params) => { return await data.getStudiesByPatientId(params); },

    getClaimsByPatient: async (args) => {
        return await data.getClaimsByPatient(args);
    },

    getPatientAltAccNumber: async (args) => {
        return await data.getPatientAltAccNumber(args);
    },

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

    updateNotes: data.updateNotes,

    getChargesByPatientId: data.getChargesByPatientId
};

module.exports = api;
