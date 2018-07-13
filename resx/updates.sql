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
    CONSTRAINT claim_status_company_code_uc UNIQUE(company_id,code)
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
DROP INDEX IF EXISTS edi_files_file_path_ux;

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
    payment_application_id BIGINT,
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
  CONSTRAINT audit_log_module_name_cc CHECK(module_name in ('setup','claims','payments','era','edi'))
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
  CONSTRAINT b_insurance_provider_id_pk PRIMARY KEY (insurance_provider_id),
  CONSTRAINT b_insurance_providers_clearing_house_id_fk FOREIGN KEY (clearing_house_id) REFERENCES billing.edi_clearinghouses (id),
  CONSTRAINT insurance_providers_insurance_provider_id_fk FOREIGN KEY (insurance_provider_id) REFERENCES insurance_providers (id),
  CONSTRAINT insurance_provider_details_ins_id_clear_house_id_uc UNIQUE (insurance_provider_id, clearing_house_id),
  CONSTRAINT insurance_providers_ins_id_clear_house_id_uc UNIQUE (insurance_provider_id, billing_method)
  CONSTRAINT insurance_provider_details_billing_method_cc CHECK (billing_method IN ('patient_payment', 'direct_billing', 'electronic_billing', 'paper_claim'))
);
-- --------------------------------------------------------------------------------------------------------------------
-- Creating functions
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_claim_totals(bigint)
    RETURNS TABLE (
          studies_count                 bigint
        , charges_count                 bigint
        , charges_bill_fee_total        money
        , charges_allowed_amount_total  money
        , claim_cpt_description character varying[]
        , payments_count                bigint
        , payments_total                money
        , payments_applied_count        bigint
        , payments_applied_total        money
        , adjustments_applied_count     bigint
        , adjustments_applied_total     money
        , claim_balance_total           money
    ) AS
$BODY$


    -- to debug or see EXPLAIN plan, copy body of function to separate window, seach and replace $1 with claim id.
    WITH charges AS (
        SELECT
              count(cs.study_id)              AS studies_count
            , count(c.id)                     AS charges_count
            , sum(c.bill_fee * c.units)       AS charges_bill_fee_total
            , sum(c.allowed_amount * c.units) AS charges_allowed_amount_total
            , array_agg(pc.display_code) AS claim_cpt_description
        FROM
            billing.charges AS c
            INNER JOIN public.cpt_codes AS pc ON pc.id = c.cpt_id
            LEFT OUTER JOIN billing.charges_studies AS cs ON c.id = cs.charge_id   -- charges may or may not belong to studies os LEFT and don't count NULLs
        WHERE
            c.claim_id = $1
    )
    , payments AS (
        SELECT
              count(p.id)   AS payments_count
            , sum(p.amount) AS payments_total
        FROM
            billing.payments AS p
            INNER JOIN (
                SELECT
                    distinct pa.payment_id
                FROM
                    billing.charges AS c
                    INNER JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
                WHERE
                    c.claim_id = $1
            ) AS pa ON p.id = pa.payment_id
    )
    , applications AS (
        SELECT
              count(pa.amount) FILTER (WHERE pa.amount_type = 'payment')    AS payments_applied_count
            , coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'payment'),0::money)    AS payments_applied_total
            , count(pa.amount) FILTER (WHERE pa.amount_type = 'adjustment') AS adjustments_applied_count
            , coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'adjustment'),0::money) AS ajdustments_applied_total
        FROM
            billing.charges AS c
            INNER JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
            INNER JOIN billing.payments AS p ON pa.payment_id = p.id
        WHERE
            c.claim_id = $1
    )
    SELECT
          charges.*
        , payments.*
        , applications.*
        , charges.charges_bill_fee_total - (
            applications.payments_applied_total +
            applications.ajdustments_applied_total
        ) AS claim_balance_total
    FROM
          charges
        , payments
        , applications


$BODY$
LANGUAGE sql
VOLATILE
PARALLEL SAFE;


COMMENT ON FUNCTION billing.get_claim_totals(bigint) IS
$BODY$
Returns claim balance and other aggregate counts and totals for a given claim.
Returned columns are:

 1) studies_count                   - Number of studies (if any) that charges are for
 2) charges_count                   - Number of charges for claim
 3) charges_bill_fee_total          - Total amount of billed fees for charges
 4) charges_allowed_amount_total    - Total amount of allowed amounts for charges
 5) payments_count                  - Number of distinct payments used in payment applications
 6) payments_total                  - Total of all payment amounts for payments used in payment applications
 7) payments_applied_count          - Number of payment applications where amount_type = 'payment'
 8) payments_applied_total          - Total amount of payment applications where amount_type = 'payment'
 9) adjustments_applied_count       - Number of payment applications where amount_type = 'adjustment'
10) ajdustments_applied_total       - Total amount of payment applications where amount_type = 'adjustment'
11) claim_balance_total             - Claim balance based on formula: charges_bill_fee_total - (payments_applied_total + ajdustments_applied_total)

Examples:
SELECT billing.get_claim_totals(4161);                          -- returns RECORD
SELECT * FROM billing.get_claim_totals(4161);                   -- returns table row
SELECT claim_balance_total FROM billing.get_claim_totals(4161); -- return single column
SELECT to_jsonb(r) FROM billing.get_claim_totals(4161) r;       -- return row as binary json with all columns
SELECT row_to_json(r) FROM billing.get_claim_totals(4161) r;    -- same, return row as json with all columns

-- easily add one, few or all claim total columns to claim row
SELECT
      claims.id
    , claims.patient_id
    , claims.claim_dt
    , claim_totals.*
FROM
    billing.claims
    INNER JOIN LATERAL billing.get_claim_totals(claims.id) AS claim_totals ON TRUE
WHERE
    id = 4161;

-- for single total column you can also use subquery
SELECT
      claims.*
    , (SELECT claim_balance_total FROM billing.get_claim_totals(claims.id))
FROM
    billing.claims
WHERE
    id = 4161;
$BODY$;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_payment_totals(bigint)
    RETURNS TABLE (
          payment_total                 money
        , payments_applied_count        bigint
        , payments_applied_total        money
        , adjustments_applied_count     bigint
        , adjustments_applied_total     money
        , payment_status                text
        , payment_balance_total         money
    ) AS
$BODY$
    -- to debug or see EXPLAIN plan, copy body of function to separate window, seach and replace $1 with payment id.
    SELECT
          p.amount                                                               AS payment_total   -- retrned here for consistency with get_claim_totals()
        , pa.payments_applied_count
        , coalesce(pa.payments_applied_total,0::money)
        , pa.adjustments_applied_count
        , coalesce(pa.ajdustments_applied_total,0::money)
        , CASE
            WHEN p.amount = pa.payments_applied_total THEN 'fully_applied'
            WHEN p.amount < pa.payments_applied_total THEN 'over_applied'
            WHEN p.amount > pa.payments_applied_total THEN 'partially_applied'
            ELSE                                           'unapplied'
          END                                                                    AS payment_status
        , (p.amount - coalesce(pa.payments_applied_total,0::money))               AS payment_balance_total
    FROM
        billing.payments AS p
        LEFT OUTER JOIN (
            SELECT
                  payment_id
                , count(payment_id) FILTER (WHERE amount_type = 'payment')    AS payments_applied_count
                , sum(amount)       FILTER (WHERE amount_type = 'payment')    AS payments_applied_total
                , count(payment_id) FILTER (WHERE amount_type = 'adjustment') AS adjustments_applied_count
                , sum(amount)       FILTER (WHERE amount_type = 'adjustment') AS ajdustments_applied_total
            FROM
                billing.payment_applications
            GROUP BY
                payment_id
        ) AS pa ON pa.payment_id = p.id
    WHERE
        p.id = $1

$BODY$
LANGUAGE sql
VOLATILE
PARALLEL SAFE;


COMMENT ON FUNCTION billing.get_payment_totals(bigint) IS
$BODY$
Returns payment balance and other aggregate counts and totals for a given payment.
Returned columns are:

 1) payment_total                   - Total amount of payment received
 2) payments_applied_count          - Number of payment applications where amount_type = 'payment'
 3) payments_applied_total          - Total amount of payment applications where amount_type = 'payment'
 4) adjustments_applied_count       - Number of payment applications where amount_type = 'adjustment'
 5) ajdustments_applied_total       - Total amount of payment applications where amount_type = 'adjustment'
 6) payment_status                  - Payment status based on payment balance ('unapplied', 'fully_applied', 'partially_applied', 'over_applied')
 7) payment_balance_total           - Payment balance based on formula: payment_total - payments_applied_total

Examples:
SELECT billing.get_payment_totals(15);                          -- returns RECORD
SELECT * FROM billing.get_payment_totals(15);                   -- returns table row
SELECT claim_balance_total FROM billing.get_payment_totals(15); -- return single column
SELECT to_jsonb(r) FROM billing.get_payment_totals(15) r;       -- return row as binary json with all columns
SELECT row_to_json(r) FROM billing.get_payment_totals(15) r;    -- same, return row as json with all columns

-- easily add one, few or all payment total columns to payments row
SELECT
     payments.*
   , payment_totals.*
FROM
    billing.payments
    INNER JOIN LATERAL billing.get_payment_totals(payments.id) AS payment_totals ON TRUE
WHERE
    payments.id = 15

-- for single total column you can also use subquery
SELECT
      payments.*
    , (SELECT payment_balance_total FROM billing.get_payment_totals(payments.id))
FROM
    billing.payments
WHERE
    id = 15
$BODY$;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.create_audit(
    i_company_id bigint,
    i_entity_name text,
    i_entity_key bigint,
    i_screen_name text,
    i_module_name text,
    i_log_description text,
    i_client_ip text,
    i_changes jsonb,
    i_created_by bigint)
  RETURNS bigint AS
$BODY$
BEGIN
    INSERT INTO billing.audit_log(
	  company_id,
	  entity_name,
	  entity_key,
	  screen_name,
	  module_name,
	  description,
	  client_ip,
	  changes,
	  created_by,
	  created_dt
    ) VALUES (
	i_company_id,
	i_entity_name,
	i_entity_key,
	i_screen_name,
	i_module_name,
	i_log_description,
	i_client_ip::inet,
	i_changes,
	i_created_by,
	now()
    );

    return i_entity_key;
END
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.create_charge(
    i_claim_id bigint,
    i_cpt_id bigint,
    i_pointer1 text,
    i_pointer2 text,
    i_pointer3 text,
    i_pointer4 text,
    i_modifier1_id bigint,
    i_modifier2_id bigint,
    i_modifier3_id bigint,
    i_modifier4_id bigint,
    i_bill_fee money,
    i_allowed_amount money,
    i_units bigint,
    i_created_by bigint,
    i_authorization_no text,
    i_charge_dt timestamp with time zone,
    i_study_id bigint,
    i_audit_details json)
  RETURNS boolean AS
$BODY$
DECLARE

    p_audit_id BIGINT;
    p_screen_name TEXT;
    p_module_name TEXT;
    p_entity_name TEXT;
    p_client_ip TEXT;
    p_user_id BIGINT;
    p_company_id BIGINT; 
    p_bill_fee MONEY;
    p_allowed_fee MONEY;

BEGIN

    p_screen_name := i_audit_details ->> 'screen_name';
    p_module_name := i_audit_details ->> 'module_name';
    p_client_ip := i_audit_details ->> 'client_ip';
    p_entity_name := i_audit_details ->> 'entity_name';
    p_user_id := (i_audit_details ->> 'user_id')::BIGINT;
    p_company_id := (i_audit_details ->> 'company_id')::BIGINT;

    IF i_bill_fee = 0::money THEN
       p_bill_fee = billing.get_computed_bill_fee(i_claim_id,i_cpt_id,i_modifier1_id,i_modifier2_id,i_modifier3_id,i_modifier4_id,'billing',NULL);
    ELSE 
       p_bill_fee = i_bill_fee;
    END IF;

    IF i_allowed_amount = 0::money THEN
       p_allowed_fee = billing.get_computed_bill_fee(i_claim_id,i_cpt_id,i_modifier1_id,i_modifier2_id,i_modifier3_id,i_modifier4_id,'allowed',NULL);
    ELSE 
       p_allowed_fee = i_allowed_amount;
    END IF;

	WITH save_charges AS (
		INSERT INTO billing.charges 
			( claim_id     
			, cpt_id
			, modifier1_id
			, modifier2_id
			, modifier3_id
			, modifier4_id
			, bill_fee
			, allowed_amount
			, units
			, created_by
			, charge_dt
			, pointer1
			, pointer2
			, pointer3
			, pointer4
			, authorization_no)
		values 
			( i_claim_id
			, i_cpt_id
			, i_modifier1_id
			, i_modifier2_id
			, i_modifier3_id
			, i_modifier4_id
			, p_bill_fee
			, p_allowed_fee
			, i_units
			, i_created_by
			, i_charge_dt
			, i_pointer1
			, i_pointer2
			, i_pointer3
			, i_pointer4
			, i_authorization_no
		) RETURNING *, '{}'::jsonb old_values), 
	save_charge_study AS (
		INSERT INTO billing.charges_studies
			( charge_id
			, study_id)
		SELECT
			sch.id
			,i_study_id
		FROM save_charges sch
		WHERE i_study_id is not null),
	charge_insert_audit_cte AS (
		SELECT billing.create_audit 
			(p_company_id,
			p_screen_name,
			sc.id,
			p_screen_name,
			p_module_name,
			'Charge Created Id: ' || sc.id || ' For claim ID : ' || i_claim_id,
			p_client_ip,
			json_build_object(
				'old_values', COALESCE(sc.old_values, '{}'), 
				'new_values', ( SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM ( SELECT * FROM save_charges) temp_row))::jsonb,
			p_user_id) id
		FROM save_charges sc )
		 select id into p_audit_id  from charge_insert_audit_cte;

    RETURN TRUE;
