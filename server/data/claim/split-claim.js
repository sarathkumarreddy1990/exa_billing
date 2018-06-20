const {
    SQL,
    query
} = require('../index');

module.exports = {
    getData: async (params) => {
        let {
            claim_id
        } = params;

        let sql = SQL`SELECT json_agg(row_to_json(claim)) claim_details FROM ( SELECT 
                          bc.id AS claim_no
                        , ch.cpt_id
                        , bc.id AS patient_id  
                        , cpt.display_code AS cpt_code
                        , cpt.display_description AS cpt_description
                        , public.get_full_name(p.last_name, p.first_name, p.middle_name, p.prefix_name, p.suffix_name)
                        , p.account_no
                        , (COALESCE(TRIM(pr.last_name),'') ||' '|| COALESCE(TRIM(pr.first_name),'')) AS referringPhysician
                    FROM billing.claims bc
                    INNER JOIN public.patients p ON p.id = bc.patient_id
                    INNER JOIN billing.charges ch ON ch.claim_id = bc.id
                    INNER JOIN public.cpt_codes cpt ON cpt.id = ch.cpt_id
                    LEFT JOIN public.provider_contacts pc ON pc.id = bc.referring_provider_contact_id
                    LEFT JOIN public.providers pr ON pr.id = pc.provider_id
                    WHERE claim_id = ${claim_id} ) AS claim`;

        return await query(sql);

    },

    createClaim: async () => {

    },

    getvalidatedData: async (params) =>{
        let {
            claim_id
        } = params;

        let sql = SQL`WITH charge_count AS (
                            SELECT 
                                COUNT(1) AS charge_count 
                            FROM 
                                billing.charges 
                            WHERE claim_id = ${claim_id}),
                        payment_count AS(
                            SELECT 
                                COUNT(pa.id) AS payment_count
                            FROM
                                billing.charges ch
                            INNER JOIN billing.payment_applications pa ON pa.charge_id = ch.id
                            WHERE ch.claim_id = ${claim_id}
                        )                        
                        SELECT * FROM charge_count, payment_count `;

        return await query(sql);

    }
};