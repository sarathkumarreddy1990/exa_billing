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

        if(params.claim_status_id){
            updateData=`claim_status_id = ${claim_status_id}`;
        }else if(params.billing_code_id){
            updateData=`billing_code_id = ${billing_code_id}`;
        }
        else if(params.billing_class_id){
            updateData=`billing_class_id = ${billing_class_id}`;
        }


        let sql = SQL`UPDATE
                             billing.claims 
                        SET                      
                        
                    `;
        sql.append(updateData);        
        sql.append(`WHERE  id in (${claimIds})`);

        return await query(sql);
    },

    getEDIClaim:async (params) => {

        const {           
            claimIds           
        } = params;
        
        let sql = SQL`
        
SELECT  

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
                                     coverage_level as "claimResponsibleParty",
                                     ( SELECT 

				     (  CASE description 
						WHEN 'Self' THEN 18
						WHEN 'Father' THEN 33
						WHEN 'Mother' THEN 32
						WHEN 'Sibling' THEN 32
						WHEN 'Grandparent' THEN 04
						WHEN 'Great Grandparent' THEN 04
						WHEN 'Unknown' THEN 21
						WHEN 'Spouse' THEN 21
						WHEN 'Child' THEN 19
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
 ) AS subscriber)


, cte_patients AS (

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

				     (  CASE description 
						WHEN 'Self' THEN 18
						WHEN 'Father' THEN 33
						WHEN 'Mother' THEN 32
						WHEN 'Sibling' THEN 32
						WHEN 'Grandparent' THEN 04
						WHEN 'Great Grandparent' THEN 04
						WHEN 'Unknown' THEN 21
						WHEN 'Spouse' THEN 21
						WHEN 'Child' THEN 19
						END) 
					FROM  relationship_status WHERE  subscriber_relationship_id =relationship_status.id ) as  relationship


                                    FROM   patients
                                    WHERE  patients.id=claims.patient_id)AS patient
)

, cte_claims AS (

 SELECT Json_agg(Row_to_json(claim)) "claim"
                            FROM   (
                                     SELECT claims.id as "claimNumber",
                                        frequency as "claimFrequencyCode",
					(select charges_bill_fee_total from BILLING.get_claim_totals(claims.id)) as "claimTotalCharge",
 (SELECT places_of_service.description FROM  places_of_service WHERE  places_of_service.id=claims.place_of_service_id) as "POS",

is_employed as  "relatedCauseCode1",

is_other_accident as  "relatedCauseCode2",

is_auto_accident as  "relatedCauseCode3",

current_illness_date::date as "illnessDate"
,
					(SELECT Json_agg(Row_to_json(renderingProvider)) renderingProvider
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
					as renderingProvider),

				(SELECT Json_agg(Row_to_json(servicefacility)) servicefacility
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
					as servicefacility),

			(SELECT Json_agg(Row_to_json(referringProvider)) referringProvider
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
					as referringProvider),

			(SELECT Json_agg(Row_to_json(otherSubscriber)) otherSubscriber
                                    FROM 
					(SELECT 
					subscriber_firstname as "lastName",
					subscriber_firstname as "firstName",
					coverage_level as "otherClaimResponsibleParty",
       ( SELECT 

				     (  CASE description 
						WHEN 'Self' THEN 18
						WHEN 'Father' THEN 33
						WHEN 'Mother' THEN 32
						WHEN 'Sibling' THEN 32
						WHEN 'Grandparent' THEN 04
						WHEN 'Great Grandparent' THEN 04
						WHEN 'Unknown' THEN 21
						WHEN 'Spouse' THEN 21
						WHEN 'Child' THEN 19
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
			(SELECT Json_agg(Row_to_json(OtherPayer)) OtherPayer
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

(SELECT Json_agg(Row_to_json(serviceLine)) serviceLine
                                    FROM 
					(SELECT 
					display_code as "examCpt",
					modifier1.description as "mod1",
modifier2.description as "mod2",
modifier3.description as "mod3",
modifier4.description as "mod4",
					bill_fee as "billFee",
charges.units as "unit",
claim_dt as "studyDate",
pointer1 as "pointer1",
pointer2 as "pointer2",
pointer3 as "pointer3",
pointer4 as "pointer4"


 ,(SELECT Json_agg(Row_to_json(lineAdjudication)) lineAdjudication
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

 ,(SELECT (Row_to_json(lineAdjustment)) lineAdjustment
                                     FROM 
 					(SELECT 
					cas_group_codes.code as "adjustmentGroupCode",
 					cas_reason_codes.code as "reasonCode",
 					cas_payment_application_details.amount as "monetaryAmount"
					FROM  billing.cas_payment_application_details
 					INNER JOIN   billing.cas_group_codes ON cas_group_codes.id=cas_group_code_id
 					INNER JOIN   billing.cas_reason_codes ON cas_reason_codes.id=cas_reason_code_id
                                        
                                    WHERE  payment_application_id=payment_applications.id LIMIT 1) 
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


SELECT * 
FROM
     cte_billing_providers,cte_pay_to_providers,cte_subscriber,cte_patients,cte_claims

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
        WHERE claims.id= ANY(${claimIds})
        `;


        return await query(sql, params);
    }


};
