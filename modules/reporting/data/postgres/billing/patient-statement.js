const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger')
    , moment = require('moment');

// generate query template ***only once*** !!!
const patientStatementDataSetQueryTemplate = _.template(`
WITH claim_data AS (
    SELECT
        bc.patient_id,
        bc.id AS claim_id,
        bc.facility_id
    FROM billing.claims bc
    INNER JOIN billing.claim_status bcs ON bcs.id = bc.claim_status_id
    WHERE bc.payer_type = 'patient'
    AND bcs.code IN ('PP', 'PatBal', 'NPB', 'PatOP', 'OP')
    ),

    billing_comments AS (
    SELECT cc.claim_id as id,
           'claim' as type,
           note as comments,
           created_dt as commented_dt,
           null as amount,
           u.username as commented_by,
           null as code,
           cc.id as charge_id
    FROM billing.claim_comments cc
    INNER JOIN claim_data cd on cd.claim_id = cc.claim_id
    INNER JOIN users u on u.id = cc.created_by
    WHERE(
        CASE WHEN cc.type in( 'manual', 'auto', 'patient_statement')  THEN
            cc.is_internal
        ELSE
            cc.type in ('co_pay', 'co_insurance', 'deductible')
        END
    )

    UNION

    SELECT c.claim_id as id,
           'charge' as type,
           cc.short_description as comments,
           to_facility_date(cd.facility_id, c.charge_dt) as commented_dt,
           (c.bill_fee*c.units) as amount,
           u.username as commented_by,
           cc.display_code as code,
           c.id as charge_id
    FROM billing.charges c
    INNER JOIN claim_data cd on cd.claim_id = c.claim_id
    INNER JOIN cpt_codes cc on cc.id = c.cpt_id
    INNER JOIN users u on u.id = c.created_by

    UNION

    SELECT bc.claim_id as id,
           amount_type as type,
           CASE WHEN bp.payer_type = 'patient' THEN pp.full_name
                WHEN bp.payer_type = 'insurance' THEN pip.insurance_name
                WHEN bp.payer_type = 'ordering_facility' THEN pof.name
                WHEN bp.payer_type = 'ordering_provider' THEN p.full_name
           END as comments,
           bp.accounting_date as commented_dt,
           sum(pa.amount) as amount,
           u.username as commented_by,
           CASE amount_type
                WHEN 'adjustment' THEN 'Adj'
                WHEN 'payment' THEN (CASE bp.payer_type
                                     WHEN 'patient' THEN 'Patient'
                                     WHEN 'insurance' THEN 'Insurance'
                                     WHEN 'ordering_facility' THEN 'Ordering facility'
                                     WHEN 'ordering_provider' THEN 'Provider'
                                     END)
                END as code,
                ROW_NUMBER () OVER (ORDER BY bp.id) as charge_id  -- Require rownumber for each selected row
    FROM billing.payments bp
    INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
    INNER JOIN billing.charges AS bc on bc.id = pa.charge_id
    INNER JOIN claim_data cd on cd.claim_id = bc.claim_id
    INNER JOIN users u on u.id = bp.created_by
    LEFT JOIN public.patients pp on pp.id = bp.patient_id
    LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
    LEFT JOIN public.ordering_facilities pof ON pof.id = bp.ordering_facility_id
    LEFT JOIN public.provider_contacts pc on pc.id = bp.provider_contact_id
    LEFT JOIN public.providers p on p.id = pc.provider_id
    GROUP BY bc.claim_id,amount_type,comments,bp.id,u.username,code,pa.applied_dt
    ORDER BY charge_id ASC
    ),

    detailed_cte AS (
    SELECT
        p.id as pid,
        bc.id as claim_id,
        bc.ordering_facility_contact_id,
        sum((CASE type WHEN 'charge' then amount
                      WHEN 'payment' then amount
                      WHEN 'adjustment' then amount
            ELSE 0::money
            END) * (CASE WHEN type in('payment','adjustment') then -1
            ELSE 1
            END)) OVER (PARTITION BY p.id) AS sum_amount,
        p.first_name,
        p.middle_name,
        p.last_name,
        get_full_name(p.last_name,p.first_name,p.middle_name,p.prefix_name,p.suffix_name) as full_name,
        p.account_no AS account_no,
        p.patient_info->'c1AddressLine1' AS address1,
        p.patient_info->'c1AddressLine2' AS address2,
        p.patient_info->'c1City' AS city,
        p.patient_info->'c1State' AS state,
        p.patient_info->'c1Zip' AS zip,
        commented_dt as enc_date,
        comments as description,
        pc.code,
        pc.id as enc_id,
        CASE type WHEN 'charge' THEN 1
            WHEN 'payment' THEN 2
            WHEN 'adjustment' THEN 3
            ELSE 4
            END AS row_flag,
        ((CASE type WHEN 'charge' then amount
                    WHEN 'payment' then amount
                    WHEN 'adjustment' then amount
          ELSE 0::money
          END) * (CASE WHEN type in ('payment','adjustment') then -1
                  ELSE 1
                  END)) AS amount,
        <%= claimAmount %>
        <% if (payToProvider == true) {%>
          bp.name as billing_provider_name,
          bp.pay_to_address_line1 as billing_proaddress1,
          bp.pay_to_address_line2 as billing_proaddress2,
          bp.pay_to_city as billing_procity,
          bp.pay_to_state as billing_prostate,
          bp.pay_to_zip_code as billing_prozip,
          bp.pay_to_zip_code_plus as billing_zip_plus,
          bp.pay_to_phone_number as billing_phoneno,
        <% } else { %>
          bp.name as billing_provider_name,
          bp.address_line1 as billing_proaddress1,
          bp.address_line2 as billing_proaddress2,
          bp.city as billing_procity,
          bp.state as billing_prostate,
          bp.zip_code as billing_prozip,
          bp.zip_code_plus as billing_zip_plus,
          bp.phone_number as billing_phoneno,
        <% } %>
        type as payment_type,
        CASE type WHEN 'charge' THEN 1 ELSE 2 END AS sort_order,
        charge_id,
        SUM((CASE type WHEN 'charge' THEN amount
                      WHEN 'payment' THEN amount
                      WHEN 'adjustment' THEN amount
            ELSE 0::MONEY
            END) * (CASE WHEN type IN('payment','adjustment') THEN -1
            ELSE 1
            END)) OVER (PARTITION BY bc.id) AS claim_sum_amount,
            bc.claim_dt,
            p.birth_date
    FROM public.patients p
    INNER JOIN billing.claims bc on bc.patient_id = p.id
    INNER JOIN billing_comments pc on pc.id = bc.id
    INNER JOIN billing.providers bp on bp.id = bc.billing_provider_id
    INNER JOIN facilities f on f.id = bc.facility_id
    LEFT JOIN LATERAL (
        SELECT
            MAX(coalesce(study_dt,bc.claim_dt)) AS study_date
		FROM billing.claims bc
            LEFT JOIN billing.charges bch ON bch.claim_id = bc.id
            LEFT JOIN billing.charges_studies bchs on bchs.charge_id = bch.id
            LEFT JOIN studies s ON s.id = bchs.study_id
		WHERE bc.patient_id = p.id
      ) std ON TRUE
    WHERE <%= whereDate %>
    <% if (billingProviderIds) { %>AND <% print(billingProviderIds); } %>
    <% if (facilityIds) { %>AND <% print(facilityIds); } %>
    <% if (patientIds) { %>AND <% print(patientIds); } %>

    <% if (patientLastnameFrom && patientLastnameTo) { %>
    AND p.last_name BETWEEN '<%= patientLastnameFrom %>' AND '<%= patientLastnameTo %>Z'
    <% } %>

    ORDER BY first_name),
    patient_claim_details AS(
		SELECT
		    pid AS patient_id,
			max(claim_dt) AS study_date
		FROM detailed_cte
		GROUP BY pid
	),
    main_detail_cte AS (
		SELECT
			*,
		   date_part('year', age(pcd.study_date, dc.birth_date)::interval) AS age
		FROM patient_claim_details pcd
		INNER JOIN detailed_cte dc ON pcd.patient_id = dc.pid
	),
    guarantor_cte AS (
        SELECT
           mpid,
           pgid,
           guarantor_address1,
           guarantor_address2,
           guarantor_city,
           guarantor_state,
           guarantor_zip,
           guarantor_full_name,
           RANK () OVER (
                PARTITION BY mpid
                   ORDER BY pgid DESC
                ) pg_rank
        FROM (
                SELECT
                    mdc.pid AS mpid,
                    pg.id AS pgid,
                    pg.guarantor_info->'address1' AS guarantor_address1,
                    pg.guarantor_info->'address2' AS guarantor_address2,
                    pg.guarantor_info->'city' AS guarantor_city,
                    pg.guarantor_info->'state' AS guarantor_state,
                    pg.guarantor_info->'zip' AS guarantor_zip,
                    get_full_name(pg.guarantor_info->'lastName',pg.guarantor_info->'firstName',pg.guarantor_info->'mi','',pg.guarantor_info->'suffix') as guarantor_full_name
                FROM main_detail_cte mdc
                INNER JOIN patient_guarantors pg on pg.patient_id = mdc.pid AND pg.deleted_dt IS NULL
                GROUP BY
                      mpid
                    , pgid
                    , guarantor_address1
                    , guarantor_address2
                    , guarantor_city
                    , guarantor_state
                    , guarantor_zip
                    , guarantor_full_name
        ) pgs
    ),
    main_detail_ext_cte AS (
        SELECT
            mdc.pid,
            mdc.claim_id,
            mdc.ordering_facility_contact_id,
            sum_amount,
            first_name,
            middle_name,
            last_name,
            full_name,
            account_no,
            address1,
            address2,
            city,
            state,
            zip,
            enc_date,
            description,
            code,
            enc_id,
            row_flag,
            amount,
            charge,
            payment,
            adjustment,
            billing_provider_name,
            billing_proaddress1,
            billing_proaddress2,
            billing_procity,
            billing_prostate,
            billing_prozip,
            billing_zip_plus,
            billing_phoneno,
            study_date,
            age,
            payment_type,
            sort_order,
            charge_id,
            claim_sum_amount,
            gc.guarantor_full_name,
            gc.guarantor_address1,
            gc.guarantor_address2,
            gc.guarantor_city,
            gc.guarantor_state,
            gc.guarantor_zip
        FROM main_detail_cte mdc
        LEFT JOIN guarantor_cte gc ON gc.mpid = mdc.pid
        WHERE COALESCE(pg_rank,1) = 1
        ORDER BY first_name
    ),
    detail_cte AS (
        SELECT *
        FROM main_detail_ext_cte
        WHERE ( CASE
                    WHEN payment_type = 'adjustment' THEN amount != 0::money
                    ELSE true
                END )
        AND sum_amount >=  <%= minAmount  %>::MONEY
        AND sum_amount != 0::MONEY
        AND claim_sum_amount != 0::MONEY
        ORDER BY first_name
    ),
    ordering_facility_claim_cte AS (
        SELECT
              pid
            , max(claim_id) AS ordering_facility_claim_id
        FROM detail_cte
        WHERE ordering_facility_contact_id IS NOT NULL
        GROUP BY pid
    ),
    ordering_facility_cte AS (
        SELECT
              ofct.pid          AS patient_id
            , ofct.ordering_facility_claim_id
            , of.name           AS ordering_facility_name
            , of.address_line_1 AS ordering_facility_address1
            , of.address_line_2 AS ordering_facility_address2
            , of.city           AS ordering_facility_city
            , of.state          AS ordering_facility_state
            , of.zip_code       AS ordering_facility_zip_code
        FROM ordering_facility_claim_cte ofct
        INNER JOIN billing.claims bc ON bc.id = ofct.ordering_facility_claim_id
        INNER JOIN ordering_facility_contacts ofc ON ofc.id = bc.ordering_facility_contact_id
        INNER JOIN ordering_facilities of ON of.id = ofc.ordering_facility_id
    ),
    all_detail_cte AS(
        SELECT
              dc.*
            , ofc.*
        FROM detail_cte dc
        LEFT JOIN ordering_facility_cte ofc ON ofc.patient_id = dc.pid
    ),
    <% if (logInClaimInquiry === 'true') { %>
        create_comments AS (
            INSERT INTO billing.claim_comments
                (
                      claim_id
                    , type
                    , note
                    , created_by
                    , created_dt
                )
                (
                    SELECT
                          DISTINCT claim_id
                        , 'patient_statement'
                        , 'Patient Statement Printed for ' || full_name || ' (patient)'
                        , <%= userId %>
                        , now()
                    FROM detail_cte
                    WHERE row_flag = 1
                )
            ),
    <% } %>
    date_cte AS (
    SELECT
        pid,
        max(enc_date::date) FILTER (WHERE payment_type = ANY (ARRAY['payment','adjustment'])) payment_type_date1,
        max(enc_date::date) FILTER (WHERE payment_type = 'charge')  payment_type_date2
    FROM main_detail_ext_cte
    WHERE payment_type  = ANY (ARRAY['payment','adjustment' ,'charge'] )
    GROUP BY pid
    ),

    sum_encounter_cte AS (
    SELECT
        dc.pid,
        dc.enc_id,
        COALESCE (payment_type_date1, payment_type_date2) AS bucket_date,
        <%= encounterTotal %> AS enc_total_amount
    FROM all_detail_cte dc
    INNER JOIN date_cte dtc ON  dtc.pid = dc.pid
    GROUP BY
      dc.pid
    , dc.enc_id
    , bucket_date
    HAVING <%= encounterTotal %> != '0'
    ),

    sum_statement_credit_cte AS (
    SELECT
      pid
    , sum(enc_total_amount) FILTER (WHERE bucket_date between <%= sDate %> - interval '30 days' and  <%= sDate %>) as current_amount
    , sum(enc_total_amount) FILTER (WHERE bucket_date between <%= sDate %> - interval '60 days' and  <%= sDate %>- interval '31 days') as over30_amount
    , sum(enc_total_amount) FILTER (WHERE bucket_date between <%= sDate %> - interval '90 days' and  <%= sDate %>- interval '61 days') as over60_amount
    , sum(enc_total_amount) FILTER (WHERE bucket_date between <%= sDate %> - interval '120 days' and <%= sDate %> - interval '91 days') as over90_amount
    , sum(enc_total_amount) FILTER (WHERE bucket_date <= <%= sDate %> - interval '121 days') as over120_amount
    , sum(enc_total_amount) AS statement_total_amount
    FROM sum_encounter_cte
    GROUP BY pid
    ),
    statement_cte AS (
        SELECT
            <%= statmentAging %>
            (SELECT description
             FROM billing.messages
             WHERE company_id = 1
             AND CODE = (SELECT CASE
                         WHEN over120_amount IS NOT NULL THEN '>120'
                         WHEN over90_amount IS NOT NULL THEN '91-120'
                         WHEN over60_amount IS NOT NULL THEN '61-90'
                         WHEN over30_amount IS NOT NULL THEN '31-60'
                         WHEN current_amount IS NOT NULL THEN '0-30'
                         ELSE 'collections'
                         END)
            ) AS billing_msg,
            pid AS pid
        FROM sum_statement_credit_cte
        ),

    all_cte AS (
    -- 1st Header, Billing Provider, update the columns in the dataset
    -- 2nd Header, Patient
    SELECT
      'PatientID'          AS c1
    , 'PatientFirstName'   AS c2
    , 'PatientMiddleName'  AS c3
    , 'PatientLastName'    AS c4
    , 'PatientMRN'         AS c5
    , 'PatientAddress1'    AS c6
    , 'PatientAddress2'    AS c7
    , 'PatientCity'        AS c8
    , 'PatientState'       AS c9
    , 'PatientZip'         AS c10
    , 'EncounterDate'      AS c11
    , 'Description'        AS c12
    , 'Code'               AS c13
    , 'EncounterID'        AS c14
    , 'Charge'             AS c15
    , 'Payment'            AS c16
    , 'Adjustments'        AS c17
    , 'Deductible'         AS c18
    , 'CoPay'              AS c19
    , 'CoInsurance'        AS c20
    , 'Current'            AS c21
    , 'Over30'             AS c22
    , 'Over60'             AS c23
    , 'Over90'             AS c24
    , 'Over120'            AS c25
    , 'BillingMessage'     AS c26
    <% if (reportFormat === 'html' || reportFormat === 'pdf') {%>
    , 'GuarantorName'               AS c27
    , 'Age'                         AS c28
    , 'PatientGuarantorAddress1'    AS c29
    , 'PatientGuarantorAddress2'    AS c30
    , 'PatientGuarantorCity'        AS c31
    , 'PatientGuarantorState'       AS c32
    , 'PatientGuarantorZip'         AS c33
    , 'orderingFacilityName'        AS c34
    , 'orderingFacilityAddress1'    AS c35
    , 'orderingFacilityAddress2'    AS c36
    , 'orderingFacilityCity'        AS c37
    , 'orderingFacilityState'       AS c38
    , 'orderingFacilityZipCode'     AS c39
    , 'mailTo'                      AS c40
    , 'countryCode'                 AS c41
    <% } %>
    , -1                   AS pid
    , -1                   AS enc_id
    , null::date           AS enc_date
    , -1                   AS row_flag
    , -1                   AS sort_order
    , -1                   AS statement_flag
    , ''                   AS anything_else
    , ''                   AS charge_id
    UNION

    -- Billing Information
    SELECT
      billing_provider_name
    , billing_proaddress1
    , billing_proaddress2
    , billing_procity
    , billing_prostate
    , billing_prozip
    , billing_zip_plus
    , billing_phoneno
    , to_char(<%= statementDate %>::date, '<%= dateFormat %>')
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    <% if (reportFormat === 'html' || reportFormat === 'pdf') {%>
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    <% } %>
    , pid
    , 0
    , null
    , 0
    , 0                              AS sort_order
    , 0
    , null
    , null
    FROM all_detail_cte
    UNION

    <%= statementAmount %>
    <%= patientInfo %>

    -- Details
    SELECT
      pid::text
    , first_name
    , middle_name
    , last_name
    , account_no
    , address1
    , address2
    , city
    , state
    , zip
    , to_char(enc_date ,'<%= dateFormat %>') AS enc_date
    , description
    , code
    , enc_id::text
    , charge::text
    , payment::text <%= CR %>
    , adjustment::text <%= CR %>
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    <% if (reportFormat === 'html' || reportFormat === 'pdf') {%>
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    <% } %>
    , pid
    , enc_id
    , enc_date::date AS enc_date
    , row_flag
    , sort_order
    , null
    <%= anythingElse %>
    , charge_id::text
    FROM all_detail_cte
    UNION

    -- Encounter Total, sum per pid and enc_id, both should be in select
    SELECT
      pid::text
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , 'Encounter Total'
    , coalesce(enc_total_amount::text,'0.00')
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    <% if (reportFormat === 'html' || reportFormat === 'pdf') {%>
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    <% } %>
    , pid
    , enc_id
    , null
    , 5
    , 98   AS sort_order
    , null
    , null
    , null
    FROM sum_encounter_cte
    UNION

    -- Statement Totals, 30, 60, 90, 120, Balance
    SELECT
      null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , 'Statement Total'
    , statement_total_amount::text
    , null
    , null
    , null
    , current_amount::text
    , over30_amount::text
    , over60_amount::text
    , over90_amount::text
    , over120_amount::text
    , billing_msg
    <% if (reportFormat === 'html' || reportFormat === 'pdf') {%>
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    <% } %>
    , pid
    , null
    , null
    , 6
    , 99   AS sort_order
    , 0
    , null
    , null
    FROM statement_cte

    <%= billingInfo %>
    <%= billingMsg %>
    )

    -- Main Query, added rowFlag and encounterAmount for HTML and PDF
    SELECT
    CASE
    WHEN row_flag = 5 THEN null
    ELSE c1
    END
    , c2
    , c3
    , c4
    , c5
    , c6
    , c7
    , c8
    , c9
    , c10
    , c11
    , c12
    , c13
    , c14
    , c15
    , c16
    , c17
    , c18
    , c19
    , c20
    , c21
    , c22
    , c23
    , c24
    , c25
    , c26
    <% if (reportFormat === 'html' || reportFormat === 'pdf') {%>
    , c27
    , c28
    , c29
    , c30
    , c31
    , c32
    , c33
    , c34
    , c35
    , c36
    , c37
    , c38
    , c39
    , c40
    , c41
    <% } %>
    <%= rowFlag %>
    <%= encounterAmount %>
    <%= statementFlag %>
    , anything_else
    , null
    FROM all_cte
    ORDER BY
    pid
    , enc_id
    , sort_order
    , enc_date
    , row_flag
    , statement_flag
    , charge_id
    , c13;

`);