END;
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.create_claim_charge(
    i_claim_details json,
    i_insurances_details json,
    i_claim_icds json,
    i_audit_details json,
    i_charge_details json)
  RETURNS boolean AS
$BODY$
DECLARE

    p_audit_id BIGINT;
    p_claim_id BIGINT;
    p_screen_name TEXT;
    p_module_name TEXT;
    p_entity_name TEXT;
    p_client_ip TEXT;
    p_user_id BIGINT;
    p_company_id BIGINT;
    p_result json;
    
BEGIN

    p_screen_name := i_audit_details ->> 'screen_name';
    p_module_name := i_audit_details ->> 'module_name';
    p_client_ip := i_audit_details ->> 'client_ip';
    p_entity_name := i_audit_details ->> 'entity_name';
    p_user_id := (i_audit_details ->> 'user_id')::BIGINT;
    p_company_id := (i_audit_details ->> 'company_id')::BIGINT;

	WITH save_patient_insurances AS (
		INSERT INTO public.patient_insurances (
			  patient_id
			, insurance_provider_id
			, subscriber_zipcode
			, subscriber_relationship_id
			, coverage_level
			, policy_number
			, group_number
			, subscriber_employment_status_id
			, subscriber_firstname
			, subscriber_lastname
			, subscriber_middlename
			, subscriber_name_suffix
			, subscriber_gender
			, subscriber_address_line1
			, subscriber_address_line2
			, subscriber_city
			, subscriber_state
			, assign_benefits_to_patient
			, subscriber_dob
			, valid_from_date
			, valid_to_date
			, medicare_insurance_type_code)
		SELECT
			  patient_id
			, insurance_provider_id
			, subscriber_zipcode
			, subscriber_relationship_id
			, coverage_level
			, policy_number
			, group_number
			, subscriber_employment_status_id
			, subscriber_firstname
			, subscriber_lastname
			, subscriber_middlename
			, subscriber_name_suffix
			, subscriber_gender
			, subscriber_address_line1
			, subscriber_address_line2
			, subscriber_city
			, subscriber_state
			, assign_benefits_to_patient
			, subscriber_dob
			, now()
			, now() + interval '1 month'
			, medicare_insurance_type_code
		FROM
		    json_to_recordset(i_insurances_details) AS insurances (
			  patient_id bigint
			, insurance_provider_id bigint
			, subscriber_zipcode text
			, subscriber_relationship_id bigint
			, coverage_level text
			, policy_number text
			, group_number text
			, subscriber_employment_status_id bigint
			, subscriber_firstname text
			, subscriber_lastname text
			, subscriber_middlename text
			, subscriber_name_suffix text
			, subscriber_gender text
			, subscriber_address_line1 text
			, subscriber_address_line2 text
			, subscriber_city text
			, subscriber_state text
			, assign_benefits_to_patient boolean
			, subscriber_dob date
			, valid_from_date date
			, valid_to_date date
			, medicare_insurance_type_code bigint)
			RETURNING id,coverage_level),
	save_claim AS (
		INSERT INTO billing.claims (
			  company_id
			, facility_id
			, patient_id
			, billing_provider_id
			, place_of_service_id
			, billing_code_id
			, billing_class_id
			, created_by
			, billing_method
			, billing_notes
			, claim_dt
			, current_illness_date
			, same_illness_first_date
			, unable_to_work_from_date
			, unable_to_work_to_date
			, hospitalization_from_date
			, hospitalization_to_date
			, claim_notes
			, original_reference
			, authorization_no
			, frequency
			, is_auto_accident
			, is_other_accident
			, is_employed
			, service_by_outside_lab
			, payer_type
			, claim_status_id
			, rendering_provider_contact_id
			, primary_patient_insurance_id
			, secondary_patient_insurance_id
			, tertiary_patient_insurance_id
			, ordering_facility_id
			, referring_provider_contact_id)
		VALUES (
			  (i_claim_details ->> 'company_id')::BIGINT
			, (i_claim_details ->> 'facility_id')::BIGINT
			, (i_claim_details ->> 'patient_id')::BIGINT
			, (i_claim_details ->> 'billing_provider_id')::BIGINT
			, (i_claim_details ->> 'place_of_service_id')::BIGINT
			, (i_claim_details ->> 'billing_code_id')::BIGINT
			, (i_claim_details ->> 'billing_class_id')::BIGINT
			, (i_claim_details ->> 'created_by')::BIGINT
			, i_claim_details ->> 'billing_method'
			, i_claim_details ->> 'billing_notes'
			, (i_claim_details ->> 'claim_dt')::TIMESTAMPTZ
			, (i_claim_details ->> 'current_illness_date')::DATE
			, (i_claim_details ->> 'same_illness_first_date')::DATE
			, (i_claim_details ->> 'unable_to_work_from_date')::DATE
			, (i_claim_details ->> 'unable_to_work_to_date')::DATE
			, (i_claim_details ->> 'hospitalization_from_date')::DATE
			, (i_claim_details ->> 'hospitalization_to_date')::DATE
			, i_claim_details ->> 'claim_notes'
			, i_claim_details ->> 'original_reference'
			, i_claim_details ->> 'authorization_no'
			, i_claim_details ->> 'frequency'
			, (i_claim_details ->> 'is_auto_accident')::boolean
			, (i_claim_details ->> 'is_other_accident')::boolean
			, (i_claim_details ->> 'is_employed')::boolean
			, (i_claim_details ->> 'service_by_outside_lab')::boolean
			, i_claim_details ->> 'payer_type'
			, (i_claim_details ->> 'claim_status_id')::BIGINT
			, (i_claim_details ->> 'rendering_provider_contact_id')::BIGINT
			, (SELECT id FROM save_patient_insurances WHERE coverage_level = 'primary')
			, (SELECT id FROM save_patient_insurances WHERE coverage_level = 'secondary')
			, (SELECT id FROM save_patient_insurances WHERE coverage_level = 'tertiary')
			, (i_claim_details ->> 'ordering_facility_id')::BIGINT
			, (i_claim_details ->> 'referring_provider_contact_id')::BIGINT)
		RETURNING  *, '{}'::jsonb old_values),
	save_claim_icds AS (
		INSERT INTO billing.claim_icds (
			claim_id
			, icd_id)
		SELECT 
			  (SELECT id FROM save_claim)
			, icd_id
                FROM json_to_recordset(i_claim_icds) AS icds (
			icd_id bigint)),
	claim_insert_audit_cte AS (
		SELECT billing.create_audit (
			p_company_id,
			p_screen_name,
			sc.id,
			p_screen_name,
			p_module_name,
			'Claim Created Id: ' || sc.id || ' For patient ID : ' || sc.patient_id,
			p_client_ip,
			json_build_object(
				'old_values', COALESCE(sc.old_values, '{}'),
				'new_values', ( SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM ( SELECT * FROM save_claim) temp_row))::jsonb,
			p_user_id) id
		FROM save_claim sc)
		select ciac.id,sc.id INTO p_audit_id,p_claim_id  FROM save_claim sc,claim_insert_audit_cte ciac;

		PERFORM  billing.create_charge( 
			p_claim_id
			,charges.cpt_id
			,charges.pointer1
			,charges.pointer2
			,charges.pointer3
			,charges.pointer4
			,charges.modifier1_id
			,charges.modifier2_id
			,charges.modifier3_id
			,charges.modifier4_id
			,charges.bill_fee
			,charges.allowed_amount
			,charges.units
			,charges.created_by
			,charges.authorization_no
			,charges.charge_dt
			,charges.study_id
			,i_audit_details)
		FROM (
			SELECT * from 
				json_to_recordset(i_charge_details) as x(
					  cpt_id bigint
					, pointer1 text
					, pointer2 text
					, pointer3 text
					, pointer4 text
					, modifier1_id bigint
					, modifier2_id bigint
					, modifier3_id bigint
					, modifier4_id bigint
					, bill_fee money
					, allowed_amount money
					, units bigint
					, created_by bigint
					, authorization_no text
					, charge_dt timestamptz
					, study_id bigint )
		) charges;

    RETURN TRUE;
END;
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.create_payment_applications(
    IN i_payment_id bigint,
    IN i_adjustment_code_id bigint,
    IN i_created_by bigint,
    IN i_charge_details jsonb,
    IN i_audit_details json)
  RETURNS TABLE(payment_application_ids json) AS
$BODY$
BEGIN

	RETURN QUERY

	SELECT row_to_json(x2) from (
		SELECT	billing.create_payment_applications(
				i_payment_id,
				charges.charge_id,
				charges.payment,
				charges.adjustment,
				i_adjustment_code_id,
				i_created_by,
				charges.cas_details,	
				i_audit_details
			)
		FROM	(select * from jsonb_to_recordset(i_charge_details) as x(charge_id bigint, payment money, adjustment money, cas_details jsonb )) charges
	) x2;
END
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION billing.create_payment_applications(
    IN i_payment_id bigint,
    IN i_charge_id bigint,
    IN i_payment_amount money,
    IN i_adjustment_amount money,
    IN i_adjustment_code_id bigint,
    IN i_created_by bigint,
    IN i_cas_details jsonb,
    IN i_audit_details json)
  RETURNS TABLE(payment_application_id bigint, payment_application_adjustment_id bigint, cas_payment_application_detail_id bigint) AS
$BODY$
DECLARE
  p_screen_name TEXT;
  p_module_name TEXT;
  p_client_ip TEXT;
  p_user_id BIGINT;
  p_company_id BIGINT;
BEGIN

  p_screen_name := i_audit_details->>'screen_name';
  p_module_name := i_audit_details->>'module_name';
  p_client_ip := i_audit_details->>'client_ip';
  p_user_id := (i_audit_details->>'user_id')::BIGINT;
  p_company_id := (i_audit_details->>'company_id')::BIGINT;

	RETURN QUERY
	
	WITH 
	payment_cte as (
		INSERT INTO billing.payment_applications( 
			payment_id,
			charge_id,
			amount_type,
			amount,
			created_by
		) VALUES (
			i_payment_id,
			i_charge_id,
			'payment',
			i_payment_amount,
			i_created_by
		)
		RETURNING *, '{}'::jsonb old_values
	),

	adjustment_cte as (
		INSERT INTO billing.payment_applications( 
			payment_id,
			charge_id,
			amount_type,
			amount,
			adjustment_code_id,
			created_by,
			payment_application_id
		) (SELECT 
			i_payment_id,
			i_charge_id,
			'adjustment' AS amount_type,
			i_adjustment_amount,
			i_adjustment_code_id,
			i_created_by,
			payment_cte.id
		FROM payment_cte
		WHERE i_adjustment_amount != 0::money OR i_cas_details != '[]'::jsonb)

		RETURNING *, '{}'::jsonb old_values
	),

	cas_cte as (
		INSERT INTO billing.cas_payment_application_details( 
			payment_application_id,
			cas_group_code_id,
			cas_reason_code_id,
			amount
		) (
		SELECT 	adjustment_cte.id,
			cas.group_code_id,
			cas.reason_code_id,
			cas.amount
		FROM
			(SELECT * FROM jsonb_to_recordset(i_cas_details) AS x(group_code_id int, reason_code_id int, amount money)) cas 
				INNER JOIN adjustment_cte on true WHERE adjustment_cte.id is not null
		)

		RETURNING *, '{}'::jsonb old_values
	),
	insert_payment_audit_cte as(
		SELECT billing.create_audit(
			  p_company_id
			, p_screen_name
			, pc.id
			, p_screen_name
			, p_module_name
			, 'Payment applied for Payment id: ' || pc.payment_id || ' Charge id :' || pc.charge_id || ' Amount :' || amount
			, p_client_ip
			, json_build_object(
			      'old_values', COALESCE(pc.old_values, '{}'),
			      'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM payment_cte) temp_row)
			  )::jsonb
			, p_user_id
			) AS audit_id
		FROM payment_cte pc
		WHERE pc.id IS NOT NULL
	),
	insert_adjustment_audit_cte as(
		SELECT billing.create_audit(
			  p_company_id
			, p_screen_name
			, pc.id
			, p_screen_name
			, p_module_name
			, 'Adjustment applied for Payment id: ' || pc.payment_id || ' Charge id :' || pc.charge_id ||' Amount :' || amount
			, p_client_ip
			, json_build_object(
			      'old_values', COALESCE(pc.old_values, '{}'),
			      'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM adjustment_cte) temp_row)
			  )::jsonb
			, p_user_id
			) AS audit_id
		FROM adjustment_cte pc
		WHERE pc.id IS NOT NULL
	),
	cas_audit_cte as(
		SELECT billing.create_audit(
			  p_company_id
			, p_screen_name
			, pc.id
			, p_screen_name
			, p_module_name
			, 'Cas apllied For payment Id ' || i_payment_id || ' Charge Id: ' || i_charge_id
			, p_client_ip
			, json_build_object(
			      'old_values', COALESCE(pc.old_values, '{}'),
			      'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM cas_cte limit 1) temp_row)
			  )::jsonb
			, p_user_id
			) AS audit_id
		FROM cas_cte pc
		WHERE pc.id IS NOT NULL
	)
	SELECT	adjustment_cte.payment_application_id, 
		cas_cte.payment_application_id as payment_application_adjustment_id, 
		cas_cte.id as cas_payment_application_detail_id
	FROM	cas_cte
	INNER 	JOIN adjustment_cte ON adjustment_cte.id = cas_cte.payment_application_id
	UNION ALL
	SELECT audit_id, null,null FROM insert_payment_audit_cte
	UNION ALL
	SELECT audit_id, null,null FROM insert_adjustment_audit_cte
	UNION ALL
	SELECT audit_id, null,null FROM cas_audit_cte;
