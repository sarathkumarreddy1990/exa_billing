
DO
$$
DECLARE
      l_company_id BIGINT := 1; -- Default company_id
      l_new_adjustment_code BIGINT;
      l_user_id BIGINT; -- need to remove for o help the migration
      l_recoup_id BIGINT;
      l_max_claim_id BIGINT;
      l_max_payment_id BIGINT;
BEGIN
-- -------------------------------------------------------------------------------------------------------------
 RAISE NOTICE 'Start migration...';

 SET CONSTRAINTS ALL DEFERRED;   -- let the migration go faster and apply constraints later during commit
-- -------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.migration_log
(
    id BIGINT NOT NULL GENERATED ALWAYS AS IDENTITY,
	table_name TEXT NOT NULL,
	migration_dt TIMESTAMPTZ NOT NULL,
    CONSTRAINT migration_log_pk PRIMARY KEY (id),
	CONSTRAINT migration_log_table_name_uc UNIQUE (table_name)
);
-- -------------------------------------------------------------------------------------------------------------
-- Adding old referencce column as "old_id" in every table until end of the migration Then end of the
-- script we will drop "old_id" columns .
-- -------------------------------------------------------------------------------------------------------------
      RAISE NOTICE 'Creating Reference columns for migration';
-- -------------------------------------------------------------------------------------------------------------

      ALTER TABLE IF EXISTS billing.edi_clearinghouses ADD COLUMN IF NOT EXISTS old_id BIGINT;
      ALTER TABLE IF EXISTS billing.edi_templates ADD COLUMN IF NOT EXISTS old_id BIGINT;
      ALTER TABLE IF EXISTS billing.edi_template_rules ADD COLUMN IF NOT EXISTS old_id BIGINT;
      ALTER TABLE IF EXISTS billing.adjustment_codes ADD COLUMN IF NOT EXISTS old_id BIGINT;
      ALTER TABLE IF EXISTS billing.billing_codes ADD COLUMN IF NOT EXISTS old_id BIGINT;
      ALTER TABLE IF EXISTS billing.billing_classes ADD COLUMN IF NOT EXISTS old_id BIGINT;

      ALTER TABLE IF EXISTS billing.printer_templates ADD COLUMN IF NOT EXISTS old_id BIGINT;
      ALTER TABLE IF EXISTS billing.providers ADD COLUMN IF NOT EXISTS old_id BIGINT;
      ALTER TABLE IF EXISTS billing.provider_id_codes ADD COLUMN IF NOT EXISTS old_id BIGINT;
      ALTER TABLE IF EXISTS billing.claims ADD COLUMN IF NOT EXISTS old_id BIGINT;
      ALTER TABLE IF EXISTS billing.charges ADD COLUMN IF NOT EXISTS old_id BIGINT;
      ALTER TABLE IF EXISTS billing.payments ADD COLUMN IF NOT EXISTS old_id BIGINT;
      ALTER TABLE IF EXISTS billing.payment_applications ADD COLUMN IF NOT EXISTS old_ord_pymt_id BIGINT;
      ALTER TABLE IF EXISTS billing.payment_applications ADD COLUMN IF NOT EXISTS  old_pymt_recon_id BIGINT;

-- -------------------------------------------------------------------------------------------------------------
      RAISE NOTICE 'Creating Support Functions for migration';
-- -------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_modifier_id(TEXT)
RETURNS public.modifiers.id % TYPE
AS
$BODY$
    SELECT id FROM public.modifiers WHERE code = $1;
$BODY$
LANGUAGE sql;
-- -------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_paper_claim_or_invoice_json_for_migration (INPUT CHARACTER VARYING [ ])
RETURNS jsonb
AS $begin$
DECLARE
    counter INTEGER := 0;
    b_json TEXT;
    RESULT jsonb;
    arr_len INTEGER;
    CHECK TEXT;
BEGIN
    arr_len := array_length(INPUT,1);
IF (arr_len < 1) THEN
    RETURN RESULT;
END IF;
WHILE counter < arr_len LOOP
    counter := counter + 1;
IF counter = 1 THEN
    b_json := '[{"field":"' || INPUT [ counter ] || '","enabled":"true"},';
ELSE
    b_json := b_json || '{"field":"' || INPUT [ counter ] || '","enabled":"true"},';
END IF;
END LOOP;
    b_json := rtrim(b_json,',');
    b_json := b_json || ']';
    RESULT := (b_json)::jsonb;
    RETURN RESULT;
END;
$begin$
LANGUAGE plpgsql;
-- ------------------------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_charge_created_by(BIGINT,BIGINT)
 RETURNS BIGINT
AS
$BODEY$
    SELECT comment_by::bigint from public.payment_comments where study_cpt_id = $1 and order_id = $2 and has_deleted is null order by comment_dt desc limit 1;
$BODEY$
LANGUAGE sql;
-- -------------------------------------------------------------------------------------------------------------
      RAISE NOTICE 'Setup Tables Migration Started';
-- -------------------------------------------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 from users where username = 'newbilling') THEN
      INSERT INTO public.users(username, salt, password, first_name, last_name)
      VALUES ('newbilling','$2a$08$7AS7v7MysGrHdMtvVQ6JP.','$2a$08$7AS7v7MysGrHdMtvVQ6JP.ixfir6dljxGqN/khFWMoy/a9zT7kpJ2','newbilling','newbilling') returning id into l_user_id;
ELSE
      SELECT id into l_user_id from users where username = 'newbilling';
END IF;
-- -------------------------------------------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'edi_clearinghouses') THEN

RAISE NOTICE 'billing.edi_clearinghouses...';

INSERT INTO billing.edi_clearinghouses
(
    old_id,
    company_id,
    inactivated_dt,
    name,
    code,
    receiver_name,
    receiver_id,
    communication_info
)
SELECT
    id as old_id,
    company_id,
    CASE WHEN is_active is false THEN
        now()
    ELSE
        NULL
    END AS inactivated_dt,
    description,
    code,
    receiver_name,
    receiver_id,
    to_json(more_info)
From public.edi_clearinghouses
WHERE NOT has_deleted;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('edi_clearinghouses',now());
ELSE
      RAISE NOTICE 'Billing.edi_clearinghouses table migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'edi_templates') THEN

