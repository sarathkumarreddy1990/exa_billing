const { query } = require('./index');

module.exports = {

    getPendingPayments: async function (params) {
        return await query(`                                            
        SELECT 
            bc.id AS claim_id,
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
            AND patient_id = ${params.customArgs.payerId}

        AND (SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) FROM billing.get_claim_totals(bc.id)) > 0::money 
        group by bc.id, bc.invoice_no, bc.claim_dt, pp.account_no, get_full_name(pp.last_name,pp.first_name)
        `);
    },

    getAppliedPayments: async function (params) {
        return await query(`                                            
        SELECT
            bc.id, 
            bc.invoice_no,
            get_full_name(pp.last_name,pp.first_name),
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
        GROUP BY bc.id ,bc.invoice_no,get_full_name(pp.last_name,pp.first_name),bc.claim_dt        
        `);
    },

    getClaimBasedCharges: async function (params) {
        return await query(`   
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
            FROM billing.charges bch
            INNER JOIN billing.claims bc on bc.id = bch.claim_id
            INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id
            WHERE bch.claim_id = ${params.claimId}
                GROUP BY bch.id 
                 `
        );
    },

    getGroupCodesAndReasonCodes: async function (params) {
        let { companyID } = params;
        return await query(`   
        WITH cte_cas_group_codes AS
        (
            SELECT Json_agg(Row_to_json(cas_group_codes)) cas_group_codes
                FROM   (
                    SELECT code,
                    name,
                    description
                    FROM billing.cas_group_codes 
                    WHERE company_id =  ${companyID}
                    )
            AS cas_group_codes ),
                 cte_cas_reason_codes AS(
            SELECT Json_agg(Row_to_json(cas_reason_codes)) cas_reason_codes
                FROM  (
                    SELECT 
                        code,
                        description
                        FROM billing.cas_reason_codes 
                        WHERE company_id = ${companyID}
                        ) 
                    AS cas_reason_codes)
            SELECT *
                FROM   
                cte_cas_group_codes,                      
                cte_cas_reason_codes   
                 `
        );
    }
};