END
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_claim_payments(IN bigint)
  RETURNS TABLE(studies_count bigint, charges_count bigint, charges_bill_fee_total money, charges_allowed_amount_total money, payments_count bigint, payments_total money, payments_applied_count bigint, payments_applied_total money, adjustments_applied_count bigint, adjustments_applied_total money, payment_insurance_total money, payment_patient_total money, claim_balance_total money) AS
$BODY$


    -- to debug or see EXPLAIN plan, copy body of function to separate window, seach and replace $1 with claim id.
    WITH charges AS (
        SELECT
              count(cs.study_id)              AS studies_count
            , count(c.id)                     AS charges_count
            , sum(c.bill_fee * c.units)       AS charges_bill_fee_total
            , sum(c.allowed_amount * c.units) AS charges_allowed_amount_total
        FROM
            billing.charges AS c
            LEFT OUTER JOIN billing.charges_studies AS cs ON c.id = cs.charge_id  -- charges may or may not belong to studies os LEFT and don't count NULLs
        WHERE
            c.claim_id = $1
    )
    , payments AS (
        SELECT
              count(p.id)   AS payments_count
            , sum(p.amount) AS payments_total
        FROM
            billing.payments AS p
            INNER JOIN (
                SELECT
                    distinct pa.payment_id
                FROM
                    billing.charges AS c
                    INNER JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
                WHERE
                    c.claim_id = $1
            ) AS pa ON p.id = pa.payment_id
    )
    , applications AS (
        SELECT
              count(pa.amount) FILTER (WHERE pa.amount_type = 'payment')    AS payments_applied_count
            , coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'payment'),0::money)    AS payments_applied_total
            , count(pa.amount) FILTER (WHERE pa.amount_type = 'adjustment') AS adjustments_applied_count
            , coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'adjustment'),0::money) AS ajdustments_applied_total
,coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'payment' AND payer_type='insurance'),0::money)    AS payment_insurance_total
,coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'payment' AND payer_type='patient'),0::money)    AS payment_patient_total
        FROM
            billing.charges AS c
            INNER JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
            INNER JOIN billing.payments AS p ON pa.payment_id = p.id
        WHERE
            c.claim_id = $1
    )
    SELECT
          charges.*
        , payments.*
        , applications.*
        , charges.charges_bill_fee_total - (
            applications.payments_applied_total +
            applications.ajdustments_applied_total
        ) AS claim_balance_total
    FROM
          charges
        , payments
        , applications


$BODY$
  LANGUAGE sql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_age_patient_claim(bigint, bigint)
  RETURNS TABLE(patient_age_0_30 money, patient_age_31_60 money, patient_age_61_90 money, patient_age_91_120 money, patient_age_121 money, insurance_age_0_30 money, insurance_age_31_60 money, insurance_age_61_90 money, insurance_age_91_120 money, insurance_age_121 money, total_balance money, patient_total money, insurance_total money, total_age_30 money, total_age_31_60 money, total_age_61_90 money, total_age_91_120 money, total_age_121 money, total_unapplied money) AS
$BODY$


  WITH claims_sum AS ( SELECT  (SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) FROM  billing.get_claim_payments(claims.id)) as balance,
		  (select payment_patient_total from billing.get_claim_payments(claims.id)) AS total_patient_payment,
		  (select payment_insurance_total from billing.get_claim_payments(claims.id)) AS total_insurance_payment,
		  payer_type,
		  (CASE WHEN   ar_dates.num_days < 31 THEN 'age_0_30'
			WHEN   ar_dates.num_days <  61 THEN 'age_31_60'
			WHEN  ar_dates.num_days  <  91 THEN 'age_61_90'
			WHEN  ar_dates.num_days  < 121 THEN 'age_91_120' ELSE 'age_121' END  ) as age_days
		FROM billing.claims 

 JOIN LATERAL (
         SELECT now()::date - claim_dt::date AS num_days
     ) AS ar_dates ON TRUE

		WHERE patient_id=  $1 AND CASE WHEN $2 != 0 THEN billing_provider_id = $2 ELSE 1 = 1 END
)
, payment_sum as(
	 SELECT COALESCE(NULLIF(sum(balance) FILTER (WHERE age_days = 'age_0_30' AND payer_type='patient'), 0::money),0::money) as patient_age_0_30 ,
		COALESCE(NULLIF(sum(balance) FILTER (WHERE age_days = 'age_31_60' AND payer_type='patient'), 0::money),0::money) as patient_age_31_60 ,
		COALESCE(NULLIF(sum(balance) FILTER (WHERE age_days = 'age_61_90' AND payer_type='patient'), 0::money),0::money) as patient_age_61_90 ,
		COALESCE(NULLIF(sum(balance) FILTER (WHERE age_days = 'age_91_120' AND payer_type='patient'), 0::money),0::money) as patient_age_91_120 ,
		COALESCE(NULLIF(sum(balance) FILTER (WHERE age_days = 'age_121' AND payer_type='patient') , 0::money),0::money) as patient_age_121 ,
		COALESCE(NULLIF(sum(balance) FILTER (WHERE age_days = 'age_0_30' AND payer_type !='patient'), 0::money),0::money) as insurance_age_0_30 ,
		COALESCE(NULLIF(sum(balance) FILTER (WHERE age_days = 'age_31_60'  AND payer_type !='patient'), 0::money),0::money) as insurance_age_31_60 ,
		COALESCE(NULLIF(sum(balance) FILTER (WHERE age_days = 'age_61_90'  AND payer_type !='patient'), 0::money),0::money) as insurance_age_61_90 ,
		COALESCE(NULLIF(sum(balance) FILTER (WHERE age_days = 'age_91_120'  AND payer_type !='patient'), 0::money),0::money) as insurance_age_91_120 ,
		COALESCE(NULLIF(sum(balance) FILTER (WHERE age_days = 'age_121'  AND payer_type !='patient') , 0::money),0::money) as insurance_age_121 ,
		COALESCE(NULLIF(sum(balance), 0::money),0::money) as total_balance 
		FROM claims_sum
)
 
,total_sum as (SELECT  	SUM(patient_age_0_30 +patient_age_31_60 +patient_age_61_90+patient_age_91_120+patient_age_121) as patient_total,
			SUM(insurance_age_0_30 +insurance_age_31_60 +insurance_age_61_90+insurance_age_91_120+insurance_age_121) as insurance_total,
			SUM(patient_age_0_30+insurance_age_0_30) as total_age_30 ,
			SUM(patient_age_31_60+insurance_age_31_60) as total_age_31_60 ,
			SUM(patient_age_61_90+insurance_age_61_90) as total_age_61_90 ,
			SUM(patient_age_91_120+insurance_age_91_120) as total_age_91_120,
			SUM(patient_age_121+insurance_age_121) as total_age_121 			
			FROM payment_sum)

,total_unapplied as (SELECT COALESCE(NULLIF(sum(amount), 0::money),0::money) as unapplied
					FROM    billing.payments		
					WHERE patient_id= $1   AND (SELECT payment_status FROM  billing.get_payment_totals(payments.id)) = 'unapplied') 

SELECT *
 FROM payment_sum,total_sum,total_unapplied

$BODY$
  LANGUAGE sql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_charge_icds(p_charge_id bigint)
  RETURNS text[] AS
$BODY$
DECLARE
	l_claim_id BIGINT;
	l_pointer1 INTEGER;
	l_pointer2 INTEGER;
	l_pointer3 INTEGER;
	l_pointer4 INTEGER;
	l_icd_codes TEXT[];
	l_result TEXT[];
BEGIN 
	SELECT claim_id,pointer1::INTEGER,pointer2::INTEGER,pointer3::INTEGER,pointer4::INTEGER INTO l_claim_id,l_pointer1,l_pointer2,l_pointer3,l_pointer4 FROM billing.charges where id = p_charge_id;

	select array_agg(pic.code) INTO l_icd_codes From billing.claim_icds bci
	INNER JOIN public.icd_codes pic on pic.id = bci.icd_id
	WHERE claim_id = l_claim_id;
	
	IF l_pointer1 IS NOT NULL THEN   l_result  = l_result || l_icd_codes[l_pointer1]; END IF;
	IF l_pointer2 IS NOT NULL THEN   l_result  = l_result || l_icd_codes[l_pointer2]; END IF;
	IF l_pointer3 IS NOT NULL THEN   l_result  = l_result || l_icd_codes[l_pointer3]; END IF;
	IF l_pointer4 IS NOT NULL THEN   l_result  = l_result || l_icd_codes[l_pointer4]; END IF;

	return l_result;

END;
$BODY$
  LANGUAGE plpgsql IMMUTABLE;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_charge_other_payment_adjustmet(
    IN i_charge_id bigint,
    IN i_payment_id bigint)
  RETURNS TABLE(other_payment money, other_adjustment money) AS
$BODY$
BEGIN
	RETURN QUERY 
	   SELECT 
	        COALESCE(sum(amount) FILTER(where amount_type = 'payment'),0::money) as other_payment,
            COALESCE(sum(amount) FILTER(where amount_type = 'adjustment'),0::money) as other_adjustment
        FROM billing.payment_applications 
        WHERE   
            charge_id = i_charge_id
        AND payment_id != i_payment_id;
END;
$BODY$
LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_claim_patient_other_payment(IN i_claim_id bigint)
    RETURNS TABLE(patient_paid money, others_paid money) AS
$BODY$
BEGIN
	RETURN QUERY 
	   SELECT 
            COALESCE(sum(bpa.amount) FILTER(where bp.payer_type = 'patient' and bpa.amount_type = 'payment'),0::money) as patient_paid,
            COALESCE(sum(bpa.amount) FILTER(where bp.payer_type != 'patient' and bpa.amount_type = 'payment'),0::money) as others_paid
	   FROM billing.payments bp
	   INNER JOIN billing.payment_applications bpa on bpa.payment_id = bp.id
	   INNER JOIN billing.charges bch on bch.id = bpa.charge_id
	   INNER JOIN billing.claims bc on bc.id = bch.claim_id
	   WHERE   
	      bc.id = i_claim_id;
END;
$BODY$
LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_age_claim_payments(IN bigint)
  RETURNS TABLE(age_0_30 money, age_31_60 money, age_61_90 money, age_91_120 money, age_121 money, total_balance money, payment_insurance_total money, payment_patient_total money) AS
$BODY$


  WITH claims_sum AS ( SELECT  (SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) FROM  billing.get_claim_payments(claims.id)) as balance,
		  (select payment_patient_total from billing.get_claim_payments(claims.id)) AS total_patient_payment,
		  (select payment_insurance_total from billing.get_claim_payments(claims.id)) AS total_insurance_payment,
		(CASE WHEN   ar_dates.num_days <  31 THEN 'AGE_0_30'
			WHEN   ar_dates.num_days <  61 THEN 'AGE_31_60'
			WHEN  ar_dates.num_days <  91 THEN 'AGE_61_90'
			WHEN  ar_dates.num_days  < 121 THEN 'AGE_91_120' ELSE 'AGE_121' END  ) as age_days
 FROM billing.claims 

 JOIN LATERAL (
         SELECT now()::date - claim_dt::date AS num_days
     ) AS ar_dates ON TRUE
 WHERE patient_id= $1)

, payment_sum as(
	SELECT sum(total_patient_payment) as payment_patient_total ,sum(total_insurance_payment) as payment_insurance_total FROM claims_sum
)

,balance_sum  as (

	SELECT sum(balance) FILTER (WHERE age_days = 'AGE_0_30') as  AGE_0_30,
	       sum(balance)  FILTER (WHERE age_days = 'AGE_31_60') as AGE_31_60,
	       sum(balance) FILTER (WHERE age_days = 'AGE_61_90') as AGE_61_90,
               sum(balance) FILTER (WHERE age_days = 'AGE_91_120')  as AGE_91_120,
               sum(balance) FILTER (WHERE age_days = 'AGE_121') as  AGE_121
       FROM   claims_sum
),
total_sum as( SELECT (COALESCE(NULLIF(AGE_0_30, 0::money),0::money)+ COALESCE(NULLIF(AGE_31_60 ,0::money),0::money)+COALESCE(NULLIF(AGE_61_90 ,0::money),0::money)+COALESCE(NULLIF(AGE_91_120, 0::money),0::money)+COALESCE(NULLIF(AGE_121, 0::money),0::money)) as total_balance FROM balance_sum
)