RAISE NOTICE 'billing.edi_templates...';

INSERT INTO billing.edi_templates
(
    old_id,
    company_id,
    inactivated_dt,
    name,
    code,
    template_type,
    hipaa_version,
    template_info
)
SELECT
    id as old_id,
    company_id ,
    CASE WHEN is_active is false THEN
        now()
    ELSE
        NULL
    END AS inactivated_dt,
    display_code,
    template_code,
    lower(transaction_type),
    hipaa_version,
    template_mapped_xml::xml
From public.edi_request_templates;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('edi_templates',now());
ELSE
      RAISE NOTICE 'Billing.edi_templates table migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'edi_template_rules') THEN

RAISE NOTICE 'billing.edi_template_rules...';

INSERT INTO billing.edi_template_rules
(
    old_id,
    edi_template_id,
    element_id,
    segment_id,
    action_type,
    rules_info,
    contains_sub_segment
)
SELECT
    ertr.id as old_id,
    et.id,
    ertr.element_id,
    trim(ertr.segment_uid)
	|| CASE
            WHEN row_number() OVER (w1) > 1 THEN (' - duplicate - ' || row_number() OVER (w1)::text)
            ELSE ''
         END
         AS segment_id,
    lower(trim(regexp_replace(action_type, E'[\\n\\r]+', ' ', 'g' ))) AS action_type,
    ertr.rules,
    (CASE WHEN ertr.sub_element_id = -1 THEN TRUE ELSE false END) AS contains_sub_segment
From public.edi_request_template_rules ertr
INNER JOIN billing.edi_templates et ON et.old_id = ertr.edi_request_template_id
WINDOW
    w1 AS (PARTITION BY (et.id, ertr.element_id, trim(ertr.segment_uid)))
ORDER BY
    id;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('edi_template_rules',now());
ELSE
      RAISE NOTICE 'Billing.edi_template_rules table migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'edi_template_translations') THEN

RAISE NOTICE 'billing.edi_template_translations...';

INSERT INTO billing.edi_template_translations
(
    edi_template_id,
    name,
    translation_info
)
SELECT
    et.id,
    ett.translation_name,
    ett.translation_info
From public.edi_template_translations ett,billing.edi_templates et order by ett.id;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('edi_template_translations',now());
ELSE
      RAISE NOTICE 'Billing.edi_template_translations table migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'adjustment_codes') THEN

RAISE NOTICE 'billing.adjustment_codes...';

INSERT INTO billing.adjustment_codes
(
    old_id,
    company_id,
    inactivated_dt,
    code ,
    description,
    accounting_entry_type
)
SELECT
    id,
    company_id,
    CASE WHEN is_active is false THEN
        now()
    ELSE
        null
    END,
    code,
    description,
    'credit'
From public.adjustment_codes WHERE
    type = 'ADJCDE' and
	has_deleted is not true ;
-- ---------------------------------------------------------------------------------------------------------
INSERT INTO billing.adjustment_codes
(
    old_id,
    company_id,
    inactivated_dt,
    code ,
    description,
    accounting_entry_type
)
SELECT
    id,
    company_id,
    CASE WHEN is_active is false THEN
        now()
    ELSE
        null
    END,
    code,
    description,
    'refund_debit'
From public.adjustment_codes WHERE
    type = 'REFADJ' and
	has_deleted is not true ;
-- ---------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.adjustment_codes where code = 'RECOUP') THEN
INSERT INTO billing.adjustment_codes(company_id,inactivated_dt,code ,description,accounting_entry_type)
VALUES (l_company_id,null,'RECOUP','Recoupment','recoupment_debit') ;
END IF;
-- ---------------------------------------------------------------------------------------------------------
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('adjustment_codes',now());
ELSE
      RAISE NOTICE 'Billing.adjustment_codes table migration already finished';
END IF;
-- ---------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'billing_codes') THEN

RAISE NOTICE 'billing.billing_codes...';

INSERT INTO billing.billing_codes
(
    old_id,
    company_id,
    inactivated_dt,
    code,
    description
)
SELECT
    id as old_id,
    company_id,
    CASE WHEN is_active is false THEN
        now()
    ELSE
        null
    END,
    code,
    description
From public.adjustment_codes WHERE
    type = 'BILCDE' and
    has_deleted is not true;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('billing_codes',now());
ELSE
      RAISE NOTICE 'Billing.billing_codes table migration already finished';
END IF;
-- --------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'billing_classes') THEN

RAISE NOTICE 'billing.billing_classes...';

INSERT INTO billing.billing_classes
(
    old_id,
    company_id,
    inactivated_dt,
    code,
    description
)
SELECT
    id as old_id,
    company_id,
    CASE WHEN is_active is false THEN
        now()
    ELSE
        null
    END,
    code,
    description
From public.adjustment_codes WHERE
    type = 'BILCLS' and
    has_deleted is not true;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('billing_classes',now());
ELSE
      RAISE NOTICE 'Billing.billing_classes table migration already finished';
END IF;
-- --------------------------------------------------------------------------------------------------------
-- Claim status migration finished while creating a table
-- --------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'printer_templates') THEN

RAISE NOTICE 'billing.printer_templates..';

INSERT INTO billing.printer_templates
(
    old_id,
    company_id,
    left_margin,
    right_margin,
    top_margin,
    bottom_margin,
    inactivated_dt,
    name,
    page_width,
    page_height,
    template_type,
    template_content
)
SELECT
	id as old_id,
    l_company_id,
    (template_info ->'left')::NUMERIC,
    (template_info ->'right')::NUMERIC,
    (template_info ->'top')::NUMERIC,
    (template_info ->'bottom')::NUMERIC,
    CASE WHEN is_active is false THEN
        current_date
	else
        null
    END,
    template_info ->'printerName',
    0,
    0,
    'paper_claim_full',
    'var dd = { content: "Test Data" }'
FROM public.paper_claim_templates
where 1=2; -- Not required, this is part of updates.sql
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('printer_templates',now());
ELSE
      RAISE NOTICE 'Billing.paper_claim_printer_setup table migration already finished';
