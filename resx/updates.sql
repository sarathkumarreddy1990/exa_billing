-- ====================================================================================================================
DO
$$
DECLARE
    l_company_id BIGINT := 1; -- Default company_id
    l_fee_schedule_duplicates RECORD;
    l_fee_schedule_data RECORD;
    l_fee_schedule_name TEXT;
    l_fee_schedule_new_id BIGINT;
BEGIN
-- --------------------------------------------------------------------------------------------------------------------
RAISE NOTICE '--- START SCRIPT ---';
-- --------------------------------------------------------------------------------------------------------------------
--Billing 2.0 Switch role to super user postgres for creating new user, schema, etc
-- --------------------------------------------------------------------------------------------------------------------
SET ROLE TO postgres;
-- -------------------------------------------------------------------------------------------------------------------- 
--Billing 2.0 User role creation
-- --------------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM pg_roles WHERE rolname = 'exa_billing') THEN
    CREATE ROLE exa_billing WITH
    LOGIN
    CONNECTION LIMIT -1
    PASSWORD 'EXA1q2wbilling';          
END IF;
-- --------------------------------------------------------------------------------------------------------------------
-- Billing 2.0 Schema creation
-- --------------------------------------------------------------------------------------------------------------------
    CREATE SCHEMA IF NOT EXISTS billing AUTHORIZATION exa_billing;
    COMMENT ON SCHEMA billing  IS 'Schema for EXA Billing related DB objects';
-- --------------------------------------------------------------------------------------------------------------------
 --Billing 2.0  - New Setup tables For public schema
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modifiers
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    modifier_amount MONEY NOT NULL,
    override_amount MONEY NOT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    level TEXT,
    sign TEXT,
    type TEXT,
    modifier1 boolean NOT NULL,
    modifier2 boolean,
    modifier3 boolean,
    modifier4 boolean,
    CONSTRAINT modifiers_pk PRIMARY KEY (id),
    CONSTRAINT modifiers_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT modifiers_level_cc CHECK(level in('global','technical','professional')),
    CONSTRAINT modifiers_sign_cc CHECK(sign in('add','subtract')),
    CONSTRAINT modifiers_type_cc CHECK(type in('percentage','value')),
    CONSTRAINT modifiers_company_code_uc UNIQUE(company_id,code)
);
COMMENT ON TABLE public.modifiers IS 'Fee modifiers used for bill fee calculations';

COMMENT ON COLUMN public.modifiers.level IS 'global fee, technical fee or professional fee ';
COMMENT ON COLUMN public.modifiers.sign IS 'add or subtract the modifier amount with the fee ';
COMMENT ON COLUMN public.modifiers.type IS 'Percentage or Value that needs to be added or subtracted for the bill fee calculation ';
-- --------------------------------------------------------------------------------------------------------------------
-- Migrate modifiers table before altering fee_Schedule_cpts table
-- --------------------------------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM public.modifiers) THEN   -- Run this migration script only one time. Avoid duplicate execution
WITH reports (data) AS ( SELECT modifiers FROM sites)
INSERT INTO public.modifiers (company_id, code, description, level, TYPE, sign, modifier1, modifier2, modifier3, modifier4, modifier_amount, override_amount)
SELECT
    l_company_id,
    REPLACE((value -> 'code')::text, '"', ''),
    REPLACE((value -> 'description')::text, '"', ''),
    CASE WHEN REPLACE((value -> 'feeLevel')::text, '"', '') = 'Global Fee' THEN
        'global'
    WHEN REPLACE((value -> 'feeLevel')::text, '"', '') = 'Tech Fee' THEN
        'technical'
    WHEN REPLACE((value -> 'feeLevel')::text, '"', '') = 'Prof Fee' THEN
        'professional'
    END,
    CASE WHEN REPLACE((value -> 'feeCalculation')::text, '"', '') = 'per' THEN
        'percentage'
    WHEN REPLACE((value -> 'feeCalculation')::text, '"', '') = 'value' THEN
        'value'
    END,
    CASE WHEN REPLACE((value -> 'feeIncDecLevel')::text, '"', '') = 'sub' THEN
        'subtract'
    WHEN REPLACE((value -> 'feeIncDecLevel')::text, '"', '') = 'add' THEN
        'add'
    END,
    REPLACE((value -> 'M1')::text, '"', '')::boolean,
    REPLACE((value -> 'M2')::text, '"', '')::boolean,
    REPLACE((value -> 'M3')::text, '"', '')::boolean,
    REPLACE((value -> 'M4')::text, '"', '')::boolean,
    REPLACE((value -> 'feeOverride')::text, '"', '')::money,
    REPLACE((value -> 'dynamicFeeOverride')::text, '"', '')::money
    FROM
        reports r, json_array_elements(r.data #> '{modifiers_codes}') obj;
END IF;
-- --------------------------------------------------------------------------------------------------------------------
    ALTER TABLE IF EXISTS public.fee_schedules ADD COLUMN IF NOT EXISTS from_date DATE;
    ALTER TABLE IF EXISTS public.fee_schedules ADD COLUMN IF NOT EXISTS to_date DATE;
    ALTER TABLE IF EXISTS public.fee_schedules ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'billing';
    ALTER TABLE IF EXISTS public.fee_schedules ADD COLUMN IF NOT EXISTS inactivated_dt TIMESTAMPTZ;

IF EXISTS (select 1 from information_schema.columns where table_name ='fee_schedules' and column_name = 'more_info') THEN
    ALTER TABLE IF EXISTS public.fee_schedules ALTER COLUMN from_date SET DATA TYPE DATE USING coalesce( nullif(more_info->'from_date','')::date, current_date);
    ALTER TABLE IF EXISTS public.fee_schedules ALTER COLUMN from_date SET NOT NULL;
    ALTER TABLE IF EXISTS public.fee_schedules ALTER COLUMN to_date SET DATA TYPE DATE USING coalesce( nullif(more_info->'to_date','')::date, current_date);
    ALTER TABLE IF EXISTS public.fee_schedules ALTER COLUMN to_date SET NOT NULL;
    ALTER TABLE IF EXISTS public.fee_schedules ALTER COLUMN category SET DATA TYPE TEXT USING CASE WHEN coalesce( nullif(more_info->'defaultfee','')::boolean, false) is TRUE THEN 'default' ELSE 'billing' END;
    ALTER TABLE IF EXISTS public.fee_schedules ALTER COLUMN category SET NOT NULL;
END IF;

IF EXISTS (select 1 from information_schema.columns where table_name ='fee_schedules' and column_name = 'is_active') THEN
    ALTER TABLE IF EXISTS public.fee_schedules ALTER COLUMN inactivated_dt SET DATA TYPE TIMESTAMPTZ USING CASE WHEN coalesce( is_active, false) is false THEN now() ELSE NULL END;
END IF;

    -- ALTER TABLE IF EXISTS public.fee_schedules DROP COLUMN IF EXISTS more_info;
    -- ALTER TABLE IF EXISTS public.fee_schedules DROP COLUMN IF EXISTS has_deleted;
    -- ALTER TABLE IF EXISTS public.fee_schedules DROP COLUMN IF EXISTS is_active;
    -- ALTER TABLE IF EXISTS public.fee_schedules DROP COLUMN IF EXISTS deleted_dt;

    ALTER TABLE IF EXISTS public.fee_schedules ALTER COLUMN  company_id  SET NOT NULL;
    ALTER TABLE IF EXISTS public.fee_schedules ALTER COLUMN name SET NOT NULL;

IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint where conname = 'fee_schedules_category_cc') THEN
    ALTER TABLE IF EXISTS public.fee_schedules ADD CONSTRAINT  fee_schedules_category_cc CHECK (category in ('billing','default','self_pay','allowed'));
END IF;