SELECT COALESCE(NULLIF(AGE_0_30, 0::money),0::money) as AGE_0_30, COALESCE(NULLIF(AGE_31_60, 0::money),0::money) as AGE_31_60,COALESCE(NULLIF(AGE_61_90, 0::money),0::money) as AGE_61_90
,COALESCE(NULLIF(AGE_91_120, 0::money),0::money) as AGE_91_120
,COALESCE(NULLIF(AGE_121, 0::money),0::money) as AGE_121
, total_balance,payment_patient_total,payment_insurance_total FROM balance_sum,payment_sum ,total_sum
$BODY$
  LANGUAGE sql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_computed_bill_fee(
    p_claim_id bigint,
    p_cpt_id integer,
    p_modifier1 integer,
    p_modifier2 integer,
    p_modifier3 integer,
    p_modifier4 integer,
    p_category text,
    p_payer_type text)
  RETURNS money AS
$BODY$
        DECLARE
            l_payer_type TEXT;
            l_patient_id INTEGER;
	        l_primary_insurance_id INTEGER;
            l_secondary_insurance_id INTEGER;
            l_tertiary_insurance_id INTEGER;
            l_ordering_facility_id INTEGER;
	        l_referring_provider_contact_id INTEGER;
            l_facility_id INTEGER;
            l_ordering_physician_id INTEGER;
            l_claim_facility_id INTEGER;
            l_active_modifier INTEGER;
            l_modifier1 INTEGER;
            l_modifier2 INTEGER;
            l_modifier3 INTEGER;
            l_modifier4 INTEGER;
            l_fee_level TEXT;
            l_dynamic_fee_modifier_type TEXT;
            l_dynamic_fee_modifier TEXT;
            l_dynamic_fee_override MONEY;
            l_fee_override MONEY;
            l_facility_fs_id INTEGER;
            l_fee_fs_id INTEGER;
            l_derived_fs_id INTEGER;
            l_resp_fs_id INTEGER;
            l_resp_allowed_fs_id INTEGER;
            l_flag INTEGER DEFAULT 0;
            l_professional_fee MONEY;
            l_technical_fee MONEY;
            l_global_Fee MONEY;
            l_base_fee MONEY;
            l_result MONEY;
        BEGIN
            -- Gets the computed bill fee for a claim id and cpt id 
            -- Step-1  -- Validate the Input parameters and derrive the assigned fee schedule ID
            -- Getting the current responsible party and it's payer type

            SELECT
                c.payer_type,
                c.patient_id,
                c.primary_patient_insurance_id,
                c.secondary_patient_insurance_id,
		c.tertiary_patient_insurance_id,
                c.ordering_facility_id,
		c.referring_provider_contact_id,
                c.facility_id INTO STRICT l_payer_type,
                l_patient_id,
                l_primary_insurance_id,
		l_secondary_insurance_id,
		l_tertiary_insurance_id,
                l_ordering_facility_id,
		l_referring_provider_contact_id
                l_facility_id
            FROM
                billing.claims c
            WHERE
                1 = 1
                AND c.id = p_claim_id;
            l_payer_type = COALESCE (l_payer_type,
                'x');

            IF p_payer_type IS NOT NULL THEN
               l_payer_type := p_payer_type;
	        END IF;
            ---- Get the active_modifer from the parameter list
            l_modifier1 := p_modifier1;
            l_modifier2 := p_modifier2;
            l_modifier3 := p_modifier3;
            l_modifier4 := p_modifier4;
            IF l_modifier4 IS NOT NULL THEN
                l_active_modifier := l_modifier4;
            ELSIF l_modifier3 IS NOT NULL THEN
                l_active_modifier := l_modifier3;
            ELSIF l_modifier2 IS NOT NULL THEN
                l_active_modifier := l_modifier2;
            ELSIF l_modifier1 IS NOT NULL THEN
                l_active_modifier := l_modifier1;
            ELSE
                l_active_modifier := 0;
            END IF;

            -- Control gets here if Claim id and cpt id in the parameters list is valid
            -- Getting the fee schedule id assigned to the responsible party 
            IF l_payer_type = 'primary_insurance' OR l_payer_type = 'secondary_insurance' OR l_payer_type = 'tertiary_insurance' THEN
                SELECT
                    i.billing_fee_schedule_id,
                    i.allowed_fee_schedule_id INTO l_resp_fs_id,
                    l_resp_allowed_fs_id
                FROM
                    public.patient_insurances pi
                INNER JOIN 
		    public.insurance_providers i ON i.id = pi.insurance_provider_id
                WHERE
                    1 = 1
                    AND pi.id = CASE WHEN l_payer_type = 'primary_insurance' THEN l_primary_insurance_id
							WHEN l_payer_type = 'secondary_insurance' THEN l_secondary_insurance_id
							WHEN l_payer_type = 'tertiary_insurance' THEN l_tertiary_insurance_id
						   END
                    AND i.has_deleted IS FALSE
		            AND i.is_active IS TRUE
                     LIMIT 1;
            ELSIF l_payer_type = 'ordering_facility' THEN
                SELECT
                   pg.fee_schedule_id INTO l_resp_fs_id
                FROM
                    public.provider_groups pg
                WHERE
                    pg.id = l_ordering_facility_id
                    AND pg.has_deleted IS FALSE
                    AND pg.is_active IS TRUE
                    LIMIT 1;
            ELSIF l_payer_type = 'facility' THEN
                SELECT
                   fee_schedule_id INTO l_resp_fs_id
                FROM
                    public.facilities f
                WHERE
                    f.id = l_facility_id
                    AND f.has_deleted IS FALSE
                    AND f.is_active IS TRUE
                    LIMIT 1;
            ELSIF l_payer_type = 'referring_provider' THEN
                SELECT
                   p.fee_schedule_id INTO l_resp_fs_id
                FROM
                    public.provider_contacts pc
                INNER JOIN 
	            public.providers p 
	        ON  p.id = pc.provider_id
                WHERE
                    1 = 1
                    AND pc.id = l_referring_provider_contact_id
                    AND p.has_deleted IS FALSE
                    AND p.is_active IS TRUE
                    LIMIT 1;
	    ELSIF l_payer_type = 'patient' THEN
		SELECT
                    fs.id INTO l_resp_fs_id
                FROM
                    public.fee_schedules fs
                WHERE
                    1 = 1
                    AND fs.category = 'self_pay'
                    AND fs.inactivated_dt IS NULL
                    LIMIT 1;
		
            END IF;
            l_resp_fs_id := COALESCE (l_resp_fs_id,
                0);

            l_resp_allowed_fs_id := COALESCE (l_resp_allowed_fs_id,
                0);
            IF l_resp_fs_id = 0 THEN
                -- Getting the default fee schedule id and cpt code id from fee facilities
                SELECT
                    f.fee_schedule_id INTO l_facility_fs_id
                FROM
                    facilities f
                WHERE
                    f.id = l_facility_id
                    AND f.has_deleted IS FALSE
                    AND f.is_active IS TRUE
                    LIMIT 1;
                l_facility_fs_id := COALESCE (l_facility_fs_id,
                    0);
                --- If fee schedule is not attached to facility, take the default fee schedule from fee schedules setup
                IF l_facility_fs_id = 0 THEN
                    -- Getting the default fee schedule id from fee schedules
                    SELECT
                        fs.id INTO l_fee_fs_id
                    FROM
                        fee_schedules fs
                    WHERE
                        1 = 1
                        AND fs.category = 'default'
                        AND fs.inactivated_dt IS NULL
                        LIMIT 1;
                    l_fee_fs_id := COALESCE (l_fee_fs_id,
                        0);
                    l_derived_fs_id := l_fee_fs_id;
                ELSE
                    l_derived_fs_id := l_facility_fs_id;
                END IF;
            ELSE
                l_derived_fs_id := l_resp_fs_id;
            END IF;

              ------ Allowed only calculate for insurances   		
            IF p_category = 'allowed' THEN
		        IF l_payer_type = 'primary_insurance' OR l_payer_type = 'secondary_insurance' OR l_payer_type = 'tertiary_insurance' THEN
		            IF l_resp_allowed_fs_id != 0 THEN
			            l_derived_fs_id =  l_resp_allowed_fs_id;
		            END IF;
                ELSE
		            RETURN 0::MONEY;
	            END IF;
            END IF;
            -- Step- 2 -- Get the Fees from Fee_schedule_cpts based on the derived scheduled id
            SELECT
                professional_fee,
                technical_fee,
                global_fee INTO l_professional_fee,
                l_technical_fee,
                l_global_Fee
            FROM
                public.fee_schedule_cpts fsc
            WHERE
                1 = 1
                AND fsc.fee_schedule_id = l_derived_fs_id
                AND fsc.cpt_code_id = p_cpt_id
                LIMIT 1;
            -- Get the modifier details for the given input
	    SELECT 
	         m.level,
		 m.override_amount,
	         m.type,
	         m.sign,
		 m.modifier_amount INTO l_fee_level,
		 l_fee_override,
		 l_dynamic_fee_modifier_type,
		 l_dynamic_fee_modifier,
		 l_dynamic_fee_override
	    FROM
	         public.modifiers m 
	    WHERE 
                 m.id = l_active_modifier
                LIMIT 1;
            -- Calculate the base fee.
            IF l_fee_level = 'global' THEN
                l_base_fee := l_global_fee;
            ELSIF l_fee_level = 'technical' THEN
                l_base_fee := l_technical_fee;
            ELSIF l_fee_level = 'professional' THEN
                l_base_fee := l_professional_fee;
            ELSE
                l_base_fee := l_global_fee;
                -- Default the global fee if fee level is not defined
            END IF;

            l_base_fee := COALESCE (l_base_fee, 0::MONEY);
            
            -- Apply the modifiers
            IF COALESCE (l_fee_override,
                    0::MONEY) != 0::MONEY THEN
                l_base_fee := l_fee_override;
            ELSIF COALESCE (l_dynamic_fee_override,
                    0::MONEY) != 0::MONEY THEN
                IF l_dynamic_fee_modifier_type = 'value' THEN
                    -- Modifier type = 'value'
                    IF l_dynamic_fee_modifier = 'add' THEN
                        l_base_fee = l_base_fee + l_dynamic_fee_override;
                    ELSE
                        l_base_fee = l_base_fee - l_dynamic_fee_override;
                    END IF;
                ELSIF l_dynamic_fee_modifier_type = 'per' THEN
                    -- Modifier type = 'per'
                    IF l_dynamic_fee_modifier = 'add' THEN
                        l_base_fee = l_base_fee + (l_base_fee::numeric * l_dynamic_fee_override::numeric / 100)::money;
                    ELSE
                        l_base_fee = l_base_fee - (l_base_fee::numeric * l_dynamic_fee_override::numeric / 100)::money;
                    END IF;
                END IF;
            END IF;
            l_result := COALESCE (l_base_fee, 0::MONEY);
            ----------------------------------------------------------------------------------------------------------------------
            RETURN l_result;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
            RAISE NOTICE 'Claim Query failed - No Data Found';
        -- ???
        RETURN 0::MONEY;
        END;
        $BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_payment_applications(IN i_payment_id bigint)
  RETURNS TABLE(id bigint, payment_id bigint, charge_id bigint, adjustment_code_id bigint, payment_amount money, adjustment_amount money, payment_created_by bigint, adjustment_created_by bigint, payment_applied_dt timestamp with time zone, adjustment_applied_dt timestamp with time zone, payment_application_adjustment_id bigint) AS
$BODY$
BEGIN
	RETURN QUERY

	SELECT 	pa.id,
		pa.payment_id,
		pa.charge_id,
		pa_adjustment.adjustment_code_id,
		coalesce(pa.amount,0::money) as payment_amount,
		coalesce(pa_adjustment.amount,0::money) as adjustment_amount,
		pa.created_by as payment_created_by,
		pa_adjustment.created_by as adjustment_created_by,
		pa.applied_dt as payment_applied_dt,
		pa_adjustment.applied_dt as adjustment_applied_dt,
		pa_adjustment.id as payment_application_adjustment_id 
	FROM	billing.payment_applications pa
	LEFT JOIN LATERAL (
		SELECT 	* 
		FROM	billing.payment_applications  
		WHERE	payment_application_id = pa.id
	) pa_adjustment ON true
	WHERE	pa.payment_id = i_payment_id 
		AND pa.payment_application_id is null;

END
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_payment_applications(
    IN i_payment_id bigint,
    IN i_application_id bigint)
  RETURNS TABLE(id bigint, payment_id bigint, charge_id bigint, adjustment_code_id bigint, payment_amount money, adjustment_amount money, payment_created_by bigint, adjustment_created_by bigint, payment_applied_dt timestamp with time zone, adjustment_applied_dt timestamp with time zone, payment_application_adjustment_id bigint) AS
$BODY$
BEGIN
	RETURN QUERY

	SELECT 	pa.id,
		pa.payment_id,
		pa.charge_id,
		pa_adjustment.adjustment_code_id,
		coalesce(pa.amount,0::money) as payment_amount,
		coalesce(pa_adjustment.amount,0::money) as adjustment_amount,
		pa.created_by as payment_created_by,
		pa_adjustment.created_by as adjustment_created_by,
		pa.applied_dt as payment_applied_dt,
		pa_adjustment.applied_dt as adjustment_applied_dt,
		pa_adjustment.id as payment_application_adjustment_id 
	FROM	billing.payment_applications pa
	LEFT JOIN LATERAL (
		SELECT 	* 
		FROM	billing.payment_applications  
		WHERE	payment_application_id = pa.id
	) pa_adjustment ON true
	LEFT JOIN LATERAL (
		SELECT 	applied_dt 
		FROM	billing.payment_applications bpa
		WHERE	bpa.id = i_application_id
	) pa_batch ON true
	WHERE	pa.payment_id = i_payment_id 
		AND pa.applied_dt = pa_batch.applied_dt
		AND pa.amount_type = 'payment';