END IF;
-- --------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'providers') THEN

RAISE NOTICE 'billing.providers..';

INSERT INTO billing.providers
(
    old_id,
    company_id,
    inactivated_dt,
    name,
    code,
    short_description,
    federal_tax_id,
    npi_no,
    taxonomy_code,
    contact_person_name,
    address_line1,
    address_line2,
    city,
    state,
    zip_code,
    zip_code_plus,
    email,
    phone_number,
    fax_number,
    web_url,
    pay_to_address_line1,
    pay_to_address_line2,
    pay_to_city,
    pay_to_state,
    pay_to_zip_code,
    pay_to_zip_code_plus,
    pay_to_email,
    pay_to_phone_number,
    pay_to_fax_number,
    communication_info
)
SELECT
    bp.id as old_id,
    bp.company_id,
    CASE WHEN bp.is_active IS false THEN
        current_date
	ELSE
        null
    END,
    bp.full_name,
    bp.code,
    bp.short_description,
    bp.more_info ->'federal_tax_id',
    bp.npi_no,
    substring(coalesce(nullif(trim(bp.more_info ->'taxonomy_code'),''),'193200000X'),1,10),
    bp.more_info ->'contact_name',
    bp.more_info ->'address1',
    bp.more_info ->'address2',
    bp.more_info ->'city',
    bp.more_info ->'state',
    bp.more_info ->'zip',
    bp.more_info ->'zip_plus',
    bp.more_info ->'email',
    bp.more_info ->'phoneno',
    bp.more_info ->'fax',
    bp.more_info ->'web_url',
    CASE WHEN more_info->'is_pay_to_provider' = 'true' THEN
        c.company_info->'company_address1'
    ELSE
        'Migration Data'
	END,
    CASE WHEN more_info->'is_pay_to_provider' = 'true' THEN
        c.company_info->'company_address2'
    ELSE
        'Migration Data'
    END,
    CASE WHEN more_info->'is_pay_to_provider' = 'true' THEN
        c.company_info->'company_city'
    ELSE
        'Migration Data'
    END,
    CASE WHEN more_info->'is_pay_to_provider' = 'true' THEN
        c.company_info->'company_state'
    ELSE
        'Migration Data'
    END,
    CASE WHEN more_info->'is_pay_to_provider' = 'true' THEN
        c.company_info->'company_zip'
    ELSE
        'Migration Data'
    END,
    '',
    CASE WHEN more_info->'is_pay_to_provider' = 'true' THEN
        c.company_info->'company_email'
    ELSE
        'Migration Data'
    END,
    '',
    CASE WHEN more_info->'is_pay_to_provider' = 'true' THEN
        c.company_info->'company_contactNo'
    ELSE
        'Migration Data'
    END,
    json_build_object('Ftp_user_name',coalesce(bp.more_info->'FtpUserName',''),
                      'Ftp_password',coalesce(bp.more_info->'FtpPassword',''),
                      'Ftp_receive_folder',coalesce(bp.more_info->'FtpReceiveFolder',''),
                      'Ftp_host',coalesce(bp.more_info->'FtpHost',''),
                      'Ftp_identity_file',coalesce(bp.more_info->'FtpIdentityFile',''),
                      'Ftp_type',coalesce(bp.more_info->'FtpType',''),
                      'Ftp_sent_folder',coalesce(bp.more_info->'FtpSentFolder',''))
FROM public.billing_providers bp
INNER JOIN public.companies c on c.id = bp.company_id;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('providers',now());
ELSE
      RAISE NOTICE 'Billing.providers table migration already finished';
END IF;
-- --------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'provider_id_codes') THEN

RAISE NOTICE 'billing.provider_id_codes ..';

INSERT INTO billing.provider_id_codes
(
    qualifier_id,
    billing_provider_id,
    insurance_provider_id,
    payer_assigned_provider_id,
	old_id
)
SELECT
    pcq.id,
    p.id,
    insurance_provider_id,
    payer_assigned_provider_id,
	bpc.id
FROM billing_provider_id_codes bpc
INNER JOIN billing.providers p on p.old_id = bpc.billing_provider_id
INNER JOIN billing.provider_id_code_qualifiers pcq on pcq.qualifier_code = bpc.id_code_qualifier;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('provider_id_codes',now());
ELSE
      RAISE NOTICE 'Billing.provider_id_codes table migration already finished';
END IF;
-- --------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'payment_reasons') THEN

RAISE NOTICE 'billing.payment_reasons ..';

WITH reports(data) AS
(
	SELECT payment_reasons From public.companies
)
INSERT INTO billing.payment_reasons(company_id, code,description)
SELECT
	l_company_id,
	REPLACE((value ->'reason')::text,'"',''),
	REPLACE((value -> 'description')::text,'"','')
FROM   reports r, json_array_elements(r.data#>'{payment_reason}') obj;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('payment_reasons',now());
ELSE
      RAISE NOTICE 'Billing.payment_reasons table migration already finished';
END IF;
-----------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'insurance_provider_details') THEN

INSERT INTO billing.insurance_provider_details (
 insurance_provider_id,
  clearing_house_id,
  billing_method
)
WITH clearing_houses  as
( SELECT id, (old_id)::TEXT old_id FROM billing.edi_clearinghouses )
SELECT
 insurance_providers.id  INSURANCE_provider_id,
 ch.id clearing_house_id,
 CASE WHEN insurance_info-> 'billingMethod' = 'PP' THEN
             'patient_payment'
         WHEN insurance_info-> 'billingMethod' = 'EB' THEN
             'electronic_billing'
         WHEN insurance_info-> 'billingMethod' = 'DB' THEN
             'direct_billing'
         WHEN insurance_info-> 'billingMethod' = 'PC' THEN
             'paper_claim'
    ELSE
        null
    END billing_method
from insurance_providers
LEFT JOIN clearing_houses ch ON ch.old_id = TRIM(insurance_info-> 'claimClearingHouse');
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('insurance_provider_details',now());
ELSE
      RAISE NOTICE 'Billing.insurance_provider_details table migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
-- Claims module migration script
-- -------------------------------------------------------------------------------------------------------------
      RAISE NOTICE 'Claims Migration Started';
