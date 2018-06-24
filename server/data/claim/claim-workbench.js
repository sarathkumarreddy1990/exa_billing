const SearchFilter = require('./claim-search-filters');

const {
    SQL,
    query
} = require('../index');

module.exports = {

    getData: async function (args) {
        return await SearchFilter.getWL(args);
    },

    updateClaimStatus: async (params) => {

        const {
            claim_status_id,
            billing_code_id,
            billing_class_id,
            claimIds
        } = params;

        let updateData;

        if (params.claim_status_id) {
            updateData = `claim_status_id = ${claim_status_id}`;
        } else if (params.billing_code_id) {
            updateData = `billing_code_id = ${billing_code_id}`;
        }
        else if (params.billing_class_id) {
            updateData = `billing_class_id = ${billing_class_id}`;
        }


        let sql = SQL`UPDATE
                             billing.claims 
                        SET                      
                        
                    `;
        sql.append(updateData);
        sql.append(`WHERE  id in (${claimIds})`);

        return await query(sql);
    },

    getPaperClaimTemplate: async function () {
        let sql = SQL`
				SELECT template_content
				FROM   billing.printer_templates 
				WHERE template_type = 'paper_claim_full'
				ORDER  BY id DESC 
				LIMIT  1 
		`;

        return await query(sql);
    },

    getEDIClaim: async (params) => {

        const {
            claimIds
        } = params;

        let sql = SQL`
        
	SELECT  
	 relationship_status.description as subscriper_relationShip,
	 insurance_info->'edi_template' as edi_template,
	(SELECT (Row_to_json(header)) "header"

				FROM ( 
						SELECT id,
						more_info->'authInfoQualifier' as "authInfoQualifier",
						more_info->'authInfo' as "authInfo",
						more_info->'securityInfoQualifier' as "securityInfoQualifier",
 						more_info->'securityInfo' as "securityInfo",
 						more_info->'interchangeSenderIDQualifier' as "interchangeSenderIDQualifier",
						more_info->'interchangeSenderID' as "interchangeSenderID",
						more_info->'interchangeReceiverIDQualifier' as "interchangeReceiverIDQualifier", 
						more_info->'interchangeReceiverID' as "interchangeReceiverID",
						more_info->'interchangeCtrlStdIdentifier' as "interchangeCtrlStdIdentifier",
						more_info->'interchangeCtrlVersionNo' as "interchangeCtrlVersionNo",
						more_info->'interchangeCtrlNo' as "interchangeCtrlNo",
						more_info->'acqRequested' as "acqRequested",
						more_info->'usageIndicator' as "usageIndicator",
						more_info->'functionalIDCode' as "functionalIDCode",
						more_info->'applicationSenderCode' as "applicationSenderCode",
						more_info->'applicationReceiverCode' as "applicationReceiverCode",
						more_info->'fgDate' as "fgDate",
						more_info->'fgTime' as "fgTime",
						more_info->'groupControlNo' as "groupControlNo",
						more_info->'responsibleAgencyCode' as "responsibleAgencyCode",
						more_info->'verReleaseIDCode' as "verReleaseIDCode",
						more_info->'tsIDCode' as "tsIDCode",
						more_info->'tsControlNo' as "tsControlNo"						
                                    FROM   edi_clearinghouses
                                    WHERE  edi_clearinghouses.id::text=insurance_info->'claimClearingHouse'::text)

					as header),
					(SELECT Json_agg(Row_to_json(data1)) "data"

												FROM ( 

					WITH cte_billing_providers AS (
					SELECT (Row_to_json(billingProvider1)) "billingProvider"
												FROM   (
														SELECT id,
										taxonomy_code as "taxonomyCode",
															billing_providers.name as "lastName",                    
															npi_no as "npiNo",
										address_line1 as "addressLine1",
										address_line2 as "addressLine2",
										city as "city",
										state as "state",
										zip_code as "zipCode",
										federal_tax_id as "federalTaxID"

														FROM   billing.providers as billing_providers
														WHERE  billing_providers.id=billing_provider_id)AS billingProvider1 

					)

					, cte_pay_to_providers AS (

					SELECT (Row_to_json(billingProvider)) "payToProvider"
												FROM   (
														SELECT id,
															billing_providers.name as "lastName",
															billing_providers.name as "firstName",
															npi_no as "npiNo",
										pay_to_address_line1 as "addressLine1",
										pay_to_address_line2 as "addressLine2",
										pay_to_city as "city",
										pay_to_state as "state",
										pay_to_zip_code as "zipCode"

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
															WHEN 'teritary' THEN 'T' END) as "claimResponsibleParty",
														( SELECT 

										(  CASE UPPER(description) 
											WHEN 'SELF' THEN 18
											WHEN 'FATHER' THEN 33
											WHEN 'MOTHER' THEN 32
											WHEN 'SIBLING' THEN 32
											WHEN 'GRANDPARENT' THEN 04
											WHEN 'GREAT GRANDPARENT' THEN 04
											WHEN 'UNKNOWN' THEN 21
											WHEN 'SPOUSE' THEN 21
											WHEN 'CHILD' THEN 19
											WHEN 'BROTHER' THEN 23
											WHEN 'SISTER' THEN 20
											END) 
										FROM  relationship_status WHERE  subscriber_relationship_id =relationship_status.id ) as  relationship,

										policy_number  as "policyNo",
										group_name as "planName",
										group_number as "planType",
										insurance_info->'claimFileIndicatorCode' as "claimFilingCode",
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
										subscriber_dob as "dob",
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
										) as payer)
										,(
											SELECT Json_agg(Row_to_json(patient)) "patient"
																	FROM   (
																				SELECT id,
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
										birth_date::text as dob,
											(  CASE gender 
																WHEN 'Male' THEN 'M'						
																WHEN 'Female' THEN 'F'
																WHEN 'Unknown' THEN 'U'
																WHEN 'Others' THEN 'O'
																ELSE gender 
																END) as gender,
										
															( SELECT 
																(  CASE UPPER(description) 
																	WHEN 'SELF' THEN 18
																	WHEN 'FATHER' THEN 33
																	WHEN 'MOTHER' THEN 32
																	WHEN 'SIBLING' THEN 32
																	WHEN 'GRANDPARENT' THEN 04
																	WHEN 'GREAT GRANDPARENT' THEN 04
																	WHEN 'UNKNOWN' THEN 21
																	WHEN 'SPOUSE' THEN 21
																	WHEN 'CHILD' THEN 19
																	WHEN 'BROTHER' THEN 23
																	WHEN 'SISTER' THEN 20
																END) 
															FROM  relationship_status WHERE  subscriber_relationship_id =relationship_status.id ) as  relationship
										
										
																			FROM   patients
																			WHERE  patients.id=claims.patient_id)AS patient)
							,( SELECT Json_agg(Row_to_json(claim)) "claim"
							FROM   (
									SELECT claims.id as "claimNumber",
										frequency as "claimFrequencyCode",
										(select charges_bill_fee_total from BILLING.get_claim_totals(claims.id)) as "claimTotalCharge",
										(SELECT places_of_service.description FROM  places_of_service WHERE  places_of_service.id=claims.place_of_service_id) as "POS",

										is_employed as  "relatedCauseCode1",
										is_other_accident as  "relatedCauseCode2",
										is_auto_accident as  "relatedCauseCode3",
										current_illness_date::date as "illnessDate"

							,(SELECT Json_agg(Row_to_json(renderingProvider)) "renderingProvider"
									FROM 
										(SELECT 
											last_name as "lastName",
											first_name as "firstName",
											middle_initial as "middileName",
											suffix as "suffix",
											'' as "prefix",
											provider_info->'TXC' as "taxonomyCode",
											provider_info->'NPI' as "NPINO"
											FROM provider_contacts   rendering_pro_contact
											LEFT JOIN providers as render_provider ON render_provider.id=rendering_pro_contact.id
											WHERE  rendering_pro_contact.id=claims.rendering_provider_contact_id) 
											as renderingProvider)

							,(SELECT Json_agg(Row_to_json(servicefacility)) "servicefacility"
									FROM 
										(SELECT 
											group_name as "lastName",
											group_name as "firstName",
											group_name as "middileName",
											group_name as "suffix",
											'' as "prefix",
											group_info->'npi_no' as "NPINO",
											group_info->'taxonomy_code' as "taxonomyCode"
											FROM provider_groups 
											WHERE  claims.ordering_facility_id = provider_groups.id) 
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
											provider_info->'NPI' as "NPINO"
											FROM provider_contacts 
											LEFT JOIN providers as ref_provider ON ref_provider.id=provider_contacts.id
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
												WHEN 'teritary' THEN 'T' END) as "otherClaimResponsibleParty",
									( SELECT 

											(  CASE description 
												WHEN 'Self' THEN 18
												WHEN 'Mother' THEN 32
												WHEN 'Sibling' THEN 32
												WHEN 'Grandparent' THEN 04
												WHEN 'Great Grandparent' THEN 04
												WHEN 'Unknown' THEN 21
												WHEN 'Spouse' THEN 21							
												WHEN 'Father' THEN 33
												WHEN 'Child' THEN  19 
												END) 
												FROM  relationship_status WHERE  subscriber_relationship_id =relationship_status.id ) as  relationship,
						
											policy_number  as "policyNo",
											group_name as "groupName",
											insurance_info->'claimFileIndicatorCode' as "claimFilingCode",
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
					subscriber_zipcode as "zipCode"
					FROM   patient_insurances 
									WHERE  patient_insurances.id = 
						(  CASE payer_type 
						WHEN 'primary_insurance' THEN secondary_patient_insurance_id
						WHEN 'secondary_insurance' THEN tertiary_patient_insurance_id
						WHEN 'teritary_insurance' THEN primary_patient_insurance_id
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
					insurance_info->'ZipCode' as "zipCode"

										
					FROM   patient_insurances 
										inner join insurance_providers on insurance_providers.id=insurance_provider_id
									WHERE  patient_insurances.id = 
						(  CASE payer_type 
						WHEN 'primary_insurance' THEN secondary_patient_insurance_id
						WHEN 'secondary_insurance' THEN tertiary_patient_insurance_id
						WHEN 'teritary_insurance' THEN primary_patient_insurance_id
						END) ) 
					as OtherPayer),

					(SELECT Json_agg(Row_to_json(serviceLine)) "serviceLine"
									FROM 
					(SELECT 
					display_code as "examCpt",
					modifier1.description as "mod1",
					modifier2.description as "mod2",
					modifier3.description as "mod3",
					modifier4.description as "mod4",
					charges.id as "iterationIndex",
					bill_fee as "billFee",
					charges.units as "unit",
					claim_dt as "studyDate",
					pointer1 as "pointer1",
					pointer2 as "pointer2",
					pointer3 as "pointer3",
					pointer4 as "pointer4"


					,(SELECT Json_agg(Row_to_json(lineAdjudication)) "lineAdjudication"
									FROM 
					(SELECT 
					display_code as "cpt",
					insurance_info->'PayerID' as "payerID",
					modifier1.description as "modifier1",
					modifier2.description as "modifier2",
					modifier3.description as "modifier3",
					modifier4.description as "modifier4",
					amount as "paidAmount",
					charges.units as "unit",
					payment_applications.id as id

					,(SELECT Json_agg(Row_to_json(lineAdjustment)) "lineAdjustment"
									FROM 
					(SELECT 
					cas_group_codes.code as "adjustmentGroupCode",
					cas_reason_codes.code as "reasonCode",
					cas_payment_application_details.amount as "monetaryAmount"
					FROM  billing.cas_payment_application_details
					INNER JOIN   billing.cas_group_codes ON cas_group_codes.id=cas_group_code_id
					INNER JOIN   billing.cas_reason_codes ON cas_reason_codes.id=cas_reason_code_id
										
									WHERE  payment_application_id=payment_applications.id) 
					as lineAdjustment)

					FROM  billing.payment_applications
										
									WHERE  charge_id=charges.id) 
					as lineAdjudication)


					FROM   billing.charges 
										inner join cpt_codes on cpt_codes.id=cpt_id
					LEFT join modifiers as modifier1 on modifier1.id=modifier1_id
					LEFT join modifiers as modifier2 on modifier2.id=modifier2_id
					LEFT join modifiers as modifier3 on modifier3.id=modifier3_id
					LEFT join modifiers as modifier4 on modifier4.id=modifier4_id
					WHERE  claim_id=claims.id order by line_num) 
					as serviceLine)
					)AS claim
					)
					) AS subscriber)




					SELECT * 
					FROM
						cte_billing_providers,cte_pay_to_providers,cte_subscriber
					) 

					AS data1 
					) 

					FROM billing.claims  

					INNER JOIN    patient_insurances  ON  patient_insurances.id = 
											(  CASE payer_type 
											WHEN 'primary_insurance' THEN primary_patient_insurance_id
											WHEN 'secondary_insurance' THEN secondary_patient_insurance_id
											WHEN 'teritary_insurance' THEN tertiary_patient_insurance_id
											END)
									INNER JOIN  insurance_providers ON insurance_providers.id=insurance_provider_id   
									LEFT JOIN relationship_status ON  subscriber_relationship_id =relationship_status.id

							WHERE claims.id= ANY(${claimIds})
							`;


        return await query(sql, params);
    },

    validateClaim: async (params) => {

        let sql = SQL`SELECT 
							bc.id
						, billing_method
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
						, p.first_name AS "patient_firstName"
						, p.last_name AS "patient_lastName"
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
									, 'claimClearingHouse', p_ip.insurance_info->'claimCHCode' 
									, 'edi_request_templates_id', p_ip.insurance_info->'claimRequestTemplate'
									, 'claim_req_type', p_ip.insurance_info->'claim_req_type_prov')
								WHEN bc.payer_type = 'secondary_insurance' THEN
									json_build_object('payer_name',  s_ip.insurance_name 
									, 'payer_address1', s_ip.insurance_info->'Address1' 
									, 'payer_city', s_ip.insurance_info->'City'
									, 'payer_state', s_ip.insurance_info->'State' 
									, 'payer_zip_code', s_ip.insurance_info->'ZipCode'
									, 'claimClearingHouse', s_ip.insurance_info->'claimCHCode' 
									, 'edi_request_templates_id', s_ip.insurance_info->'claimRequestTemplate'
									, 'claim_req_type', s_ip.insurance_info->'claim_req_type_prov')
								WHEN bc.payer_type = 'tertiary_insurance' THEN
									json_build_object( 'payer_name', t_ip.insurance_name 
									, 'payer_address1', t_ip.insurance_info->'Address1' 
									, 'payer_city', t_ip.insurance_info->'City' 
									, 'payer_state', t_ip.insurance_info->'State' 
									, 'payer_zip_code', t_ip.insurance_info->'ZipCode'
									, 'claim_req_type', t_ip.insurance_info->'claim_req_type_prov'
									, 'claimClearingHouse', t_ip.insurance_info->'claimCHCode' 
									, 'edi_request_templates_id', t_ip.insurance_info->'claimRequestTemplate')
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
									, 'payer_zip_code', ref_pc.contact_info->'ZIP' ) END AS payer_info
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
									
									, p_pi.subscriber_address_line1 AS "p_subscriber_addressLine1"
									, p_pi.subscriber_city AS "p_subscriber_city"
									, p_pi.subscriber_dob AS "p_subscriber_dob"
									, p_pi.subscriber_firstname AS "p_subscriber_firstName"
									, p_pi.subscriber_lastname AS "p_subscriber_lastName"
									, p_pi.subscriber_state AS "p_subscriber_state"
									, p_pi.subscriber_zipcode AS "p_subscriber_zipCode"	
					
									, s_pi.subscriber_address_line1 AS "s_subscriber_addressLine1"
									, s_pi.subscriber_city AS "s_subscriber_city"
									, s_pi.subscriber_dob AS "s_subscriber_dob"
									, s_pi.subscriber_firstname AS "s_subscriber_firstName"
									, s_pi.subscriber_lastname AS "s_subscriber_lastName"
									, s_pi.subscriber_state AS "s_subscriber_state"
									, s_pi.subscriber_zipcode AS "s_subscriber_zipCode"	
					
									, t_pi.subscriber_address_line1 AS "t_subscriber_addressLine1"
									, t_pi.subscriber_city AS "t_subscriber_city"
									, t_pi.subscriber_dob AS "t_subscriber_dob"
									, t_pi.subscriber_firstname AS "t_subscriber_firstName"
									, t_pi.subscriber_lastname AS "t_subscriber_lastName"
									, t_pi.subscriber_state AS "t_subscriber_state"
									, t_pi.subscriber_zipcode AS "t_subscriber_zipCode"					
									, (SELECT array_agg(row_to_json(pointer)) AS charge_pointer FROM (
										SELECT ch.id, pointer1, claim_id, cpt.ref_code, cpt.display_description FROM billing.charges ch INNER JOIN public.cpt_codes cpt ON ch.cpt_id = cpt.id WHERE ch.claim_id = bc.id
														 ) pointer) AS charge_pointer
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
					LEFT JOIN public.patient_insurances s_pi on s_pi.id = bc.primary_patient_insurance_id
					LEFT JOIN public.patient_insurances t_pi on t_pi.id = bc.primary_patient_insurance_id
					LEFT JOIN public.insurance_providers p_ip on p_ip.id = p_pi.insurance_provider_id
					LEFT JOIN public.insurance_providers s_ip on s_ip.id = s_pi.insurance_provider_id
					LEFT JOIN public.insurance_providers t_ip on t_ip.id = t_pi.insurance_provider_id
					LEFT JOIN 
						LATERAL (SELECT icd_id FROM billing.claim_icds ci WHERE ci.claim_id = bc.id LIMIT 1) claim_icd ON true
					WHERE bc.id = ANY(${params.claim_ids})`;

        return await query(sql);
    },

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
    }
};