-- Renaming the duplicate schedule names(if exists)
FOR l_fee_schedule_duplicates in (select lower(name) as name from fee_schedules group by lower(name) having count(lower(name)) > 1)
LOOP
    FOR l_fee_schedule_data in (select id,name from fee_schedules where lower(name) = l_fee_schedule_duplicates.name order by id )
    LOOP
        IF l_fee_schedule_name = lower(l_fee_schedule_data.name) THEN 
            UPDATE fee_schedules set name = l_fee_schedule_data.name ||'_duplicate_'||l_fee_schedule_data.id where id = l_fee_schedule_data.id;
        END IF;
        l_fee_schedule_name := lower(l_fee_schedule_data.name);
    END LOOP;
    l_fee_schedule_name := '';
END LOOP;


CREATE UNIQUE INDEX IF NOT EXISTS fee_schedules_company_id_name_ux on public.fee_schedules USING BTREE (company_id,lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS fee_schedules_is_default_ux on public.fee_schedules USING BTREE (company_id,category) WHERE category = 'default';
CREATE UNIQUE INDEX IF NOT EXISTS fee_schedules_is_self_pay_ux on public.fee_schedules USING BTREE (company_id,category) WHERE category = 'self_pay';
-- --------------------------------------------------------------------------------------------------------------------
    ALTER TABLE IF EXISTS public.fee_schedule_cpts ADD COLUMN IF NOT EXISTS professional_fee MONEY;
    ALTER TABLE IF EXISTS public.fee_schedule_cpts ADD COLUMN IF NOT EXISTS technical_fee MONEY;
    ALTER TABLE IF EXISTS public.fee_schedule_cpts ADD COLUMN IF NOT EXISTS global_fee MONEY;

IF EXISTS (select 1 from information_schema.columns where table_name ='fee_schedule_cpts' and column_name = 'fee_info') THEN

    ALTER TABLE IF EXISTS public.fee_schedule_cpts ALTER COLUMN professional_fee SET DATA TYPE MONEY USING coalesce( nullif(fee_info->'prof_fee','')::money, 0::money);
    ALTER TABLE IF EXISTS public.fee_schedule_cpts ALTER COLUMN professional_fee SET NOT NULL;
    ALTER TABLE IF EXISTS public.fee_schedule_cpts ALTER COLUMN technical_fee SET DATA TYPE MONEY USING coalesce( nullif(fee_info->'tech_fee','')::money, 0::money);
    ALTER TABLE IF EXISTS public.fee_schedule_cpts ALTER COLUMN technical_fee SET NOT NULL;
    ALTER TABLE IF EXISTS public.fee_schedule_cpts ALTER COLUMN global_fee SET DATA TYPE MONEY USING coalesce( nullif(fee_info->'global_fee','')::money, 0::money);
    ALTER TABLE IF EXISTS public.fee_schedule_cpts ALTER COLUMN global_fee SET NOT NULL;

    -- Following PLSQL is used to migrate the _allowed_ columns to separate allowed fee schedules
    FOR l_fee_schedule_data in (SELECT id,name,company_id,from_date,to_date,inactivated_dt FROM fee_schedules fs WHERE 
                                EXISTS (SELECT 1 FROM fee_Schedule_cpts WHERE  
                                        fee_schedule_id = fs.id 
                                        AND (coalesce( nullif(fee_info->'prof_allowable','')::money, 0::money) > 0::money
                                             OR coalesce( nullif(fee_info->'tech_allowable','')::money, 0::money) > 0::money 
                                             OR coalesce( nullif(fee_info->'global_allowable','')::money, 0::money) > 0::money
                                            )
                                       )
                               )
    LOOP
        l_fee_schedule_name := l_fee_schedule_data.name||'_allowed';
        INSERT INTO fee_schedules(name,company_id,from_date,to_date,category) values(l_fee_schedule_name,l_company_id,l_fee_schedule_data.from_date,l_fee_schedule_data.to_date,'allowed') RETURNING id INTO l_fee_schedule_new_id;
        INSERT INTO fee_Schedule_cpts(fee_schedule_id,cpt_code_id,professional_fee,technical_fee,global_fee)
                select l_fee_schedule_new_id,
                       cpt_code_id,
                       coalesce( nullif(fee_info->'prof_allowable','')::money, 0::money),
                       coalesce( nullif(fee_info->'tech_allowable','')::money, 0::money),
                       coalesce( nullif(fee_info->'global_allowable','')::money, 0::money)
                from fee_Schedule_cpts 
                where 1=1
                AND fee_schedule_id = l_fee_schedule_data.id
                AND (coalesce(nullif(fee_info->'prof_allowable','')::money, 0::money) > 0::money OR
                     coalesce( nullif(fee_info->'tech_allowable','')::money, 0::money) > 0::money OR 
                     coalesce( nullif(fee_info->'global_allowable','')::money, 0::money) > 0::money
                    );
    END LOOP;
END IF;

    -- ALTER TABLE IF EXISTS public.fee_schedule_cpts DROP COLUMN IF EXISTS fee_info;

    ALTER TABLE IF EXISTS public.fee_schedule_cpts ALTER COLUMN  fee_schedule_id  SET NOT NULL;
    ALTER TABLE IF EXISTS public.fee_schedule_cpts ALTER COLUMN  cpt_code_id  SET NOT NULL;

COMMENT ON TABLE public.fee_schedule_cpts IS 'cpt codes mapping for each fee schedule';
-- --------------------------------------------------------------------------------------------------------------------
    ALTER TABLE IF EXISTS public.insurance_providers ADD COLUMN IF NOT EXISTS billing_fee_schedule_id BIGINT;
    ALTER TABLE IF EXISTS public.insurance_providers ADD COLUMN IF NOT EXISTS allowed_fee_schedule_id BIGINT;

IF EXISTS (select 1 from insurance_providers where (insurance_info ?| ARRAY['fee_id'])) THEN
    ALTER TABLE IF EXISTS public.insurance_providers ALTER COLUMN billing_fee_schedule_id SET DATA TYPE BIGINT USING nullif(insurance_info -> 'fee_id','')::BIGINT;
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint where conname = 'insurance_providers_billing_fee_schedule_id_fk') THEN
    ALTER TABLE IF EXISTS public.insurance_providers ADD CONSTRAINT insurance_providers_billing_fee_schedule_id_fk FOREIGN KEY (billing_fee_schedule_id) REFERENCES public.fee_schedules (id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint where conname = 'insurance_providers_allowed_fee_schedule_id_fk') THEN
    ALTER TABLE IF EXISTS public.insurance_providers ADD CONSTRAINT insurance_providers_allowed_fee_schedule_id_fk FOREIGN KEY (allowed_fee_schedule_id) REFERENCES public.fee_schedules (id);
END IF;

    -- UPDATE public.insurance_providers SET insurance_info = delete(insurance_info, 'fee_id');
    -- UPDATE public.insurance_providers SET insurance_info = delete(insurance_info, 'fee_name');