END
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.is_need_bill_fee_recaulculation(
    p_claim_id bigint,
    p_payer_type text,
    p_existing_payer_type text)
  RETURNS boolean AS
$BODY$
DECLARE
   l_payer_type TEXT;
   l_claim_status_id INTEGER;
   l_claim_status TEXT;
   l_bill_fee_recalculation BOOLEAN;
   
BEGIN 
	l_bill_fee_recalculation := TRUE;
	SELECT 
		    cs.description INTO STRICT l_claim_status
		FROM
		    billing.claim_status 
		WHERE 
	            id = l_claim_status_id;
	        
	     IF l_claim_status = 'Pending Validation' THEN
			IF (p_payer_type = 'patient' AND (p_existing_payer_type = 'ordering_facility' OR p_existing_payer_type = 'referring_provider' OR p_existing_payer_type = 'facility' OR p_existing_payer_type = 'primary_insurance' OR p_existing_payer_type = 'secondary_insurance' OR p_existing_payer_type = 'tertiary_insurance')) THEN
				l_bill_fee_recalculation = FALSE;
			ELSIF ((p_payer_type = 'primary_insurance' OR p_payer_type = 'secondary_insurance') AND p_existing_payer_type = 'tertiary_insurance') THEN
				l_bill_fee_recalculation = FALSE;
			ELSIF ((p_payer_type = 'primary_insurance' OR p_payer_type = 'tertiary_insurance') AND p_existing_payer_type = 'secondary_insurance') THEN
				l_bill_fee_recalculation = FALSE;
			ELSIF ((p_payer_type = 'secondary_insurance' OR p_payer_type = 'tertiary_insurance') AND p_existing_payer_type = 'primary_insurance') THEN
				l_bill_fee_recalculation = FALSE;
			END IF;
		END IF;

		IF p_payer_type = p_existing_payer_type THEN
		     l_bill_fee_recalculation = FALSE;
		END IF;
		
	RETURN l_bill_fee_recalculation;
END;
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.purge_claim(
    i_claim_id bigint,
    i_audit_details json)
  RETURNS boolean AS
$BODY$
DECLARE
  p_screen_name TEXT;
  p_module_name TEXT;
  p_client_ip TEXT;
  p_user_id BIGINT;
  p_company_id BIGINT;
  p_entity_name TEXT;
  p_result BIGINT;
BEGIN
  p_screen_name := i_audit_details->>'screen_name';
  p_entity_name := i_audit_details->>'entity_name';
  p_module_name := i_audit_details->>'module_name';
  p_client_ip := i_audit_details->>'client_ip';
  p_user_id := (i_audit_details->>'user_id')::BIGINT;
  p_company_id := (i_audit_details->>'company_id')::BIGINT;


        WITH get_claim_charge_ids AS(
		SELECT
                    bch.id
                FROM
                    billing.charges bch
                WHERE
                    bch.claim_id = i_claim_id
        ),
        purge_claim_icd AS(
           DELETE FROM billing.claim_icds bci
                 WHERE
                    bci.claim_id = i_claim_id
        ),
        purge_claim_followup AS(
           DELETE FROM billing.claim_followups bcf
                 WHERE
                    bcf.claim_id = i_claim_id
        ),
       purge_claim_comments AS(
           DELETE FROM billing.claim_comments bcc
                 WHERE
                    bcc.claim_id = i_claim_id
        ),
        purge_charge_studies AS(
           DELETE FROM billing.charges_studies bcs
                 WHERE
                    bcs.charge_id IN (SELECT * FROM get_claim_charge_ids)
        ),
	purge_cas_details AS(
        DELETE FROM billing.cas_payment_application_details
        WHERE payment_application_id IN (
                SELECT
                    bpa.id
                FROM
                    billing.payment_applications bpa
                WHERE
                    bpa.charge_id IN (SELECT * FROM get_claim_charge_ids)
                    AND bpa.amount_type = 'adjustment')
        RETURNING * ),
	purge_payment_applications AS (
        DELETE FROM billing.payment_applications
        WHERE charge_id IN (SELECT * FROM get_claim_charge_ids)
        RETURNING *),
	purge_charge AS (
	    DELETE FROM billing.charges
	    WHERE claim_id = i_claim_id
            RETURNING *), 
	purge_claims AS (
		DELETE FROM billing.claims bc
		WHERE bc.id = i_claim_id
		RETURNING *, '{}'::jsonb old_values ),
	purge_claim_audit AS(
	SELECT billing.create_audit(			  
		  p_company_id
		, p_entity_name
		, i_claim_id
		, p_screen_name
		, p_module_name
		, 'Claim Deleted Id: ' || i_claim_id || ' AND Claim related '|| coalesce((SELECT count(*) FROM purge_payment_applications),0) || ' Payment applications removed and ' || coalesce((SELECT count(*) FROM purge_cas_details),0) || ' Cas details removed '
		, p_client_ip
                , json_build_object(
                    'old_values', (SELECT COALESCE(old_values, '{}') FROM purge_claims),
                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM purge_claims) temp_row)
                  )::jsonb
		, p_user_id
		) AS audit_id
		FROM purge_claims pc
		WHERE pc.id IS NOT NULL),
	 purge_charge_audit AS(
	SELECT billing.create_audit(			  
		  p_company_id
		, p_entity_name
		, i_claim_id
		, p_screen_name
		, p_module_name
		, 'Charge Deleted Id: ' || pc.id
		, p_client_ip
                , json_build_object(
                    'old_values', (SELECT COALESCE(old_values, '{}') FROM purge_claims),
                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM purge_charge limit 1) temp_row)
                  )::jsonb
		, p_user_id
		) AS audit_id
		FROM purge_charge pc
		WHERE pc.id IS NOT NULL),
	audit_details as (SELECT pca.audit_id FROM purge_claim_audit pca
	UNION
	SELECT pch.audit_id FROM purge_charge_audit pch)
	select audit_id INTO p_result from audit_details;
	RETURN true;
END;
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION billing.purge_claim_or_charge(
    i_claim_charge_id bigint,
    i_type text,
    i_audit_details json)
  RETURNS boolean AS
$BODY$
DECLARE
  p_screen_name TEXT;
  p_module_name TEXT;
  p_client_ip TEXT;
  p_user_id BIGINT;
  p_company_id BIGINT;
  p_entity_name TEXT;
  p_result BIGINT;
BEGIN

  p_screen_name := i_audit_details->>'screen_name';
  p_entity_name := i_audit_details->>'entity_name';
  p_module_name := i_audit_details->>'module_name';
  p_client_ip := i_audit_details->>'client_ip';
  p_user_id := (i_audit_details->>'user_id')::BIGINT;
  p_company_id := (i_audit_details->>'company_id')::BIGINT;

 IF i_type = 'claim' THEN
 
      WITH get_claim_charge_ids AS(
		SELECT
                    bch.id
                FROM
                    billing.charges bch
                WHERE
                    bch.claim_id = i_claim_charge_id
        ),
        purge_claim_icd AS(
           DELETE FROM billing.claim_icds bci
                 WHERE
                    bci.claim_id = i_claim_charge_id
        ),
        purge_claim_followup AS(
           DELETE FROM billing.claim_followups bcf
                 WHERE
                    bcf.claim_id = i_claim_charge_id
        ),
       purge_claim_comments AS(
           DELETE FROM billing.claim_comments bcc
                 WHERE
                    bcc.claim_id = i_claim_charge_id
        ),
        purge_charge_studies AS(
           DELETE FROM billing.charges_studies bcs
                 WHERE
                    bcs.charge_id IN (SELECT * FROM get_claim_charge_ids)
        ),
	purge_cas_details AS(
        DELETE FROM billing.cas_payment_application_details
        WHERE payment_application_id IN (
                SELECT
                    bpa.id
                FROM
                    billing.payment_applications bpa
                WHERE
                    bpa.charge_id IN (SELECT * FROM get_claim_charge_ids)
                    AND bpa.amount_type = 'adjustment')
        RETURNING * ),
	purge_payment_applications AS (
        DELETE FROM billing.payment_applications
        WHERE charge_id IN (SELECT * FROM get_claim_charge_ids)
        RETURNING *),
	purge_charge AS (
	    DELETE FROM billing.charges
	    WHERE claim_id = i_claim_charge_id
            RETURNING *), 
	purge_claims AS (
		DELETE FROM billing.claims bc
		WHERE bc.id = i_claim_charge_id
		RETURNING *, '{}'::jsonb old_values ),
	purge_claim_audit AS(
	SELECT billing.create_audit(			  
		  p_company_id
		, p_entity_name
		, i_claim_charge_id
		, p_screen_name
		, p_module_name
		, 'Claim Deleted Id: ' || i_claim_charge_id || ' AND Claim related '|| coalesce((SELECT count(*) FROM purge_payment_applications),0) || ' Payment applications removed and ' || coalesce((SELECT count(*) FROM purge_cas_details),0) || ' Cas details removed '
		, p_client_ip
                , json_build_object(
                    'old_values', (SELECT COALESCE(old_values, '{}') FROM purge_claims),
                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM purge_claims) temp_row)
                  )::jsonb
		, p_user_id
		) AS audit_id
		FROM purge_claims pc
		WHERE pc.id IS NOT NULL),
	 purge_charge_audit AS(
	SELECT billing.create_audit(			  
		  p_company_id
		, p_entity_name
		, i_claim_charge_id
		, p_screen_name
		, p_module_name
		, 'Charge Deleted Id: ' || pc.id
		, p_client_ip
                , json_build_object(
                    'old_values', (SELECT COALESCE(old_values, '{}') FROM purge_claims),
                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM purge_charge limit 1) temp_row)
                  )::jsonb
		, p_user_id
		) AS audit_id
		FROM purge_charge pc
		WHERE pc.id IS NOT NULL),
	audit_details as (SELECT pca.audit_id FROM purge_claim_audit pca
	UNION
	SELECT pch.audit_id FROM purge_charge_audit pch)
	select audit_id INTO p_result from audit_details;
	RETURN true;
ELSIF i_type = 'charge' THEN
 
	WITH purge_charge_studies AS(
           DELETE FROM billing.charges_studies bcs
                 WHERE
            bcs.charge_id = i_claim_charge_id
        ),
	purge_cas_details AS(
        DELETE FROM billing.cas_payment_application_details
        WHERE payment_application_id IN (
                SELECT
                    bpa.id
                FROM
                    billing.payment_applications bpa
                WHERE
                    bpa.charge_id = i_claim_charge_id
                    AND bpa.amount_type = 'adjustment')
        RETURNING * ),
	purge_payment_applications AS (
        DELETE FROM billing.payment_applications
        WHERE charge_id = i_claim_charge_id
        RETURNING *),
	purge_charge AS (
	    DELETE FROM billing.charges bch
	    WHERE bch.id = i_claim_charge_id
            RETURNING *, '{}'::jsonb old_values), 
        purge_charge_audit AS(
	SELECT billing.create_audit(			  
		  p_company_id
		, p_entity_name
		, i_claim_charge_id
		, p_screen_name
		, p_module_name
		, 'Charge Deleted Id: ' || pc.id
		, p_client_ip
                , json_build_object(
                    'old_values', (SELECT COALESCE(old_values, '{}') FROM purge_charge),
                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM purge_charge limit 1) temp_row)
                  )::jsonb
		, p_user_id
		) AS audit_id
	 FROM purge_charge pc
	 WHERE pc.id IS NOT NULL)
	 SELECT pch.audit_id INTO p_result FROM purge_charge_audit pch;

  RETURN true;
END IF;
   RETURN false;
END;
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.purge_payment(
    i_payment_id bigint,
    i_audit_details json)
  RETURNS boolean AS
$BODY$
DECLARE
  p_screen_name TEXT;
  p_module_name TEXT;
  p_client_ip TEXT;
  p_user_id BIGINT;
  p_company_id BIGINT;
  p_result BIGINT;
BEGIN

  p_screen_name := i_audit_details->>'screen_name';
  p_module_name := i_audit_details->>'module_name';
  p_client_ip := i_audit_details->>'client_ip';
  p_user_id := (i_audit_details->>'user_id')::BIGINT;
  p_company_id := (i_audit_details->>'company_id')::BIGINT;

        WITH purge_payment_cas_details AS (
        DELETE FROM billing.cas_payment_application_details
        WHERE payment_application_id IN (
                SELECT
                    bpa.id
                FROM
                    billing.payment_applications bpa
                WHERE
                    bpa.payment_id = i_payment_id
                    AND bpa.amount_type = 'adjustment')
        RETURNING *),
	purge_payment_applications AS (
	    DELETE FROM billing.payment_applications
	    WHERE payment_id = i_payment_id
            RETURNING *),
 	edi_file_payments AS (
	    DELETE FROM billing.edi_file_payments
	    WHERE payment_id = i_payment_id
            RETURNING *), 
	purge_payment AS (
		DELETE FROM billing.payments bp
		WHERE bp.id = i_payment_id
		RETURNING *, '{}'::jsonb old_values ),
	purge_payment_audit AS(
	SELECT billing.create_audit(			  
		  p_company_id
		, p_screen_name
		, i_payment_id
		, p_screen_name
		, p_module_name
		, 'Payment Deleted Id: ' || i_payment_id || ' AND Payment related '|| coalesce((SELECT count(*) FROM purge_payment_applications),0) || ' Payment applications removed ' || coalesce((SELECT count(*) FROM purge_payment_cas_details),0) || ' Cas details removed '
		, p_client_ip
                , json_build_object(
                    'old_values', (SELECT COALESCE(old_values, '{}') FROM purge_payment),
                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM purge_payment) temp_row)
                  )::jsonb
		, p_user_id
		) AS audit_id
		FROM purge_payment pc
		WHERE pc.id IS NOT NULL)
	SELECT ppa.audit_id INTO p_result FROM purge_payment_audit ppa;

	RETURN true;

