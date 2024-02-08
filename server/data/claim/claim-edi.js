const { SQL, query } = require('../index');
const { getClaimPatientInsurances } = require('../../shared/index');
const config = require('../../config');

const isMobileBillingEnabled = config.get(config.keys.enableMobileBilling);

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
                        , pof.address_line_1 AS "service_facility_addressLine1"
                        , pof.city AS "service_facility_city"
                        , pof.name AS "service_facility_firstName"
                        , pof.npi_number AS "service_facility_npiNo"
                        , pof.state AS "service_facility_state"
                        , pof.zip_code AS "service_facility_zip"
						, pos.id AS "claim_place_of_service_code"
						, claim_icd.icd_id AS "claim_icd_code1"
						, CASE
                            WHEN bc.payer_type = 'service_facility_location' THEN
                                public.get_claim_service_facility_address(bc.id, bc.pos_map_code, bc.patient_id)
                            WHEN bc.payer_type = 'primary_insurance' THEN
                                json_build_object('payer_name', p_ip.insurance_name
                                , 'payer_address1', p_ip.insurance_info->'Address1'
                                , 'payer_city', p_ip.insurance_info->'City'
                                , 'payer_state', p_ip.insurance_info->'State'
                                , 'payer_zip_code', p_ip.insurance_info->'ZipCode'
                                , 'payer_zip_code_plus', p_ip.insurance_info->'ZipPlus'
                                , 'claimClearingHouse', p_edi_clearinghouse.receiver_name
                                , 'edi_request_templates_id', p_edi_clearinghouse.edi_template_id
                                )
                            WHEN bc.payer_type = 'secondary_insurance' THEN
                                json_build_object('payer_name',  s_ip.insurance_name
                                , 'payer_address1', s_ip.insurance_info->'Address1'
                                , 'payer_city', s_ip.insurance_info->'City'
                                , 'payer_state', s_ip.insurance_info->'State'
                                , 'payer_zip_code', s_ip.insurance_info->'ZipCode'
                                , 'payer_zip_code_plus', s_ip.insurance_info->'ZipPlus'
                                , 'claimClearingHouse',  s_edi_clearinghouse.receiver_name
                                , 'edi_request_templates_id',  s_edi_clearinghouse.edi_template_id
                                )
                            WHEN bc.payer_type = 'tertiary_insurance' THEN
                                json_build_object( 'payer_name', t_ip.insurance_name
                                , 'payer_address1', t_ip.insurance_info->'Address1'
                                , 'payer_city', t_ip.insurance_info->'City'
                                , 'payer_state', t_ip.insurance_info->'State'
                                , 'payer_zip_code', t_ip.insurance_info->'ZipCode'
                                , 'payer_zip_code_plus', t_ip.insurance_info->'ZipPlus'
                                , 'claimClearingHouse', t_edi_clearinghouse.receiver_name
                                , 'edi_request_templates_id', t_edi_clearinghouse.edi_template_id
                                )
                            WHEN bc.payer_type = 'ordering_facility' THEN
                            json_build_object(
                                'payer_name',  pof.name
                                , 'payer_address1', pof.address_line_1
                                , 'payer_city', pof.city
                                , 'payer_state', pof.state
                                , 'payer_zip_code', pof.zip_code)
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
                        , bci.patient_insurance_id AS primary_patient_insurance_id
                        , p_ip.insurance_info->'Address1' AS "p_insurance_pro_address1"
                        , p_ip.insurance_info->'City' AS "p_insurance_pro_city"
                        , p_ip.insurance_info->'PayerID' AS "p_insurance_pro_payerID"
                        , p_ip.insurance_info->'State' AS "p_insurance_pro_state"
                        , p_ip.insurance_info->'ZipCode' AS "p_insurance_pro_zipCode"
                        , p_ip.insurance_info->'ZipPlus' AS "p_insurance_pro_zipPlus"
                        , p_ip.insurance_name AS "p_insurance_pro_companyName"
                        , bsi.patient_insurance_id AS secondary_patient_insurance_id
                        , s_ip.insurance_info->'Address1' AS "s_insurance_pro_address1"
                        , s_ip.insurance_info->'City' AS "s_insurance_pro_city"
                        , s_ip.insurance_info->'PayerID' AS "s_insurance_pro_payerID"
                        , s_ip.insurance_info->'State' AS "s_insurance_pro_state"
                        , s_ip.insurance_info->'ZipCode' AS "s_insurance_pro_zipCode"
                        , s_ip.insurance_info->'ZipPlus' AS "s_insurance_pro_zipPlus"
                        , s_ip.insurance_name AS "s_insurance_pro_companyName"
                        , bti.patient_insurance_id AS tertiary_patient_insurance_id
                        , t_ip.insurance_info->'Address1' AS "t_insurance_pro_address1"
                        , t_ip.insurance_info->'City' AS "t_insurance_pro_city"
                        , t_ip.insurance_info->'PayerID' AS "t_insurance_pro_payerID"
                        , t_ip.insurance_info->'State' AS "t_insurance_pro_state"
                        , t_ip.insurance_info->'ZipCode' AS "t_insurance_pro_zipCode"
                        , t_ip.insurance_info->'ZipPlus' AS "t_insurance_pro_zipPlus"
                        , t_ip.insurance_name AS "t_insurance_pro_companyName"

                        , COALESCE (NULLIF(p_pi.subscriber_address_line1,'Migration Address'),'') AS "p_subscriber_addressLine1"
                        , COALESCE (NULLIF(p_pi.subscriber_city,'Migration City'),'') AS "p_subscriber_city"
                        , p_pi.subscriber_dob::text AS "p_subscriber_dob"
                        , COALESCE (NULLIF(p_pi.subscriber_firstname, ''), '')  AS "p_subscriber_firstName"
                        , COALESCE (NULLIF(p_pi.subscriber_middlename, ''), '')  AS "p_subscriber_middleName"
                        , COALESCE (NULLIF(p_pi.subscriber_name_suffix, ''), '')  AS "p_subscriber_suffixName"
                        , COALESCE (NULLIF(p_pi.subscriber_lastname, ''), '') AS "p_subscriber_lastName"
                        , COALESCE (NULLIF(p_pi.subscriber_gender, 'Migration Gender'), '') AS "p_subscriber_gender"
                        , COALESCE (NULLIF(p_pi.subscriber_state,'Migration State'), '') AS "p_subscriber_state"
                        , COALESCE (NULLIF(p_pi.subscriber_zipcode, 'Migration ZipCode'), '') AS "p_subscriber_zipCode"
                        , COALESCE (NULLIF(p_pi.subscriber_zipcode_plus, 'Migration ZipPlus'), '') AS "p_subscriber_zipcode_plus"

                        , COALESCE (NULLIF(s_pi.subscriber_address_line1 , 'Migration Address'), '') AS "s_subscriber_addressLine1"
                        , COALESCE (NULLIF(s_pi.subscriber_city , 'Migration City'), '') AS "s_subscriber_city"
                        , s_pi.subscriber_dob::text AS "s_subscriber_dob"
                        , COALESCE (NULLIF(s_pi.subscriber_firstname, ''), '')  AS "s_subscriber_firstName"
                        , COALESCE (NULLIF(s_pi.subscriber_middlename, ''), '')  AS "s_subscriber_middleName"
                        , COALESCE (NULLIF(s_pi.subscriber_name_suffix, ''), '')  AS "s_subscriber_suffixName"
                        , COALESCE (NULLIF(s_pi.subscriber_lastname, ''), '') AS "s_subscriber_lastName"
                        , COALESCE (NULLIF(s_pi.subscriber_gender, 'Migration Gender'), '') AS "s_subscriber_gender"
                        , COALESCE (NULLIF(s_pi.subscriber_state,'Migration State') , '') AS "s_subscriber_state"
                        , COALESCE (NULLIF(s_pi.subscriber_zipcode , 'Migration ZipCode'),'') AS "s_subscriber_zipCode"
                        , COALESCE (NULLIF(s_pi.subscriber_zipcode_plus , 'Migration ZipPlus'),'') AS "s_subscriber_zipPlus"

                        , COALESCE (NULLIF(t_pi.subscriber_address_line1, 'Migration Address'),'') AS "t_subscriber_addressLine1"
                        , COALESCE (NULLIF(t_pi.subscriber_city, 'Migration City'),'') AS "t_subscriber_city"
                        , t_pi.subscriber_dob::text AS "t_subscriber_dob"
                        , COALESCE (NULLIF(t_pi.subscriber_firstname, ''), '')  AS "t_subscriber_firstName"
                        , COALESCE (NULLIF(t_pi.subscriber_middlename, ''), '')  AS "t_subscriber_middleName"
                        , COALESCE (NULLIF(t_pi.subscriber_name_suffix, ''), '')  AS "t_subscriber_suffixName"
                        , COALESCE (NULLIF(t_pi.subscriber_lastname, ''), '') AS "t_subscriber_lastName"
                        , COALESCE (NULLIF(t_pi.subscriber_gender, 'Migration Gender'), '') AS "t_subscriber_gender"
                        , COALESCE (NULLIF(t_pi.subscriber_state , 'Migration State'), '') AS "t_subscriber_state"
                        , COALESCE (NULLIF(t_pi.subscriber_zipcode , 'Migration ZipCode'), '') AS "t_subscriber_zipCode"
                        , COALESCE (NULLIF(t_pi.subscriber_zipcode_plus , 'Migration ZipPlus'), '') AS "t_subscriber_zipPlus"
                        , (SELECT array_agg(row_to_json(pointer)) AS charge_pointer FROM (
                            SELECT ch.id, pointer1, claim_id, cpt.ref_code, cpt.display_description FROM billing.charges ch INNER JOIN public.cpt_codes cpt ON ch.cpt_id = cpt.id WHERE ch.claim_id = bc.id
                                                ) pointer) AS charge_pointer
                        , lower(prs.description) = ('self') AS is_pri_relationship_self
                        , lower(srs.description) = ('self') AS is_sec_relationship_self
                        , lower(trs.description) = ('self') AS is_ter_relationship_self`;

                        if (params.billingRegionCode === 'can_BC') {
                            sql.append(SQL`, ref_pc.can_prid AS "referring_pro_practitioner_number"
                            , rend_pc.can_prid AS "reading_pro_practitioner_number"
                            , bp.can_bc_data_centre_number AS "billing_pro_data_centre_number"
                            , bp.can_bc_payee_number AS "billing_pro_payeeNumber" `);
                        }

                            sql.append(SQL` FROM
						billing.claims bc
					INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
					INNER JOIN public.patients p ON p.id = bc.patient_id
					LEFT JOIN public.provider_contacts ref_pc ON ref_pc.id = bc.referring_provider_contact_id
					LEFT JOIN public.provider_contacts rend_pc ON rend_pc.id = bc.rendering_provider_contact_id
					LEFT JOIN public.providers ref_pr ON ref_pr.id = ref_pc.provider_id
					LEFT JOIN public.providers rend_pr ON rend_pr.id = rend_pc.provider_id
					LEFT JOIN public.places_of_service pos ON pos.id = bc.place_of_service_id
					LEFT JOIN public.ordering_facility_contacts pofc ON pofc.id = bc.ordering_facility_contact_id
					LEFT JOIN public.ordering_facilities pof ON pof.id = pofc.ordering_facility_id
					LEFT JOIN billing.claim_patient_insurances bci ON bci.claim_id = bc.id AND bci.coverage_level = 'primary'
					LEFT JOIN billing.claim_patient_insurances bsi ON bsi.claim_id = bc.id AND bsi.coverage_level = 'secondary'
					LEFT JOIN billing.claim_patient_insurances bti ON bti.claim_id = bc.id AND bti.coverage_level = 'tertiary'
					LEFT JOIN public.patient_insurances p_pi on p_pi.id = bci.patient_insurance_id
					LEFT JOIN public.patient_insurances s_pi on s_pi.id = bsi.patient_insurance_id
					LEFT JOIN public.patient_insurances t_pi on t_pi.id = bti.patient_insurance_id
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
						WHERE bc.id = ANY(${params.claim_ids})`);


        return await query(sql);
    },

    getClaimData: async (params) => {
        let {
            claimIds,
            payerId,
            payerType,
            companyCode
        } = params || {};

        claimIds = claimIds.split(',');
        payerId = payerId || null;
        payerType = payerType || null;
        companyCode = companyCode?.toUpperCase() || '';

        let sql = SQL`
            SELECT
                relationship_status.description AS subscriber_relationship
                , claims.id AS claim_id
                , insurance_name
                , ins_coverage_level.coverage_level
                , ${isMobileBillingEnabled} AS is_mobile_billing_enabled
                , (
                    SELECT
                        (row_to_json(header)) "header"
                    FROM (
                        SELECT
                            billing.edi_clearinghouses.id
                            , et.name AS edi_template_name
                            , communication_info->'securityInformationQualifier' AS "authInfoQualifier"
                            , communication_info->'authorizationInformation' AS "authInfo"
                            , communication_info->'securityInformationQualifier' AS "securityInfoQualifier"
                            , communication_info->'securityInformation' AS "securityInfo"
                            , communication_info->'interchangeSenderIdQualifier' AS "interchangeSenderIDQualifier"
                            , communication_info->'interchangeSenderId' AS "interchangeSenderID"
                            , communication_info->'interchangeReceiverIdQualifier' AS "interchangeReceiverIDQualifier"
                            , communication_info->'interchangeReceiverId' AS "interchangeReceiverID"
                            , communication_info->'interchangeControlStandardsIdentifier' AS "interchangeCtrlStdIdentifier"
                            , communication_info->'implementationConventionRef' AS "implementationConventionRef"
                            , nextval('billing.interchange_control_no_seq') AS "interchangeCtrlNo"
                            , communication_info->'interchangeControlVersionNumber' AS "interchangeCtrlVersionNo"
                            , CASE communication_info->'acknowledgementRequested'
                                WHEN 'true' THEN '0'
                                WHEN 'false' THEN '1'
                              END AS "acqRequested"
                            , communication_info->'usageIndicator' AS "usageIndicator"
                            , 'HC' AS "functionalIDCode"
                            , communication_info->'applicationSenderCode' AS "applicationSenderCode"
                            , communication_info->'applicationReceiverCode' AS "applicationReceiverCode"
                            , communication_info->'repetitionSeparator' AS "repetitionSeparator"
                            , communication_info->'securityInformation' AS "securityInformation"
                            , communication_info->'segmentTerminator' AS "SEGMENT_TERMINATOR"
                            , communication_info->'elementDelimiter' AS "ELEMENT_DELIMITER"
                            , communication_info->'segmentDelimiter' AS "SUB_ELEMENT_DELIMITER"
                            , communication_info->'backupRootFolder' AS "backupRootFolder"
                            , communication_info->'usageIndicator' AS "usageIndicator"
                            , to_char(now(), 'YYYYMMDD') AS "fgDate"
                            , to_char(now(), 'HH24MI') AS "fgTime"
                            , claims.id AS "groupControlNo"
                            , communication_info->'responsibleAgencyCode' AS "responsibleAgencyCode"
                            , communication_info->'verRelIndIdCode' AS "verReleaseIDCode"
                            , communication_info->'enable_ftp' AS "enableFtp"
                            , communication_info->'ftp_host' AS "ftpHostName"
                            , communication_info->'ftp_port' AS "ftpPort"
                            , communication_info->'ftp_user_name' AS "ftpUserName"
                            , communication_info->'ftp_password' AS "ftpPassword"
                            , communication_info->'ftp_type' AS "ftpType"
                            , communication_info->'ftp_sent_folder' AS "ftpSentFolder"
                            , communication_info->'ftp_receive_folder' AS "ftpReceiveFolder"
                            , communication_info->'ftp_identity_file' AS "ftpIdentityFile"
                            , communication_info->'ftp_readyTimeout' AS "ftpReadyTimeout"
                            , '837' AS "tsIDCode"
                            , '0001' AS "tsControlNo"
                            , edi_clearinghouses.name AS clearinghouses_name
                            , edi_clearinghouses.code AS clearinghouses_code
                            , edi_clearinghouses.receiver_name AS clearinghouses_receiver_name
                            , edi_clearinghouses.receiver_id AS clearinghouses_receiver_id
                            , edi_clearinghouses.edi_file_ext AS edi_file_extension
                            , communication_info->'sftp_edi_file_ext' AS sftp_edi_file_extension
                        FROM billing.edi_clearinghouses
                        LEFT JOIN billing.edi_templates et ON et.id = billing.edi_clearinghouses.edi_template_id
                        WHERE billing.edi_clearinghouses.id = insurance_provider_details.clearing_house_id
                    ) AS header
                  )
                , (
                    SELECT
                        json_agg(row_to_json(data1)) "data"
                    FROM (
                        WITH cte_billing_providers AS (
                            SELECT
                                (row_to_json(billingProvider1)) "billingProvider"
                            FROM (
                                SELECT
                                    bp.id AS "billingProviderID"
                                    , bp.taxonomy_code AS "taxonomyCode"
                                    , UPPER(bp.name) AS "lastName"
                                    , bp.npi_no AS "npiNo"
                                    , bp.short_description AS "description"
                                    , bp.address_line1 AS "addressLine1"
                                    , bp.address_line2 AS "addressLine2"
                                    , bp.city AS "city"
                                    , bp.state AS "state"
                                    , bp.zip_code AS "zipCode"
                                    , bp.federal_tax_id AS "federalTaxID"
                                    , bp.phone_number AS "phoneNo"
                                    , bp.email AS "email"
                                    , bp.fax_number AS "faxNumber"
                                    , bp.zip_code_plus AS "zip_code_plus"
                                    , UPPER(bp.contact_person_name) AS "contactName"
                                    , bp_id_codes.qualifier_code AS "legacyID"
                                    , bp_id_codes.payer_assigned_provider_id AS "payerAssignedProviderID"
                                FROM billing.providers bp
                                LEFT JOIN LATERAL (
                                    SELECT
                                        qualifier_code
                                        , payer_assigned_provider_id
                                    FROM billing.provider_id_code_qualifiers
                                    LEFT JOIN billing.provider_id_codes ON provider_id_code_qualifiers.id = provider_id_codes.qualifier_id
                                    WHERE provider_id_codes.billing_provider_id = bp.id
                                        AND provider_id_codes.insurance_provider_id = insurance_providers.id
                                ) AS bp_id_codes ON TRUE
                                WHERE bp.id = CASE
                                                WHEN 'QMI' = ${companyCode} AND bp_data.billing_provider_npi IS NOT NULL
                                                THEN bp_data.billing_provider_id
                                                ELSE claims.billing_provider_id
                                            END
                            ) AS billingProvider1
                        )
                        , cte_pay_to_providers AS (
                            SELECT
                                (row_to_json(billingProvider)) "payToProvider"
                            FROM (
                                SELECT
                                    id AS "payToProviderID"
                                    , UPPER(billing_providers.name) AS "lastName"
                                    , UPPER(billing_providers.name) AS "firstName"
                                    , npi_no AS "npiNo"
                                    , billing_providers.short_description AS "description"
                                    , pay_to_address_line1 AS "addressLine1"
                                    , pay_to_address_line2 AS "addressLine2"
                                    , pay_to_city AS "city"
                                    , pay_to_state AS "state"
                                    , pay_to_zip_code AS "zipCode"
                                    , pay_to_zip_code_plus AS "zipCodePlus"
                                    , federal_tax_id AS "federalTaxID"
                                    , pay_to_phone_number AS "phoneNo"
                                    , UPPER(contact_person_name) AS "contactName"
                                FROM billing.providers AS billing_providers
                                WHERE billing_providers.id = claims.billing_provider_id
                            ) AS billingProvider
                        )
                        , cte_subscriber AS (
                            SELECT
                                json_agg(row_to_json(subscriber)) subscriber
                            FROM (
                                SELECT
                                    CASE ins_coverage_level.coverage_level
                                        WHEN 'primary' THEN 'P'
                                        WHEN 'secondary' THEN 'S'
                                        WHEN 'tertiary' THEN 'T'
                                    END AS "claimResponsibleParty"
                                    , (
                                        SELECT
                                            (CASE UPPER(description)
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
                                        FROM relationship_status
                                        WHERE subscriber_relationship_id = relationship_status.id
                                      ) AS relationship
                                    , policy_number AS "policyNo"
                                    , pi.group_name AS "planName"
                                    , group_number AS "groupNumber"
                                    , CASE
                                        WHEN ins_coverage_level.coverage_level = 'secondary'
                                        THEN pi.medicare_insurance_type_code
                                        ELSE ''
                                      END AS "insuranceTypeCode"
                                    , insurance_provider_details.claim_filing_indicator_code AS "claimFilingCode"
                                    , insurance_provider_details.is_name_required AS "isNameRequired"
                                    , insurance_provider_details.is_signature_required AS "isSignatureRequired"
                                    , insurance_provider_details.is_print_billing_provider_address AS "isPrintBillingProviderAddress"
                                    , insurance_provider_details.is_split_claim_enabled AS "isSplitClaimEnabled"
                                    , UPPER(subscriber_firstname) AS "firstName"
                                    , UPPER(subscriber_lastname) AS "lastName"
                                    , UPPER(subscriber_middlename) AS "middleName"
                                    , UPPER(subscriber_name_suffix) AS "suffix"
                                    , '' AS "prefix"
                                    , subscriber_address_line1 AS "addressLine1"
                                    , subscriber_address_line2 AS "addressLine2"
                                    , subscriber_city AS "city"
                                    , subscriber_state AS "state"
                                    , subscriber_zipcode AS "zipCode"
                                    , subscriber_zipcode_plus AS "zipCodePlus"
                                    , home_phone_number AS "phoneNumber"
                                    , assign_benefits_to_patient AS "acceptAssignment"
                                    , subscriber_dob::TEXT AS "dob"
                                    , to_char(subscriber_dob, 'YYYYMMDD') AS "dobFormat"
                                    , CASE subscriber_gender
                                        WHEN 'Male' THEN 'M'
                                        WHEN 'Female' THEN 'F'
                                        WHEN 'Unknown' THEN 'U'
                                        WHEN 'Others' THEN 'O'
                                        ELSE subscriber_gender
                                      END AS gender
                                    , (
                                        SELECT
                                            (row_to_json(payer)) payer
                                        FROM (
                                            SELECT
                                                UPPER(insurance_name) AS "payerName"
                                                , insurance_info->'PayerID' AS "payerID"
                                                , insurance_info->'Address1' AS "insuranceprovideraddressline1"
                                                , insurance_info->'Address2' AS "insuranceprovideraddressline2"
                                                , insurance_info->'City' "payerCity"
                                                , insurance_info->'State' "payerState"
                                                , insurance_info->'ZipCode' "payerZIPCode"
                                                , insurance_info->'PhoneNo' AS "phoneNo"
                                                , insurance_info->'ZipPlus' AS "zipPlus"
                                                , insurance_provider_payer_types.code AS "providerTypeCode"
                                                , insurance_provider_payer_types.description AS "providerTypeDescription"
                                        ) AS payer
                                      )
                                    , (
                                        SELECT
                                            json_agg(row_to_json(patient)) "patient"
                                        FROM (
                                            SELECT
                                                patients.id AS patient_id
                                                , UPPER(last_name) AS "lastName"
                                                , UPPER(first_name) AS "firstName"
                                                , UPPER(middle_name) AS "middleName"
                                                , UPPER(suffix_name) AS "suffix"
                                                , account_no AS "accountNumber"
                                                , patient_info->'c1AddressLine1' AS "addressLine1"
                                                , patient_info->'c1AddressLine2' AS "addressLine2"
                                                , patient_info->'c1City' AS "city"
                                                , patient_info->'c1State' AS "state"
                                                , patient_info->'c1Zip' AS "zipCode"
                                                , patient_info->'c1ZipPlus' AS "zipPlus"
                                                , patient_info->'c1HomePhone' AS "homePhone"
                                                , patient_info->'c1WorkPhone' AS "workPhone"
                                                , patient_info->'licenseNo' AS "licenseNo"
                                                , patient_info->'employerFax' AS "employer_fax"
                                                , patient_info->'employerName' AS "employer_name"
                                                , patient_info->'employerPhone' AS "employer_phone"
                                                , patient_info->'employerAddress' AS "employer_address"
                                                , concat( patient_info->'employerCity',' ', patient_info->'employerState',' ', patient_info->'employerZip' ) AS "employerAddressDet"
                                                , get_issuer_details(patients.id, 'uli_phn') AS phn_details
                                                , birth_date::TEXT AS dob
                                                , date_part('year', age(date(timezone(facilities.time_zone,claim_dt)), birth_date)::interval) AS age
                                                , to_char(birth_date, 'YYYYMMDD') AS "dobFormat"
                                                , (
                                                    CASE gender
                                                        WHEN 'Male' THEN 'M'
                                                        WHEN 'Female' THEN 'F'
                                                        WHEN 'Unknown' THEN 'U'
                                                        WHEN 'Others' THEN 'O'
                                                        ELSE gender
                                                    END
                                                ) AS gender
                                                , (
                                                    SELECT
                                                        CASE UPPER(description)
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
                                                        END
                                                    FROM relationship_status
                                                    WHERE subscriber_relationship_id = relationship_status.id
                                                ) AS relationship
                                        ) AS patient
                                      )
                                    , (
                                        SELECT
                                            json_agg(row_to_json(claim)) "claim"
                                        FROM (
                                            SELECT
                                                claims.id AS "claimNumber"
                                                , order_details.study_id IS NOT NULL AS "hasStudyReference"
                                                , insurance_split_details.is_primary_ins_split_enabled AS "isInsuranceSplitEnabled"
                                                , bdr.code AS "delayReasonCode"
                                                , order_details.order_id AS "orderId"
                                                , frequency AS "claimFrequencyCode"
                                                , UPPER(facilities.facility_name) AS facility_name
                                                , facilities.can_mb_wcb_number
                                                , facilities.facility_info
                                                , bgcp.charges_bill_fee_total::NUMERIC::TEXT AS "claimTotalCharge"
                                                , bgcp.payment_insurance_total::NUMERIC::TEXT AS "claimPaymentInsurance"
                                                , bgcp.payment_ordering_facility_total::NUMERIC::TEXT AS "claimPaymentOrderingFacility"
                                                , bgcp.payment_ordering_provider_total::NUMERIC::TEXT AS "claimPaymentProvider"
                                                , bgcp.adjustment_ordering_facility_total::NUMERIC::TEXT AS "claimAdjustmentOrderingFacility"
                                                , bgcp.adjustment_ordering_provider_total::NUMERIC::TEXT AS "claimAdjustmentProvider"
                                                , bgcp.payment_patient_total::NUMERIC::TEXT AS "claimPaymentPatient"
                                                , bgcp.payments_applied_total::NUMERIC::TEXT AS "claimPaymentTotal"
                                                , (
                                                    SELECT
                                                        pos.code
                                                    FROM places_of_service pos
                                                    WHERE pos.id = claims.place_of_service_id
                                                  ) AS "POS"
                                                , to_char(date(timezone(facilities.time_zone,claim_dt)), 'YYYYMMDD') AS "claimDate"
                                                , date(timezone(facilities.time_zone,claim_dt))::TEXT AS "claimDt"
                                                , is_employed AS "relatedCauseCode1"
                                                , is_other_accident AS "relatedCauseCode2"
                                                , is_auto_accident AS "relatedCauseCode3"
                                                , accident_state AS "autoAccidentState"
                                                , current_illness_date::date AS "illnessDate"
                                                , service_by_outside_lab AS "outSideLab"
                                                , account_no AS "accountNumber"
                                                , claims.billing_type AS "billingType"
                                                , (
                                                    SELECT
                                                        display_description
                                                    FROM billing.charges
                                                    INNER JOIN cpt_codes ON cpt_codes.id = cpt_id
                                                    WHERE claims.id = charges.claim_id
                                                        AND display_description ILIKE '%MAMMO%'
                                                    LIMIT 1
                                                  ) AS "mammoStudyDescription"
                                                , to_char(current_illness_date, 'YYYYMMDD') AS "illnessDateFormat"
                                                , authorization_no AS "authorizationNo"
                                                , auth_no.service_line_auth_no AS "serviceLineAuthNo"
                                                , original_reference AS "originalReference"
                                                , patient_info->'c1State' AS "state"
                                                , facility_info->'facility_mammoLicenseId' AS "mammoCertificationNO"
                                                , claim_notes AS "claimNotes"
                                                , same_illness_first_date::TEXT AS "sameIllnessFirstDate"
                                                , to_char(same_illness_first_date, 'YYYYMMDD') AS "sameIllnessFirstDateFormat"
                                                , unable_to_work_from_date::TEXT AS "unableToWorkFromDate"
                                                , to_char(unable_to_work_from_date, 'YYYYMMDD') AS "unableToWorkFromDateFormat"
                                                , unable_to_work_to_date::TEXT AS "unableToWorkToDate"
                                                , to_char(unable_to_work_to_date, 'YYYYMMDD') AS "unableToWorkToDateFormat"
                                                , hospitalization_from_date::TEXT AS "hospitalizationFromDate"
                                                , to_char(hospitalization_from_date, 'YYYYMMDD') AS "hospitalizationFromDateFormat"
                                                , hospitalization_to_date::TEXT AS "hospitalizationToDate"
                                                , to_char(hospitalization_to_date, 'YYYYMMDD') AS "hospitalizationToDateFormat"
                                                , pof.state_license_number AS "stateLicenseNo"
                                                , pof.clia_number AS "cliaNumber"
                                                , pof.taxonomy_code AS "serviceFacilityTaxonomyCode"
                                                , CASE ins_coverage_level.coverage_level
                                                    WHEN 'primary' THEN 'P'
                                                    WHEN 'secondary' THEN 'S'
                                                    WHEN 'tertiary' THEN 'T'
                                                  END AS "claimResponsibleParty"
                                                , (
                                                    SELECT
                                                        jsonb_agg(row_to_json(payerpaidAmount)) "payerpaidAmount"
                                                    FROM (
                                                        SELECT
                                                            primary_paid_total AS "primaryPaidTotal"
                                                            , primary_adj_total AS "primaryAdjTotal"
                                                            , secondary_paid_total AS "secondaryPaidTotal"
                                                            , secondary_adj_total AS "secondaryAdjTotal"
                                                        FROM billing.get_payer_claim_payments(claims.id)
                                                    ) AS payerpaidAmount
                                                  )
                                                , (
                                                    SELECT json_agg(row_to_json(icd)) "icd"
                                                    FROM (
                                                        SELECT
                                                            icd_id
                                                            , code
                                                            , description
                                                            , CASE code_type
                                                                WHEN 'icd9' THEN '0'
                                                                WHEN 'icd10' THEN '1'
                                                              END AS code_type
                                                        FROM billing.claim_icds ci
                                                        INNER JOIN icd_codes ON icd_codes.id = ci.icd_id
                                                        WHERE ci.claim_id = claims.id
                                                        ORDER BY ci.id
                                                    ) AS icd
                                                  )
                                                , bp_data.billing_provider_npi AS "billingProviderNPI"
                                                , (
                                                    SELECT
                                                        jsonb_agg(rendering_provider_default) "renderingProviderDefault"
                                                    FROM billing.get_claim_provider_data (
                                                        claims.id
                                                        , 'default'
                                                        , order_details.study_id
                                                    ) AS rendering_provider_default
                                                    WHERE rendering_provider_default IS NOT NULL
                                                  )
                                                , (
                                                    SELECT
                                                        jsonb_agg(rendering_provider_claim) "renderingProviderClaim"
                                                    FROM billing.get_claim_provider_data(
                                                        claims.id
                                                        , 'rendering_provider_claim'
                                                        , order_details.study_id
                                                    ) AS rendering_provider_claim
                                                    WHERE rendering_provider_claim IS NOT NULL
                                                  )
                                                , (
                                                    SELECT
                                                        jsonb_agg(rendering_provider_facility) "renderingProviderFacility"
                                                    FROM billing.get_claim_provider_data(
                                                        claims.id
                                                        , 'rendering_provider_facility'
                                                        , order_details.study_id
                                                    ) AS rendering_provider_facility
                                                    WHERE rendering_provider_facility IS NOT NULL
                                                  )
                                                , (
                                                    SELECT
                                                        jsonb_agg(rendering_provider_study) AS "renderingProviderStudy"
                                                    FROM billing.get_claim_provider_data(
                                                        claims.id
                                                        , 'rendering_provider_study'
                                                        , order_details.study_id
                                                    ) AS rendering_provider_study
                                                    WHERE rendering_provider_study IS NOT NULL
                                                  )
                                                , (
                                                    SELECT
                                                        JSONB_AGG(servicefacility) "servicefacility"
                                                    FROM (
                                                        SELECT
                                                            public.get_claim_service_facility_address(
                                                                claims.id
                                                                , CASE
                                                                    WHEN ${companyCode} = 'QMI'
                                                                    THEN pmap.more_info -> 'pos_dispatching_address'
                                                                    ELSE claims.pos_map_code
                                                                  END
                                                                , claims.patient_id
                                                            ) AS servicefacility
                                                    ) AS servicefacility
                                                  )
                                                , (
                                                    SELECT
                                                        jsonb_agg(approving_provider) "approvingProvider"
                                                    FROM billing.get_claim_provider_data(
                                                        claims.id,
                                                        'approving_provider',
                                                        order_details.study_id
                                                    ) AS approving_provider
                                                    WHERE order_details.study_status IN ('APP', 'APCD')
                                                        AND approving_provider IS NOT NULL
                                                  )
                                                , (
                                                    SELECT
                                                        json_agg(referring_provider) "referringProvider"
                                                    FROM billing.get_claim_provider_data(
                                                        claims.id,
                                                        'referring_provider',
                                                        order_details.study_id
                                                    ) AS referring_provider
                                                    WHERE referring_provider IS NOT NULL
                                                  )
                                                -- Other Subscriber/Payer Information Starts --
                                                -- Primary payer needs secondary payer(insurance)'s details and payments if available.
                                                -- Secondary payer needs primary payer(insurance)'s details and payments if available.
                                                -- Tertiary payer needs secondary payer(insurance)'s details and payments if avaialble.
                                                -- So for current responsible party of the claim, Other Subscriber/Payer's data will be Previous Payers' payment details
                                                , (
                                                    SELECT
                                                        json_agg(row_to_json(otherSubscriber)) "otherSubscriber"
                                                    FROM (
                                                        SELECT
                                                            UPPER(subscriber_firstname) AS "lastName"
                                                            , UPPER(subscriber_firstname) AS "firstName"
                                                            , CASE ins_coverage_level.coverage_level
                                                                WHEN 'primary' THEN 'S'
                                                                WHEN 'secondary' THEN 'P'
                                                                WHEN 'tertiary' THEN 'S' -- for tertiary insurance provider claims, the secondary insurance's payment details were encoded
                                                              END AS "otherClaimResponsibleParty"
                                                            , (
                                                                SELECT
                                                                    CASE UPPER(description)
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
                                                                    END
                                                                FROM relationship_status
                                                                WHERE subscriber_relationship_id = relationship_status.id
                                                              ) AS relationship
                                                            , policy_number AS "policyNo"
                                                            , patient_insurances.group_name AS "groupName"
                                                            , group_number AS "groupNumber"
                                                            , other_ins_details.claim_filing_indicator_code AS "claimFilingCode"
                                                            , medicare_insurance_type_code AS "insuranceTypeCode"
                                                            , UPPER(subscriber_firstname) AS "firstName"
                                                            , UPPER(subscriber_lastname) AS "lastName"
                                                            , UPPER(subscriber_middlename) AS "middleName"
                                                            , UPPER(subscriber_name_suffix) AS "suffix"
                                                            , '' AS "prefix"
                                                            , subscriber_address_line1 AS "addressLine1"
                                                            , subscriber_address_line2 AS "addressLine2"
                                                            , subscriber_city AS "city"
                                                            , subscriber_state AS "state"
                                                            , subscriber_zipcode AS "zipCode"
                                                            , subscriber_zipcode_plus AS "zipCodePlus"
                                                            , subscriber_zipcode_plus AS "zipPlus"
                                                            , home_phone_number AS "phoneNumber"
                                                            , assign_benefits_to_patient AS "acceptAssignment"
                                                            , subscriber_dob::TEXT AS "dob"
                                                            , to_char(subscriber_dob, 'YYYYMMDD') AS "dobFormat"
                                                            , CASE ins_coverage_level.coverage_level
                                                                WHEN 'primary' THEN 'P'
                                                                WHEN 'secondary' THEN 'S'
                                                                WHEN 'tertiary' THEN 'T'
                                                              END AS "claimResponsibleParty"
                                                            , (
                                                                SELECT
                                                                    json_agg(row_to_json(payerpaidAmount)) "payerpaidAmount"
                                                                FROM (
                                                                    SELECT
                                                                        primary_paid_total AS "primaryPaidTotal"
                                                                        , primary_adj_total AS "primaryAdjTotal"
                                                                        , secondary_paid_total AS "secondaryPaidTotal"
                                                                        , secondary_adj_total AS "secondaryAdjTotal"
                                                                    FROM billing.get_payer_claim_payments(claims.id)
                                                                ) AS payerpaidAmount
                                                              )
                                                              , (
                                                                SELECT
                                                                    json_agg(row_to_json(claimAdjustment)) "claimAdjustment"
                                                                FROM (
                                                                    SELECT
                                                                        cas_group_codes.code AS "adjustmentGroupCode"
                                                                        , (
                                                                            SELECT
                                                                                json_agg(row_to_json(CAS)) AS caslist
                                                                            FROM (
                                                                                SELECT
                                                                                    DISTINCT cas_reason_codes.code AS "reasonCode"
                                                                                    , SUM(cas_payment_application_details.amount)::NUMERIC::TEXT AS amount
                                                                                FROM billing.cas_payment_application_details
                                                                                INNER JOIN billing.cas_group_codes gc ON gc.id = cas_group_code_id
                                                                                INNER JOIN billing.cas_reason_codes ON cas_reason_codes.id = cas_reason_code_id
                                                                                INNER JOIN billing.payment_applications ON payment_applications.id = cas_payment_application_details.payment_application_id
                                                                                INNER JOIN billing.charges bch ON bch.id = payment_applications.charge_id
                                                                                INNER JOIN billing.payments ON
                                                                                    billing.payments.id = payment_applications.payment_id
                                                                                    AND payer_type = 'insurance'
                                                                                    AND bch.claim_id = claims.id
                                                                                    AND payment_applications.amount_type = 'adjustment'
                                                                                WHERE cas_group_codes.code = gc.code
                                                                                AND payments.insurance_provider_id NOT IN (
                                                                                    SELECT
                                                                                        insurance_provider_id
                                                                                    FROM public.patient_insurances
                                                                                    WHERE id = ANY(ARRAY[claim_ins.tertiary_patient_insurance_id, claim_ins.secondary_patient_insurance_id])
                                                                                        AND insurance_provider_id <> payments.insurance_provider_id
                                                                                )
                                                                                GROUP BY cas_reason_codes.code
                                                                            ) AS CAS
                                                                          )
                                                                    FROM billing.cas_payment_application_details
                                                                    INNER JOIN billing.cas_group_codes ON cas_group_codes.id = cas_group_code_id
                                                                    INNER JOIN billing.payment_applications ON payment_applications.id = cas_payment_application_details.payment_application_id
                                                                    INNER JOIN billing.charges bch1 ON bch1.id = payment_applications.charge_id
                                                                    INNER JOIN billing.payments
                                                                        ON billing.payments.id = payment_applications.payment_id
                                                                            AND payer_type = 'insurance'
                                                                            AND bch1.claim_id = claims.id
                                                                            AND payment_applications.amount_type = 'adjustment'
                                                                    GROUP BY cas_group_codes.code
                                                                ) AS claimAdjustment
                                                              )
                                                        FROM patient_insurances
                                                        LEFT JOIN billing.insurance_provider_details other_ins_details
                                                            ON other_ins_details.insurance_provider_id = patient_insurances.insurance_provider_id
                                                        WHERE patient_insurances.id =
                                                            CASE COALESCE(${payerType}, payer_type)
                                                                WHEN 'primary_insurance' THEN claim_ins.secondary_patient_insurance_id
                                                                WHEN 'secondary_insurance' THEN claim_ins.primary_patient_insurance_id
                                                                WHEN 'tertiary_insurance' THEN claim_ins.secondary_patient_insurance_id
                                                            END
                                                    ) AS otherSubscriber
                                                  )
                                                , (
                                                    SELECT
                                                        json_agg(row_to_json(OtherPayer)) "OtherPayer"
                                                    FROM (
                                                        SELECT
                                                            UPPER(insurance_name) AS "name"
                                                            , insurance_info->'PayerID' AS "payerID"
                                                            , insurance_info->'Address1' AS "addressLine1"
                                                            , insurance_info->'Address2' AS "addressLine2"
                                                            , insurance_info->'City' AS "city"
                                                            , insurance_info->'State' AS "state"
                                                            , insurance_info->'ZipCode' AS "zipCode"
                                                            , insurance_info->'ZipPlus' AS "zipCodePlus"
                                                            , insurance_info->'PhoneNo' AS "phoneNo"
                                                            , insurance_info->'ZipPlus' AS "zipPlus"
                                                            , pippt.code AS "providerTypeCode"
                                                            , pippt.description AS "providerTypeDescription"
                                                            , ipd.claim_filing_indicator_code
                                                        FROM patient_insurances
                                                        INNER JOIN insurance_providers ON insurance_providers.id = insurance_provider_id
                                                        LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = insurance_providers.provider_payer_type_id
                                                        INNER JOIN billing.insurance_provider_details ipd ON ipd.insurance_provider_id = insurance_providers.id
                                                        WHERE patient_insurances.id =
                                                            CASE COALESCE(${payerType}, payer_type)
                                                                WHEN 'primary_insurance' THEN claim_ins.secondary_patient_insurance_id
                                                                WHEN 'secondary_insurance' THEN claim_ins.primary_patient_insurance_id
                                                                WHEN 'tertiary_insurance' THEN claim_ins.secondary_patient_insurance_id
                                                            END
                                                    ) AS OtherPayer
                                                  )
                                                -- Other Subscriber/Payer Information Ends --
                                                , (
                                                    SELECT
                                                        json_agg(row_to_json(serviceLine)) "serviceLine"
                                                    FROM (
                                                        SELECT
                                                            display_code AS "examCpt"
                                                            , modifier1.code AS "mod1"
                                                            , modifier2.code AS "mod2"
                                                            , modifier3.code AS "mod3"
                                                            , modifier4.code AS "mod4"
                                                            , authorization_no AS "authorizationNo"
                                                            , allowed_amount::NUMERIC::TEXT AS "allowedAmount"
                                                            , (allowed_amount*charges.units)::NUMERIC::TEXT AS "totalAllowedAmount"
                                                            , charges.id AS "chargeID"
                                                            , display_description AS "studyDescription"
                                                            , ndc.package_code AS NDCCode
                                                            , cn.unit_measure AS NDCUnit
                                                            , cn.needle_gauge AS NDCMeasure
                                                            , bill_fee::NUMERIC::TEXT AS "billFee"
                                                            , (bill_fee*charges.units)::NUMERIC::TEXT AS "totalBillFee"
                                                            , charges.units AS "unit"
                                                            , date(timezone(facilities.time_zone,charge_dt))::TEXT AS "studyDt"
                                                            , to_char(date(timezone(facilities.time_zone,charge_dt)), 'YYYYMMDD') AS "studyDate"
                                                            , pointer1 AS "pointer1"
                                                            , pointer2 AS "pointer2"
                                                            , pointer3 AS "pointer3"
                                                            , pointer4 AS "pointer4"
                                                            , pof.clia_number AS "cliaNumber"
                                                            , study_details.accession_no AS "accessionNumber"
                                                            , study_details.body_part
                                                            , (
                                                                SELECT
                                                                    json_agg(row_to_json(lineAdjudication)) "lineAdjudication"
                                                                FROM (
                                                                    SELECT
                                                                        display_code AS "cpt"
                                                                        , to_char(max(payments.accounting_date), 'YYYYMMDD') AS "accountingDt"
                                                                        , charges.id AS "chargeID"
                                                                        , insurance_info->'PayerID' AS "claimPayerID"
                                                                        -- Other Subscriber/Payer's Payment/Adjustment details at charge level --
                                                                        , (
                                                                            SELECT insurance_info->'PayerID'
                                                                            FROM patient_insurances p_pi
                                                                            INNER JOIN insurance_providers ON insurance_providers.id = insurance_provider_id
                                                                            WHERE p_pi.id =
                                                                                CASE COALESCE(${payerType}, claims.payer_type)
                                                                                    WHEN 'primary_insurance' THEN claim_ins.secondary_patient_insurance_id
                                                                                    WHEN 'secondary_insurance' THEN claim_ins.primary_patient_insurance_id
                                                                                    WHEN 'tertiary_insurance' THEN claim_ins.secondary_patient_insurance_id
                                                                                END
                                                                          ) AS "payerID"
                                                                        , CASE ins_coverage_level.coverage_level
                                                                            WHEN 'primary' THEN 'P'
                                                                            WHEN 'secondary' THEN 'S'
                                                                            WHEN 'tertiary' THEN 'T'
                                                                          END AS "claimResponsibleParty"
                                                                        , modifier1.code AS "modifier1"
                                                                        , modifier2.code AS "modifier2"
                                                                        , modifier3.code AS "modifier3"
                                                                        , modifier4.code AS "modifier4"
                                                                        , COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'payment'),0::money)::NUMERIC::TEXT AS "cptPaymentTotal"
                                                                        , COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'payment' AND payer_type = 'insurance'),0::money)::NUMERIC::TEXT AS "paidAmount"
                                                                        , COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'payment' AND payer_type = 'ordering_provider'),0::money)::NUMERIC::TEXT AS "cptPaymentProvider"
                                                                        , COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'payment' AND payer_type = 'ordering_facility'),0::money)::NUMERIC::TEXT AS "cptPaymentOrderingFacility"
                                                                        , COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'adjustment' AND payer_type = 'ordering_provider'),0::money)::NUMERIC::TEXT AS "cptAdjustmentProvider"
                                                                        , COALESCE(sum(pa.amount) FILTER (WHERE pa.amount_type = 'adjustment' AND payer_type = 'ordering_facility'),0::money)::NUMERIC::TEXT AS "cptAdjustmentOrderingFacility"
                                                                        , charges.units AS "unit"
                                                                        , (
                                                                            SELECT
                                                                                json_agg(row_to_json(lineAdjustment)) "lineAdjustment"
                                                                            FROM (
                                                                                SELECT
                                                                                    cas_group_codes.code AS "adjustmentGroupCode"
                                                                                    , (
                                                                                        SELECT
                                                                                            json_agg(row_to_json(CAS)) AS caslist
                                                                                        FROM (
                                                                                            SELECT
                                                                                                cas_reason_codes.code AS "reasonCode"
                                                                                                , SUM(cas_payment_application_details.amount)::NUMERIC::TEXT AS amount
                                                                                            FROM billing.cas_payment_application_details
                                                                                            INNER JOIN billing.cas_group_codes gc ON gc.id = cas_group_code_id
                                                                                            INNER JOIN billing.cas_reason_codes ON cas_reason_codes.id = cas_reason_code_id
                                                                                            INNER JOIN billing.payment_applications ON payment_applications.id = cas_payment_application_details.payment_application_id
                                                                                            INNER JOIN billing.payments ON
                                                                                                billing.payments.id = payment_applications.payment_id
                                                                                                AND payer_type = 'insurance'
                                                                                                AND payment_applications.charge_id = charges.id
                                                                                                AND payment_applications.amount_type = 'adjustment'
                                                                                            WHERE cas_group_codes.code = gc.code
                                                                                            AND payments.insurance_provider_id NOT IN (
                                                                                                SELECT
                                                                                                    insurance_provider_id
                                                                                                FROM public.patient_insurances
                                                                                                WHERE id = ANY(ARRAY[claim_ins.tertiary_patient_insurance_id, claim_ins.secondary_patient_insurance_id])
                                                                                                    AND insurance_provider_id <> payments.insurance_provider_id
                                                                                            )
                                                                                            GROUP BY cas_reason_codes.code
                                                                                        ) AS CAS
                                                                                      )
                                                                                FROM billing.cas_payment_application_details
                                                                                INNER JOIN billing.cas_group_codes ON cas_group_codes.id = cas_group_code_id
                                                                                INNER JOIN billing.payment_applications ON payment_applications.id = cas_payment_application_details.payment_application_id
                                                                                INNER JOIN billing.payments
                                                                                    ON billing.payments.id = payment_applications.payment_id
                                                                                        AND payer_type = 'insurance'
                                                                                        AND payment_applications.charge_id = charges.id
                                                                                        AND payment_applications.amount_type = 'adjustment'
                                                                                GROUP BY cas_group_codes.code
                                                                            ) AS lineAdjustment
                                                                          )
                                                                    FROM billing.payment_applications pa
                                                                    INNER JOIN billing.payments ON billing.payments.id = pa.payment_id
                                                                    WHERE charge_id = charges.id
                                                                    AND payments.insurance_provider_id NOT IN (
                                                                        SELECT insurance_provider_id
                                                                        FROM public.patient_insurances
                                                                        WHERE id = ANY(ARRAY[claim_ins.tertiary_patient_insurance_id, claim_ins.secondary_patient_insurance_id])
                                                                        AND insurance_provider_id <> payments.insurance_provider_id)
                                                                ) AS lineAdjudication
                                                              )
                                                        FROM billing.charges
                                                        INNER JOIN cpt_codes ON cpt_codes.id = cpt_id
                                                        LEFT JOIN modifiers AS modifier1 ON modifier1.id = modifier1_id
                                                        LEFT JOIN modifiers AS modifier2 ON modifier2.id = modifier2_id
                                                        LEFT JOIN modifiers AS modifier3 ON modifier3.id = modifier3_id
                                                        LEFT JOIN modifiers AS modifier4 ON modifier4.id = modifier4_id
                                                        LEFT JOIN billing.charges_ndc AS cn ON cn.charge_id = charges.id
                                                        LEFT JOIN national_drug_codes ndc ON ndc.id = cn.ndc_id
                                                        LEFT JOIN LATERAL (
                                                            SELECT
                                                                s.accession_no
                                                                , s.body_part
                                                            FROM public.studies s
                                                            INNER JOIN billing.charges_studies AS cs ON cs.study_id = s.id
                                                            WHERE cs.charge_id = charges.id
                                                            ORDER BY s.id
                                                        ) AS study_details ON TRUE
                                                        WHERE claim_id = claims.id
                                                        AND NOT charges.is_excluded
                                                        ORDER BY charges.id ASC
                                                    ) AS serviceLine
                                                  )
                                            ) AS claim
                                      )
                            ) AS subscriber
                        )
                        SELECT
                            claims.id
                            , insurance_providers.insurance_code AS insurance_provider_code
                            , *
                        FROM
                            cte_billing_providers
                            , cte_pay_to_providers
                            , cte_subscriber
                    ) AS data1
                )
            FROM billing.claims
            INNER JOIN LATERAL billing.get_claim_payments(claims.id, true) bgcp ON TRUE
            INNER JOIN facilities ON facilities.id=claims.facility_id
            INNER JOIN patients ON patients.id=claims.patient_id
            LEFT JOIN billing.providers bprov ON bprov.id = claims.billing_provider_id
            LEFT JOIN billing.delay_reasons bdr ON bdr.id = claims.delay_reason_id `
        sql.append(getClaimPatientInsurances('claims'))
            .append(SQL`
            LEFT JOIN LATERAL (
                SELECT
                    CASE COALESCE(${payerType}, payer_type)
                        WHEN 'primary_insurance' THEN 'primary'
                        WHEN 'secondary_insurance' THEN 'secondary'
                        WHEN 'tertiary_insurance' THEN 'tertiary'
                        END AS coverage_level
            ) AS ins_coverage_level ON TRUE
            LEFT JOIN patient_insurances pi ON pi.id = (
                CASE COALESCE(${payerType}, payer_type)
                    WHEN 'primary_insurance' THEN claim_ins.primary_patient_insurance_id
                    WHEN 'secondary_insurance' THEN claim_ins.secondary_patient_insurance_id
                    WHEN 'tertiary_insurance' THEN claim_ins.tertiary_patient_insurance_id
                END
            )
            LEFT JOIN insurance_providers ON insurance_providers.id = insurance_provider_id
            LEFT JOIN billing.insurance_provider_details ON insurance_provider_details.insurance_provider_id = insurance_providers.id
            LEFT JOIN relationship_status ON subscriber_relationship_id = relationship_status.id
            LEFT JOIN public.insurance_provider_payer_types ON insurance_provider_payer_types.id = insurance_providers.provider_payer_type_id
            LEFT JOIN public.ordering_facility_contacts pofc ON pofc.id = claims.ordering_facility_contact_id
            LEFT JOIN public.ordering_facilities pof ON pof.id = pofc.ordering_facility_id
            LEFT JOIN public.pos_map pmap ON pmap.id = pof.pos_map_id
            LEFT JOIN (
                SELECT
                    ARRAY_AGG(cc.display_code)::TEXT[] AS cpt_array
                    , bch.claim_id
                    , ARRAY_AGG(studies.modality_code) AS mod_array
                FROM billing.charges bch
                INNER JOIN billing.charges_studies bcs ON bcs.charge_id = bch.id
                INNER JOIN public.cpt_codes cc ON cc.id = bch.cpt_id
                INNER JOIN (
                    SELECT
                        id
                        , (SELECT modality_code FROM modalities WHERE modalities.id = s.modality_id)
                    FROM public.studies s
                ) studies ON studies.id = bcs.study_id
                GROUP BY claim_id
            ) bp_charges ON bp_charges.claim_id = claims.id
            LEFT JOIN LATERAL (
                SELECT
                    bpr_code[1] AS bpr_code
                    , bpr_code[2] AS bpr_state
                    , bpr_code[3] AS bpr_modality
                    , bprov.npi_no AS billing_provider_npi
                FROM string_to_array(bprov.code, ' ') bpr_code
                WHERE
                    bpr_code[3] = 'US' AND facilities.facility_info->'facility_state' = bpr_code[2]
                    AND insurance_provider_details.claim_filing_indicator_code = 'MB'
                    AND (ARRAY['93306', '93308'] && bp_charges.cpt_array)
            ) bpr_data ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    MAX(ip.insurance_code) FILTER (WHERE coverage_level = 'primary' AND ipd.claim_filing_indicator_code = 'MB') AS pri_ins_code,
                    MAX(ip.insurance_code) FILTER (WHERE coverage_level = 'secondary' AND ipd.claim_filing_indicator_code = 'MC') AS sec_ins_code
                FROM patient_insurances pi
                LEFT JOIN insurance_providers ip ON ip.id = pi.insurance_provider_id
                LEFT JOIN billing.insurance_provider_details ipd ON ipd.insurance_provider_id = ip.id
                WHERE
                    pi.id IN (claim_ins.primary_patient_insurance_id, claim_ins.secondary_patient_insurance_id)
            ) ins_details ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    ipd.is_split_claim_enabled AS is_primary_ins_split_enabled
                FROM patient_insurances pi
                LEFT JOIN insurance_providers ip ON ip.id = pi.insurance_provider_id
                LEFT JOIN billing.insurance_provider_details ipd ON ipd.insurance_provider_id = ip.id
                WHERE
                    pi.id = claim_ins.primary_patient_insurance_id
            ) AS insurance_split_details ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    bpr.id AS billing_provider_id
                    , bpr.npi_no AS billing_provider_npi
                    , bpr_fac.npi_no AS fac_billing_provider_npi
                FROM billing.providers bpr
                LEFT JOIN billing.facility_settings bfs ON bfs.facility_id = claims.facility_id
                LEFT JOIN billing.providers bpr_fac ON bpr_fac.id = bfs.default_provider_id
                WHERE
                    CASE
                        WHEN 'QMI' != ${companyCode}
                        THEN bpr.id = claims.billing_provider_id
                        ELSE
                            CASE
                                WHEN ins_coverage_level.coverage_level = 'primary'
                                THEN
                                    CASE
                                        WHEN bpr_data.billing_provider_npi IS NOT NULL
                                        THEN bpr.id = claims.billing_provider_id
                                        ELSE bpr.id = bfs.default_provider_id
                                    END
                                WHEN ins_coverage_level.coverage_level = 'secondary'
                                THEN
                                    CASE
                                        WHEN facilities.facility_code = 'QAZU' AND bprov.code = 'QMI AZ US'
                                            AND '370' = ins_details.pri_ins_code AND '368' = ins_details.sec_ins_code
                                        THEN bpr.id = (SELECT id FROM billing.providers WHERE code = 'QMI AZ')
                                        WHEN facilities.facility_code = 'QIDU' AND bprov.code = 'QMI ID US'
                                            AND '1435' = ins_details.pri_ins_code AND '1850' = ins_details.sec_ins_code
                                        THEN bpr.id = (SELECT id FROM billing.providers WHERE code = 'QMI ID')
                                        WHEN facilities.facility_code = 'QNVU' AND bprov.code = 'QMI NV US'
                                            AND '348' = ins_details.pri_ins_code AND '351' = ins_details.sec_ins_code
                                        THEN bpr.id = (SELECT id FROM billing.providers WHERE code = 'QMI NV')
                                        WHEN facilities.facility_code = 'QUTU' AND bprov.code = 'QMI UT US'
                                            AND '347' = ins_details.pri_ins_code AND '350' = ins_details.sec_ins_code
                                        THEN bpr.id = (SELECT id FROM billing.providers WHERE code = 'QMI UT')
                                        WHEN facilities.facility_code = 'QWAU' AND bprov.code = 'QMI WA US'
                                            AND '812' = ins_details.pri_ins_code AND '18392' = ins_details.sec_ins_code
                                        THEN bpr.id = (SELECT id FROM billing.providers WHERE code = 'QMI WA')
                                        ELSE bpr.id = claims.billing_provider_id
                                    END
                                ELSE bpr.id = claims.billing_provider_id
                            END
                    END
            ) bp_data ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    bch.authorization_no AS service_line_auth_no
                FROM
                    billing.charges bch
                INNER JOIN cpt_codes
                    ON cpt_codes.id = bch.cpt_id
                WHERE
                    bch.claim_id = claims.id
                    AND NOT bch.is_excluded
                    AND bch.authorization_no IS NOT NULL
                ORDER BY
                    bch.id ASC
                LIMIT 1
            ) AS auth_no ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    s.order_id
                    , s.id AS study_id
                    , s.reading_physician_id
                    , s.study_status AS study_status
                    , o.order_info->'pos_type_code' AS pos
                FROM
                    public.studies s
                INNER JOIN billing.charges_studies AS cs ON cs.study_id = s.id
                INNER JOIN billing.charges AS c on c.id = cs.charge_id
                INNER JOIN public.orders o ON o.id = s.order_id
                WHERE
                    c.claim_id = claims.id
                ORDER BY s.order_id
                LIMIT 1
            ) AS order_details ON TRUE
            WHERE claims.id= ANY(${claimIds})
        `);

        return await query(sql);
    },
};