-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employment_status
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    description TEXT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT employment_status_pk PRIMARY KEY (id),
    CONSTRAINT employment_status_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT employment_status_company_description_uc UNIQUE(company_id,description),
    CONSTRAINT employment_status_description_cc  CHECK (TRIM(description) <> '')
);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relationship_status
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    description TEXT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT relationship_status_pk PRIMARY KEY (id),
    CONSTRAINT relationship_status_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT relationship_status_company_description_uc UNIQUE(company_id,description),
    CONSTRAINT relationship_status_description_cc  CHECK (TRIM(description) <> '')
);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_insurances
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    patient_id BIGINT NOT NULL,
    insurance_provider_id BIGINT NOT NULL,
    subscriber_relationship_id BIGINT NOT NULL,
    subscriber_employment_status_id BIGINT,
    valid_from_date DATE,
    valid_to_date DATE,
    subscriber_dob DATE NOT NULL,
    medicare_insurance_type_code TEXT,
    coverage_level TEXT NOT NULL,
    policy_number TEXT NOT NULL,
    group_name TEXT,
    group_number TEXT,
    precertification_phone_number TEXT,
    precertification_fax_number TEXT,
    subscriber_firstname TEXT NOT NULL,
    subscriber_lastname TEXT NOT NULL,
    subscriber_middlename TEXT,
    subscriber_name_suffix TEXT,
    subscriber_gender TEXT NOT NULL,
    subscriber_address_line1 TEXT NOT NULL,
    subscriber_address_line2 TEXT,
    subscriber_city TEXT NOT NULL,
    subscriber_state TEXT NOT NULL,
    subscriber_zipcode TEXT NOT NULL,
    work_phone_number TEXT,
    home_phone_number TEXT,
    assign_benefits_to_patient BOOLEAN DEFAULT false,
    CONSTRAINT patient_insurances_pk PRIMARY KEY (id),
    CONSTRAINT patient_insurances_patient_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id),
    CONSTRAINT patient_insurances_insurance_provider_id_fk FOREIGN KEY (insurance_provider_id) REFERENCES public.insurance_providers (id),
    CONSTRAINT patient_insurances_subscriber_relationship_id_fk FOREIGN KEY (subscriber_relationship_id) REFERENCES public.relationship_status(id),
    CONSTRAINT patient_insurances_subscriber_employment_status_id_fk FOREIGN KEY (subscriber_employment_status_id) REFERENCES public.employment_status(id),
    CONSTRAINT patient_insurances_coverage_level_cc CHECK ( coverage_level in('primary','secondary','tertiary')),
    CONSTRAINT patient_insurances_medicare_insurance_type_code_cc CHECK (medicare_insurance_type_code in ('12','13','14','15','16','41','42','43','47')),
    CONSTRAINT patient_insurances_id_patient_id_uc UNIQUE (id,patient_id)
);
COMMENT ON COLUMN public.patient_insurances.medicare_insurance_type_code IS 'Code identifying the type of insurance policy within a specific insurance program. Refer EDI transaction set implementation guide -Claim 837 - SBR05-1336';
COMMENT ON COLUMN public.patient_insurances.assign_benefits_to_patient IS 'Whether provider is accepting assignments from insurances';
-- --------------------------------------------------------------------------------------------------------------------
alter table public.patient_insurances alter column valid_from_date drop not null;
alter table public.patient_insurances alter column valid_to_date drop not null;
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.places_of_service
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    CONSTRAINT places_of_service_pk PRIMARY KEY (id),
    CONSTRAINT places_of_service_company_id_code_uc UNIQUE (company_id,code),
    CONSTRAINT places_of_service_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_level_codes
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    reading_provider_percent_level numeric(7,3) NOT NULL,
    CONSTRAINT provider_level_codes_pk PRIMARY KEY(id),
    CONSTRAINT provider_level_codes_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT provider_level_codes_company_code_uc UNIQUE(company_id,code)
);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cpt_code_provider_level_codes
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    cpt_code_id BIGINT NOT NULL,
    provider_level_code_id BIGINT NOT NULL,
    CONSTRAINT cpt_code_provider_level_codes_pk PRIMARY KEY(id),
    CONSTRAINT cpt_code_provider_level_codes_cpt_code_id_fk FOREIGN KEY (cpt_code_id) REFERENCES public.cpt_codes (id),
    CONSTRAINT cpt_code_provider_level_codes_provider_level_code_id_fk FOREIGN KEY (provider_level_code_id) REFERENCES public.provider_level_codes (id),
    CONSTRAINT cpt_code_provider_level_codes_cpt_code_prov_lvl_code_id_uc UNIQUE(cpt_code_id,provider_level_code_id)
);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurance_provider_payer_types 
(
    id BIGSERIAL,
    company_id BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    CONSTRAINT insurance_provider_payer_types_pk PRIMARY KEY(id),
    CONSTRAINT insurance_provider_payer_types_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT insurance_provider_payer_types_company_code_uc UNIQUE(company_id,code)
);
-- --------------------------------------------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.insurance_providers ADD COLUMN IF NOT EXISTS provider_payer_type_id BIGINT;
IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint where conname = 'insurance_providers_provider_payer_type_id_fk') THEN

    ALTER TABLE IF EXISTS public.insurance_providers ADD CONSTRAINT  insurance_providers_provider_payer_type_id_fk 
                                                     FOREIGN KEY (provider_payer_type_id) 
                                                     REFERENCES public.insurance_provider_payer_types (id);
END IF;
-- --------------------------------------------------------------------------------------------------------------------
-- Billing 2.0 Grant priveleges for exa_billing
-- --------------------------------------------------------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO exa_billing;

-- Following Tables used by RIS  are shared with Billing.
GRANT ALL on public.user_log, public.users_online,public.user_log_id_seq,public.facilities,public.companies,public.insurance_providers,public.modifiers TO exa_billing;

GRANT REFERENCES ON ALL TABLES IN SCHEMA public TO exa_billing;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA billing TO exa_billing;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA billing TO exa_billing;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA billing TO exa_billing;
GRANT ALL PRIVILEGES ON schema billing TO exa_billing;
-- --------------------------------------------------------------------------------------------------------------------
-- Billing 2.0  -Switch role to exa_billing, so objects of billing module about to be created have correct ownership
-- --------------------------------------------------------------------------------------------------------------------
-- SET ROLE TO exa_billing;
-- --------------------------------------------------------------------------------------------------------------------
--Billing 2.0  - New Setup tables - Create Script
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.edi_clearinghouses
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    receiver_name TEXT,
    receiver_id TEXT,
    communication_info JSONB,
    edi_template_name TEXT,
    CONSTRAINT edi_clearinghouses_id_pk PRIMARY KEY (id),
    CONSTRAINT edi_clearinghouses_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
    CONSTRAINT edi_clearinghouses_company_name_uc UNIQUE(company_id,name),
    CONSTRAINT edi_clearinghouses_company_code_uc UNIQUE(company_id,code)
);

COMMENT ON COLUMN billing.edi_clearinghouses.communication_info IS 'JSONB object that holds protocol (sftp, https, ftps),host (IP/URL/FQDN),port,username,password,upload_path,download_path,identity_file_path(path to private key file on server, used for authentication)';
COMMENT ON COLUMN billing.edi_clearinghouses.code IS '.NET app identifier';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.edi_templates
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    template_type TEXT NOT NULL,
    hipaa_version TEXT NOT NULL,
    template_info XML NOT NULL,
    CONSTRAINT edi_templates_id_pk PRIMARY KEY (id),
    CONSTRAINT edi_templates_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT edi_templates_company_name_uc UNIQUE(company_id,name),
    CONSTRAINT edi_templates_company_code_uc UNIQUE(company_id,code),
    CONSTRAINT edi_templates_template_type_cc  CHECK (template_type in ('claim','eligibility','authorization')),
    CONSTRAINT edi_templates_hipaa_version_cc  CHECK (hipaa_version in ('005010','004010X092A1'))
);
        
COMMENT ON TABLE billing.edi_templates IS 'Template for Data source mapping in EDI 837. It has the blank template XML and the XML mapped with data source';       
COMMENT ON COLUMN billing.edi_templates.template_info IS 'Standard EDI XML with mapped data sources';
COMMENT ON COLUMN billing.edi_templates.code IS '.NET app identifier';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.edi_template_rules
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    edi_template_id BIGINT NOT NULL,
    element_id BIGINT NOT NULL,
    segment_id TEXT NOT NULL,
    action_type TEXT NOT NULL, 
    rules_info JSONB NOT NULL,
    contains_sub_segment BOOLEAN NOT NULL DEFAULT FALSE,   
    CONSTRAINT edi_template_rules_id_pk PRIMARY KEY (id),
    CONSTRAINT edi_template_rules_edi_template_id_fk FOREIGN KEY (edi_template_id) REFERENCES billing.edi_templates(id),
    CONSTRAINT edi_template_rules_action_type_cc CHECK (action_type in ('dni','atv','mch')),
    CONSTRAINT edi_template_rules_edi_template_element_segment_id_uc UNIQUE(edi_template_id,element_id,segment_id)
);

    COMMENT ON TABLE billing.edi_template_rules IS 'Rules for data source columns in EDI template';
    COMMENT ON COLUMN billing.edi_template_rules.contains_sub_segment IS 'In billing 1.0, if sub_element_id is -1 then it means segment has a sub-segment. In Billing 2.0 respective value will be true ';
    COMMENT ON COLUMN billing.edi_template_rules.action_type IS 'dni - Do not include the rule , atv - apply this rule , mch - make as no children';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.edi_template_translations
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    edi_template_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    translation_info JSONB,
    CONSTRAINT edi_template_translations_id_pk PRIMARY KEY (id),
    CONSTRAINT edi_template_translations_edi_template_id_fk FOREIGN KEY (edi_template_id) REFERENCES billing.edi_templates(id),
    CONSTRAINT edi_template_translations_edi_template_id_name_uc UNIQUE(edi_template_id,name)
); 

