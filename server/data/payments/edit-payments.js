const { query } = require('./../index');

module.exports = {

    getPendingPayments: async function (params) {
        return await query(`                                            
        SELECT 
            bc.id AS claim_id,
            bch.id AS charge_id,
            patient_id,
            bc.id,
            bc.invoice_no,
            get_full_name(pp.last_name,pp.first_name) AS full_name,
            bc.claim_dt,
            pp.account_no,
            array_agg(pcc.display_description) AS display_description,
            (SELECT charges_bill_fee_total from billing.get_claim_totals(bc.id)) AS billing_fee,
            (SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) FROM billing.get_claim_totals(bc.id)) AS balance
        FROM billing.claims bc
        INNER JOIN public.patients pp on pp.id = bc.patient_id 
        INNER JOIN billing.charges bch on bch.claim_id = bc.id
        INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id
        WHERE NOT EXISTS (SELECT 1 FROM billing.payment_applications bpa 
            INNER JOIN billing.payments bp ON bp.id = bpa.payment_id
            WHERE  bpa.charge_id = bch.id
            AND payment_id = ${params.customArgs.paymentID})
        AND (SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) FROM billing.get_claim_totals(bc.id)) > 0::money 
        group by bc.id, bc.invoice_no, bc.claim_dt, pp.account_no, get_full_name(pp.last_name,pp.first_name), bch.id
        LIMIT ${params.pageSize} OFFSET ${((params.pageNo - 1) * params.pageSize)} 
        `);
    },

    getAppliedPayments: async function (params) {
        return await query(`                                            
        SELECT
            bc.id, 
            bc.id AS claim_id, 
            bch.id AS charge_id,
            bc.invoice_no,
            get_full_name(pp.last_name,pp.first_name) AS full_name,
            bc.claim_dt,
            (SELECT charges_bill_fee_total from billing.get_claim_totals(bc.id)) as bill_fee,
            COALESCE(sum(bpa.amount) FILTER(where bp.payer_type = 'patient'),0::money) as patient_paid,
            COALESCE(sum(bpa.amount) FILTER(where bp.payer_type != 'patient'),0::money) as others_paid,
            (SELECT adjustments_applied_total from billing.get_claim_totals(bc.id)) as adjustment,
            (SELECT payments_applied_total from billing.get_claim_totals(bc.id)) as payment,
            (SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) from billing.get_claim_totals(bc.id)) as balance,
            array_agg(pcc.display_description) as display_description
        FROM billing.payments bp
        INNER JOIN billing.payment_applications bpa on bpa.payment_id = bp.id
        INNER JOIN billing.charges bch on bch.id = bpa.charge_id
        INNER JOIN billing.claims bc on bc.id = bch.claim_id
        INNER JOIN public.patients pp on pp.id = bc.patient_id
        INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id
        WHERE bp.id = ${params.customArgs.paymentID}
        GROUP BY bc.id, bc.invoice_no, get_full_name(pp.last_name,pp.first_name), bc.claim_dt, bch.id 
        LIMIT ${params.pageSize} OFFSET ${((params.pageNo - 1) * params.pageSize)} 
        `);
    },

    getClaimBasedCharges: async function (params) {
        let joinQuery = '';
        let selectQuery = ``;
        let groupByQuery = '';

        if (params.paymentStatus && params.paymentStatus == 'applied') {
            joinQuery = ` LEFT JOIN billing.payment_applications ppa ON ppa.charge_id = ${params.charge_id} AND payment_id =  ${params.paymentId} `; //-- bch.id AND payment_id =  ${params.paymentId} `;
            selectQuery = ` , ppa.id AS payment_application_id, adjustment_code_id, amount AS payment_application_amount, amount_type AS payment_application_amount_type `;
            groupByQuery = ` , ppa.id, adjustment_code_id, amount , amount_type `;
        }

        return await query(`  
        WITH payer_types AS
        (
            SELECT Json_agg(Row_to_json(payer_types)) payer_types
                FROM   (
                    SELECT bc.patient_id, 
                            bc.facility_id, 

                            bc.primary_patient_insurance_id AS primary, 
                            bc.secondary_patient_insurance_id AS secondary, 
                            bc.tertiary_patient_insurance_id AS tertiary, 

                            bc.ordering_facility_id AS order_facility_id, 
                            bc.referring_provider_contact_id, 
                            payer_type ,
                            patients.full_name AS patient_name,
                            facilities.facility_name AS facility_name,

                            pips.insurance_name AS primary_ins_provider_name,
                            pips.insurance_code AS primary_ins_provider_code,

                            sips.insurance_name AS secondary_ins_provider_name,
                            sips.insurance_code AS secondary_ins_provider_code,

                            tips.insurance_name AS tertiary_ins_provider_name,
                            tips.insurance_code AS tertiary_ins_provider_code,

                            provider_groups.group_name AS ordering_facility_name,
                            providers.full_name AS provider_name
                    FROM billing.claims bc
                        LEFT JOIN public.patients ON patients.id = bc.patient_id
                        LEFT JOIN public.facilities ON facilities.id = bc.facility_id

                        LEFT  JOIN patient_insuarances AS pip ON pip.id = bc.primary_patient_insurance_id
                        LEFT  JOIN patient_insuarances AS sip ON pip.id = bc.secondary_patient_insurance_id
                        LEFT  JOIN patient_insuarances AS tip ON pip.id = bc.tertiary_patient_insurance_id
                  
                        LEFT JOIN public.insurance_providers pips ON pips.id = pip.insurance_provider_id
                        LEFT JOIN public.insurance_providers sips ON sips.id = sip.insurance_provider_id
                        LEFT JOIN public.insurance_providers tips ON tips.id = tip.insurance_provider_id

                        LEFT JOIN provider_groups ON provider_groups.id = bc.ordering_facility_id
                        LEFT JOIN public.providers ON providers.id = bc.referring_provider_contact_id 
                    WHERE bc.id =  ${params.claimId}
                        )
                AS payer_types ),
                    adjustment_codes AS(
                        SELECT Json_agg(Row_to_json(adjustment_codes)) adjustment_codes
                            FROM  (
                                SELECT 
                                    id,
                                    code,
                                    description,
                                    accounting_entry_type 
                            FROM billing.adjustment_codes 
                            WHERE company_id = ${params.companyID}
                            ) 
                    AS adjustment_codes),
                charges AS(
                SELECT Json_agg(Row_to_json(charges)) charges
                    FROM  ( 
                        SELECT
                            bch.id, 
                            bch.modifier1_id,
                            bch.modifier2_id,
                            bch.modifier3_id,
                            bch.modifier4_id,
                            bch.bill_fee::NUMERIC,
                            bch.allowed_amount::NUMERIC,
                            bch.units,
                            bch.charge_dt,
                            array_agg(pcc.short_description) as cpt_description, 
                            array_agg(pcc.display_code) as cpt_code
                            ${selectQuery}
                        FROM billing.charges bch
                        INNER JOIN billing.claims bc on bc.id = bch.claim_id
                        INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id
                        ${joinQuery}
                        WHERE bch.claim_id = ${params.claimId}
                            GROUP BY bch.id ${groupByQuery}
                ) 
                AS charges)
                    SELECT *
                        FROM   
                        payer_types,                      
                        adjustment_codes,
                        charges
                 `
        );
    },

    getGroupCodesAndReasonCodes: async function (params) {
        return await query(`   
        WITH cte_cas_group_codes AS
        (
            SELECT Json_agg(Row_to_json(cas_group_codes)) cas_group_codes
                FROM   (
                    SELECT 
                    id,
                    code,
                    name,
                    description
                    FROM billing.cas_group_codes 
                    WHERE company_id =  ${params.companyID}
                    )
            AS cas_group_codes ),
                 cte_cas_reason_codes AS(
            SELECT Json_agg(Row_to_json(cas_reason_codes)) cas_reason_codes
                FROM  (
                    SELECT 
                        id,
                        code,
                        description
                        FROM billing.cas_reason_codes 
                        WHERE company_id = ${params.companyID}
                        ) 
                    AS cas_reason_codes)
            SELECT *
                FROM   
                cte_cas_group_codes,                      
                cte_cas_reason_codes   
                 `
        );
    },

    getPayemntApplications: async function (params) {
        return await query(
            `
                SELECT 
                    cas_group_code_id,
                    cas_reason_code_id,
                    amount
                FROM  
                    billing.cas_payment_application_details
                WHERE 
                payment_application_id = ${params.paymentApplicationId}
            `
        );
    }
};
