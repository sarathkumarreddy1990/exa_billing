const SearchFilter = require('./claim-search-filters');
const { SQL, query, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (args) {
        return await SearchFilter.getWL(args);
    },

    deleteClaimOrCharge: async (params) => {
        const { target_id, clientIp, entityName, userId, companyId, type } = params;
        const screenName = 'claims';

        let audit_json = {
            client_ip: clientIp,
            screen_name: screenName,
            entity_name: entityName,
            module_name: screenName,
            user_id: userId,
            company_id: companyId
        };

        params.audit_json = JSON.stringify(audit_json);

        const sql = SQL` SELECT billing.purge_claim_or_charge(${target_id}, ${type}, ${params.audit_json}::json)`;

        return await query(sql);
    },

    updateClaimStatus: async (params) => {

        const {
            claim_status_id,
            billing_code_id,
            billing_class_id,
            claimIds,
        } = params;

        params.moduleName = 'claims';

        let updateData;

        if (params.claim_status_id) {
            updateData = SQL`claim_status_id = ${claim_status_id}`;
        } else if (params.billing_code_id) {
            updateData = SQL`billing_code_id = ${billing_code_id}`;
        } else if (params.billing_class_id) {
            updateData = SQL`billing_class_id = ${billing_class_id}`;
        }

        let sql = SQL`UPDATE
                             billing.claims 
                        SET                          
                    `;

        sql.append(updateData);
        sql.append(SQL`WHERE  id in (${claimIds}) RETURNING id, '{}'::jsonb old_values`);

        return await queryWithAudit(sql, {
            ...params,
            logDescription: 'Updated Claim '+ params.process+ ' for claims ('+ params.claimIds +')'
        });
    },

    /// TODO: bad fn name -- need to rename
    movetoPendingSub: async (params) => {
        let sql = SQL`WITH getStatus AS 
						(
							SELECT 
								id
							FROM 
								billing.claim_status
							WHERE code  = 'SUBPEN'
						)	
						UPDATE 
							billing.claims bc
						SET claim_status_id = (SELECT id FROM getStatus)
						WHERE bc.id = ANY(${params.success_claimID})
						RETURNING bc.id`;

        return await query(sql);
    },

    getClaimStudy: async (params) => {

        let {
            claim_id
        } = params;

        let sql = SQL`				
                    SELECT  study_id,
                            studies.order_id 
					FROM    billing.charges_studies 
                            INNER JOIN billing.charges ON billing.charges.id = billing.charges_studies.charge_id 
                            INNER JOIN public.studies ON public.studies.id = billing.charges_studies.study_id 
					WHERE   billing.charges.claim_id = ${claim_id}
					LIMIT   1`;

        return await query(sql);
    },

    getBillingPayers : async function(params) {
        const sql = SQL`
                        SELECT 
                            c.patient_id
                            , c.facility_id 
                            , c.referring_provider_contact_id
                            , c.primary_patient_insurance_id
                            , c.secondary_patient_insurance_id
                            , c.tertiary_patient_insurance_id
                            , c.ordering_facility_id
                            , pg.group_name AS ordering_facility_name
                            , ipp.insurance_name AS p_insurance_name
                            , ips.insurance_name AS s_insurance_name
                            , ipt.insurance_name AS t_insurance_name
                            , ref_pr.full_name AS ref_prov_full_name
                            , p.full_name AS patient_full_name
                            , f.facility_name 
                        FROM
                            billing.claims c
                        INNER JOIN public.patients p ON p.id = c.patient_id
                        LEFT JOIN public.patient_insurances cpi ON cpi.id = c.primary_patient_insurance_id
                        LEFT JOIN public.patient_insurances csi ON csi.id = c.secondary_patient_insurance_id
                        LEFT JOIN public.patient_insurances cti ON cti.id = c.tertiary_patient_insurance_id
                        LEFT JOIN public.insurance_providers ipp ON ipp.id = cpi.insurance_provider_id
                        LEFT JOIN public.insurance_providers ips ON ips.id = csi.insurance_provider_id
                        LEFT JOIN public.insurance_providers ipt ON ipt.id = cti.insurance_provider_id
                        LEFT JOIN public.provider_contacts ref_pc ON ref_pc.id = c.referring_provider_contact_id
                        LEFT JOIN public.providers ref_pr ON ref_pc.provider_id = ref_pr.id
                        LEFT JOIN public.provider_contacts rend_pc ON rend_pc.id = c.rendering_provider_contact_id
                        LEFT JOIN public.provider_groups pg ON pg.id = c.ordering_facility_id
                        LEFT JOIN public.facilities f ON f.id = c.facility_id
                        WHERE 
                            c.id = ${params.id}`;

        return await query(sql);
           
    },

    updateBillingPayers: async function(params) {
        const sql = SQL`
                        UPDATE 
                        billing.claims
                        SET payer_type = ${params.payer_type}
                        WHERE id = ${params.id}`;

        return await query(sql);
    }
};