COMMENT ON COLUMN billing.edi_template_translations.translation_info IS 'For the values in source system(EXA), the translated values in EDI 837 standards ';
-- --------------------------------------------------------------------------------------------------------------------
-- Datamodel for Adjustment codes  <START> 
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.adjustment_codes
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    accounting_entry_type TEXT NOT NULL,
    CONSTRAINT adjustment_codes_pk PRIMARY KEY(id),
    CONSTRAINT adjustment_codes_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT adjustment_codes_company_code_uc UNIQUE(company_id,code),
    CONSTRAINT adjustment_codes_accounting_entry_type_cc CHECK(accounting_entry_type in('credit','debit','refund_debit','recoupment_debit'))
);

COMMENT ON TABLE billing.adjustment_codes IS 'Adjustment codes for Billing';
COMMENT ON COLUMN billing.adjustment_codes.accounting_entry_type IS 'An adjustment code can be associated either with a Credit entry transation or a Debit entry transaction. The associated accounting entry type(credit/debit) is represented here.';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS  billing.billing_codes
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    CONSTRAINT billing_codes_pk PRIMARY KEY(id),
    CONSTRAINT billing_codes_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT billing_codes_company_code_uc UNIQUE(company_id,code)
);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS  billing.billing_classes
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    CONSTRAINT billing_classes_pk PRIMARY KEY(id),
    CONSTRAINT billing_classes_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT billing_classes_company_code_uc UNIQUE(company_id,code)
);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.claim_status
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    is_system_status BOOLEAN NOT NULL DEFAULT FALSE,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    display_order bigint NOT NULL,
    CONSTRAINT claim_status_pk PRIMARY KEY(id),
    CONSTRAINT claim_status_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id), 
    CONSTRAINT claim_status_company_code_uc UNIQUE(company_id,code),
    CONSTRAINT claim_status_company_display_order_uc UNIQUE(company_id,display_order)
);
-- --------------------------------------------------------------------------------------------------------------------
IF NOT EXISTS(SELECT 1 FROM billing.claim_status) THEN 
    INSERT INTO billing.claim_status(company_id,code,description,is_system_status,display_order) values(l_company_id,'PV','Pending Validation',true,1);
    INSERT INTO billing.claim_status(company_id,code,description,is_system_status,display_order) values(l_company_id,'PS','Pending Submission',true,2);
    INSERT INTO billing.claim_status(company_id,code,description,is_system_status,display_order) values(l_company_id,'PP','Pending Payment',true,3);
    INSERT INTO billing.claim_status(company_id,code,description,is_system_status,display_order) values(l_company_id,'D','Denied',true,4);
    INSERT INTO billing.claim_status(company_id,code,description,is_system_status,display_order) values(l_company_id,'PIF','Paid In Full',true,5);
    INSERT INTO billing.claim_status(company_id,code,description,is_system_status,display_order) values(l_company_id,'OP','Over Payment',true,6);
    INSERT INTO billing.claim_status(company_id,code,description,is_system_status,display_order) values(l_company_id,'CR','Collections Review',true,7);
    INSERT INTO billing.claim_status(company_id,code,description,is_system_status,display_order) values(l_company_id,'CIC','Claim in Collections',true,8);
END IF;
-- --------------------------------------------------------------------------------------------------------------------
-- Datamodel for Adjustment codes  <END>
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.printer_templates
(
  id bigserial NOT NULL,
  company_id bigint NOT NULL,
  page_width integer NOT NULL,
  page_height integer NOT NULL,
  left_margin numeric(3,1) NOT NULL,
  right_margin numeric(3,1) NOT NULL,
  top_margin numeric(3,1) NOT NULL,
  bottom_margin numeric(3,1) NOT NULL,
  inactivated_dt timestamp with time zone,
  name text NOT NULL,
  template_type text NOT NULL,
  template_content text NOT NULL,
  CONSTRAINT printer_templates_pk PRIMARY KEY (id),
  CONSTRAINT printer_templates_company_id_fk FOREIGN KEY (company_id) REFERENCES companies (id),
  CONSTRAINT printer_templates_company_name_uc UNIQUE (company_id, name)
);
COMMENT ON TABLE billing.printer_templates IS 'paper claim printer configurations';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.providers
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    short_description TEXT NOT NULL,
    federal_tax_id TEXT NOT NULL,
    npi_no TEXT NOT NULL,
    taxonomy_code TEXT NOT NULL,
    contact_person_name TEXT NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT  NOT NULL,
    zip_code_plus TEXT NOT NULL,
    email TEXT,
    phone_number TEXT NOT NULL,
    fax_number TEXT NOT NULL,
    web_url TEXT,
    pay_to_address_line1 TEXT,
    pay_to_address_line2 TEXT,
    pay_to_city TEXT,
    pay_to_state TEXT,
    pay_to_zip_code TEXT,
    pay_to_zip_code_plus TEXT,
    pay_to_email TEXT,
    pay_to_phone_number TEXT,
    pay_to_fax_number TEXT,
    communication_info JSONB,
    CONSTRAINT billing_provider_id_pk PRIMARY KEY (id),
    CONSTRAINT billing_provider_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
    CONSTRAINT billing_provider_code_uc UNIQUE(company_id,code),
    CONSTRAINT billing_provider_taxonomy_code_cc CHECK (LENGTH(taxonomy_code) = 10 and UPPER(taxonomy_code) = taxonomy_code)
);

COMMENT ON COLUMN billing.providers.communication_info IS 'JSONB object that holds protocol (sftp, https, ftps),host (IP/URL/FQDN),port,username,password,upload_path,download_path,identity_file_path(path to private key file on server, used for authentication)';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.provider_id_code_qualifiers
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    qualifier_code  TEXT NOT NULL,
    description TEXT NOT NULL,
    CONSTRAINT provider_id_code_qualifiers_pk PRIMARY KEY(id),
    CONSTRAINT provider_id_code_qualifiers_company_id_fk FOREIGN KEY(company_id) REFERENCES public.companies (id)
);

COMMENT ON TABLE billing.provider_id_code_qualifiers IS 'Qualifiers and its description for the provider id codes';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.provider_id_codes
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    qualifier_id BIGINT NOT NULL, 
    billing_provider_id BIGINT NOT NULL,
    insurance_provider_id BIGINT NOT NULL,
    payer_assigned_provider_id TEXT NOT NULL ,
    CONSTRAINT provider_id_codes_pk PRIMARY KEY (id),
    CONSTRAINT provider_id_codes_provider_id_fk FOREIGN KEY(billing_provider_id) REFERENCES billing.providers(id),
    CONSTRAINT provider_id_codes_qualifier_id_fk FOREIGN KEY(qualifier_id) REFERENCES billing.provider_id_code_qualifiers(id),
    CONSTRAINT provider_id_codes_insurance_provider_id_fk FOREIGN KEY(insurance_provider_id) REFERENCES public.insurance_providers(id),
    CONSTRAINT provider_id_codes_qualifier_id_uc UNIQUE( qualifier_id,billing_provider_id,insurance_provider_id),
    CONSTRAINT provider_id_codes_payer_assigned_provider_id_length_cc CHECK( LENGTH(payer_assigned_provider_id) BETWEEN 1 and 17)
);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.messages
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    CONSTRAINT messages_pk PRIMARY KEY (id),
    CONSTRAINT messages_company_code_uc UNIQUE (company_id,code),
    CONSTRAINT messages_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT messages_code_cc CHECK ( code in ('0-30', '31-60', '61-90', '91-120', '>120', 'collections'))
);