END;
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.get_billing_method (i_claim_id bigint, payer_type text)
    RETURNS text
AS $BODY$
DECLARE
  p_patient_insurance_id BIGINT;
  p_payer_type TEXT;
BEGIN
     
     IF payer_type is null THEN 
	SELECT bc.payer_type INTO p_payer_type FROM billing.claims bc where id = i_claim_id;
     ELSE 
        p_payer_type := payer_type;
     END IF; 
     
     IF p_payer_type = 'primary_insurance' THEN 
         SELECT primary_patient_insurance_id INTO p_patient_insurance_id FROM billing.claims where id = i_claim_id;
     ELSIF p_payer_type = 'secondary_insurance' THEN 
         SELECT secondary_patient_insurance_id INTO p_patient_insurance_id FROM billing.claims where id = i_claim_id;
     ELSIF p_payer_type = 'tertiary_insurance' THEN 
         SELECT tertiary_patient_insurance_id INTO p_patient_insurance_id FROM billing.claims where id = i_claim_id;
     END IF ;
     
    RETURN (
        SELECT
            ( CASE WHEN p_payer_type = 'patient' THEN
                    'patient_payment'
              WHEN p_payer_type = 'primary_insurance' OR p_payer_type = 'secondary_insurance' OR p_payer_type = 'tertiary_insurance' THEN
                    ( SELECT billing_method FROM billing.insurance_provider_details WHERE insurance_provider_id = (SELECT insurance_provider_id FROM public.patient_insurances WHERE id = p_patient_insurance_id))
              ELSE
                    'direct_billing'
              END));
END;
$BODY$
LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.change_payer_type(
    p_claim_id bigint,
    p_payer_type text)
  RETURNS boolean AS
$BODY$
DECLARE
     l_old_payer_type TEXT;
     l_charges RECORD;
     l_is_need_recalculation BOOLEAN;
BEGIN 
        l_is_need_recalculation := FALSE;

	----------Getting Existing Payer Type
	SELECT 
	     payer_type INTO STRICT l_old_payer_type
	FROM 
             billing.claims
	WHERE
	     id = p_claim_id;

	---------Update new payer type into claim
	UPDATE billing.claims
        SET
            payer_type = p_payer_type,
            billing_method = (SELECT billing.get_billing_method(p_claim_id, p_payer_type))
        WHERE id = p_claim_id;


	--------
	l_is_need_recalculation = billing.is_need_bill_fee_recaulculation(p_claim_id,p_payer_type,l_old_payer_type);

	IF l_is_need_recalculation = TRUE THEN 

		FOR l_charges IN SELECT 
				id,
				claim_id,
				cpt_id,
				modifier1_id,
				modifier2_id,
				modifier3_id,
				modifier4_id
			FROM
				billing.charges
			WHERE 
				claim_id = p_claim_id
		LOOP
		  UPDATE 
			billing.charges
		  SET
			bill_fee = billing.get_computed_bill_fee(l_charges.claim_id, l_charges.cpt_id, l_charges.modifier1_id,l_charges.modifier2_id,l_charges.modifier3_id,l_charges.modifier4_id,'billing',NULL),
			allowed_amount = billing.get_computed_bill_fee(l_charges.claim_id, l_charges.cpt_id, l_charges.modifier1_id,l_charges.modifier2_id,l_charges.modifier3_id,l_charges.modifier4_id,'allowed',NULL)
	        WHERE 
			id = l_charges.id;
		END LOOP;
	END IF;
	
	RETURN TRUE;

END;
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.change_responsible_party(
    i_claim_id bigint,
    i_claim_status_code bigint,
    i_company_id bigint,
    i_original_reference text)
  RETURNS boolean AS
$BODY$
DECLARE
BEGIN 

    WITH 
	claim_details AS 
		(	
		  SELECT  claim_balance_total, charges_bill_fee_total, payments_applied_total, adjustments_applied_total
		  ,(SELECT payer_type FROM  billing.claims WHERE id = i_claim_id ) AS payer_type
		  ,(SELECT original_reference FROM  billing.claims WHERE id = i_claim_id ) AS default_original_reference
		  ,(SELECT claim_status_id FROM  billing.claims WHERE id = i_claim_id ) AS default_claim_status_id
		  FROM billing.get_claim_totals(i_claim_id)
		)

	UPDATE billing.claims

	SET payer_type = (
			CASE WHEN claim_details.adjustments_applied_total = claim_details.charges_bill_fee_total AND claim_details.payments_applied_total::money = 0::money THEN claim_details.payer_type
			ELSE
			    CASE 
				WHEN claim_details.claim_balance_total > 0::money AND (claim_details.payer_type = 'primary_insurance' AND secondary_patient_insurance_id IS NOT NULL )
				THEN 'secondary_insurance'
			    
				WHEN claim_details.claim_balance_total > 0::money AND (claim_details.payer_type = 'secondary_insurance' AND tertiary_patient_insurance_id IS NOT NULL )
				THEN 'tertiary_insurance'
				
				WHEN claim_details.claim_balance_total > 0::money AND claim_details.payer_type = 'tertiary_insurance'
				THEN 'patient'				    
			    
				WHEN claim_details.claim_balance_total > 0::money AND (secondary_patient_insurance_id IS NULL AND tertiary_patient_insurance_id IS NULL )
				THEN 'patient'

				WHEN claim_details.claim_balance_total = 0::money
				THEN 'patient'

				ELSE 
				claim_details.payer_type
			     END 
			END 
		),
		claim_status_id = ( 
                                     CASE WHEN i_claim_status_code = 4 OR i_claim_status_code = 23 OR i_claim_status_code = 25
                                        THEN ( SELECT COALESCE(id, claim_details.default_claim_status_id ) FROM billing.claim_status WHERE company_id = i_company_id AND code = 'D' AND inactivated_dt IS NULL )
                                           ELSE
                                            CASE 
                                                WHEN claim_details.charges_bill_fee_total = claim_details.adjustments_applied_total AND claim_details.payments_applied_total = 0::money
                                                    THEN ( SELECT COALESCE(id, claim_details.default_claim_status_id ) FROM billing.claim_status WHERE company_id = i_company_id AND code = 'D' AND inactivated_dt IS NULL )
                                                WHEN claim_details.claim_balance_total = 0::money
                                                    THEN ( SELECT COALESCE(id, claim_details.default_claim_status_id ) FROM billing.claim_status WHERE company_id = i_company_id AND code = 'PIF' AND inactivated_dt IS NULL )
                                                WHEN claim_details.claim_balance_total < 0::money
                                                    THEN ( SELECT COALESCE(id, claim_details.default_claim_status_id ) FROM billing.claim_status WHERE company_id = i_company_id AND code = 'OP' AND inactivated_dt IS NULL )
                                                WHEN claim_details.claim_balance_total > 0::money
                                                    THEN ( SELECT COALESCE(id, claim_details.default_claim_status_id ) FROM billing.claim_status WHERE company_id = i_company_id AND code = 'PP' AND inactivated_dt IS NULL )
                                                ELSE
                                                    claim_details.default_claim_status_id
                                           END
                                     END	
                                  ),
                original_reference = COALESCE(i_original_reference, claim_details.default_original_reference )
		
	FROM claim_details WHERE billing.claims.id = i_claim_id;

    UPDATE billing.claims set billing_method = (SELECT billing.get_billing_method(i_claim_id, null)) WHERE  id = i_claim_id ;

	RETURN TRUE;

END;
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.update_claim_charge(
    i_claim_details json,
    i_insurances_details json,
    i_claim_icds json,
    i_audit_details json,
    i_charge_details json)
  RETURNS json AS
$BODY$
DECLARE

    p_audit_id BIGINT;
    p_claim_id BIGINT;
    p_screen_name TEXT;
    p_module_name TEXT;
    p_entity_name TEXT;
    p_client_ip TEXT;
    p_user_id BIGINT;
    p_company_id BIGINT;
    p_result json;
    p_insurance_details BIGINT;
    p_claim_details BIGINT;
    p_charge_details BIGINT;
    p_icd_insertion json;
    