const api = {
    getReportData: (initialReportData) => {
        if (initialReportData.report.params.patientOption) {
            initialReportData.report.params.patientOption = initialReportData.report.params.patientOption === 'S' && initialReportData.report.params.patientIds === undefined ? 'All' : initialReportData.report.params.patientOption;
        }

        // convert patientIds array of string to integer
        if (initialReportData.report.params.patientIds) {
            initialReportData.report.params.patientIds = initialReportData.report.params.patientIds.map(Number);
        }

        if (initialReportData.report.params.minAmount) {
            initialReportData.report.params.minAmount = parseFloat(initialReportData.report.params.minAmount);
        }


        if (initialReportData.report.params.payToProvider && initialReportData.report.params.payToProvider !== undefined) {
            initialReportData.report.params.payToProvider = initialReportData.report.params.payToProvider === 'true';
        } else {
            initialReportData.report.params.payToProvider = false;
        }

        initialReportData.report.params.allBillingProviders = initialReportData.report.params.allBillingProviders === 'true';

        return Promise.join(
            api.createpatientStatementDataSet(initialReportData.report.params),
            initialReportData.report.params.allBillingProviders ? [] : dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            dataHelper.getPatientInfo(initialReportData.report.params.companyId, initialReportData.report.params.patientIds),
            // other data sets could be added here...
            (patientStatementDataSet, providerInfo, patientInfo) => {
                // add report filters
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.lookups.patients = patientInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(patientStatementDataSet);
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                return initialReportData;
            });
    },

    transformReportData: (rawReportData) => {
        if (rawReportData.dataSets[0].rowCount === 0) {
            return Promise.resolve(rawReportData);
        }

        // aggregate raw data, add header columns for provider
        return new Promise((resolve, reject) => {
            rawReportData.report.bottomAddressPx = "10px"; // Put this in here as this can changed, this is to avoid updating the template
            rawReportData.dataSets[0].columns = [{name: 'BillingProviderName'}, {name: 'Address1'}, {name: 'Address2'}, {name: 'City'}, {name: 'State'}, {name: 'ZipCode'}, {name: 'ZipPlus'}, {name: 'Phone'}, {name: 'StatementDate'}];
            return resolve(rawReportData);
        });
    },

    getJsReportOptions: (reportParams, reportDefinition) => {
        return reportDefinition.jsreport[reportParams.reportFormat];
    },

    createReportFilters: (initialReportData) => {
        const lookups = initialReportData.lookups;
        const params = initialReportData.report.params;
        const filtersUsed = [];
        filtersUsed.push({ name: 'company', label: 'Company', value: lookups.company.name });

        if (params.allFacilities && params.facilityIds)
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.map(Number).indexOf(parseInt(f.id, 10)) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        }
        // Billing provider Filter
        filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: params.allBillingProviders ? 'All' : _(lookups.billingProviderInfo).map(f => f.name).value() });

        // Min Amount
        filtersUsed.push({ name: 'minAmount', label: 'Minumum Amount', value: params.minAmount });

        filtersUsed.push({ name: 'sDate', label: 'Statement Date', value: moment(params.sDate).format(params.dateFormat)});

        if (params.patientOption !== 'R') {
            const patientNames = params.patientOption === 'All' ? 'All' : _(lookups.patients).map(f => f.name).value();
            filtersUsed.push({ name: 'patientNames', label: 'Patients', value: patientNames });
        }

        filtersUsed.push({ name: 'payToProvider', label: 'Use address of Pay-To Provider', value: params.payToProvider ? 'Yes' : 'No' });

        filtersUsed.push({
            name: 'logInClaimInquiry',
            label: 'Log in claim inquiry',
            value: (params.logInClaimInquiry === "true") ? 'Yes' : 'No'
        });

        if (params.patientOption === 'R') {
            filtersUsed.push({name: 'patientLastnameFrom', label: 'Patient Lastname From', value: params.patientLastnameFrom });
            filtersUsed.push({name: 'patientLastnameTo', label: 'Patient Lastname To', value: params.patientLastnameTo });
        }

        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - patientStatement count

    createpatientStatementDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getpatientStatementDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = patientStatementDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getpatientStatementDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            patientIds: null,
            billingProviderIds: null,
            facilityIds: null,
            statementDate: null,
            patientLastnameFrom: null,
            patientLastnameTo: null,
            userId: null,
            reportFormat: null,
            logInClaimInquiry: null,
            countryCode: null,
            mailTo: null
        };

        filters.userId = reportParams.userId;

        // patients
        if (reportParams.patientOption === 'S' && reportParams.patientIds) {
            params.push(reportParams.patientIds);
            filters.patientIds = queryBuilder.whereIn(`p.id`, [params.length]);
        }

        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        // billing providers
        if (reportParams.billingProvider && reportParams.billingProvider.length > 0) {
            params.push(reportParams.billingProvider);
            filters.billingProviderIds = queryBuilder.whereIn(`bp.id`, [params.length]);
        }

        // Min Amount
        filters.minAmount = reportParams.minAmount || 0;

         // Excel Report (xlsx)
         filters.reportFormat = reportParams.reportFormat

        params.push(reportParams.sDate);
        filters.sDate = `$${params.length}::date`;
        filters.statementDate = `$${params.length}::date`;

        filters.whereDate = queryBuilder.whereDateInTz(` CASE  WHEN type = 'charge' THEN  bc.claim_dt ELSE pc.commented_dt END `, `<=`, [params.length], `f.time_zone`);
        filters.payToProvider = reportParams.payToProvider;
        filters.logInClaimInquiry = reportParams.logInClaimInquiry;

        if (reportParams.patientOption === 'R') {
            filters.patientLastnameFrom = reportParams.patientLastnameFrom;
            filters.patientLastnameTo = reportParams.patientLastnameTo;
        }

        if ( /^html|pdf$/i.test(reportParams.reportFormat) ) {
            filters.rowFlag = `, row_flag`;
            filters.encounterAmount = `, CASE row_flag WHEN 1 THEN c15 WHEN 2 THEN c16 WHEN 3 THEN c17 ELSE '' END AS enc_amount`;
            filters.statementFlag = `, statement_flag`;
            filters.statementAmount = `
              -- Statement Amount
              SELECT
                null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , coalesce(statement_total_amount::text, '0.00')
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , pid
              , 0
              , null
              , 0
              , 0                              AS sort_order
              , 1
              , null
              , null
              FROM sum_statement_credit_cte
              UNION
              `;

            filters.patientInfo = `
              -- Patient Info
              SELECT
                null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , to_char('${reportParams.sDate}'::date, '${reportParams.dateFormat}')
              , full_name
              , account_no
              , address1
              , address2
              , city
              , state
              , zip
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , guarantor_full_name
              , age::text
              , guarantor_address1
              , guarantor_address2
              , guarantor_city
              , guarantor_state
              , guarantor_zip
              , ordering_facility_name
              , ordering_facility_address1
              , ordering_facility_address2
              , ordering_facility_city
              , ordering_facility_state
              , ordering_facility_zip_code
              , '${reportParams.mailTo}'
              , '${reportParams.countryCode}'
              , pid
              , 0
              , null
              , 0
              , 0                              AS sort_order
              , 2
              , null
              , null
              FROM all_detail_cte
              UNION
              `;

            filters.billingInfo = `
            UNION
            SELECT
              billing_provider_name
            , billing_proaddress1
            , billing_proaddress2
            , billing_procity
            , billing_prostate
            , billing_prozip
            , billing_zip_plus
            , billing_phoneno
            , to_char('${reportParams.sDate}'::date, '${reportParams.dateFormat}')
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , pid
            , null
            , null
            , 6
            , 99   AS sort_order
            , 1
            , null
            , null
            FROM all_detail_cte
            `;

            filters.billingMsg = `
            UNION
            SELECT
              null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , billing_msg
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , null
            , pid
            , null
            , null
            , 6
            , 99   AS sort_order
            , 2
            , null
            , null
            FROM statement_cte
            `;
            filters.CR = ``;
            filters.anythingElse = `
            , CASE
            WHEN (row_flag = 2 AND payment >= 0::MONEY) OR (row_flag = 3 AND adjustment >= 0::MONEY) THEN 'CR'
            WHEN (row_flag = 2 AND payment < 0::MONEY) OR (row_flag = 3 AND adjustment < 0::MONEY) THEN 'DR'
            ELSE null
            END
            `;
            filters.statmentAging  = `
                COALESCE(statement_total_amount, 0::money) AS statement_total_amount,
                COALESCE(current_amount,0::money) AS current_amount,
                COALESCE(over30_amount,0::money) AS over30_amount,
                COALESCE(over60_amount,0::money) AS over60_amount,
                COALESCE(over90_amount,0::money) AS over90_amount,
                COALESCE(over120_amount,0::money) AS over120_amount,
           `;
           filters.claimAmount = `
                CASE WHEN type = 'charge' THEN amount end AS charge,
                CASE WHEN type = 'payment' THEN amount end AS payment,
                CASE WHEN type = 'adjustment' THEN amount end AS adjustment,
            `;
            filters.encounterTotal = `
                SUM(dc.amount)
            `;
        }
        else {
            filters.rowFlag = ``;
            filters.encounterAmount = ``;
            filters.statementFlag = ``;
            filters.statementAmount = ``;
            filters.patientInfo = ``;
            filters.billingInfo = ``;
            filters.billingMsg = ``;
            filters.CR = `|| ' CR'`;
            filters.anythingElse = `, null`;
            filters.statmentAging = `
                    COALESCE(statement_total_amount::NUMERIC, 0) AS statement_total_amount,
                    COALESCE(current_amount::NUMERIC,0) AS current_amount,
                    COALESCE(over30_amount::NUMERIC,0) AS over30_amount,
                    COALESCE(over60_amount::NUMERIC,0) AS over60_amount,
                    COALESCE(over90_amount::NUMERIC,0) AS over90_amount,
                    COALESCE(over120_amount::NUMERIC,0) AS over120_amount,
            `;
            filters.claimAmount = `
                CASE WHEN type = 'charge' THEN amount::NUMERIC END AS charge,
                CASE WHEN type = 'payment' THEN amount::NUMERIC END AS payment,
                CASE WHEN type = 'adjustment' THEN amount::NUMERIC END AS adjustment,
            `;
             filters.encounterTotal = `
                SUM(dc.amount::NUMERIC)
            `;
        }

        filters.dateFormat = reportParams.dateFormat;
        filters.countryCode = reportParams.countryCode;
        filters.mailTo = reportParams.mailTo;
        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