COMMENT ON TABLE billing.messages IS 'Messages used in billing reports like patient statement, etc';

COMMENT ON COLUMN billing.messages.code IS 'Unique short code that helps to identify a report message indicating aging';
COMMENT ON COLUMN billing.messages.description IS 'Actual billing report message text used in billing aging reports';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.payment_reasons
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    CONSTRAINT payment_reasons_pk PRIMARY KEY (id),
    CONSTRAINT payment_reasons_company_id_code_uc UNIQUE (company_id,code),
    CONSTRAINT payment_reasons_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id)
);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.validations
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    edi_validation JSONB,
    invoice_validation JSONB,
    patient_validation JSONB,
    CONSTRAINT validations_pk PRIMARY KEY (id),
    CONSTRAINT validations_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id)
);

COMMENT ON TABLE billing.validations IS 'Validations used in  EDI and Invoice';

COMMENT ON COLUMN billing.validations.edi_validation IS 'EDI validations like Billing provider EDI validations, refering provider EDI validations, rendering provider EDI validations, etc. This is used during claim validation.';
COMMENT ON COLUMN billing.validations.invoice_validation IS 'Invoice validations like claim validations , payer validations, subscriber validations, etc.This is used during claim validation. ';
COMMENT ON COLUMN billing.validations.patient_validation IS 'Patient validations like claim validations ,billing provider, rendering provider, etc except payer and subscriber validations. This is used during claim validation.';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.cas_group_codes
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id  BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    code  TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    CONSTRAINT cas_group_codes_pk PRIMARY KEY (id),
    CONSTRAINT cas_group_codes_group_code_uc UNIQUE (company_id,code),
    CONSTRAINT cas_group_codes_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT cas_group_codes_code_cc  CHECK (TRIM(code) <> ''),
    CONSTRAINT cas_group_codes_name_cc  CHECK (TRIM(name) <> ''),
    CONSTRAINT cas_group_codes_description_cc  CHECK (TRIM(description) <> '')
);

COMMENT ON TABLE billing.cas_group_codes IS 'CAS group codes use in ERA/EOB processing';

COMMENT ON COLUMN billing.cas_group_codes.code IS 'User enterable Group code (Like CO, PR, etc) for CAS';
COMMENT ON COLUMN billing.cas_group_codes.name  IS 'Example : Contractual Obligation';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.cas_reason_codes 
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id  BIGINT NOT NULL,
    inactivated_dt TIMESTAMPTZ DEFAULT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    CONSTRAINT cas_reason_codes_pk PRIMARY KEY (id),
    CONSTRAINT cas_reason_codes_code_uc UNIQUE (company_id,code),
    CONSTRAINT cas_reason_codes_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT cas_reason_codes_code_cc  CHECK (TRIM(code) <> ''),
    CONSTRAINT cas_reason_codes_description_cc  CHECK (TRIM(description) <> '')
);
-- --------------------------------------------------------------------------------------------------------------------
-- Billing 2.0 - New Claim module tables -  Create Script
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.claims
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    facility_id BIGINT NOT NULL,
    patient_id BIGINT NOT NULL,
    billing_provider_id BIGINT NOT NULL,
    rendering_provider_contact_id BIGINT,
    referring_provider_contact_id BIGINT,
    primary_patient_insurance_id BIGINT,
    secondary_patient_insurance_id BIGINT,
    tertiary_patient_insurance_id BIGINT,
    ordering_facility_id BIGINT,
    place_of_service_id BIGINT,
    claim_status_id BIGINT NOT NULL,
    billing_code_id BIGINT,
    billing_class_id BIGINT,
    created_by BIGINT NOT NULL,
    claim_dt TIMESTAMPTZ NOT NULL,
    submitted_dt TIMESTAMPTZ,
    current_illness_date DATE,
    same_illness_first_date DATE,
    unable_to_work_from_date DATE,
    unable_to_work_to_date DATE,
    hospitalization_from_date DATE,
    hospitalization_to_date DATE,
    payer_type TEXT NOT NULL,
    billing_method TEXT,
    billing_notes TEXT,
    claim_notes TEXT,
    original_reference TEXT,
    authorization_no TEXT,
    frequency TEXT,
    invoice_no TEXT,
    is_auto_accident BOOLEAN DEFAULT FALSE,
    is_other_accident BOOLEAN DEFAULT FALSE,
    is_employed BOOLEAN DEFAULT FALSE,
    service_by_outside_lab BOOLEAN DEFAULT FALSE,
    CONSTRAINT claims_pk PRIMARY KEY (id),
    CONSTRAINT claims_billing_code_id_fk FOREIGN KEY (billing_code_id) REFERENCES billing.billing_codes (id),
    CONSTRAINT claims_billing_class_id_fk FOREIGN KEY (billing_class_id) REFERENCES billing.billing_classes (id),
    CONSTRAINT claims_claim_status_id_fk FOREIGN KEY (claim_status_id) REFERENCES billing.claim_status(id),
    CONSTRAINT claims_billing_provider_id_fk FOREIGN KEY (billing_provider_id) REFERENCES billing.providers (id),
    CONSTRAINT claims_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT claims_patient_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients (id),
    CONSTRAINT claims_place_of_service_id_fk FOREIGN KEY (place_of_service_id) REFERENCES public.places_of_service (id),
    CONSTRAINT claims_rendering_provider_contact_id_fk FOREIGN KEY (rendering_provider_contact_id) REFERENCES public.provider_contacts (id),
    CONSTRAINT claims_referring_provider_contact_id_fk FOREIGN KEY (referring_provider_contact_id) REFERENCES public.provider_contacts (id),
    CONSTRAINT claims_created_by_fk FOREIGN KEY (created_by) REFERENCES public.users(id),
    CONSTRAINT claims_facility_id_fk FOREIGN KEY (facility_id) REFERENCES public.facilities (id),
    CONSTRAINT claims_primary_patient_insurance_id_fk FOREIGN KEY (primary_patient_insurance_id, patient_id) REFERENCES public.patient_insurances (id, patient_id),
    CONSTRAINT claims_secondary_patient_insurance_id_fk FOREIGN KEY (secondary_patient_insurance_id, patient_id) REFERENCES public.patient_insurances (id, patient_id),
    CONSTRAINT claims_tertiary_patient_insurance_id_fk FOREIGN KEY (tertiary_patient_insurance_id, patient_id) REFERENCES public.patient_insurances (id, patient_id),
    CONSTRAINT claims_ordering_facility_id_fk FOREIGN KEY (ordering_facility_id) REFERENCES public.provider_groups (id),
    CONSTRAINT claims_billing_method_cc CHECK(billing_method in('patient_payment','direct_billing', 'electronic_billing','paper_claim')),
    CONSTRAINT claims_frequency_cc CHECK ( frequency in ('original' ,'corrected' ,'void')),
    CONSTRAINT claims_payer_type_cc CHECK ( payer_type IN ('patient', 'primary_insurance', 'secondary_insurance', 'tertiary_insurance', 'ordering_facility','referring_provider')),
    CONSTRAINT claims_distinct_patient_insurance_ids_cc  CHECK (coalesce(primary_patient_insurance_id, -1) != coalesce(secondary_patient_insurance_id, -2) AND coalesce(primary_patient_insurance_id, -1)   != coalesce(tertiary_patient_insurance_id,  -3) AND coalesce(secondary_patient_insurance_id, -2) != coalesce(tertiary_patient_insurance_id, -3)),
    CONSTRAINT claims_payer_id_cc CHECK (CASE payer_type
                                        WHEN 'patient'    THEN true
                                        WHEN 'primary_insurance'    THEN primary_patient_insurance_id IS NOT NULL
                                        WHEN 'secondary_insurance'    THEN secondary_patient_insurance_id IS NOT NULL
                                        WHEN 'tertiary_insurance'    THEN tertiary_patient_insurance_id IS NOT NULL
                                        WHEN 'ordering_facility'    THEN ordering_facility_id IS NOT NULL
                                        WHEN 'referring_provider'    THEN referring_provider_contact_id IS NOT NULL
                                        ELSE false
                                        END)
);

