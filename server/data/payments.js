const { query } = require('./index');

module.exports = {

    getPayments: async function () {
        return await query(`                                            
        SELECT 
        payments.id ,
        payments.facility_id ,
        patient_id ,
        insurance_provider_id ,
        provider_group_id ,
        provider_contact_id ,
        payment_reason_id ,
        amount MONEY  ,
        accounting_dt AS accounting_date,
        payment_dt AS payment_date,
        alternate_payment_id AS display_id,
        created_by AS payer_name,
        payment_dt     ,
        invoice_no ,
        alternate_payment_id ,
        payer_type ,
        payments.notes  ,
        mode AS payment_mode,
        card_name ,
        card_number ,
        patients.full_name as patient_name,
        get_full_name(users.last_name, users.first_name) as user_full_name,
        facilities.facility_name,
        amount, 
        (select payment_balance_total from billing.get_payment_totals(payments.id)) AS available_balance  ,
        (select payments_applied_total from billing.get_payment_totals(payments.id)) AS applied   ,        
        (select adjustments_applied_total from billing.get_payment_totals(payments.id)) AS adjustment_amount            
        
     FROM billing.payments
        LEFT JOIN patients ON patients.id = payments.patient_id
        LEFT JOIN users ON users.id = payments.created_by
        INNER JOIN facilities ON facilities.id = payments.facility_id
        ORDER BY id ASC LIMIT 100`);
    },

    getPayment: async function (params) {
        return await query(`
        SELECT 
        payments.id,
        payments.facility_id,
        patient_id,
        insurance_provider_id,
        provider_group_id,
        provider_contact_id,
        payment_reason_id,
        amount MONEY,
        accounting_dt AS accounting_date,
        payment_dt AS payment_date,
        alternate_payment_id AS display_id,
        created_by AS payer_name,
        payment_dt,
        invoice_no,
        alternate_payment_id,
        payer_type,
        payments.notes,
        mode AS payment_mode,
        card_name,
        card_number,
        patients.full_name as patient_name,
        get_full_name(users.last_name, users.first_name) as user_full_name,
        facilities.facility_name,
        amount, 
        (select payment_balance_total from billing.get_payment_totals(payments.id)) AS available_balance  ,
        (select payments_applied_total from billing.get_payment_totals(payments.id)) AS applied   ,        
        (select adjustments_applied_total from billing.get_payment_totals(payments.id)) AS adjustment_amount            
        
     FROM billing.payments
        LEFT JOIN patients ON patients.id = payments.patient_id
        LEFT JOIN users ON users.id = payments.created_by
        INNER JOIN facilities ON facilities.id = payments.facility_id
        WHERE billing.payments.id = ${params.id}`);
    },

    updatePayment: async function (params) {
        // let { paid_facility_id, payer_type, amount, 
        //     accounting_date, patient_id, payer_id, provider_id, provider_group_id,
        //     credit_card_number, credit_card_name,
        //     payment_mode, notes, id, display_id } = params;
        return await query(`
            UPDATE billing.payments SET 
                facility_id = ${params.paid_facility_id},
                patient_id = ${params.patient_id},
                insurance_provider_id = ${params.insurance_provider_id},
                provider_group_id = ${params.provider_group_id},
                provider_contact_id = ${params.provider_id},
                amount = ${params.amount}::money,
                accounting_dt = now(),
                payment_dt = now(),
                invoice_no = 0,
                alternate_payment_id = ${params.display_id},
                payer_type = '${ params.payer_type }',
                notes = '${params.notes}',
                mode = '${params.payment_mode}',
                card_name = '${params.credit_card_name}',
                card_number = '${params.credit_card_number}'
            WHERE id = ${params.id}
            `);
    }
};