BEGIN

    p_screen_name := i_audit_details ->> 'screen_name';
    p_claim_id := i_claim_details->>'claim_id';
    p_module_name := i_audit_details ->> 'module_name';
    p_client_ip := i_audit_details ->> 'client_ip';
    p_entity_name := i_audit_details ->> 'entity_name';
    p_user_id := (i_audit_details ->> 'user_id')::BIGINT;
    p_company_id := (i_audit_details ->> 'company_id')::BIGINT;


	        WITH insurance_details AS (
                  SELECT
                    patient_id
                  , insurance_provider_id
                  , subscriber_zipcode
                  , subscriber_relationship_id
                  , coverage_level
                  , policy_number
                  , group_number
                  , subscriber_employment_status_id
                  , subscriber_firstname
                  , subscriber_lastname
                  , subscriber_middlename
                  , subscriber_name_suffix
                  , subscriber_gender
                  , subscriber_address_line1
                  , subscriber_address_line2
                  , subscriber_city
                  , subscriber_state
                  , assign_benefits_to_patient
                  , subscriber_dob
                  , medicare_insurance_type_code
                  , claim_insurance_id
                  , is_deleted
                  , valid_from_date
                  , valid_to_date
            FROM
                json_to_recordset(i_insurances_details) AS insurances (
                   patient_id bigint
                 , insurance_provider_id bigint 
                 , subscriber_zipcode text
                 , subscriber_relationship_id bigint
                 , coverage_level text 
                 , policy_number text 
                 , group_number text
                 , subscriber_employment_status_id bigint 
                 , subscriber_firstname text 
                 , subscriber_lastname text 
                 , subscriber_middlename text
                 , subscriber_name_suffix text
                 , subscriber_gender text 
                 , subscriber_address_line1 text
                 , subscriber_address_line2 text
                 , subscriber_city text
                 , subscriber_state text
                 , assign_benefits_to_patient boolean  
                 , subscriber_dob date  
                 , medicare_insurance_type_code bigint
                 , claim_insurance_id bigint
                 , is_deleted boolean 
                 , valid_from_date date
                 , valid_to_date date )
        ),
        save_insurance AS (
                INSERT INTO patient_insurances (
                    patient_id
                  , insurance_provider_id
                  , subscriber_zipcode
                  , subscriber_relationship_id
                  , coverage_level
                  , policy_number
                  , group_number
                  , subscriber_employment_status_id
                  , subscriber_firstname
                  , subscriber_lastname
                  , subscriber_middlename
                  , subscriber_name_suffix
                  , subscriber_gender
                  , subscriber_address_line1
                  , subscriber_address_line2
                  , subscriber_city
                  , subscriber_state
                  , assign_benefits_to_patient
                  , subscriber_dob
                  , medicare_insurance_type_code
                  , valid_from_date
                  , valid_to_date
            )
            SELECT
                      patient_id
                    , insurance_provider_id
                    , subscriber_zipcode
                    , subscriber_relationship_id
                    , coverage_level
                    , policy_number
                    , group_number
                    , subscriber_employment_status_id
                    , subscriber_firstname
                    , subscriber_lastname
                    , subscriber_middlename
                    , subscriber_name_suffix
                    , subscriber_gender
                    , subscriber_address_line1
                    , subscriber_address_line1
                    , subscriber_city
                    , subscriber_state
                    , assign_benefits_to_patient
                    , subscriber_dob
                    , medicare_insurance_type_code
                    , now()
                    , now() + interval '1 month'
            FROM
                insurance_details
            WHERE
                claim_insurance_id IS NULL
                AND NOT is_deleted
                RETURNING  *, '{}'::jsonb old_values
        ),
	insurance_audit_cte AS (
		SELECT billing.create_audit (
			p_company_id,
			p_screen_name,
			sc.id,
			p_screen_name,
			p_module_name,
			'Claim Related (claim_id) : '|| p_claim_id || 'Insurance details inserted id :' || sc.id ,
			p_client_ip,
			json_build_object(
				'old_values', COALESCE(sc.old_values, '{}'),
				'new_values', ( SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM ( SELECT * FROM save_insurance limit 1) temp_row))::jsonb,
			p_user_id) id
		FROM save_insurance sc),
        update_insurance AS (
                    UPDATE
                        patient_insurances
                    SET
                      insurance_provider_id = ins.insurance_provider_id
                    , subscriber_zipcode = ins.subscriber_zipcode
                    , subscriber_relationship_id = ins.subscriber_relationship_id
                    , coverage_level = ins.coverage_level
                    , policy_number = ins.policy_number
                    , group_number = ins.group_number
                    , subscriber_employment_status_id = ins.subscriber_employment_status_id
                    , subscriber_firstname = ins.subscriber_firstname
                    , subscriber_lastname = ins.subscriber_lastname
                    , subscriber_middlename = ins.subscriber_middlename
                    , subscriber_name_suffix = ins.subscriber_name_suffix
                    , subscriber_gender = ins.subscriber_gender
                    , subscriber_address_line1 = ins.subscriber_address_line1
                    , subscriber_address_line2 = ins.subscriber_address_line2
                    , subscriber_city = ins.subscriber_city
                    , subscriber_state = ins.subscriber_state
                    , assign_benefits_to_patient = ins.assign_benefits_to_patient
                    , subscriber_dob = ins.subscriber_dob
                    , medicare_insurance_type_code = ins.medicare_insurance_type_code
            FROM
                insurance_details ins
            WHERE
                ins.claim_insurance_id = patient_insurances.id
                AND ins.claim_insurance_id IS NOT NULL
                AND NOT is_deleted
        ),
        insurance_deletion AS (
            DELETE FROM 
                patient_insurances 
            USING insurance_details ins
            WHERE 
                patient_insurances.id = ins.claim_insurance_id
                AND ins.claim_insurance_id IS NOT NULL
                AND is_deleted
        ),
        update_claim_header AS (
            UPDATE
                billing.claims
            SET
                  facility_id = (i_claim_details->>'facility_id')::bigint
                , billing_provider_id = (i_claim_details->>'billing_provider_id')::bigint
                , rendering_provider_contact_id = (i_claim_details->>'rendering_provider_contact_id')::bigint
                , referring_provider_contact_id = (i_claim_details->>'referring_provider_contact_id')::bigint
                , ordering_facility_id = (i_claim_details->>'ordering_facility_id')::bigint
                , place_of_service_id = (i_claim_details->>'place_of_service_id')::bigint
                , claim_status_id = (i_claim_details->>'claim_status_id')::bigint
                , billing_code_id = (i_claim_details->>'billing_code_id')::bigint
                , billing_class_id = (i_claim_details->>'billing_class_id')::bigint
                , billing_notes = i_claim_details->>'billing_notes'
                , current_illness_date = (i_claim_details->>'current_illness_date')::date
                , same_illness_first_date = (i_claim_details->>'same_illness_first_date')::date
                , unable_to_work_from_date = (i_claim_details->>'unable_to_work_from_date')::date
                , unable_to_work_to_date = (i_claim_details->>'unable_to_work_to_date')::date
                , hospitalization_from_date = (i_claim_details->>'hospitalization_from_date')::date
                , hospitalization_to_date = (i_claim_details->>'hospitalization_to_date')::date
                , claim_notes = i_claim_details->>'claim_notes'
                , original_reference = i_claim_details->>'original_reference'
                , authorization_no = i_claim_details->>'authorization_no'
                , frequency = i_claim_details->>'frequency'
                , is_auto_accident = (i_claim_details->>'is_auto_accident')::boolean
                , is_other_accident = (i_claim_details->>'is_other_accident')::boolean
                , is_employed = (i_claim_details->>'is_employed')::boolean
                , service_by_outside_lab = (i_claim_details->>'service_by_outside_lab')::boolean
                , primary_patient_insurance_id = COALESCE((i_claim_details->>'primary_patient_insurance_id')::bigint, (SELECT id FROM save_insurance WHERE coverage_level = 'primary'))
                , secondary_patient_insurance_id = COALESCE((i_claim_details->>'secondary_patient_insurance_id')::bigint, (SELECT id FROM save_insurance WHERE coverage_level = 'secondary'))
                , tertiary_patient_insurance_id = COALESCE((i_claim_details->>'tertiary_patient_insurance_id')::bigint, (SELECT id FROM save_insurance WHERE coverage_level = 'tertiary'))
                
            WHERE
                billing.claims.id = (i_claim_details->>'claim_id')::bigint
		RETURNING *,
                            (
                                SELECT row_to_json(old_row) 
                                FROM   (SELECT * 
                                    FROM   billing.claims 
                                    WHERE  id = (i_claim_details->>'claim_id')::bigint) old_row 
                            ) old_value
        ),
          claim_update_audit_cte AS (
		SELECT billing.create_audit (
			p_company_id,
			p_screen_name,
			ucd.id,
			p_screen_name,
			p_module_name,
			'claim updated Id: ' || ucd.id || ' For patient ID : ' || ucd.patient_id,
			p_client_ip,
			json_build_object(
				'old_values', COALESCE(ucd.old_value, '{}'),
				'new_values', ( SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM ( SELECT * FROM update_claim_header limit 1) temp_row))::jsonb,
			p_user_id) id
		FROM update_claim_header ucd),
        icd_details AS (
            SELECT
                      id
                    , claim_id
                    , icd_id
                    , is_deleted
                    
            FROM
                json_to_recordset(i_claim_icds) AS x (
                      id bigint
                    , claim_id bigint
                    , icd_id bigint
                    , is_deleted boolean
                )
        ),
        icd_insertion AS (
            INSERT INTO billing.claim_icds (
                      claim_id
                    , icd_id
            )
            (   SELECT
                      claim_id
                    , icd_id
                FROM
                    icd_details
                WHERE
                    id IS NULL
                    AND  NOT is_deleted
            ) RETURNING billing.claim_icds.id, billing.claim_icds.icd_id
        ),
        update_icds AS (
            DELETE FROM
                billing.claim_icds
            USING icd_details icd
            WHERE
                 billing.claim_icds.id = icd.id
                AND billing.claim_icds.icd_id = icd.icd_id
                AND  icd.is_deleted
                AND  icd.id is NOT NULL  RETURNING billing.claim_icds.id
        )
        , charge_details AS (
            SELECT
                id
              , claim_id     
              , cpt_id
              , modifier1_id
              , modifier2_id
              , modifier3_id
              , modifier4_id
              , bill_fee
              , allowed_amount
              , units
              , created_by
              , charge_dt
              , pointer1
              , pointer2
              , pointer3
              , pointer4
              , authorization_no
              , is_deleted
    FROM
        json_to_recordset(i_charge_details) AS x (
              id bigint
            , claim_id bigint     
            , cpt_id bigint
            , modifier1_id bigint
            , modifier2_id bigint
            , modifier3_id bigint
            , modifier4_id bigint
            , bill_fee money
            , allowed_amount money
            , units numeric(7,3)
            , created_by bigint
            , charge_dt timestamp with time zone
            , pointer1 text
            , pointer2 text
            , pointer3 text
            , pointer4 text
            , authorization_no text
            , is_deleted boolean
        )
    ),
    update_charges AS (
        UPDATE
            billing.charges
        SET
              cpt_id    = chd.cpt_id
           , bill_fee  = CASE WHEN billing.is_need_bill_fee_recaulculation((i_claim_details->>'claim_id')::bigint,i_claim_details->>'payer_type',i_claim_details->>'existing_payer_type') = TRUE THEN
                             billing.get_computed_bill_fee((i_claim_details->>'claim_id')::bigint,chd.cpt_id,chd.modifier1_id,chd.modifier2_id,chd.modifier3_id,chd.modifier4_id,'billing',i_claim_details->>'payer_type')
                          ELSE
                            chd.bill_fee
                          END 
            , allowed_amount = CASE WHEN billing.is_need_bill_fee_recaulculation((i_claim_details->>'claim_id')::bigint,i_claim_details->>'payer_type',i_claim_details->>'existing_payer_type') = TRUE THEN
                             billing.get_computed_bill_fee((i_claim_details->>'claim_id')::bigint,chd.cpt_id,chd.modifier1_id,chd.modifier2_id,chd.modifier3_id,chd.modifier4_id,'allowed',i_claim_details->>'payer_type')
                          ELSE
                             chd.allowed_amount
                          END 
            , units  = chd.units
            , pointer1  = chd.pointer1
            , pointer2  = chd.pointer2
            , pointer3  = chd.pointer3
            , pointer4  = chd.pointer4
            , modifier1_id = chd.modifier1_id
            , modifier2_id = chd.modifier2_id
            , modifier3_id = chd.modifier3_id
            , modifier4_id = chd.modifier4_id
            , authorization_no  = chd.authorization_no

        FROM
            charge_details chd
        WHERE
             billing.charges.id = chd.id
            AND billing.charges.claim_id = chd.claim_id
            AND  NOT chd.is_deleted
            AND  chd.id is NOT NULL 
		RETURNING *,
                            (
                                SELECT row_to_json(old_row) 
                                FROM   (SELECT * 
                                    FROM   billing.charges 
                                    WHERE  id = chd.id) old_row 
                            ) old_value
    ),
   charge_update_audit_cte AS (
		SELECT billing.create_audit (
			p_company_id,
			'charges',
			(uccc.old_value->>'id')::bigint,
			p_screen_name,
			p_module_name,
			'Charge updated Id: ' || (uccc.old_value->>'id')::bigint || ' For claim ID : ' || p_claim_id,
			p_client_ip,
			json_build_object(
				'old_values', COALESCE(uccc.old_value, '{}'),
				'new_values', ( SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM ( SELECT * FROM update_charges limit 1) temp_row))::jsonb,
			p_user_id) id
		FROM update_charges uccc),
    delete_charges AS (

        DELETE FROM
            billing.charges
        USING charge_details chd
        WHERE
             billing.charges.id = chd.id
            AND billing.charges.claim_id = chd.claim_id
            AND  chd.is_deleted
            AND  chd.id is NOT NULL
    )
    SELECT
	(SELECT id FROM insurance_audit_cte) as insurance_details,
	(SELECT id FROM claim_update_audit_cte) as claim_details,
        (SELECT id FROM charge_update_audit_cte limit 1) as charge_details,
	( SELECT json_agg(row_to_json(save_insurance)) save_insurance
                FROM (
                        SELECT
                              *
                        FROM
                            save_insurance

                    ) AS save_insurance
         ) AS save_insurance,
	( SELECT json_agg(row_to_json(icd_insertion)) icd_insertion
                FROM (
                        SELECT
                              *
                        FROM
                        icd_insertion

                    ) AS icd_insertion
         ) AS icd_insertion into p_insurance_details,p_claim_details,p_charge_details,p_result,p_icd_insertion;

		PERFORM  billing.create_charge( 
			p_claim_id
			,charges.cpt_id
			,charges.pointer1
			,charges.pointer2
			,charges.pointer3
			,charges.pointer4
			,charges.modifier1_id
			,charges.modifier2_id
			,charges.modifier3_id
			,charges.modifier4_id
			,charges.bill_fee
			,charges.allowed_amount
			,charges.units
			,charges.created_by
			,charges.authorization_no
			,charges.charge_dt
			,charges.study_id
			,i_audit_details)
		FROM (
			SELECT * from 
				json_to_recordset(i_charge_details) as x(
					  id bigint
					, cpt_id bigint
					, pointer1 text
					, pointer2 text
					, pointer3 text
					, pointer4 text
					, modifier1_id bigint
					, modifier2_id bigint
					, modifier3_id bigint
					, modifier4_id bigint
					, bill_fee money
					, allowed_amount money
					, units bigint
					, created_by bigint
					, authorization_no text
					, charge_dt timestamptz
					, study_id bigint )
		) charges  WHERE id is null;


	UPDATE billing.claims 
        SET 
            payer_type = (i_claim_details->>'payer_type')::TEXT,
            billing_method = billing.get_billing_method((i_claim_details->>'claim_id')::bigint,(i_claim_details->>'payer_type')::text)
    WHERE id = (i_claim_details->>'claim_id')::bigint;


    RETURN p_result;
END;
$BODY$
  LANGUAGE plpgsql;
-- --------------------------------------------------------------------------------------------------------------------
-- Alter script For new Table changes 
-- --------------------------------------------------------------------------------------------------------------------
ALTER TABLE billing.claim_status ADD COLUMN IF NOT EXISTS display_order BIGINT;
ALTER TABLE billing.edi_clearinghouses ADD COLUMN IF NOT EXISTS edi_template_name TEXT;
ALTER TABLE billing.edi_files ADD COLUMN IF NOT EXISTS uploaded_file_name TEXT;
ALTER TABLE billing.grid_filters ADD COLUMN IF NOT EXISTS inactivated_dt TIMESTAMPTZ;
DROP TABLE IF EXISTS billing.insurance_provider_clearinghouses;
DROP TABLE IF EXISTS billing.paper_claim_printer_setup;
ALTER TABLE billing.user_settings ADD COLUMN IF NOT EXISTS paper_claim_full_template_id BIGINT;
ALTER TABLE billing.user_settings ADD COLUMN IF NOT EXISTS paper_claim_original_template_id BIGINT;
ALTER TABLE billing.user_settings ADD COLUMN IF NOT EXISTS direct_invoice_template_id BIGINT;
ALTER TABLE billing.user_settings ADD COLUMN IF NOT EXISTS patient_invoice_template_id BIGINT;
ALTER TABLE billing.user_settings ADD COLUMN IF NOT EXISTS grid_field_settings JSON;
ALTER TABLE billing.grid_filters ADD CONSTRAINT IF NOT EXISTS grid_filters_filter_name_uc UNIQUE(filter_type, filter_name);
-- --------------------------------------------------------------------------------------------------------------------
CREATE INDEX charges_studies_idx1 ON billing.charges_studies(study_id);
CREATE INDEX charges_studies_idx2 ON billing.charges_studies(charge_id);
CREATE INDEX payment_applications_idx1 ON billing.payment_applications(charge_id);
-- --------------------------------------------------------------------------------------------------------------------
-- Function: billing.get_batch_claim_details(bigint, bigint)

