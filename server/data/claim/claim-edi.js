const { SQL, query } = require('../index');

module.exports = {

    validateClaim: async (params) => {

        let sql = SQL`SELECT
							bc.id
						, bc.billing_method
						, claim_notes
						, (SELECT array_agg(field) FROM jsonb_to_recordset((
							SELECT
								CASE WHEN (bc.billing_method = 'electronic_billing' OR bc.billing_method = 'paper_claim') THEN edi_validation
								WHEN bc.billing_method = 'direct_billing' THEN invoice_validation
								WHEN bc.billing_method = 'patient_payment' THEN patient_validation
								ELSE invoice_validation
								END
							FROM
								billing.validations )) AS x(field text, enabled boolean) WHERE enabled) AS validation_fields
						, bp.address_line1 AS "billing_pro_addressLine1"
						, bp.city AS billing_pro_city
						, bp.name AS "billing_pro_firstName"
						, bp.npi_no AS "billing_pro_npiNo"
						, bp.state AS "billing_pro_state"
						, bp.zip_code AS "billing_pro_zip"
						, p.patient_info->'c1AddressLine1' AS "patient_address1"
						, p.patient_info->'c1City' AS "patient_city"
						, p.birth_date AS "patient_dob"
						, COALESCE (NULLIF(p.first_name, ''), '') AS "patient_firstName"
						, COALESCE (NULLIF(p.last_name, ''), '') AS "patient_lastName"
						, COALESCE (NULLIF(p.middle_name, ''), '') AS "patient_middleName"
						, COALESCE (NULLIF(p.suffix_name, ''), '') AS "patient_suffixName"
						, COALESCE (NULLIF(p.gender, ''), '') AS "patient_gender"
						, p.full_name AS patient_name
						, p.patient_info->'c1State' AS "patient_state"
						, p.patient_info->'c1Zip' AS "patient_zipCode"
						, ref_pr.first_name AS "ref_full_name"
						, ref_pr.provider_info->'NPI' AS "referring_pro_npiNo"
						, rend_pr.first_name AS "reading_physician_full_name"
						, rend_pr.provider_info->'NPI' AS "reading_pro_npiNo"
						, CASE WHEN (SELECT charges_bill_fee_total FROM billing.get_claim_totals(bc.id)) > 0::money
							THEN (SELECT charges_bill_fee_total FROM billing.get_claim_totals(bc.id)) ELSE null END AS "claim_totalCharge"
						, pg.group_info->'AddressLine1' AS "service_facility_addressLine1"
						, pg.group_info->'City' AS "service_facility_city"
						, pg.group_name AS "service_facility_firstName"
						, pg.group_info->'npi_no' AS "service_facility_npiNo"
						, pg.group_info->'State' AS "service_facility_state"
						, pg.group_info->'Zip' AS "service_facility_zip"
						, pos.id AS "claim_place_of_service_code"
						, claim_icd.icd_id AS "claim_icd_code1"
						, CASE  WHEN bc.payer_type = 'primary_insurance' THEN
									json_build_object('payer_name', p_ip.insurance_name
									, 'payer_address1', p_ip.insurance_info->'Address1'
									, 'payer_city', p_ip.insurance_info->'City'
									, 'payer_state', p_ip.insurance_info->'State'
									, 'payer_zip_code', p_ip.insurance_info->'ZipCode'
									, 'claimClearingHouse', p_edi_clearinghouse.receiver_name
									, 'edi_request_templates_id', p_edi_clearinghouse.edi_template_id
									)
								WHEN bc.payer_type = 'secondary_insurance' THEN
									json_build_object('payer_name',  s_ip.insurance_name
									, 'payer_address1', s_ip.insurance_info->'Address1'
									, 'payer_city', s_ip.insurance_info->'City'
									, 'payer_state', s_ip.insurance_info->'State'
									, 'payer_zip_code', s_ip.insurance_info->'ZipCode'
									, 'claimClearingHouse',  s_edi_clearinghouse.receiver_name
									, 'edi_request_templates_id',  s_edi_clearinghouse.edi_template_id
									)
								WHEN bc.payer_type = 'tertiary_insurance' THEN
									json_build_object( 'payer_name', t_ip.insurance_name
									, 'payer_address1', t_ip.insurance_info->'Address1'
									, 'payer_city', t_ip.insurance_info->'City'
									, 'payer_state', t_ip.insurance_info->'State'
									, 'payer_zip_code', t_ip.insurance_info->'ZipCode'
									, 'claimClearingHouse', t_edi_clearinghouse.receiver_name
                                    , 'edi_request_templates_id', t_edi_clearinghouse.edi_template_id
                                    )
								WHEN bc.payer_type = 'ordering_facility' THEN
								json_build_object(
									'payer_name',  pg.group_name
									, 'payer_address1', pg.group_info->'AddressLine1'
									, 'payer_city', pg.group_info->'City'
									, 'payer_state', pg.group_info->'State'
									, 'payer_zip_code', pg.group_info->'Zip' )
								WHEN bc.payer_type = 'referring_provider' THEN
									json_build_object( 'payer_name',  ref_pr.last_name
									, 'payer_address1', ref_pc.contact_info->'ADDR1'
									, 'payer_city', ref_pc.contact_info->'CITY'
									, 'payer_state', ref_pc.contact_info->'STATE'
									, 'payer_zip_code', ref_pc.contact_info->'ZIP' )
								WHEN bc.payer_type = 'patient' THEN
                                	json_build_object( 'payer_name',  p.full_name
									, 'payer_address1', p.patient_info->'c1AddressLine1'
									, 'payer_city', p.patient_info->'c1City'
									, 'payer_state', p.patient_info->'c1State'
									, 'payer_zip_code', p.patient_info->'c1Zip' ) END AS payer_info
									, bc.primary_patient_insurance_id
									, p_ip.insurance_info->'Address1' AS "p_insurance_pro_address1"
									, p_ip.insurance_info->'City' AS "p_insurance_pro_city"
									, p_ip.insurance_info->'PayerID' AS "p_insurance_pro_payerID"
									, p_ip.insurance_info->'State' AS "p_insurance_pro_state"
									, p_ip.insurance_info->'ZipCode' AS "p_insurance_pro_zipCode"
									, p_ip.insurance_name AS "p_insurance_pro_companyName"
									, bc.secondary_patient_insurance_id
									, s_ip.insurance_info->'Address1' AS "s_insurance_pro_address1"
									, s_ip.insurance_info->'City' AS "s_insurance_pro_city"
									, s_ip.insurance_info->'PayerID' AS "s_insurance_pro_payerID"
									, s_ip.insurance_info->'State' AS "s_insurance_pro_state"
									, s_ip.insurance_info->'ZipCode' AS "s_insurance_pro_zipCode"
									, s_ip.insurance_name AS "s_insurance_pro_companyName"
									, bc.tertiary_patient_insurance_id
									, t_ip.insurance_info->'Address1' AS "t_insurance_pro_address1"
									, t_ip.insurance_info->'City' AS "t_insurance_pro_city"
									, t_ip.insurance_info->'PayerID' AS "t_insurance_pro_payerID"
									, t_ip.insurance_info->'State' AS "t_insurance_pro_state"
									, t_ip.insurance_info->'ZipCode' AS "t_insurance_pro_zipCode"
									, t_ip.insurance_name AS "t_insurance_pro_companyName"

									, COALESCE (NULLIF(p_pi.subscriber_address_line1,'Migration Address'),'') AS "p_subscriber_addressLine1"
									, COALESCE (NULLIF(p_pi.subscriber_city,'Migration City'),'') AS "p_subscriber_city"
									, p_pi.subscriber_dob AS "p_subscriber_dob"
									, COALESCE (NULLIF(p_pi.subscriber_firstname, ''), '')  AS "p_subscriber_firstName"
									, COALESCE (NULLIF(p_pi.subscriber_middlename, ''), '')  AS "p_subscriber_middleName"
									, COALESCE (NULLIF(p_pi.subscriber_name_suffix, ''), '')  AS "p_subscriber_suffixName"
									, COALESCE (NULLIF(p_pi.subscriber_lastname, ''), '') AS "p_subscriber_lastName"
									, COALESCE (NULLIF(p_pi.subscriber_gender, 'Migration Gender'), '') AS "p_subscriber_gender"
									, COALESCE (NULLIF(p_pi.subscriber_state,'Migration State'), '') AS "p_subscriber_state"
									, COALESCE (NULLIF(p_pi.subscriber_zipcode, 'Migration ZipCode'), '') AS "p_subscriber_zipCode"

									, COALESCE (NULLIF(s_pi.subscriber_address_line1 , 'Migration Address'), '') AS "s_subscriber_addressLine1"
									, COALESCE (NULLIF(s_pi.subscriber_city , 'Migration City'), '') AS "s_subscriber_city"
									, s_pi.subscriber_dob AS "s_subscriber_dob"
									, COALESCE (NULLIF(s_pi.subscriber_firstname, ''), '')  AS "s_subscriber_firstName"
									, COALESCE (NULLIF(s_pi.subscriber_middlename, ''), '')  AS "s_subscriber_middleName"
									, COALESCE (NULLIF(s_pi.subscriber_name_suffix, ''), '')  AS "s_subscriber_suffixName"
									, COALESCE (NULLIF(s_pi.subscriber_lastname, ''), '') AS "s_subscriber_lastName"
									, COALESCE (NULLIF(s_pi.subscriber_gender, 'Migration Gender'), '') AS "s_subscriber_gender"
									, COALESCE (NULLIF(s_pi.subscriber_state,'Migration State') , '') AS "s_subscriber_state"
									, COALESCE (NULLIF(s_pi.subscriber_zipcode , 'Migration ZipCode'),'') AS "s_subscriber_zipCode"

									, COALESCE (NULLIF(t_pi.subscriber_address_line1, 'Migration Address'),'') AS "t_subscriber_addressLine1"
									, COALESCE (NULLIF(t_pi.subscriber_city, 'Migration City'),'') AS "t_subscriber_city"
									, t_pi.subscriber_dob AS "t_subscriber_dob"
									, COALESCE (NULLIF(t_pi.subscriber_firstname, ''), '')  AS "t_subscriber_firstName"
									, COALESCE (NULLIF(t_pi.subscriber_middlename, ''), '')  AS "t_subscriber_middleName"
									, COALESCE (NULLIF(t_pi.subscriber_name_suffix, ''), '')  AS "t_subscriber_suffixName"
									, COALESCE (NULLIF(t_pi.subscriber_lastname, ''), '') AS "t_subscriber_lastName"
									, COALESCE (NULLIF(t_pi.subscriber_gender, 'Migration Gender'), '') AS "t_subscriber_gender"
									, COALESCE (NULLIF(t_pi.subscriber_state , 'Migration State'), '') AS "t_subscriber_state"
									, COALESCE (NULLIF(t_pi.subscriber_zipcode , 'Migration ZipCode'), '') AS "t_subscriber_zipCode"
									, (SELECT array_agg(row_to_json(pointer)) AS charge_pointer FROM (
										SELECT ch.id, pointer1, claim_id, cpt.ref_code, cpt.display_description FROM billing.charges ch INNER JOIN public.cpt_codes cpt ON ch.cpt_id = cpt.id WHERE ch.claim_id = bc.id
														 ) pointer) AS charge_pointer
									, lower(prs.description) = ('self') AS is_pri_relationship_self
									, lower(srs.description) = ('self') AS is_sec_relationship_self
									, lower(trs.description) = ('self') AS is_ter_relationship_self
					FROM
						billing.claims bc
					INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
					INNER JOIN public.patients p ON p.id = bc.patient_id
					LEFT JOIN public.provider_contacts ref_pc ON ref_pc.id = bc.referring_provider_contact_id
					LEFT JOIN public.provider_contacts rend_pc ON rend_pc.id = bc.rendering_provider_contact_id
					LEFT JOIN public.providers ref_pr ON ref_pr.id = ref_pc.provider_id
					LEFT JOIN public.providers rend_pr ON rend_pr.id = rend_pc.provider_id
					LEFT JOIN public.places_of_service pos ON pos.id = bc.place_of_service_id
					LEFT JOIN public.provider_groups pg ON pg.id = bc.ordering_facility_id
					LEFT JOIN public.patient_insurances p_pi on p_pi.id = bc.primary_patient_insurance_id
					LEFT JOIN public.patient_insurances s_pi on s_pi.id = bc.secondary_patient_insurance_id
					LEFT JOIN public.patient_insurances t_pi on t_pi.id = bc.tertiary_patient_insurance_id
					LEFT JOIN public.insurance_providers p_ip on p_ip.id = p_pi.insurance_provider_id
					LEFT JOIN public.insurance_providers s_ip on s_ip.id = s_pi.insurance_provider_id
					LEFT JOIN public.insurance_providers t_ip on t_ip.id = t_pi.insurance_provider_id
					LEFT JOIN billing.insurance_provider_details p_ins_det ON p_ins_det.insurance_provider_id = p_ip.id
					LEFT JOIN billing.insurance_provider_details s_ins_det ON s_ins_det.insurance_provider_id = s_ip.id
					LEFT JOIN billing.insurance_provider_details t_ins_det ON t_ins_det.insurance_provider_id = t_ip.id
					LEFT JOIN billing.edi_clearinghouses p_edi_clearinghouse ON p_edi_clearinghouse.id=p_ins_det.clearing_house_id
					LEFT JOIN billing.edi_clearinghouses s_edi_clearinghouse ON s_edi_clearinghouse.id=s_ins_det.clearing_house_id
                    LEFT JOIN billing.edi_clearinghouses t_edi_clearinghouse ON t_edi_clearinghouse.id=t_ins_det.clearing_house_id
					LEFT JOIN public.relationship_status prs ON prs.id = p_pi.subscriber_relationship_id
					LEFT JOIN public.relationship_status srs ON srs.id = s_pi.subscriber_relationship_id
					LEFT JOIN public.relationship_status trs ON trs.id = t_pi.subscriber_relationship_id
					LEFT JOIN
						LATERAL (SELECT icd_id FROM billing.claim_icds ci WHERE ci.claim_id = bc.id LIMIT 1) claim_icd ON true
					WHERE bc.id = ANY(${params.claim_ids})`;

        return await query(sql);
    },

    getClaimData: async (params) => {

        let claimIds = params.claimIds.split(',');
        params.payerId = params.payerId || null;
        params.payerType = params.payerType || null;

        let sql = SQL`
            SELECT
			relationship_status.description as subscriber_relationship,
			claims.id as claim_id,
			insurance_name,
			coverage_level,
            (SELECT (Row_to_json(header)) "header"

				FROM (
                        SELECT billing.edi_clearinghouses.id,
                        et.name AS edi_template_name,
						communication_info->'securityInformationQualifier' as "authInfoQualifier",
						communication_info->'authorizationInformation' as "authInfo",
						communication_info->'securityInformationQualifier' as "securityInfoQualifier",
 						communication_info->'securityInformation' as "securityInfo",
 						communication_info->'interchangeSenderIdQualifier' as "interchangeSenderIDQualifier",
						communication_info->'interchangeSenderId' as "interchangeSenderID",
						communication_info->'interchangeReceiverIdQualifier' as "interchangeReceiverIDQualifier",
						communication_info->'interchangeReceiverId' as "interchangeReceiverID",
						communication_info->'interchangeControlStandardsIdentifier' as "interchangeCtrlStdIdentifier",
                        communication_info->'implementationConventionRef' as "implementationConventionRef",
                        nextval('billing.interchange_control_no_seq') as "interchangeCtrlNo",
						communication_info->'interchangeControlVersionNumber' as "interchangeCtrlVersionNo",
						(CASE communication_info->'acknowledgementRequested'
											WHEN 'true' THEN '0'
											WHEN 'false' THEN '1' END ) as "acqRequested",
						communication_info->'usageIndicator' as "usageIndicator",
						'HC' as "functionalIDCode",
						communication_info->'applicationSenderCode' as "applicationSenderCode",
						communication_info->'applicationReceiverCode' as "applicationReceiverCode",
						communication_info->'repetitionSeparator' as "repetitionSeparator",
						communication_info->'securityInformation' as "securityInformation",
						communication_info->'segmentTerminator' as "SEGMENT_TERMINATOR",
						communication_info->'elementDelimiter' as "ELEMENT_DELIMITER",
						communication_info->'segmentDelimiter' as "SUB_ELEMENT_DELIMITER",
						communication_info->'backupRootFolder' as "backupRootFolder",
						communication_info->'usageIndicator' as "usageIndicator",
						to_char(now(), 'YYYYMMDD')  as "fgDate",
						to_char(now(), 'HH24MI')  as "fgTime",
						claims.id as "groupControlNo",
						communication_info->'responsibleAgencyCode' as "responsibleAgencyCode",
						communication_info->'verRelIndIdCode' as "verReleaseIDCode",
						'837' as "tsIDCode",
						'0001' as "tsControlNo",
						edi_clearinghouses.name as clearinghouses_name,
						edi_clearinghouses.code as clearinghouses_code,
						edi_clearinghouses.receiver_name as clearinghouses_receiver_name,
						edi_clearinghouses.receiver_id as clearinghouses_receiver_id
                                    FROM   billing.edi_clearinghouses
                                    LEFT JOIN billing.edi_templates et ON et.id = billing.edi_clearinghouses.edi_template_id
                                    WHERE  billing.edi_clearinghouses.id=insurance_provider_details.clearing_house_id)

					as header),
					(SELECT Json_agg(Row_to_json(data1)) "data"

												FROM (

					WITH cte_billing_providers AS (
					SELECT (Row_to_json(billingProvider1)) "billingProvider"
												FROM   (
														SELECT id as "billingProviderID",
															taxonomy_code as "taxonomyCode",
															billing_providers.name as "lastName",
															npi_no as "npiNo",
															billing_providers.short_description as "description",
															address_line1 as "addressLine1",
															address_line2 as "addressLine2",
															city as "city",
															state as "state",
															zip_code as "zipCode",
															federal_tax_id as "federalTaxID",
															phone_number as "phoneNo",
															email  as "email",
															fax_number as "faxNumber",
															zip_code_plus as "zip_code_plus",
															contact_person_name as "contactName",
															(SELECT qualifier_code FROM billing.provider_id_code_qualifiers LEFT JOIN billing.provider_id_codes   ON  provider_id_code_qualifiers.id=provider_id_codes.qualifier_id
																 WHERE provider_id_codes.billing_provider_id=billing_providers.id AND provider_id_codes.insurance_provider_id = insurance_providers.id ) as "legacyID"

														FROM   billing.providers as billing_providers
														WHERE  billing_providers.id=billing_provider_id)AS billingProvider1

					)

					, cte_pay_to_providers AS (

					SELECT (Row_to_json(billingProvider)) "payToProvider"
												FROM   (
														SELECT id as "payToProviderID",
															billing_providers.name as "lastName",
															billing_providers.name as "firstName",
															npi_no as "npiNo",
															billing_providers.short_description as "description",
															pay_to_address_line1 as "addressLine1",
															pay_to_address_line2 as "addressLine2",
															pay_to_city as "city",
															pay_to_state as "state",
															pay_to_zip_code as "zipCode",
															federal_tax_id as "federalTaxID",
															phone_number as "phoneNo",
															contact_person_name as "contactName"
														FROM   billing.providers as billing_providers
														WHERE  billing_providers.id=billing_provider_id)AS billingProvider
					)
					, cte_subscriber AS(
														SELECT Json_agg(Row_to_json(subscriber)) subscriber
														FROM  (
														SELECT
														(CASE coverage_level
															WHEN 'primary' THEN 'P'
															WHEN 'secondary' THEN 'S'
															WHEN 'tertiary' THEN 'T' END) as "claimResponsibleParty",
														( SELECT

										(  CASE UPPER(description)
											WHEN 'SELF' THEN '18'
											WHEN 'FATHER' THEN '33'
											WHEN 'MOTHER' THEN '32'
											WHEN 'SIBLING' THEN '32'
											WHEN 'GRANDPARENT' THEN '04'
											WHEN 'GREAT GRANDPARENT' THEN '04'
											WHEN 'UNKNOWN' THEN '21'
											WHEN 'SPOUSE' THEN '01'
											WHEN 'CHILD' THEN '19'
											WHEN 'BROTHER' THEN '23'
                                            WHEN 'SISTER' THEN '20'
                                            WHEN 'OTHER RELATIONSHIP' THEN 'G8'
                                            WHEN 'LIFE PARTNER' THEN '53'
                                            WHEN 'EMPLOYEE' THEN '20'
                                            WHEN 'ORGAN DONOR' THEN '39'
                                            WHEN 'CADAVER DONOR' THEN '40'
											END)
										FROM  relationship_status WHERE  subscriber_relationship_id =relationship_status.id ) as  relationship,

										policy_number  as "policyNo",
										pi.group_name as "planName",
										group_number as "groupNumber",
										insurance_provider_details.claim_filing_indicator_code as "claimFilingCode",
										subscriber_firstname as "firstName",
										subscriber_lastname as "lastName",
										subscriber_middlename as "middleName",
										subscriber_name_suffix as "suffix",
										'' as "prefix",
										subscriber_address_line1 as "addressLine1",
										subscriber_address_line2 as "addressLine2",
										subscriber_city as "city",
										subscriber_state as "state",
										subscriber_zipcode as "zipCode",
										home_phone_number as "phoneNumber",
										assign_benefits_to_patient as "acceptAssignment",
										subscriber_dob as "dob",
										to_char(subscriber_dob, 'YYYYMMDD')  as "dobFormat",
										(  CASE subscriber_gender
											WHEN 'Male' THEN 'M'
											WHEN 'Female' THEN 'F'
											WHEN 'Unknown' THEN 'U'
											WHEN 'Others' THEN 'O'
											ELSE subscriber_gender
											END) as gender

							, (SELECT (Row_to_json(payer)) payer
														FROM  (
										SELECT insurance_name as "payerName",
										insurance_info->'PayerID' as "payerID"
										,insurance_info->'Address1' as "insuranceprovideraddressline1"
										,insurance_info->'Address2' as "insuranceprovideraddressline2"
										,insurance_info->'City'  "payerCity"
										,insurance_info->'State'  "payerState"
										,insurance_info->'ZipCode'  "payerZIPCode"
										,insurance_info->'PhoneNo' as "phoneNo"
										,insurance_info->'ZipPlus' as "zipPlus"
										,insurance_provider_payer_types.code	as "providerTypeCode"
										,insurance_provider_payer_types.description	as "providerTypeDescription"
										) as payer)
										,(
											SELECT Json_agg(Row_to_json(patient)) "patient"
												FROM   (
													SELECT patients.id as patient_id,
															last_name as "lastName",
															first_name as "firstName",
															middle_name as "middleName",
															suffix_name as "suffix",
															account_no as "accountNumber",
															patient_info->'c1AddressLine1' as "addressLine1",
															patient_info->'c1AddressLine2' as "addressLine2",
															patient_info->'c1City' as "city",
															patient_info->'c1State' as "state",
															patient_info->'c1Zip' as "zipCode",
															patient_info->'c1HomePhone' as "homePhone",
															patient_info->'c1WorkPhone' as "workPhone",
															patient_info->'licenseNo' as "licenseNo",
															birth_date::text as dob,
															to_char(birth_date, 'YYYYMMDD')  as "dobFormat",
											(  CASE gender
																WHEN 'Male' THEN 'M'
																WHEN 'Female' THEN 'F'
																WHEN 'Unknown' THEN 'U'
																WHEN 'Others' THEN 'O'
																ELSE gender
																END) as gender,

															( SELECT
                                                                (  CASE UPPER(description)
                                                                        WHEN 'SELF' THEN '18'
                                                                        WHEN 'FATHER' THEN '33'
                                                                        WHEN 'MOTHER' THEN '32'
                                                                        WHEN 'SIBLING' THEN '32'
                                                                        WHEN 'GRANDPARENT' THEN '04'
                                                                        WHEN 'GREAT GRANDPARENT' THEN '04'
                                                                        WHEN 'UNKNOWN' THEN '21'
                                                                        WHEN 'SPOUSE' THEN '01'
                                                                        WHEN 'CHILD' THEN '19'
                                                                        WHEN 'BROTHER' THEN '23'
                                                                        WHEN 'SISTER' THEN '20'
                                                                        WHEN 'OTHER RELATIONSHIP' THEN 'G8'
                                                                        WHEN 'LIFE PARTNER' THEN '53'
                                                                        WHEN 'EMPLOYEE' THEN '20'
                                                                        WHEN 'ORGAN DONOR' THEN '39'
                                                                        WHEN 'CADAVER DONOR' THEN '40'
                                                                END)
															FROM  relationship_status WHERE  subscriber_relationship_id =relationship_status.id ) as  relationship
										)AS patient)
							,( SELECT Json_agg(Row_to_json(claim)) "claim"
							FROM   (
									SELECT claims.id as "claimNumber",
										frequency as "claimFrequencyCode",
										bgcp.charges_bill_fee_total::numeric::text AS "claimTotalCharge",
										bgcp.payment_insurance_total::numeric::text AS "claimPaymentInsurance",
										bgcp.payment_ordering_facility_total::NUMERIC::TEXT AS "claimPaymentOrderingFacility",
										bgcp.payment_ordering_provider_total::NUMERIC::TEXT AS "claimPaymentProvider",
										bgcp.adjustment_ordering_facility_total::NUMERIC::TEXT AS "claimAdjustmentOrderingFacility",
										bgcp.adjustment_ordering_provider_total::NUMERIC::TEXT AS "claimAdjustmentProvider",
										bgcp.payment_patient_total::numeric::text AS "claimPaymentPatient",
										bgcp.payments_applied_total::numeric::text AS "claimPaymentTotal",
										(SELECT places_of_service.code FROM  places_of_service WHERE  places_of_service.id=claims.place_of_service_id) as "POS",
										to_char(date(timezone(facilities.time_zone,claim_dt)), 'YYYYMMDD') as "claimDate",							date(timezone(facilities.time_zone,claim_dt))::text as "claimDt",
										is_employed as  "relatedCauseCode1",
										is_other_accident as  "relatedCauseCode2",
										is_auto_accident as  "relatedCauseCode3",
										current_illness_date::date as "illnessDate",
										service_by_outside_lab as "outSideLab",
                                        account_no as "accountNumber",
                                        (SELECT display_description FROM billing.charges
                                            inner join cpt_codes on cpt_codes.id=cpt_id
                                            WHERE claims.id=charges.claim_id AND display_description ILIKE '%MAMMO%' LIMIT 1) as "mammoStudyDescription",
										to_char(current_illness_date, 'YYYYMMDD')  as "illnessDateFormat",
										authorization_no as "authorizationNo",
										original_reference as "originalReference",
										patient_info->'c1State' as "state",
										facility_info->'facility_mammoLicenseId' as "mammoCertificationNO",
										claim_notes as "claimNotes",
										same_illness_first_date::text as "sameIllnessFirstDate",
										to_char(same_illness_first_date, 'YYYYMMDD')  as "sameIllnessFirstDateFormat",
										unable_to_work_from_date::text as "unableToWorkFromDate",
										to_char(unable_to_work_from_date, 'YYYYMMDD')  as "unableToWorkFromDateFormat",
										unable_to_work_to_date::text as "unableToWorkToDate",
										to_char(unable_to_work_to_date, 'YYYYMMDD')  as "unableToWorkToDateFormat",
										hospitalization_from_date::text as "hospitailizationFromDate",
										to_char(hospitalization_to_date, 'YYYYMMDD')  as "hospitailizationFromDateFormat",
										hospitalization_to_date::text as "hospitailizationToDate",
										to_char(unable_to_work_to_date, 'YYYYMMDD')  as "hospitailizationToDateFormat",
										group_info->'stateLicenseNo' as "stateLicenseNo",
                                        group_info->'cliaNumber' as "cliaNumber",
                                        (CASE coverage_level
                                            WHEN 'primary' THEN 'P'
                                            WHEN 'secondary' THEN 'S'
                                            WHEN 'tertiary' THEN 'T' END) as "claimResponsibleParty",
										(SELECT Json_agg(Row_to_json(payerpaidAmount)) "payerpaidAmount" FROM (
										 SELECT primary_paid_total as "primaryPaidTotal"
										 ,primary_adj_total as "primaryAdjTotal"
										 ,secondary_paid_total as "secondaryPaidTotal"
										 ,secondary_adj_total  as "secondaryAdjTotal"
										FROM  billing.get_payer_claim_payments(claims.id)  ) as payerpaidAmount)

										,(SELECT Json_agg(Row_to_json(icd)) "icd" FROM
										(SELECT icd_id,  code,description,(CASE code_type
											WHEN 'icd9' THEN '0'
											WHEN 'icd10' THEN '1' END ) as code_type   FROM billing.claim_icds ci INNER JOIN icd_codes ON icd_codes.id=ci.icd_id  WHERE ci.claim_id = claims.id order by  ci.id ) as icd)

							,(SELECT Json_agg(Row_to_json(renderingProvider)) "renderingProvider"
									FROM
										(SELECT
											last_name as "lastName",
											first_name as "firstName",
											middle_initial as "middileName",
											suffix as "suffix",
											'' as "prefix",
											provider_info->'TXC' as "taxonomyCode",
											provider_info->'NPI' as "NPINO",
											provider_info->'LicenseNo' as "licenseNo",
											insurance_provider_details.claim_filing_indicator_code as "claimFilingCode",
											insurance_name as "payerName"
											FROM provider_contacts   rendering_pro_contact
											LEFT JOIN providers as render_provider ON render_provider.id=rendering_pro_contact.provider_id
											WHERE  rendering_pro_contact.id=claims.rendering_provider_contact_id)
											as renderingProvider)

							,(SELECT Json_agg(Row_to_json(servicefacility)) "servicefacility"
									FROM
										(SELECT
											provider_groups.group_name as "lastName",
											provider_groups.group_name as "firstName",
											provider_groups.group_name as "middleName",
											provider_groups.group_name as "suffix",
											'' as "prefix",
											group_info->'npi_no' as "NPINO",
											group_info->'taxonomy_code' as "taxonomyCode",
											group_info->'AddressLine1' as "addressLine1",
											group_info->'AddressLine2' as "addressLine2",
											group_info->'City' as "city",
											group_info->'State' as "state",
											group_info->'Zip' as "zip",
											group_info->'ZipPlus' as "zipPlus",
											group_info->'Phone' as "phone",
											group_info->'Email' as "email",
											group_info->'stateLicenseNo' as "stateLicenseNo",
											group_info->'cliaNumber' as "cliaNumber"
											)
										as servicefacility)

							,(SELECT Json_agg(Row_to_json(referringProvider)) "referringProvider"
									FROM
										(SELECT
											last_name as "lastName",
											first_name as "firstName",
											middle_initial as "middileName",
											suffix as "suffix",
											'' as "prefix",
											provider_info->'TXC' as "taxonomyCode",
											provider_info->'NPI' as "NPINO",
											provider_info->'LicenseNo' as "licenseNo"
											FROM provider_contacts
											LEFT JOIN providers as ref_provider ON ref_provider.id=provider_contacts.provider_id
											WHERE  provider_contacts.id=claims.referring_provider_contact_id)
											as referringProvider)

								,(SELECT Json_agg(Row_to_json(otherSubscriber)) "otherSubscriber"
									FROM
										(SELECT
											subscriber_firstname as "lastName",
											subscriber_firstname as "firstName",
											(CASE coverage_level
												WHEN 'primary' THEN 'P'
												WHEN 'secondary' THEN 'S'
												WHEN 'tertiary' THEN 'T' END) as "otherClaimResponsibleParty",
									( SELECT

										(  CASE UPPER(description)
                                                WHEN 'SELF' THEN '18'
                                                WHEN 'FATHER' THEN '33'
                                                WHEN 'MOTHER' THEN '32'
                                                WHEN 'SIBLING' THEN '32'
                                                WHEN 'GRANDPARENT' THEN '04'
                                                WHEN 'GREAT GRANDPARENT' THEN '04'
                                                WHEN 'UNKNOWN' THEN '21'
                                                WHEN 'SPOUSE' THEN '01'
                                                WHEN 'CHILD' THEN '19'
                                                WHEN 'BROTHER' THEN '23'
                                                WHEN 'SISTER' THEN '20'
                                                WHEN 'OTHER RELATIONSHIP' THEN 'G8'
                                                WHEN 'LIFE PARTNER' THEN '53'
                                                WHEN 'EMPLOYEE' THEN '20'
                                                WHEN 'ORGAN DONOR' THEN '39'
                                                WHEN 'CADAVER DONOR' THEN '40'
                                        END)
												FROM  relationship_status WHERE  subscriber_relationship_id =relationship_status.id ) as  relationship,

											policy_number  as "policyNo",
											patient_insurances.group_name as "groupName",
											group_number as "groupNumber",
											other_ins_details.claim_filing_indicator_code as "claimFilingCode",
					medicare_insurance_type_code as "insuranceTypeCode",
					subscriber_firstname as "firstName",
					subscriber_lastname as "lastName",
					subscriber_middlename as "middleName",
					subscriber_name_suffix as "suffix",
					'' as "prefix",
					subscriber_address_line1 as "addressLine1",
					subscriber_address_line2 as "addressLine2",
					subscriber_city as "city",
					subscriber_state as "state",
					subscriber_zipcode as "zipCode",
					home_phone_number as "phoneNumber",
					assign_benefits_to_patient as "acceptAssignment",
					subscriber_dob as "dob",
                    to_char(subscriber_dob, 'YYYYMMDD')  as "dobFormat",
                    (CASE pi.coverage_level
                        WHEN 'primary' THEN 'P'
                        WHEN 'secondary' THEN 'S'
                        WHEN 'tertiary' THEN 'T' END) as "claimResponsibleParty",
                    (SELECT Json_agg(Row_to_json(payerpaidAmount)) "payerpaidAmount" FROM (
                        SELECT primary_paid_total as "primaryPaidTotal"
                        ,primary_adj_total as "primaryAdjTotal"
                        ,secondary_paid_total as "secondaryPaidTotal"
                        ,secondary_adj_total  as "secondaryAdjTotal"
                        FROM  billing.get_payer_claim_payments(claims.id)  ) as payerpaidAmount)
					FROM   patient_insurances
					LEFT JOIN billing.insurance_provider_details  other_ins_details ON other_ins_details.insurance_provider_id = patient_insurances.insurance_provider_id
									WHERE  patient_insurances.id =
						(  CASE COALESCE(${params.payerType}, payer_type)
						WHEN 'primary_insurance' THEN secondary_patient_insurance_id
						WHEN 'secondary_insurance' THEN primary_patient_insurance_id
						WHEN 'tertiary_insurance' THEN primary_patient_insurance_id
						END) )
					as otherSubscriber),
					(SELECT Json_agg(Row_to_json(OtherPayer)) "OtherPayer"
									FROM
					(SELECT
					insurance_name as "name",
					insurance_info->'PayerID' as "payerID",
					insurance_info->'Address1' as "addressLine1",
					insurance_info->'Address2' as "addressLine2",
					insurance_info->'City' as "city",
					insurance_info->'State' as "state",
					insurance_info->'ZipCode' as "zipCode",
					insurance_info->'PhoneNo' as "phoneNo",
					insurance_info->'ZipPlus' as "zipPlus",
					pippt.code	as "providerTypeCode",
					pippt.description	as "providerTypeDescription"
					FROM   patient_insurances
										inner join insurance_providers on insurance_providers.id=insurance_provider_id
										LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = insurance_providers.provider_payer_type_id
									WHERE  patient_insurances.id =
						(  CASE COALESCE(${params.payerType}, payer_type)
						WHEN 'primary_insurance' THEN secondary_patient_insurance_id
						WHEN 'secondary_insurance' THEN primary_patient_insurance_id
						WHEN 'tertiary_insurance' THEN primary_patient_insurance_id
						END) )
					as OtherPayer),

					(SELECT Json_agg(Row_to_json(serviceLine)) "serviceLine"
									FROM
					(SELECT
					display_code as "examCpt",
					modifier1.code as "mod1",
					modifier2.code as "mod2",
					modifier3.code as "mod3",
					modifier4.code as "mod4",
					authorization_no as "authorizationNo",
					allowed_amount::numeric::text as "allowedAmount",
					(allowed_amount*charges.units)::numeric::text  as "totalAllowedAmount",
					charges.id as "chargeID",
					display_description as "studyDescription",
					additional_info->'ndc_code' as NDCCode,
					additional_info->'ndc_measure' as NDCMeasure,
					bill_fee::numeric::text as "billFee",
					(bill_fee*charges.units)::numeric::text  as "totalBillFee",
					charges.units as "unit",
					date(timezone(facilities.time_zone,charge_dt))::text as  "studyDt",
					to_char(date(timezone(facilities.time_zone,charge_dt)), 'YYYYMMDD') as "studyDate",
					pointer1 as "pointer1",
					pointer2 as "pointer2",
					pointer3 as "pointer3",
					pointer4 as "pointer4",
					group_info->'cliaNumber' as "cliaNumber"
					,(SELECT Json_agg(Row_to_json(lineAdjudication)) "lineAdjudication"
									FROM
                 (SELECT
                    display_code as "cpt",
                    to_char(max(payments.accounting_date), 'YYYYMMDD') as "accountingDt",
                    charges.id as "chargeID",
                    insurance_info->'PayerID' as "claimPayerID",
                    (SELECT insurance_info->'PayerID' FROM    patient_insurances p_pi
                    INNER JOIN  insurance_providers ON insurance_providers.id=insurance_provider_id
                    WHERE  p_pi.id = claims.primary_patient_insurance_id) as "payerID",
					(CASE coverage_level
						WHEN 'primary' THEN 'P'
						WHEN 'secondary' THEN 'S'
						WHEN 'tertiary' THEN 'T' END) as "claimResponsibleParty",
					modifier1.code as "modifier1",
					modifier2.code as "modifier2",
					modifier3.code as "modifier3",
					modifier4.code as "modifier4",
					COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'payment'),0::money)::NUMERIC::text  AS "cptPaymentTotal",
					COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'payment' AND payer_type='insurance'),0::money)::NUMERIC::text AS "paidAmount",
					COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'payment' AND payer_type='ordering_provider'),0::money)::NUMERIC::text AS "cptPaymentProvider",
					COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'payment' AND payer_type='ordering_facility'),0::money)::NUMERIC::text AS "cptPaymentOrderingFacility",
					COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'adjustment' AND payer_type='ordering_provider'),0::money)::NUMERIC::text AS "cptAdjustmentProvider",
					COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'adjustment' AND payer_type='ordering_facility'),0::money)::NUMERIC::text AS "cptAdjustmentOrderingFacility",
					charges.units as "unit"
					,(SELECT Json_agg(Row_to_json(lineAdjustment)) "lineAdjustment"
									FROM
					(	SELECT
						cas_group_codes.code as "adjustmentGroupCode" ,
						(SELECT JSON_agg(row_to_JSON(CAS)) as casList FROM
						(SELECT
											cas_reason_codes.code as "reasonCode",
											cas_payment_application_details.amount::numeric::text
											FROM  billing.cas_payment_application_details
											INNER JOIN   billing.cas_group_codes gc  ON  gc.id=cas_group_code_id
											INNER JOIN   billing.cas_reason_codes ON cas_reason_codes.id=cas_reason_code_id
											INNER JOIN 	billing.payment_applications	 ON payment_applications.id=cas_payment_application_details.payment_application_id
											INNER JOIN billing.payments ON  billing.payments.id=payment_applications.payment_id and payer_type='insurance' AND
											payment_applications.charge_id = charges.id AND payment_applications.amount_type = 'adjustment'
											WHERE cas_group_codes.code= gc.code ) AS CAS )
											FROM  billing.cas_payment_application_details
											INNER JOIN billing.cas_group_codes ON cas_group_codes.id = cas_group_code_id
											INNER JOIN billing.payment_applications ON payment_applications.id = cas_payment_application_details.payment_application_id
											INNER JOIN billing.payments ON billing.payments.id = payment_applications.payment_id
											                            AND payer_type='insurance'
											                            AND payment_applications.charge_id = charges.id
											                            AND payment_applications.amount_type = 'adjustment'
											                            GROUP BY cas_group_codes.code ) AS lineAdjustment)
                                        FROM billing.payment_applications pa
                                        INNER JOIN billing.payments ON billing.payments.id=pa.payment_id
                                        WHERE charge_id = charges.id ) AS lineAdjudication)
					FROM billing.charges
					INNER JOIN cpt_codes ON cpt_codes.id=cpt_id
					LEFT JOIN modifiers AS modifier1 ON modifier1.id=modifier1_id
					LEFT JOIN modifiers AS modifier2 ON modifier2.id=modifier2_id
					LEFT JOIN modifiers AS modifier3 ON modifier3.id=modifier3_id
					LEFT JOIN modifiers AS modifier4 ON modifier4.id=modifier4_id
					WHERE claim_id=claims.id AND NOT charges.is_excluded ORDER BY charges.id ASC)
					AS serviceLine)
					) AS claim
					)
					) AS subscriber)
					SELECT claims.id,*
					FROM
						cte_billing_providers,cte_pay_to_providers,cte_subscriber
					)

					AS data1
					)

					FROM billing.claims
					INNER JOIN LATERAL billing.get_claim_payments(claims.id, true) bgcp ON TRUE
					INNER JOIN facilities ON facilities.id=claims.facility_id
					INNER JOIN patients ON patients.id=claims.patient_id
					INNER JOIN    patient_insurances pi  ON  pi.id =
											(  CASE COALESCE(${params.payerType}, payer_type)
											WHEN 'primary_insurance' THEN primary_patient_insurance_id
											WHEN 'secondary_insurance' THEN secondary_patient_insurance_id
											WHEN 'tertiary_insurance' THEN tertiary_patient_insurance_id
											END)
									INNER JOIN  insurance_providers ON insurance_providers.id=insurance_provider_id
									LEFT JOIN billing.insurance_provider_details ON insurance_provider_details.insurance_provider_id = insurance_providers.id
									LEFT JOIN relationship_status ON  subscriber_relationship_id =relationship_status.id
									LEFT JOIN public.insurance_provider_payer_types  ON insurance_provider_payer_types.id = insurance_providers.provider_payer_type_id
                                    LEFT JOIN provider_groups  ON  claims.ordering_facility_id = provider_groups.id
                                    WHERE claims.id= ANY(${claimIds})
                            `;

        return await query(sql);
    },
	
    submitOhipClaim: async (params) => {
        let claimIds = params.claimIds.split(',');
        let sql = SQL`SELECT
                        bc.id AS claim_id,
                        npi_no AS "groupNumber",
                        rend_pr.provider_info -> 'NPI' AS "providerNumber",
                        rend_pr.specialities[1] AS "specialtyCode",
                        (SELECT JSON_agg(Row_to_json(claim_details)) FROM (
                           WITH cte_insurance_details AS (
                                SELECT
                                    (Row_to_json(insuranceDetails)) AS "insuranceDetails"
                                FROM (SELECT
                                    ppi.policy_number AS "healthNumber",
                                    ppi.group_number AS "versionCode",
                                    pp.birth_date AS "dateOfBirth",
                                    bc.id AS "accountingNumber",
                                    CASE WHEN nullif (pc.company_info -> 'company_state','') = subscriber_state THEN
                                        'HCP'
                                    ELSE
                                        'RMB'
                                    END AS "paymentProgram",
                                    'P' AS "payee",
                                    'HOP' AS "masterNumber",
                                    reff_pr.provider_info -> 'NPI' AS "referringProviderNumber",
                                    'HOP' AS "serviceLocationIndicator",
                                    ppi.policy_number AS "registrationNumber",
                                    pp.last_name AS "patientLastName",
                                    pp.first_name AS "patientFirstName",
                                    pp.gender AS "patientSex",
                                    pp.patient_info -> 'c1Statepp' AS "provinceCode"
                                FROM public.patient_insurances ppi
                                WHERE ppi.id = bc.primary_patient_insurance_id) AS insuranceDetails)
						, charge_details AS (
                            SELECT JSON_agg(Row_to_json(items)) "items" FROM (
								SELECT
                                    pcc.display_code AS "serviceCode",
                                    (bch.bill_fee * bch.units) AS "feeSubmitted",
                                    1 AS "numberOfServices",
                                    charge_dt AS "serviceDate",
                                    billing.get_charge_icds (bch.id) AS diagnosticCodes
                                FROM billing.charges bch
                                INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
								WHERE bch.claim_id = bc.id) AS items )
                            SELECT * FROM cte_insurance_details, charge_details) AS claim_details ) AS "claims"
                    FROM billing.claims bc
                    INNER JOIN public.companies pc ON pc.id = bc.company_id
                    INNER JOIN public.patients pp ON pp.id = bc.patient_id
                    INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
                    LEFT JOIN public.provider_contacts rend_ppc ON rend_ppc.id = bc.rendering_provider_contact_id
                    LEFT JOIN public.providers rend_pr ON rend_pr.id = rend_ppc.provider_id
                    LEFT JOIN public.provider_contacts reff_ppc ON reff_ppc.id = bc.referring_provider_contact_id
                    LEFT JOIN public.providers reff_pr ON reff_pr.id = reff_ppc.provider_id
                    WHERE bc.id = ANY (${claimIds})
                    ORDER BY bc.id DESC
		`;
        return await query(sql);	
    }

};