-- -------------------------------------------------------------------------------------------------------------
 -- Data fix for payer is facility or ordering physician
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'claims') THEN

RAISE NOTICE 'Claims1';

UPDATE
    claims c
SET
    claim_info = claim_info || hstore (ARRAY [ 'payer',
        'payer_id',
        'payer_type','payer_name'],
        ARRAY [ CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
            'Insurance'
          ELSE
            'Patient'
          END,
          CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
              (SELECT insurance_provider_id FROM patient_insuarances WHERE id = o.insurance_provider_ids [ 1 ])::text
           ELSE
              (c.patient_id)::text
           END,
	   CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
                'PIP'
           ELSE
                'PPP'
           END ,
           CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
               (select insurance_name from insurance_providers where id = (SELECT insurance_provider_id FROM patient_insuarances WHERE id = o.insurance_provider_ids [1]))::text
           ELSE
               (SELECT Full_name from patients where id = c.patient_id )::text
           END])
    FROM
        orders o
    WHERE
        o.id = c.order_id
        AND coalesce(c.has_expired, FALSE) IS FALSE
        AND claim_info -> 'payer' IN ('Facility', 'Ordering Physician');
-- -------------------------------------------------------------------------------------------------------------
-- Data fix for Claim having responsible party but Responsible party details removed or deleted
RAISE NOTICE 'Claims2';

UPDATE
    claims c
SET
    claim_info = claim_info || hstore (ARRAY [ 'payer',
        'payer_id',
        'payer_type','payer_name'],
	ARRAY ['Patient',(c.patient_id)::text,'PPP',(SELECT Full_name from patients where id = c.patient_id )::text])
FROM orders o
WHERE o.id = c.order_id
AND NOT coalesce(c.has_expired, FALSE)
AND NOT (CASE claim_info->'payer' WHEN 'Patient'    THEN true
          WHEN 'Insurance'    THEN o.insurance_provider_ids[1] IS NOT NULL
          WHEN 'Primary Insurance'    THEN o.insurance_provider_ids[1] IS NOT NULL
          WHEN 'Secondary Insurance'    THEN o.insurance_provider_ids[2] IS NOT NULL
          WHEN 'Teritary Insurance'    THEN o.insurance_provider_ids[3] IS NOT NULL
          WHEN 'Ordering Facility'    THEN nullif(nullif(o.order_info->'ordering_facility_id',''),'0')::BIGINT IS NOT NULL
          WHEN 'Provider'    THEN nullif(o.referring_provider_ids[1],0) IS NOT NULL
          ELSE false
          END);
-- -------------------------------------------------------------------------------------------------------------
-- Data fix for duplicate claims. Keep the claim with last updated date as live and make other as exprired

RAISE NOTICE 'Claims3';
WITH Dup_claims as
(
    SELECT
	    order_id,
		max(submitted_dt)  as q_submitted_dt
	FROM claims c
    WHERE  1=1
    AND has_expired is null
    GROUP BY order_id
    HAVING count(order_id) >1
)
UPDATE public.claims c
    SET  has_expired = true
FROM Dup_claims
WHERE 1=1
AND c.order_id = Dup_claims.order_id
AND c.submitted_dt != q_submitted_dt;
-- -------------------------------------------------------------------------------------------------------------
-- Data fix for duplicate claims with same submission date/time  other than Electronic Billing
RAISE NOTICE 'Claims4';
WITH Dup_claims as
(
    SELECT
        order_id,
        max(submitted_dt) as q_submitted_dt,
        max(id) as q_claim_id
    FROM public.claims c
    WHERE  1=1
    AND has_expired is null
    AND billing_method != 'EB'
    GROUP BY order_id
    HAVING count(order_id) >1
)
UPDATE public.claims c
    SET  has_expired = true
FROM Dup_claims
WHERE 1=1
AND c.order_id = Dup_claims.order_id
AND c.submitted_dt = q_submitted_dt
AND c.id != q_claim_id;
-- -------------------------------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS temp_providers_v15 on billing.providers(old_id);
CREATE INDEX IF NOT EXISTS temp_patient_insurances_v15 on public.patient_insurances(old_id);
-- ------------------------------------------------------------------------------------------------------------
RAISE NOTICE 'Claims5';

ALTER TABLE billing.claims alter column id set GENERATED BY DEFAULT ;