-- DROP FUNCTION billing.get_batch_claim_details(bigint, bigint);

CREATE OR REPLACE FUNCTION billing.get_batch_claim_details(IN i_study_id bigint, IN i_created_by bigint)
  RETURNS TABLE(claim_icds json, charges json, insurances json, claims json) AS
$BODY$
BEGIN
	RETURN QUERY
	WITH study_details AS (
		SELECT 
			 s.patient_id
			,s.facility_id
			,s.company_id
			,s.order_id
			,s.id AS study_id
			,f.facility_info->'billing_provider_id' AS billing_provider_id
			,f.facility_info->'rendering_provider_id' AS rendering_provider_id
			,f.facility_info->'service_facility_id' AS service_facility_id
		FROM 
			public.studies s
			INNER JOIN public.facilities f ON f.id = s.facility_id
		WHERE  s.id =  i_study_id
	)
	,claim_charges AS (

		SELECT
                null AS id
                , null AS claim_id
                , cpt_codes.id AS cpt_id
                , COALESCE((string_to_array(regexp_replace(study_cpt_info->'diagCodes_pointer', '[^0-9,]', '', 'g'),',')::int[])[1],null) AS pointer1  
                , COALESCE((string_to_array(regexp_replace(study_cpt_info->'diagCodes_pointer', '[^0-9,]', '', 'g'),',')::int[])[2],null) AS pointer2  
                , COALESCE((string_to_array(regexp_replace(study_cpt_info->'diagCodes_pointer', '[^0-9,]', '', 'g'),',')::int[])[3],null) AS pointer3  
                , COALESCE((string_to_array(regexp_replace(study_cpt_info->'diagCodes_pointer', '[^0-9,]', '', 'g'),',')::int[])[4],null) AS pointer4
				, atp.modifier1_id
                , atp.modifier2_id
                , atp.modifier3_id
                , atp.modifier4_id
                , COALESCE(sc.study_cpt_info->'bill_fee','0')::NUMERIC AS bill_fee
                , COALESCE(sc.study_cpt_info->'allowed_fee','0')::NUMERIC AS allowed_amount
                , COALESCE(sc.study_cpt_info->'units','1.00')::NUMERIC AS units
                , null AS created_by
				, sc.authorization_info->'authorization_no' AS authorization_no
				, COALESCE(s.study_dt,now()) AS charge_dt
				, sc.study_id
                , o.icd_code_ids_billing 
                , o.id AS order_id
                , o.patient_id
                , i_created_by AS created_by
        FROM public.study_cpt sc
            INNER JOIN public.studies s ON s.id = sc.study_id
            INNER JOIN public.cpt_codes on sc.cpt_code_id = cpt_codes.id
            INNER JOIN public.orders o on o.id = s.order_id
            INNER JOIN appointment_types at ON at.id = s.appointment_type_id
            INNER JOIN appointment_type_procedures atp ON atp.procedure_id = sc.cpt_code_id AND atp.appointment_type_id = s.appointment_type_id
        WHERE study_id = i_study_id 
        ORDER BY s.id DESC 
 )
, insurances AS (
		SELECT
			ins.* 
		  FROM (
			SELECT
                pi.patient_id
                , ip.id AS insurance_provider_id
                , pi.subscriber_relationship_id   
                , pi.subscriber_dob
                , pi.coverage_level
                , pi.policy_number
                , pi.group_number
			    , pi.subscriber_firstname
                , pi.subscriber_lastname
                , pi.subscriber_middlename
                , pi.subscriber_name_suffix
                , pi.subscriber_gender
                , pi.subscriber_address_line1
                , pi.subscriber_address_line2
                , pi.subscriber_city
                , pi.subscriber_state
                , pi.subscriber_zipcode
                , pi.assign_benefits_to_patient
                , pi.medicare_insurance_type_code
			    , pi.subscriber_employment_status_id  
                , pi.valid_from_date
                , pi.valid_to_date
			    , ipd.billing_method
			    , ROW_NUMBER() OVER (PARTITION BY pi.coverage_level ORDER BY pi.id ASC) AS rank
            FROM 
                public.patient_insurances pi
            INNER JOIN public.insurance_providers ip ON ip.id= pi.insurance_provider_id 
            LEFT JOIN billing.insurance_provider_details ipd on ipd.insurance_provider_id = ip.id
            LEFT JOIN LATERAL ( 
                SELECT 
                    coverage_level,
                    MIN(valid_to_date) as valid_to_date
                FROM 
                    public.patient_insurances 
                WHERE 
                    patient_id = ( SELECT COALESCE(NULLIF(patient_id,'0'),'0')::numeric FROM study_details ) AND valid_to_date >= (now())::date 
                    GROUP BY coverage_level 
            ) as expiry ON TRUE                           
            WHERE 
                pi.patient_id = ( SELECT COALESCE(NULLIF(patient_id,'0'),'0')::numeric FROM study_details ) AND expiry.valid_to_date = pi.valid_to_date AND expiry.coverage_level = pi.coverage_level 
                ORDER BY pi.id ASC
            ) ins
            WHERE  ins.rank = 1
 )
,claims AS (
		SELECT
            orders.company_id
            ,orders.facility_id
            ,orders.patient_id
          ,( SELECT
              id
              FROM billing.providers
              WHERE id = COALESCE(NULLIF(order_info -> 'billing_provider',''),(SELECT COALESCE(NULLIF(billing_provider_id,''),'0')::text FROM study_details ) )::numeric 
              AND company_id = ( SELECT COALESCE(NULLIF(company_id,'0'),'0')::numeric FROM study_details ) 
            ) AS billing_provider_id
          ,( SELECT id FROM 
              provider_groups 
              WHERE id = COALESCE(NULLIF(order_info -> 'ordering_facility_id',''), (SELECT COALESCE(NULLIF(service_facility_id,''),'0')::text FROM study_details ) )::numeric  
              AND provider_groups.has_deleted = false  AND (provider_groups.group_type = 'OF'  OR provider_groups.group_type IS NULL )
              AND provider_groups.company_id = ( SELECT COALESCE(NULLIF(company_id,'0'),'0')::numeric FROM study_details ) 
            ) AS ordering_facility_id
          ,( SELECT pc.id FROM 
              public.providers p 
              INNER JOIN provider_contacts pc ON pc.provider_id = p.id
              WHERE pc.id = COALESCE(NULLIF(order_info -> 'rendering_provider_id',''), (SELECT COALESCE(NULLIF(rendering_provider_id,''),'0')::text FROM study_details ) )::numeric 
              AND NOT p.has_deleted AND NOT pc.has_deleted AND p.company_id = ( SELECT COALESCE(NULLIF(company_id,'0'),'0')::numeric FROM study_details ) AND p.provider_type = 'PR'
            ) AS rendering_provider_contact_id
          ,( SELECT pc.id FROM 
              public.providers p 
              INNER JOIN provider_contacts pc ON pc.provider_id = p.id
              WHERE pc.id = COALESCE(NULLIF(referring_provider_ids [ 1 ],'0'),'0')::numeric 
              AND NOT p.has_deleted AND NOT pc.has_deleted AND p.company_id = ( SELECT COALESCE(NULLIF(company_id,'0'),'0')::numeric FROM study_details ) AND p.provider_type = 'RF'
            ) AS referring_provider_contact_id
          ,( SELECT id FROM 
              public.places_of_service
              WHERE code = COALESCE(NULLIF(order_info -> 'pos_type_code',''),'') AND company_id = ( SELECT COALESCE(NULLIF(company_id,'0'),'0')::numeric FROM study_details ) 
            ) AS place_of_service_id
          ,( SELECT id FROM 
              billing.claim_status
              WHERE code = 'PV'  AND NOT is_system_status AND company_id = ( SELECT COALESCE(NULLIF(company_id,'0'),'0')::numeric FROM study_details ) 
            ) AS claim_status_id
          ,( SELECT id FROM 
              billing.billing_codes
              WHERE id = COALESCE(NULLIF(order_info -> 'billing_code',''),'0')::numeric  AND company_id = ( SELECT COALESCE(NULLIF(company_id,'0'),'0')::numeric FROM study_details ) 
            ) AS billing_code_id
          ,( SELECT id FROM 
              billing.billing_classes
              WHERE id = COALESCE(NULLIF(order_info -> 'billing_class',''),'0')::numeric  AND company_id = ( SELECT COALESCE(NULLIF(company_id,'0'),'0')::numeric FROM study_details ) 
            ) AS billing_class_id
          ,i_created_by  AS created_by
          ,null AS billing_notes
          ,(SELECT COALESCE(charge_dt,NOW()) FROM claim_charges LIMIT 1)  AS claim_dt
          ,NULLIF(COALESCE(order_info->'currentDate',''),'')::DATE AS current_illness_date
          ,NULLIF(COALESCE(order_info->'similarIll',''),'')::DATE AS same_illness_first_date
          ,NULLIF(COALESCE(order_info->'wTo',''),'')::DATE AS unable_to_work_to_date
          ,NULLIF(COALESCE(order_info->'wFrom',''),'')::DATE AS unable_to_work_from_date
          ,NULLIF(COALESCE(order_info->'hTo',''),'')::DATE AS hospitalization_to_date
          ,NULLIF(COALESCE(order_info->'hFrom',''),'')::DATE AS hospitalization_from_date
          ,order_info->'claim_notes' AS claim_notes
          ,order_info->'original_ref' AS original_reference
          ,order_info->'authorization_no' AS authorization_no
          ,CASE 
                WHEN COALESCE(NULLIF(order_info->'frequency_code',''),'0')::numeric = 8 THEN 'void'
                WHEN COALESCE(NULLIF(order_info->'frequency_code',''),'0')::numeric = 7 THEN 'corrected'
                WHEN COALESCE(NULLIF(order_info->'frequency_code',''),'0')::numeric = 7 THEN 'original'
                ELSE NULL
            END AS frequency
          ,COALESCE(NULLIF(order_info->'oa',''), 'false')::boolean AS is_other_accident
          ,COALESCE(NULLIF(order_info->'aa',''), 'false')::boolean AS is_auto_accident
          ,COALESCE(NULLIF(order_info->'emp',''), 'false')::boolean AS is_employed
          ,COALESCE(NULLIF(order_info->'outsideLab',''), 'false')::boolean AS service_by_outside_lab
          ,null AS primary_patient_insurance_id
          ,null AS secondary_patient_insurance_id
          ,null AS tertiary_patient_insurance_id
          ,( SELECT COALESCE(billing_method,'patient') FROM insurances WHERE coverage_level = 'primary' ) AS billing_method
          ,( CASE 
              WHEN ( SELECT count(1) FROM insurances WHERE coverage_level = 'primary' ) > 0 THEN 'primary_insurance'
              ELSE 'patient'
                END
            ) as payer_type

        FROM
            orders
        LEFT JOIN provider_contacts ON COALESCE (NULLIF (order_info -> 'rendering_provider_id',''),'0') = provider_contacts.id::text
        LEFT JOIN providers ON providers.id = provider_contacts.provider_id
        WHERE orders.id = ( SELECT COALESCE(NULLIF(order_id,'0'),'0')::numeric FROM study_details )
)
, billing_icds AS (
	SELECT 
		DISTINCT unnest(orders.icd_code_ids_billing) AS icd_ids
	FROM orders
	WHERE orders.id = ( SELECT COALESCE(NULLIF(order_id,'0'),'0')::numeric FROM study_details )
)
 
SELECT
	( SELECT COALESCE(json_agg(row_to_json(claims_icds)),'[]') claim_icds
		FROM (
                SELECT
                    null AS id ,
                    null AS claim_id ,
                    icd_ids AS icd_id
                FROM billing_icds 
            ) AS claims_icds
         ) AS claims_icds
	,( SELECT COALESCE(json_agg(row_to_json(charge)),'[]') charges
		FROM (
                SELECT
                    *
                FROM claim_charges 
            ) AS charge
         ) AS charges
         ,( SELECT COALESCE(json_agg(row_to_json(insurance)),'[]') insurances
		FROM (
                SELECT
                   *
                FROM insurances 
                ) AS insurance
         ) AS insurances
	,( SELECT COALESCE((row_to_json(claim)),'{}') claims
		FROM (
                SELECT
                    *
                FROM claims 
            ) AS claim
         ) AS claims;

END
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100
  ROWS 1000;
ALTER FUNCTION billing.get_batch_claim_details(bigint, bigint)
  OWNER TO postgres;


-- --------------------------------------------------------------------------------------------------------------------
-- MAKE SURE THIS COMMENT STAYS AT THE BOTTOM - ADD YOUR CHANGES ABOVE !!!!
-- RULES:
--  * When run multiple times, the entire script should have no "side effects"
--  * When you delete a DB object (DROP TABLE, COLUMN, INDEX, etc, etc), remove/comment out prior uses (creation)
RAISE NOTICE '--- END OF THE SCRIPT ---';
-- --------------------------------------------------------------------------------------------------------------------
END
$$;
-- ====================================================================================================================