COMMENT ON TABLE billing.claims IS 'claims related information';

--  COMMENT ON COLUMN billing.claims.claim_status_id IS 'claim status for a claim can be Patient over payment, insurance overpayment,etc';  - Comments will be provided after spec for claim status workflow is provided
COMMENT ON COLUMN billing.claims.claim_dt IS 'Claim accounting date';
COMMENT ON COLUMN billing.claims.submitted_dt IS 'Date when claim was submitted';
COMMENT ON COLUMN billing.claims.authorization_no IS 'Claim authoriztion_no';
COMMENT ON COLUMN billing.claims.frequency IS 'Frequecy of the claim like original, corrected, etc';
COMMENT ON COLUMN billing.claims.is_other_accident IS 'Whether the accident was caused by other means(other than accident caused by vehicles)';
COMMENT ON COLUMN billing.claims.current_illness_date IS 'Used on CMS Form 1500, box #14';
COMMENT ON COLUMN billing.claims.same_illness_first_date IS 'Used on CMS Form 1500, box #15';
COMMENT ON COLUMN billing.claims.hospitalization_from_date IS 'Used on CMS Form 1500, box #18';
COMMENT ON COLUMN billing.claims.hospitalization_to_date IS 'Used on CMS Form 1500, box #18';
COMMENT ON COLUMN billing.claims.claim_notes IS 'Used on CMS Form 1500, box #19';
COMMENT ON COLUMN billing.claims.service_by_outside_lab IS 'Used on CMS Form 1500, box #20';
COMMENT ON COLUMN billing.claims.authorization_no IS 'Used on CMS Form 1500, box #23';
COMMENT ON COLUMN billing.claims.place_of_service_id IS 'Used on CMS Form 1500, box #24b';
COMMENT ON COLUMN billing.claims.unable_to_work_from_date IS 'Used on CMS Form 1500, box #16';
COMMENT ON COLUMN billing.claims.unable_to_work_to_date IS 'Used on CMS Form 1500, box #16';

CREATE INDEX IF NOT EXISTS claims_facility_id_ix ON billing.claims(facility_id);
CREATE INDEX IF NOT EXISTS claims_patient_id_ix ON billing.claims(patient_id);
CREATE INDEX IF NOT EXISTS claims_billing_provider_id_ix ON billing.claims(billing_provider_id);
CREATE INDEX IF NOT EXISTS claims_rendering_provider_contact_id_ix ON billing.claims(rendering_provider_contact_id);
CREATE INDEX IF NOT EXISTS claims_referring_provider_contact_id_ix ON billing.claims(referring_provider_contact_id);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.charges
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    claim_id BIGINT NOT NULL,
    line_num  BIGINT,
    cpt_id BIGINT NOT NULL,
    modifier1_id BIGINT,
    modifier2_id BIGINT,
    modifier3_id BIGINT,
    modifier4_id BIGINT,
    bill_fee MONEY NOT NULL,
    allowed_amount MONEY NOT NULL,
    units NUMERIC(7,3) NOT NULL,
    created_by BIGINT NOT NULL,
    charge_dt TIMESTAMPTZ NOT NULL,
    pointer1 TEXT,
    pointer2 TEXT,
    pointer3 TEXT,
    pointer4 TEXT,
    authorization_no TEXT,
    note TEXT,
    CONSTRAINT charges_pk PRIMARY KEY (id),
    CONSTRAINT charges_claim_id_fk FOREIGN KEY (claim_id) REFERENCES billing.claims (id),
    CONSTRAINT charges_cpt_id_fk FOREIGN KEY (cpt_id) REFERENCES public.cpt_codes (id),
    CONSTRAINT charges_created_by_fk FOREIGN KEY (created_by) REFERENCES public.users (id),
    CONSTRAINT charges_modifier1_id_fk FOREIGN KEY (modifier1_id) REFERENCES public.modifiers (id),
    CONSTRAINT charges_modifier2_id_fk FOREIGN KEY (modifier2_id) REFERENCES public.modifiers (id),
    CONSTRAINT charges_modifier3_id_fk FOREIGN KEY (modifier3_id) REFERENCES public.modifiers (id),
    CONSTRAINT charges_modifier4_id_fk FOREIGN KEY (modifier4_id) REFERENCES public.modifiers (id),
    CONSTRAINT charges_line_num_uc UNIQUE (claim_id,line_num)
);

COMMENT ON TABLE billing.charges IS 'charge lines for claims';

COMMENT ON COLUMN billing.charges.note IS 'One charge line can have one charge comment';

CREATE INDEX IF NOT EXISTS charges_claim_id_cpt_id_ix ON billing.charges(claim_id, cpt_id);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.charges_studies
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    charge_id BIGINT NOT NULL,
    study_id BIGINT NOT NULL,
    CONSTRAINT charges_studies_pk PRIMARY KEY (id),
    CONSTRAINT charges_studies_charge_id_study_id_uc UNIQUE (charge_id, study_id),
    CONSTRAINT charges_studies_charge_id_fk FOREIGN KEY (charge_id) REFERENCES billing.charges (id),
    CONSTRAINT charges_studies_study_id_fk FOREIGN KEY (study_id) REFERENCES public.studies (id)
);

COMMENT ON TABLE billing.charges_studies IS 'Charge originated from study';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.claim_icds
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    claim_id BIGINT NOT NULL,
    icd_id BIGINT NOT NULL,
    CONSTRAINT claim_icds_pk PRIMARY KEY (id),
    CONSTRAINT claim_icds_uc UNIQUE (claim_id, icd_id),
    CONSTRAINT claim_icds_claim_id_fk FOREIGN KEY (claim_id) REFERENCES billing.claims (id),
    CONSTRAINT claim_icd_id_fk FOREIGN KEY (icd_id) REFERENCES public.icd_codes (id)
);

COMMENT ON TABLE billing.claim_icds IS 'ICD codes for a claim';        

CREATE INDEX IF NOT EXISTS claim_icds_ix ON billing.claim_icds(claim_id, icd_id);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.claim_followups
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    claim_id BIGINT NOT NULL,
    assigned_to BIGINT NOT NULL,
    followup_date DATE NOT NULL,
    CONSTRAINT claim_followups_pk PRIMARY KEY (id),
    CONSTRAINT claim_followups_assigned_to_fk FOREIGN KEY (assigned_to) REFERENCES public.users (id),
    CONSTRAINT claim_followups_claim_id_fk  FOREIGN KEY (claim_id) REFERENCES billing.claims (id),
    CONSTRAINT claim_followups_claim_assigned_followp_uc UNIQUE(claim_id,assigned_to,followup_date)
);

COMMENT ON COLUMN billing.claim_followups.assigned_to IS 'Supervisor can asssign an user who will be responsible for a claim.This column stores the user who is responsible for claim follow-up';
COMMENT ON COLUMN billing.claim_followups.followup_date IS 'Followup date for a claim assigned by the supervisor';

CREATE INDEX IF NOT EXISTS claim_followup_claim_id_ix ON billing.claim_followups(claim_id);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.claim_comments
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    claim_id BIGINT NOT NULL, 
    note TEXT NOT NULL,
    type TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT NOT NULL,
    created_dt TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
    CONSTRAINT claim_comments_pk PRIMARY KEY (id),
    CONSTRAINT claim_comments_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT claim_comments_claim_id_fk FOREIGN KEY (claim_id) REFERENCES billing.claims (id),
    CONSTRAINT claim_comments_type_cc CHECK ( type in ('manual','auto','co_pay','co_insurance','deductible'))
);