WITH sub_pend_status as
(
    SELECT id,'RD' as code FROM billing.claim_status WHERE code = 'PS'
),
pymt_pend_status as
(
    SELECT id,'ST' as code FROM billing.claim_status WHERE code = 'PP'
),
patient_insurance_not_matched_in_claim as(
select c.id as claim_id from  claims c
INNER JOIN orders o on o.id = c.order_id
INNER JOIN patient_insuarances pi on pi.id = o.insurance_provider_ids[1]
where 1=1
AND has_expired is null
and  pi.patient_id != c.patient_id
UNION ALL
select c.id as claim_id from  claims c
INNER JOIN orders o on o.id = c.order_id
INNER JOIN patient_insuarances pi on pi.id = o.insurance_provider_ids[2]
where 1=1
AND has_expired is null
and  pi.patient_id != c.patient_id
UNION ALL
select c.id as claim_id from  claims c
INNER JOIN orders o on o.id = c.order_id
INNER JOIN patient_insuarances pi on pi.id = o.insurance_provider_ids[3]
where 1=1
AND has_expired is null
and  pi.patient_id != c.patient_id)
INSERT INTO billing.claims
(
    id,
    company_id,
    facility_id,
    patient_id,
    billing_provider_id,
    rendering_provider_contact_id,
    referring_provider_contact_id,
    primary_patient_insurance_id,
    secondary_patient_insurance_id,
    tertiary_patient_insurance_id,
    ordering_facility_id,
    place_of_service_id,
    claim_status_id,
    billing_code_id,
    billing_class_id,
    claim_dt,
    submitted_dt,
    current_illness_date,
    same_illness_first_date,
    unable_to_work_from_date,
    unable_to_work_to_date,
    hospitalization_from_date,
    hospitalization_to_date,
    payer_type,
    billing_method,
    billing_notes,
    claim_notes,
    original_reference,
    authorization_no,
    frequency,
    invoice_no,
    is_auto_accident,
    is_other_accident,
    is_employed,
    service_by_outside_lab,
    old_id,
    created_by
)
SELECT
    po.id,
    pc.company_id,
    pc.facility_id,
    pc.patient_id,
    bp.id,
    nullif(nullif(po.order_info->'rendering_provider_id',''),'0')::BIGINT,
    nullif(po.referring_provider_ids[1],0),
    ppi.id,
    spi.id,
    tpi.id,
    nullif(nullif(po.order_info->'ordering_facility_id',''),'0')::BIGINT,
    pos.id,
    bcs.id,
    bco.id,
    bcl.id,
    pc.created_dt,
    pc.submitted_dt,
    nullif(po.order_info->'currentDate','')::date,
    nullif(po.order_info->'similarIll','')::date,
    nullif(po.order_info->'wFrom','')::date,
    nullif(po.order_info->'wTo','')::date,
    nullif(po.order_info->'hFrom','')::date,
    nullif(po.order_info->'hTo','')::date,
    CASE WHEN order_info->'payer' = 'Ordering Facility' THEN
             'ordering_facility'
         WHEN order_info->'payer' in ('Insurance','Primary Insurance') THEN
             'primary_insurance'
         WHEN order_info->'payer' = 'Secondary Insurance' THEN
             'secondary_insurance'
         WHEN order_info->'payer' = 'Teritary Insurance' THEN
             'tertiary_insurance'
         WHEN order_info->'payer' = 'Patient' THEN
             'patient'
         WHEN order_info->'payer' = 'Provider' THEN
             'referring_provider'
    END,
    CASE WHEN pc.billing_method = 'PP' THEN
             'patient_payment'
         WHEN pc.billing_method = 'EB' THEN
             'electronic_billing'
         WHEN pc.billing_method = 'DB' THEN
             'direct_billing'
         WHEN pc.billing_method = 'PC' THEN
             'paper_claim'
    ELSE
        null
    END,
    po.order_info->'billing_notes',
    po.order_info->'claim_notes',
    po.order_info->'original_ref',
    po.order_info->'authorization_no',
    CASE WHEN po.order_info->'frequency_code' = '1' THEN
             'original'
         WHEN po.order_info->'frequency_code' = '7' THEN
             'corrected'
         WHEN po.order_info->'frequency_code' = '8' THEN
             'corrected'
    ELSE
        null
    END,
    pc.invoice_no,
    CASE WHEN po.order_info->'aa' = 'true' THEN
        true
    ELSE
        false
    END,
    CASE WHEN po.order_info->'oa' = 'true' THEN
        true
    ELSE
        false
    END,
    CASE WHEN po.order_info->'emp' = 'true' THEN
        true
    ELSE
        false
    END,
    CASE WHEN po.order_info->'outsideLab' = 'true' THEN
        true
    ELSE
        false
    END,
    po.id,
    l_user_id
FROM public.claims pc
INNER JOIN public.orders po on po.id = pc.order_id
INNER JOIN public.facilities f on f.id = po.facility_id
INNER JOIN billing.providers bp on bp.old_id = (coalesce((coalesce(nullif(po.order_info->'billing_provider',''),nullif(facility_info->'billing_provider_id','')))::bigint, '0'))::bigint
INNER JOIN sub_pend_status sps on true
INNER JOIN pymt_pend_status pps on true
INNER JOIN public.adjustment_codes ac on ac.id::TEXT = order_info->'claim_status' AND ac.type =  'CLMSTS'
INNER JOIN billing.claim_status bcs  ON bcs.description = ac.description
LEFT JOIN public.places_of_service pos on pos.code = po.order_info->'pos_type_code'
LEFT JOIN billing.billing_codes bco on bco.code = po.order_info->'billing_code'
LEFT JOIN billing.billing_classes bcl on bcl.code = po.order_info->'billing_class'
LEFT JOIN public.patient_insurances ppi on ppi.old_id = po.insurance_provider_ids[1]
LEFT JOIN public.patient_insurances spi on spi.old_id = po.insurance_provider_ids[2]
LEFT JOIN public.patient_insurances tpi on tpi.old_id = po.insurance_provider_ids[3]
WHERE 1=1
AND coalesce(nullif(pc.billing_method,''),'x')  in ('PP','EB','DB','PC','x')
AND NOT po.is_quick_appt
  AND po.order_type!='E'
AND po.order_status NOT IN ('NOS', 'ABRT', 'ORD', 'CAN' )
AND has_expired is null
AND (po.has_deleted is NULL or po.has_deleted is FALSE )
AND claim_info->'payer' in ('Ordering Facility','Insurance','Primary Insurance','Secondary Insurance','Teritary Insurance','Patient','Provider')
AND pc.claim_status in('RD','ST')
AND (coalesce(ppi.id, -1) != coalesce(spi.id, -2)
AND coalesce(ppi.id, -1)   != coalesce(tpi.id,  -3)
AND coalesce(spi.id, -2) != coalesce(tpi.id, -3))
AND (CASE claim_info->'payer' WHEN 'Patient'    THEN true
          WHEN 'Insurance'    THEN ppi.id IS NOT NULL
          WHEN 'Primary Insurance'    THEN ppi.id IS NOT NULL
          WHEN 'Secondary Insurance'    THEN spi.id IS NOT NULL
          WHEN 'Teritary Insurance'    THEN tpi.id IS NOT NULL
          WHEN 'Ordering Facility'    THEN nullif(nullif(po.order_info->'ordering_facility_id',''),'0')::BIGINT IS NOT NULL
          WHEN 'Provider'    THEN nullif(po.referring_provider_ids[1],0) IS NOT NULL
          ELSE false
          END)
AND  not exists  (select 1 from patient_insurance_not_matched_in_claim where claim_id = pc.id);

-- -------------------------------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS temp_claims_v15 on billing.claims(old_id);

RAISE NOTICE 'Claims6';

WITH upd as
(
    SELECT
        old_id,
        max(study_dt) as study_dt
    FROM billing.claims cl
    INNER JOIN studies s on s.order_id = cl.old_id
    GROUP BY old_id
)
UPDATE billing.claims cl
    SET claim_dt =  upd.study_dt
