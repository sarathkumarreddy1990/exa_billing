const SearchFilter = require('./claim-search-filters');
const { SQL, query, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (args) {
        return await SearchFilter.getWL(args);
    },

    deleteClaim: async (params) => {
        const { claim_id, clientIp, screenName, entityName, userId, companyId } = params;

        let audit_json = {
            client_ip: clientIp,
            screen_name: screenName,
            entity_name: entityName,
            module_name: screenName,
            user_id: userId,
            company_id: companyId
        };

        params.audit_json = JSON.stringify(audit_json);

        const sql = SQL` SELECT billing.purge_claim(${claim_id},${params.audit_json}::json)`;

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
    }
};