COMMENT ON TABLE billing.claim_comments IS 'Auto-generated comments and  user entered comments of a claim ';

COMMENT ON COLUMN billing.claim_comments.note IS 'Auto generated comments for co-Pay, co-insurance, deductible entries of a claim. Also it has manually entered comments for a claim and manually entered payment comments for a claim.';

COMMENT ON COLUMN billing.claim_comments.is_internal IS 'Whether the comments should be displayed in Billing reports';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.edi_files
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    file_store_id BIGINT NOT NULL,
    created_dt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_dt TIMESTAMPTZ DEFAULT NULL,
    status TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_md5 TEXT NOT NULL,
    uploaded_file_name TEXT NOT NULL,
    CONSTRAINT edi_files_pk PRIMARY KEY (id),
    CONSTRAINT edi_files_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies (id),
    CONSTRAINT edi_files_file_store_id_fk FOREIGN KEY (file_store_id) REFERENCES public.file_stores (id),
    CONSTRAINT edi_files_status_cc CHECK ( status in ('pending', 'in_progress', 'success','failure')),
    CONSTRAINT edi_files_file_type_cc CHECK ( file_type in ('835', '837')),
    CONSTRAINT edi_files_file_path_cc CHECK (TRIM(file_path) <> '')
);

-- CREATE UNIQUE INDEX IF NOT EXISTS edi_files_file_path_ux ON billing.edi_files(lower(file_path));
-- DROP INDEX IF EXISTS edi_files_file_path_ux;

COMMENT ON TABLE billing.edi_files IS 'Details of 837(EDI electronic claim) and 835 (ERA response) files';

COMMENT ON COLUMN billing.edi_files.file_store_id IS 'current file store  from companies table';
COMMENT ON COLUMN billing.edi_files.processed_dt IS 'when 835 was processed or when 837 was uploaded';
COMMENT ON COLUMN billing.edi_files.file_type IS '837 - EDI electronic claim or  835 - ERA response';
COMMENT ON COLUMN billing.edi_files.file_path IS 'path relative to file store root';
COMMENT ON COLUMN billing.edi_files.file_size IS 'file size in bytes';
COMMENT ON COLUMN billing.edi_files.file_md5 IS 'MD5 checksum of file that can be used for integrity';
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.is_edi_file_type (BIGINT, TEXT)
    RETURNS boolean
AS
$BODY$
    SELECT TRUE FROM billing.edi_files WHERE id = $1 AND file_type = $2;
$BODY$
LANGUAGE sql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.edi_file_claims
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    edi_file_id BIGINT NOT NULL,
    claim_id BIGINT NOT NULL,
    CONSTRAINT edi_file_claims_pk PRIMARY KEY (id),
    CONSTRAINT edi_file_claims_edi_file_id_fk FOREIGN KEY (edi_file_id) REFERENCES billing.edi_files(id),
    CONSTRAINT edi_file_claims_claim_id_fk FOREIGN KEY (claim_id) REFERENCES billing.claims(id),
    CONSTRAINT edi_file_claims_is_837_edi_file_cc CHECK(billing.is_edi_file_type(edi_file_id, '837')),
    CONSTRAINT edi_file_claims_edi_file_id_claim_id_uc UNIQUE (edi_file_id, claim_id)
);

COMMENT ON TABLE billing.edi_file_claims IS 'EDI Transaction batch can have multiple claims. This table holds all the claims in an EDI transaction batch';
-- --------------------------------------------------------------------------------------------------------------------
-- Billing 2.0 - New Payment module tables - Create Script
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.payments
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    facility_id BIGINT,
    patient_id BIGINT,
    insurance_provider_id BIGINT,
    provider_group_id BIGINT,
    provider_contact_id BIGINT,
    payment_reason_id BIGINT,
    amount MONEY NOT NULL,
    accounting_dt TIMESTAMPTZ,
    created_by BIGINT NOT NULL,
    payment_dt TIMESTAMPTZ NOT NULL DEFAULT now(),
    invoice_no TEXT,
    alternate_payment_id TEXT,
    payer_type TEXT NOT NULL,
    notes  TEXT,
    mode TEXT,
    card_name TEXT,
    card_number TEXT,
    CONSTRAINT payments_pk PRIMARY KEY (id),
    CONSTRAINT payments_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
    CONSTRAINT payments_facility_id_fk FOREIGN KEY (facility_id) REFERENCES public.facilities(id),
    CONSTRAINT payments_patient_id_fk FOREIGN KEY (Patient_id) REFERENCES public.patients (id),
    CONSTRAINT payments_created_dt_fk FOREIGN KEY (created_by) REFERENCES public.users (id),
    CONSTRAINT payments_insurance_provider_id_fk FOREIGN KEY (Insurance_provider_id) REFERENCES public.insurance_providers(id),
    CONSTRAINT payments_provider_group_id_fk  FOREIGN KEY (provider_group_id) REFERENCES public.provider_groups (id),
    CONSTRAINT payments_provider_contact_id_fk  FOREIGN KEY (Provider_contact_id) REFERENCES public.Provider_contacts (id),
    CONSTRAINT payments_payment_reason_id_fk  FOREIGN KEY (payment_reason_id) REFERENCES billing.payment_reasons(id),
    CONSTRAINT payments_payer_id_nullable_cc CHECK (
        CASE payer_type 
            WHEN 'patient' THEN patient_id IS NOT NULL
            WHEN 'insurance' THEN insurance_provider_id IS NOT NULL
            WHEN 'ordering_provider' THEN provider_contact_id IS NOT NULL
            WHEN 'ordering_facility' THEN provider_group_id IS NOT NULL
        END),   
    CONSTRAINT payments_payer_type_cc CHECK (payer_type in('insurance','patient' ,'ordering_facility', 'ordering_provider')),
    CONSTRAINT payments_mode_cc CHECK (mode in('eft','card' , 'cash' , 'check'))
);


COMMENT ON TABLE billing.payments IS 'Payment data for patients, insurance, ordering facility and provider';

COMMENT ON COLUMN billing.payments.payer_type IS 'Payer type like  Patient, Insurance, Ordering Provider,  Ordering facility';
COMMENT ON COLUMN billing.payments.accounting_dt IS 'Actual payment accounting date';
COMMENT ON COLUMN billing.payments.mode IS 'Payment mode like eft, cash, card, etc';
COMMENT ON COLUMN billing.payments.alternate_payment_id IS 'User entered payment id';

CREATE INDEX IF NOT EXISTS payments_payer_type_patient_ix ON billing.payments( payer_type, patient_id) where payer_type = 'patient';
CREATE INDEX IF NOT EXISTS payments_payer_type_insurance_provider_ix ON billing.payments( payer_type, insurance_provider_id) where payer_type = 'insurance';
CREATE INDEX IF NOT EXISTS payments_payer_type_provider_group_ix ON billing.payments( payer_type, provider_group_id) where payer_type = 'ordering_facility';
CREATE INDEX IF NOT EXISTS payments_payer_type_Provider_contact_ix ON billing.payments( payer_type, Provider_contact_id) where payer_type = 'ordering_provider';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.payment_applications
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    payment_id BIGINT NOT NULL,
    charge_id BIGINT NOT NULL,
    adjustment_code_id BIGINT,
    amount MONEY NOT NULL,
    amount_type TEXT NOT NULL,
    created_by BIGINT NOT NULL,
    applied_dt TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_applications_pk PRIMARY KEY (id),
    CONSTRAINT payment_applications_payment_id_fk FOREIGN KEY (payment_id) REFERENCES billing.payments (id),
    CONSTRAINT payment_applications_charge_id_fk FOREIGN KEY (charge_id) REFERENCES billing.charges (id),
    CONSTRAINT payment_applications_adjustment_code_id_fk FOREIGN KEY (adjustment_code_id) REFERENCES billing.adjustment_codes (id),
    CONSTRAINT payment_applications_created_by_fk FOREIGN KEY (created_by) REFERENCES public.users(id),
    CONSTRAINT payment_applications_amount_type_cc CHECK (amount_type IN ('payment','adjustment'))
);
CREATE INDEX IF NOT EXISTS payment_applications_charge_id_ix ON billing.payment_applications USING btree (charge_id);
CREATE INDEX IF NOT EXISTS payment_applications_payment_id_ix ON billing.payment_applications USING btree (payment_id);
CREATE INDEX IF NOT EXISTS payment_applications_adjustment_code_id_ix ON billing.payment_applications USING btree (adjustment_code_id);
CREATE INDEX IF NOT EXISTS payment_applications_created_by_ix ON billing.payment_applications USING btree (created_by);
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.is_adjustment_payment_application(BIGINT)
    RETURNS boolean