FROM upd
WHERE cl.old_id = upd.old_id;

RAISE NOTICE '-- Data Correction - Claims';
update billing.claims
set billing_method ='patient_payment'
where payer_type = 'patient'
and  billing_method !='patient_payment';

-------------------------------------------------------------------------------------------------------------
select max(id) into l_max_claim_id from billing.claims;

PERFORM  setval(pg_get_serial_sequence('billing.claims', 'id'), l_max_claim_id +1, false) ;

ALTER TABLE billing.claims alter column id set GENERATED ALWAYS;

-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('claims',now());
ELSE
      RAISE NOTICE 'Billing.claims table migration already finished';
END IF;

-- -----------------------------------------------------------------------------------------------------------
      RAISE NOTICE 'Charges Migration Started';
-- -----------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'charges') THEN
INSERT INTO billing.charges(
    claim_id,
    cpt_id,
    modifier1_id,
    modifier2_id,
    modifier3_id,
    modifier4_id,
    bill_fee,
    allowed_amount,
    units,
    charge_dt,
    created_by,
    pointer1,
    pointer2,
    pointer3,
    pointer4,
    authorization_no,
    old_id
)
SELECT
    ch.id,
    sc.cpt_code_id,
    public.get_modifier_id (sc.study_cpt_info->'modifiers1') as m1,
    public.get_modifier_id (sc.study_cpt_info->'modifiers2') as m2,
    public.get_modifier_id (sc.study_cpt_info->'modifiers3') as m3,
    public.get_modifier_id (sc.study_cpt_info->'modifiers4') as m4,
    coalesce(nullif(sc.study_cpt_info->'bill_fee',''),'0.00')::money as bill_fee,
    coalesce(nullif(sc.study_cpt_info->'allowed_fee',''),'0.00')::money as allowed_fee,
    (coalesce(nullif(sc.study_cpt_info->'units',''),'1.00'))::numeric,
	s.study_dt,
	coalesce(billing.get_charge_created_by(sc.id,sc.order_id),(select id from users where username = 'radmin')),
    (string_to_array (coalesce(replace(replace(replace(sc.study_cpt_info->'diagCodes_pointer', '"', ''),'{',''),'}',''),''),','))[1] as p1,
    (string_to_array (coalesce(replace(replace(replace(sc.study_cpt_info->'diagCodes_pointer', '"', ''),'{',''),'}',''),''),','))[2] as p2,
    (string_to_array (coalesce(replace(replace(replace(sc.study_cpt_info->'diagCodes_pointer', '"', ''),'{',''),'}',''),''),','))[3] as p3,
    (string_to_array (coalesce(replace(replace(replace(sc.study_cpt_info->'diagCodes_pointer', '"', ''),'{',''),'}',''),''),','))[4] as p4,
    (sc.study_cpt_info->'authorization_no'),
    sc.id as old_id
FROM billing.claims ch
INNER JOIN study_cpt sc on sc.order_id =  ch.old_id
INNER JOIN studies s on s.id = sc.study_id
INNER JOIN cpt_codes cpt on cpt.id = sc.cpt_code_id
WHERE 1=1
AND sc.has_deleted IS false
AND s.study_status NOT IN ('NOS','ABRT','CAN')
AND NOT s.has_deleted;

RAISE NOTICE 'Charges Update...';

with charges_qry as (
SELECT id, claim_id, row_number() OVER (PARTITION BY claim_id ORDER BY id) AS rnum
FROM billing.charges
order by id
    )
update billing.charges
set line_num = rnum
from charges_qry
where charges.id = charges_qry.id;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('charges',now());
ELSE
      RAISE NOTICE 'Billing.charges table migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'charges_studies') THEN
RAISE NOTICE 'Charge Studies';

INSERT INTO billing.charges_studies
(
    charge_id,
    study_id
)
SELECT
    ch.id,
    sc.study_id
FROM billing.charges ch
INNER JOIN public.study_cpt sc on sc.id = ch.old_id;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('charges_studies',now());
ELSE
      RAISE NOTICE 'Billing.charges_studies table migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'claim_icds') THEN
RAISE NOTICE 'claim icds';
INSERT INTO billing.claim_icds
(
    claim_id,
    icd_id
)
SELECT
    ch.id,
    unnest(o.icd_code_ids_billing)
FROM billing.claims ch
INNER JOIN orders o on o.id = ch.old_id
WHERE (o.has_deleted is NULL or o.has_deleted is FALSE );
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('claim_icds',now());
ELSE
      RAISE NOTICE 'Billing.claim_icds table migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'claim_followups') THEN
RAISE NOTICE 'Claim follow-ups';

INSERT INTO billing.claim_followups
(
    claim_id,
    assigned_to,
    followup_date
)
SELECT DISTINCT
    ch.id,
    u.id,
    bp.followup_date
FROM public.billing_followup bp
INNER JOIN billing.claims ch on ch.old_id = bp.order_id
INNER JOIN users u on u.id = bp.user_id
WHERE bp.has_deleted is false;

-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('claim_followups',now());
ELSE
      RAISE NOTICE 'Billing.claim_followups table migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'claim_comments') THEN
RAISE NOTICE 'Claim Comments';
INSERT INTO billing.claim_comments
(
    claim_id,
    note,
	type,
    is_internal,
    created_by,
    created_dt
)
SELECT
    c.id,
    CASE more_info->'type'
		WHEN 'Claim management' THEN pc.comment
		WHEN 'new' THEN pc.comment
		WHEN 'co_pay' THEN 'Co pay of '||(coalesce(more_info->'co_pay','$0.00'))::money||'is due'
        WHEN 'co_insurance' THEN 'co-insurance of '||(coalesce(more_info->'co_insurance','$0.00'))::money||'is due'
		WHEN 'deduction' THEN 'deductible of '||(coalesce(more_info->'deduction','$0.00'))::money||'is due'
    END,
	CASE more_info->'type'
	     WHEN 'Claim management' THEN 'auto'
		 WHEN 'new' THEN 'manual'
		 WHEN 'co_pay' THEN 'co_pay'
		 WHEN 'co_insurance' THEN 'co_insurance'
		 WHEN 'deduction' THEN 'deductible'
	END,
    CASE WHEN pc.more_info->'IsReport' = 'true' THEN
        true
    ELSE
        false
    END,
    pc.comment_by,
    pc.comment_dt
