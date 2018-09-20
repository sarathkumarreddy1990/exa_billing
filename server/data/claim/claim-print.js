const { SQL, query } = require('../index');

module.exports = {

    getInvoiceData: async function (params) {
        params.claimIds = params.claimIds.split(',');
        params.sortBy = params.sortBy || 'bc.id';

        if (params.sortBy === 'patient_name') {
            params.sortBy = 'pp.last_name';
        } else if (params.sortBy === 'service_date') {
            params.sortBy = 'bc.claim_dt';
        }

        let sql = SQL`
			WITH claim_details AS(
                SELECT
                    bc.invoice_no,
                    submitted_dt AS invoice_date,
                    ppr.full_name as referring_physician_name,
                    '' AS reason_for_exam,
                    json_build_object('patient_name',get_full_name(pp.last_name, pp.first_name)
                    ,'patient_address1',pp.patient_info->'c1AddressLine1',
                    'patient_address2', pp.patient_info->'c1AddressLine2',
                    'patient_city',  pp.patient_info->'c1City',
                    'patient_state' ,pp.patient_info->'c1State',
                    'patient_zip',pp.patient_info->'c1Zip'
                    ) as patient_adrress_details,
                    (SELECT claim_balance_total FROM billing.get_claim_totals(bc.id)) as claim_balance,
                    bc.claim_dt,
                    pp.account_no,
                    '' AS payment_details,
                    f.facility_name,
                    json_build_object('facility_address1' ,facility_info->'facility_address1',
                    'facility_address2', facility_info->'facility_address2',
                    'facility_city',  facility_info->'facility_city',
                    'facility_state' ,facility_info->'facility_state',
                    'facility_zip',facility_info->'facility_zip'
                    ) as facility_adrress_details,
                    bc.id as claim_no,
                    get_full_name(pp.last_name, pp.first_name) as patient_name,
                    bc.facility_id as facility_id,
                    pp.birth_date,
                    CASE WHEN payer_type = 'primary_insurance' THEN json_build_object('name',pip.insurance_name,'address',pip.insurance_info->'Address1','address2',pip.insurance_info->'Address2','city',pip.insurance_info->'City','state',pip.insurance_info->'State','zip_code',pip.insurance_info->'ZipCode','phone_no',pip.insurance_info->'PhoneNo')
                    WHEN payer_type = 'secondary_insurance' THEN json_build_object('name',pip.insurance_name,'address',pip.insurance_info->'Address1', 'address2',pip.insurance_info->'Address2','city',pip.insurance_info->'City','state',pip.insurance_info->'State','zip_code',pip.insurance_info->'ZipCode','phone_no',pip.insurance_info->'PhoneNo')
                    WHEN payer_type = 'tertiary_insurance' THEN json_build_object('name',pip.insurance_name,'address',pip.insurance_info->'Address1','address2',pip.insurance_info->'Address2','city',pip.insurance_info->'City','state',pip.insurance_info->'State','zip_code',pip.insurance_info->'ZipCode','phone_no',pip.insurance_info->'PhoneNo')
                    WHEN payer_type = 'referring_provider' THEN json_build_object('name',ppr.full_name,'address',ppc.contact_info->'ADDR1','address2',ppc.contact_info->'ADDR2', 'city',ppc.contact_info->'CITY','state',ppc.contact_info->'c1State','zip_code',ppc.contact_info->'c1Zip','phone_no',ppc.contact_info->'PHNO')
                    WHEN payer_type = 'patient' THEN json_build_object('name',get_full_name(pp.last_name,pp.first_name),'address',pp.patient_info->'c1AddressLine1','address2',pp.patient_info->'c1AddressLine2','city',pp.patient_info->'c1City','state',pp.patient_info->'STATE','zip_code',pp.patient_info->'ZIP','phone_no',pp.patient_info->'c1HomePhone')
                    WHEN payer_type = 'ordering_facility' THEN json_build_object('name',ppg.group_name,'address',ppg.group_info->'AddressLine1','address2',ppg.group_info->'AddressLine2','city',ppg.group_info->'City','state',ppg.group_info->'State','zip_code',ppg.group_info->'Zip','phone_no',ppg.group_info->'Phone')
                    END AS responsinble_party_address,
                    json_build_object('name',bp.name,'address',bp.address_line1,'address2',bp.address_line2,'city',bp.city,'state',bp.state,'zip_code',bp.zip_code,'phone_no',bp.phone_number) AS billing_provider_details
                FROM billing.claims bc
                INNER JOIN public.facilities f ON f.id = bc.facility_id
                INNER JOIN public.patients pp ON pp.id = bc.patient_id
                INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
                LEFT JOIN public.patient_insurances ppi ON ppi.id = CASE WHEN payer_type = 'primary_insurance' THEN primary_patient_insurance_id
                                                                WHEN payer_type = 'secondary_insurance' THEN secondary_patient_insurance_id
                                                                WHEN payer_type = 'tertiary_insurance' THEN tertiary_patient_insurance_id
                                                            END
                LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
                LEFT JOIN public.provider_groups ppg ON ppg.id = bc.ordering_facility_id
                LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
                LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
                WHERE  CASE WHEN ${params.flag}='new' THEN  bc.id = ANY(${params.claimIds})
                            WHEN ${params.flag}='invoice'  THEN  bc.id in(SELECT claims.id FROM billing.claims WHERE invoice_no=${params.invoiceNo})  END

            `
            .append(` ORDER BY ${params.sortBy}) ,`)
            .append( SQL`
			charge_details as(
                SELECT
                    bch.claim_id as claim_no,
                    pcc.display_code,
                    pcc.display_description,
                    charge_dt as "service_date",
                    billing.get_charge_icds(bch.id),
                    modifier1.code as "modifier1",
					modifier2.code as "modifier2",
					modifier3.code as "modifier3",
					modifier4.code as "modifier4",
                    bch.units,
                    (bch.units * bch.bill_fee) As bill_fee
                FROM  billing.charges bch
                INNER JOIN  public.cpt_codes pcc ON pcc.id = bch.cpt_id
                LEFT join modifiers as modifier1 on modifier1.id=modifier1_id
                LEFT join modifiers as modifier2 on modifier2.id=modifier2_id
                LEFT join modifiers as modifier3 on modifier3.id=modifier3_id
                LEFT join modifiers as modifier4 on modifier4.id=modifier4_id
                WHERE  CASE WHEN ${params.flag}='new' THEN  bch.claim_id = ANY(${params.claimIds})
                            WHEN ${params.flag}='invoice'  THEN  bch.claim_id in(SELECT claims.id FROM billing.claims WHERE invoice_no=${params.invoiceNo}) END

            ),
            payment_details as(
                SELECT
                    bp.payer_type
                    , (  CASE bp.payer_type
                            WHEN 'insurance' THEN pip.insurance_name
                            WHEN 'ordering_facility' THEN ppg.group_name
                            WHEN 'ordering_provider' THEN ppr.full_name
                            WHEN 'patient' THEN patients.full_name 
                        END ) AS payer_name
                    , bpa.amount_type 
                    ,ch.claim_id
                    ,bp.id payment_id
                    ,bp.accounting_dt as payment_dt
                    ,SUM(CASE WHEN bpa.amount_type = 'payment' THEN bpa.amount ELSE 0.00::money END)    AS payments_applied_total
                    ,SUM(CASE WHEN bpa.amount_type = 'adjustment'  THEN bpa.amount  ELSE 0.00::money END)    AS ajdustments_applied_total
                FROM billing.payments bp 
                INNER JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
                INNER JOIN billing.charges ch ON ch.id = bpa.charge_id
                LEFT JOIN public.patients ON patients.id = bp.patient_id
                LEFT JOIN public.insurance_providers pip ON pip.id = bp.insurance_provider_id
                LEFT JOIN public.provider_groups ppg ON ppg.id = bp.provider_group_id
                LEFT JOIN public.provider_contacts ppc ON ppc.id = bp.provider_contact_id
                LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
                LEFT JOIN billing.adjustment_codes adj ON adj.id = bpa.adjustment_code_id
                WHERE 
                    CASE WHEN ${params.flag}='new' THEN  
                            ch.claim_id = ANY(${params.claimIds}) 
                            AND (adj.accounting_entry_type != 'refund_debit' OR bpa.adjustment_code_id IS NULL) 
                            AND (CASE WHEN bpa.amount_type = 'adjustment' THEN 
                                        bpa.amount != 0.00::money 
                                      ELSE 
                                        TRUE  
                                END)
                         WHEN ${params.flag}='invoice' THEN  
                            ch.claim_id in(SELECT claims.id FROM billing.claims WHERE invoice_no=${params.invoiceNo}) 
                    END
                GROUP BY 
                    bpa.applied_dt
                    ,payer_name,bp.id
                    ,bpa.amount_type
                    ,ch.claim_id
            )
			SELECT (SELECT json_agg(row_to_json(claim_details)) AS claim_details FROM (SELECT * FROM claim_details) AS claim_details),
                    (SELECT json_agg(row_to_json(charge_details)) AS charge_details FROM (SELECT * FROM charge_details) AS charge_details),
                    (SELECT json_agg(row_to_json(payment_details)) AS payment_details FROM (SELECT * FROM payment_details) AS payment_details)
        `);

        return await query(sql);
    },

    getPrinterTemplate: async function (params) {
        let {
            userId,
            templateType
        } = params;

        let colName = {
            'paper_claim_original': 'paper_claim_original_template_id',
            'paper_claim_full': 'paper_claim_full_template_id',
            'direct_invoice': 'direct_invoice_template_id',
            'patient_invoice': 'patient_invoice_template_id',
        };

        if (!colName[templateType]) {
            return new Error('Invalid template type..');
        }

        let sql = SQL`
                SELECT *
                FROM   billing.printer_templates
                WHERE  template_type = ${templateType}
                        AND (id IN (
                `;

        sql.append(`SELECT	COALESCE(
                        (SELECT ${colName[templateType]} FROM	billing.user_settings
                        WHERE	user_id = ${userId} AND grid_name = 'claims'),`);

        sql.append(SQL` (SELECT	id
                                FROM	billing.printer_templates
                                WHERE	template_type = ${templateType} AND is_default
                                ORDER BY id DESC
                                LIMIT  1 )
                            ) AS id
                    ))
                `);

        return await query(sql);
    },

};
