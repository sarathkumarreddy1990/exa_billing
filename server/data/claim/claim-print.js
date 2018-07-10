const { SQL, query } = require('../index');

module.exports = {

    getInvoiceData: async function (params) {
        params.claimIds = params.claimIds.split(',');
        let sql = SQL`
			WITH claim_details AS(
                SELECT 
                    bc.id as claim_no,
                    get_full_name(pp.last_name,pp.last_name) as patient_name,
                    pp.birth_date,
                    CASE WHEN payer_type = 'primary_insurance' THEN json_build_object('name',pip.insurance_name,'address',pip.insurance_info->'Address1','city',pip.insurance_info->'City','state',pip.insurance_info->'State','zip_code',pip.insurance_info->'ZipCode','phone_no',pip.insurance_info->'PhoneNo')
                    WHEN payer_type = 'secondary_insurance' THEN json_build_object('name',pip.insurance_name,'address',pip.insurance_info->'Address1','city',pip.insurance_info->'City','state',pip.insurance_info->'State','zip_code',pip.insurance_info->'ZipCode','phone_no',pip.insurance_info->'PhoneNo')
                    WHEN payer_type = 'tertiary_insurance' THEN json_build_object('name',pip.insurance_name,'address',pip.insurance_info->'Address1','city',pip.insurance_info->'City','state',pip.insurance_info->'State','zip_code',pip.insurance_info->'ZipCode','phone_no',pip.insurance_info->'PhoneNo')
                    WHEN payer_type = 'referring_provider' THEN json_build_object('name',ppr.full_name,'address',ppc.contact_info->'ADDR1','city',ppc.contact_info->'CITY','state',ppc.contact_info->'c1State','zip_code',ppc.contact_info->'c1Zip','phone_no',ppc.contact_info->'PHNO')
                    WHEN payer_type = 'patient' THEN json_build_object('name',get_full_name(pp.last_name,pp.first_name),'address',pp.patient_info->'c1AddressLine1','city',pp.patient_info->'c1City','state',pp.patient_info->'STATE','zip_code',pp.patient_info->'ZIP','phone_no',pp.patient_info->'c1HomePhone')
                    WHEN payer_type = 'ordering_facility' THEN json_build_object('name',ppg.group_name,'address',ppg.group_info->'AddressLine1','city',ppg.group_info->'City','state',ppg.group_info->'State','zip_code',ppg.group_info->'Zip','phone_no',ppg.group_info->'Phone')
                    END AS responsinble_party_address,
                    json_build_object('name',bp.name,'address',bp.address_line1,'city',bp.city,'state',bp.state,'zip_code',bp.zip_code,'phone_no',bp.phone_number) AS billing_provider_details
                FROM billing.claims bc
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
                WHERE bc.id = ANY(${params.claimIds})),
			charge_details as(
                SELECT
                    bch.claim_id as claim_no,
                    pcc.display_code,
                    pcc.display_description,
                    billing.get_charge_icds(bch.id),
                    bch.units,
                    (bch.units * bch.bill_fee) As bill_fee
                FROM  billing.charges bch
                INNER JOIN  public.cpt_codes pcc ON pcc.id = bch.cpt_id
                WHERE bch.claim_id = ANY(${params.claimIds})
			)
			SELECT (SELECT json_agg(row_to_json(claim_details)) AS claim_details FROM (SELECT * FROM claim_details) AS claim_details),
					(SELECT json_agg(row_to_json(charge_details)) AS charge_details FROM (SELECT * FROM charge_details) AS charge_details)
        `;

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
                        AND id IN (
                `;

        sql.append(`SELECT	COALESCE(${colName[templateType]},`);

        sql.append(SQL`
                            (SELECT	id
                                FROM	billing.printer_templates
                                WHERE	template_type = ${templateType}
                                ORDER BY id DESC
                                LIMIT  1 )
                            ) AS id
                        FROM	billing.user_settings
                        WHERE	user_id = ${userId} AND grid_name = 'claims'
                    )
                `);

        return await query(sql);
    },

};