FROM public.payment_comments pc
INNER JOIN billing.claims c on c.old_id = pc.order_id
WHERE 1=1
AND more_info->'type' in('Claim management','new','co_pay','co_insurance','deduction')
AND (pc.has_deleted is false or pc.has_deleted is null)
ORDER BY pc.id;
-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('claim_comments',now());
ELSE
      RAISE NOTICE 'Billing.claim_comments table migration already finished';
END IF;



-- -------------------------------------------------------------------------------------------------------------
      RAISE NOTICE 'Payments Migration Started';
-- -------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'payments') THEN
RAISE NOTICE 'Payments1';
-- Data fix for applied amount in payments table
WITH total_applied_amount AS (
SELECT
    payment_id,
    sum(amount_paid) as applied_amount
FROM order_payments
WHERE NOT coalesce(has_deleted,false)
group by payment_id
)
UPDATE payments p
SET
  applied = tam.applied_amount,
  available_balance = (p.amount - tam.applied_amount),
  current_status = CASE WHEN (p.amount = tam.applied_amount) THEN 'Applied'
			WHEN (tam.applied_amount = 0::money) THEN 'UnApplied'
			WHEN (p.amount > tam.applied_amount) THEN 'PartialApplied'
			WHEN (p.amount < tam.applied_amount) THEN 'OverApplied'
	           END
FROM total_applied_amount tam
WHERE
     p.id = tam.payment_id
     AND coalesce(p.has_deleted,FALSE) is false
AND p.current_status != 'Refund';
-- -------------------------------------------------------------------------------------------------------------
RAISE NOTICE 'Payments2';

ALTER TABLE billing.payments alter column id set GENERATED BY DEFAULT ;

INSERT INTO billing.payments
(
    id,
    company_id,
    facility_id,
    alternate_payment_id,
    patient_id,
    insurance_provider_id,
    provider_group_id,
    provider_contact_id,
    payment_reason_id,
    invoice_no,
    accounting_dt,
    amount,
    payer_type,
    notes ,
    mode,
    card_name,
    card_number,
    created_by,
    payment_dt,
    old_id
)
SELECT
    p.id,
    p.company_id,
    CASE when paid_facility_id is null then f.id
    ELSE paid_facility_id END,
    nullif(p.display_id,''),
    nullif(p.patient_id,0),
    CASE WHEN p.payer_type = 'PIP' THEN
        p.payer_id
    ELSE
        null
    END,
    nullif(p.provider_group_id,0),
    nullif(p.provider_id,0),
    pr.id,
    nullif(p.invoice_no,''),
    p.accounting_date,
    p.amount,
    CASE WHEN nullif(p.payer_type,'') = 'PIP' THEN
             'insurance'
         WHEN nullif(p.payer_type,'') = 'PPP' THEN
             'patient'
         WHEN nullif(p.payer_type,'') = 'POF' THEN
             'ordering_facility'
         WHEN nullif(p.payer_type,'') = 'PRP' THEN
             'ordering_provider'
    END,
    nullif(p.payment_info->'notes',''),
    lower(nullif(p.payment_info->'payment_mode','')),
    nullif(p.payment_info->'cheque_card_name',''),
    nullif(p.payment_info->'cheque_card_number',''),
	p.created_by,
	p.payment_date,
    p.id
FROM public.payments p
INNER JOIN users u on u.id = p.created_by
INNER JOIN facilities f on f.id = u.default_facility_id
LEFT JOIN billing.payment_reasons pr on p.payment_info->'reason' = pr.code
WHERE 1=1
AND  coalesce(p.has_deleted,FALSE) is false
AND current_status != 'Refund';

select max(id) into l_max_payment_id
from billing.payments;

PERFORM  setval(pg_get_serial_sequence('billing.payments', 'id'), l_max_payment_id +1, false) ;

ALTER TABLE billing.payments alter column id set GENERATED ALWAYS;

-- Insering a row in migration_log table
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('payments',now());

ELSE
      RAISE NOTICE 'Billing.payments table migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
-- New script for payment applications
-- -------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'payment_applications') THEN

RAISE NOTICE 'Payment applications1';

CREATE TABLE IF NOT EXISTS billing.temp_orders_15
AS
        SELECT o.id  order_id
        FROM  payment_reconciliations pr
	INNER JOIN orders o  on o.id = pr.order_id
	INNER JOIN study_cpt sc on sc.id = pr.study_cpt_id
	INNER JOIN studies s on s.id = sc.study_id
	where 1=1
	    AND NOT pr.has_deleted
	    AND o.order_type != 'E'
	    AND NOT o.has_deleted
	    AND o.order_status NOT IN ('ABRT', 'CAN')
	    AND NOT o.is_quick_appt
	    AND NOT s.has_deleted
	    AND s.study_status NOT IN ('ABRT','CAN')
	    AND sc.has_deleted IS false
	 GROUP BY o.id ;
-- -------------------------------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS temp_orders_15_idx on billing.temp_orders_15(order_id);
-- -------------------------------------------------------------------------------------------------------------

SELECT MAX(id) into l_recoup_id FROM  billing.adjustment_codes where code = 'RECOUP';

RAISE NOTICE 'Payment applications2';
INSERT INTO billing.payment_applications
(
    payment_id,
    charge_id,
    adjustment_code_id,
    amount,
    amount_type,
    created_by,
    old_ord_pymt_id,
    old_pymt_recon_id
)

SELECT
   bp.id payment_id,
   bc.id charge_id,
   NULL  adjustment_code_id,
   sum(coalesce(pr.payment_amount,0::MONEY))  as amount,
   'payment' as amount_type,
   pr.created_by,
   pr.order_payment_id,
   pr.id pr_id