AS
$BODY$
    SELECT EXISTS (SELECT 1 FROM billing.payment_applications WHERE id = $1 and amount_type = 'adjustment');
$BODY$
LANGUAGE sql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.cas_payment_application_details
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    payment_application_id BIGINT NOT NULL,
    cas_group_code_id  BIGINT NOT NULL,
    cas_reason_code_id BIGINT NOT NULL,
    amount MONEY NOT NULL,
    CONSTRAINT cas_payment_application_details_pk  PRIMARY KEY (id),
    CONSTRAINT cas_payment_application_details_payment_application_id_fk FOREIGN KEY (payment_application_id) REFERENCES billing.payment_applications(id),
    CONSTRAINT cas_payment_application_details_cas_group_code_id_fk FOREIGN KEY(cas_group_code_id) REFERENCES billing.cas_group_codes(id),
    CONSTRAINT cas_payment_application_details_cas_reason_code_id_fk FOREIGN KEY(cas_reason_code_id) REFERENCES billing.cas_reason_codes(id),
    CONSTRAINT cas_payment_application_details_pymt_appl_group_reason_code_uc UNIQUE (payment_application_id,cas_group_code_id,cas_reason_code_id),
    CONSTRAINT cas_payment_application_details_is_adj_payment_application_cc CHECK (billing.is_adjustment_payment_application(payment_application_id))
);

COMMENT ON TABLE billing.cas_payment_application_details IS 'For CAS transaction data when processing ERA File';

COMMENT ON COLUMN billing.cas_payment_application_details.amount IS 'User entered adjustment amount from ERA file';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.edi_file_payments
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    edi_file_id BIGINT NOT NULL,
    payment_id BIGINT NOT NULL,
    CONSTRAINT edi_file_payments_pk PRIMARY KEY (id),
    CONSTRAINT edi_file_payments_edi_file_id_fk FOREIGN KEY (edi_file_id) REFERENCES billing.edi_files(id),
    CONSTRAINT edi_file_payments_payments_id_fk FOREIGN KEY (payment_id) REFERENCES billing.payments(id),
    CONSTRAINT edi_file_payments_is_835_edi_file_cc CHECK(billing.is_edi_file_type(edi_file_id, '835')),
    CONSTRAINT edi_file_payments_edi_file_id_payments_id_uc UNIQUE (edi_file_id, payment_id)
);
COMMENT ON TABLE billing.edi_file_payments IS 'Payments created from an ERA file';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.grid_filters
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id BIGINT NOT NULL,
    filter_order INTEGER NOT NULL,
    filter_type TEXT NOT NULL,
    filter_name TEXT NOT NULL,
    filter_info json NOT NULL,
    display_as_tab BOOLEAN DEFAULT FALSE,
    is_global_filter BOOLEAN DEFAULT FALSE,
    display_in_ddl BOOLEAN DEFAULT FALSE,
    inactivated_dt TIMESTAMPTZ,
    CONSTRAINT grid_filters_id_pk PRIMARY KEY (id),
    CONSTRAINT grid_filters_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id),
    CONSTRAINT grid_filters_filter_type_cc CHECK(filter_type IN ('studies','claims')),
    CONSTRAINT grid_filters_filter_name_uc UNIQUE(filter_type,filter_name)
);
COMMENT ON TABLE billing.grid_filters IS 'To maintain Display filter tabs in billing home page (Billed/Unbilled studies) & claim work bench';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.user_settings
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    default_tab TEXT NOT NULL,
    grid_name TEXT NOT NULL,
    default_column TEXT,
    default_column_order_by TEXT,
    field_order INTEGER[] NOT NULL,
    default_date_range TEXT NOT NULL,
    paper_claim_full_template_id bigint,
    paper_claim_original_template_id bigint,
    direct_invoice_template_id bigint,
    patient_invoice_template_id bigint,
    grid_field_settings json,
    CONSTRAINT billing_user_settings_id_pk PRIMARY KEY (id),
    CONSTRAINT billing_user_settings_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id),
    CONSTRAINT billing_user_settings_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
    CONSTRAINT billing_user_settings_default_date_range_cc CHECK(default_date_range IN ('last_7_days', 'last_30_days', 'last_month','next_30_days','this_month','this_year')),
    CONSTRAINT billing_user_settings_grid_name_cc CHECK(grid_name IN ('studies','claims'))
);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.status_color_codes
(
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    process_type TEXT NOT NULL ,
    process_status TEXT NOT NULL,
    color_code TEXT NOT NULL,
    CONSTRAINT status_color_codes_id_pk PRIMARY KEY (id),
    CONSTRAINT status_color_codes_company_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id),
    CONSTRAINT status_color_codes_process_type_cc CHECK(process_type IN ('study','claim','payment')),
    CONSTRAINT status_color_codes_process_type_process_status_uc UNIQUE(process_type,process_status),
    CONSTRAINT status_color_codes_process_type_color_code_uc UNIQUE(process_type,color_code)
);
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.audit_log
(
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  company_id INTEGER NOT NULL,
  entity_key BIGINT NOT NULL,
  created_by BIGINT NOT NULL,
  client_ip INET NOT NULL,
  created_dt TIMESTAMPTZ NOT NULL DEFAULT now(),
  entity_name TEXT NOT NULL,
  screen_name TEXT NOT NULL,
  module_name TEXT NOT NULL,
  description TEXT NOT NULL,
  changes JSONB NOT NULL,
  CONSTRAINT audit_log_pk PRIMARY KEY (id),
  CONSTRAINT audit_log_created_by_fk FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT audit_log_module_name_cc CHECK(module_name in ('setup','claims','payments','era','edi','reports'))
 ); 
CREATE INDEX IF NOT EXISTS audit_log_entity_name_entity_key_idx ON billing.audit_log (entity_name,entity_key);

COMMENT ON TABLE billing.audit_log IS 'To log all application level changes in each table from setup,claims and payments module of billing 1.5 application';

COMMENT ON COLUMN billing.audit_log.entity_name IS 'It is the affected table name in billing schema';
COMMENT ON COLUMN billing.audit_log.entity_key IS 'It is the primary key of the affected row';
COMMENT ON COLUMN billing.audit_log.entity_key IS 'To store old and new values of the affected row ';
-- --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing.insurance_provider_details
(
  insurance_provider_id bigint NOT NULL,
  clearing_house_id bigint,
  billing_method text,
  claim_filing_indicator_code text,
  CONSTRAINT b_insurance_provider_id_pk PRIMARY KEY (insurance_provider_id),
  CONSTRAINT b_insurance_providers_clearing_house_id_fk FOREIGN KEY (clearing_house_id) REFERENCES billing.edi_clearinghouses (id),
  CONSTRAINT insurance_providers_insurance_provider_id_fk FOREIGN KEY (insurance_provider_id) REFERENCES insurance_providers (id),
  CONSTRAINT insurance_provider_details_ins_id_clear_house_id_uc UNIQUE (insurance_provider_id, clearing_house_id),
  CONSTRAINT insurance_providers_ins_id_clear_house_id_uc UNIQUE (insurance_provider_id, billing_method),
  CONSTRAINT insurance_provider_details_billing_method_cc CHECK (billing_method IN ('patient_payment', 'direct_billing', 'electronic_billing', 'paper_claim'))
);
END
$$;
-- ====================================================================================================================