FROM billing.payments bp
INNER JOIN payment_reconciliations pr on pr.payment_id = bp.old_id
INNER JOIN billing.temp_orders_15  to15 on  to15.order_id = pr.order_id
INNER JOIN order_payments op on op.id  = pr.order_payment_id
INNER JOIN billing.charges bc on bc.old_id = pr.study_cpt_id
WHERE 1=1
AND NOT pr.has_deleted
AND NOT op.has_deleted
GROUP BY bp.id,bc.id,pr.order_payment_id,bp.payment_dt,pr.created_by,pr.id
UNION ALL
SELECT
   bp.id payment_id,
   bc.id charge_id,
   CASE WHEN pr.more_info->'is_debit' = 'true' THEN l_recoup_id ELSE bac.id END AS adjustment_code_id,
   sum(coalesce(pr.adjustment,0::MONEY))  as amount,
   'adjustment' as amount_type,
   pr.created_by,
   pr.order_payment_id,
   pr.id pr_id
FROM billing.payments bp
INNER JOIN payment_reconciliations pr on pr.payment_id = bp.old_id
INNER JOIN billing.temp_orders_15  to15 on  to15.order_id = pr.order_id
INNER JOIN order_payments op on op.id  = pr.order_payment_id
INNER JOIN billing.charges bc on bc.old_id = pr.study_cpt_id
LEFT JOIN billing.adjustment_codes bac on bac.old_id = nullif(trim(op.more_info->'adjustment_code'),'')::bigint
WHERE 1=1
AND NOT pr.has_deleted
AND NOT op.has_deleted
GROUP BY bp.id,bc.id,pr.order_payment_id,bp.payment_dt,pr.created_by,bac.id,pr.id
ORDER BY 8 asc, 5 desc;
-- -------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS  billing.temp_pr_15
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    pr_id BIGINT NOT NULL,
    applied_pymt_dt TIMESTAMPTZ
);
-- -------------------------------------------------------------------------------------------------------------
RAISE NOTICE 'Payment applications3';
WITH PR AS (  SELECT old_ord_pymt_id
              FROM billing.payment_applications
              WHERE old_ord_pymt_id is not null
              GROUP BY old_ord_pymt_id
            )
 INSERT INTO billing.temp_pr_15(pr_id, applied_pymt_dt)
 SELECT old_ord_pymt_id, clock_timestamp()  FROM PR
 ORDER BY  old_ord_pymt_id    ;
-- -------------------------------------------------------------------------------------------------------------
RAISE NOTICE 'Payment applications4';

UPDATE billing.payment_applications
SET applied_dt = applied_pymt_dt
FROM billing.temp_pr_15 tp
WHERE pr_id = old_ord_pymt_id;

-- -------------------------------------------------------------------------------------------------------------
DROP TABLE IF EXISTS billing.temp_orders_15;
DROP TABLE IF EXISTS billing.temp_pr_15;


INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('payment_applications',now());
ELSE
      RAISE NOTICE 'Billing.payment_applications table  migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 from billing.migration_log where table_name = 'cas_payment_application_details') THEN
RAISE NOTICE 'CAS Payment Application details';


CREATE INDEX IF NOT EXISTS temp_payment_appl_v15 on billing.payment_applications(old_pymt_recon_id);
CREATE INDEX IF NOT EXISTS temp_pymt_appl_1 on billing.payment_applications(old_pymt_recon_id) where amount_type = 'adjustment';


DO
$BEGIN$
DECLARE
    l_cas_data record;
BEGIN
  FOR l_cas_data IN   ( SELECT pr.id AS pr_id, more_info->'cas_arr_obj' AS cas_obj
			from billing.payment_applications bpa
			INNER JOIN payment_reconciliations pr ON pr.id = old_pymt_recon_id
			WHERE amount_type = 'adjustment'
			AND  amount > 0::money
			AND more_info->'cas_arr_obj' is not null
			AND more_info->'cas_arr_obj' != '[]'
			AND more_info->'cas_arr_obj' != ''
			AND (coalesce(has_deleted, FALSE) is FALSE)
			)
  LOOP
                with with_cas_details as (
                select * from
          json_to_recordset((l_cas_data.cas_obj)::JSON)
          AS
          (claim_adjustment_group_code text, adjustment_reason_code text,adjustment_amount text)
          )
      insert into billing.cas_payment_application_details (
          payment_application_id,
          cas_group_code_id,
          cas_reason_code_id,
          amount)
        select
        pal.id,
        cgc.id ,
        crc.id,
        SUM(coalesce(cd.adjustment_amount::MONEY,0::MONEY))
        from with_cas_details cd
        INNER JOIN  billing.payment_applications pal on pal.old_pymt_recon_id= l_cas_data.pr_id
       INNER JOIN  billing.cas_group_codes cgc on cgc.code = cd.claim_adjustment_group_code
        INNER JOIN billing.cas_reason_codes crc on crc.code =  cd.adjustment_reason_code
        where 1=1
        and cd.claim_adjustment_group_code != ''
        and cd.adjustment_reason_code != ''
        and cd.adjustment_amount !=''
        and pal.amount_type = 'adjustment'
        GROUP BY pal.id, cgc.id , crc.id;

END LOOP;
END $BEGIN$;
INSERT INTO  billing.migration_log (table_name,migration_dt) VALUES ('cas_payment_application_details',now());
ELSE
      RAISE NOTICE 'Billing.cas_payment_application_details table migration already finished';
END IF;
-- -------------------------------------------------------------------------------------------------------------
      RAISE NOTICE 'Dropping Support Functions for migration';
-- -------------------------------------------------------------------------------------------------------------
      DROP FUNCTION IF EXISTS public.get_modifier_id(TEXT);
      DROP FUNCTION IF EXISTS billing.get_paper_claim_or_invoice_json_for_migration (INPUT CHARACTER VARYING [ ]);
      DROP FUNCTION IF EXISTS billing.get_charge_created_by(BIGINT,BIGINT);

      DROP INDEX IF EXISTS  billing.temp_providers_v15 ;
      DROP INDEX IF EXISTS  temp_patient_insurances_v15 ;
      DROP INDEX IF EXISTS  billing.temp_claims_v15;
      DROP INDEX IF EXISTS  billing.temp_payment_appl_v15;
      DROP INDEX IF EXISTS  billing.temp_pymt_appl_1;


END
$$;
