const _ = require('lodash');
const Promise = require('bluebird');
const db = require('../db');
const dataHelper = require('../dataHelper');
const queryBuilder = require('../queryBuilder');
const commonIndex = require('../../../../../server/shared/index');
const collectionsQueryTemplate = _.template(`
WITH collections
AS (
    SELECT
          account_no AS account_number
        , bc.id AS claim_id
        , to_char(timezone(get_facility_tz(bc.facility_id::integer), bc.claim_dt)::DATE, '<%= browserDateFormat %>') AS claim_date
        , f.time_zone
        , bc.claim_dt
        , bpr.id AS bpr
        , ren_prov.full_name AS attending_physician
        , ref_prov.full_name AS referring_physician
        , pp.last_name AS patient_last_name
        , pp.first_name AS patient_first_name
        , pp.middle_name AS patient_middle_name
        , pp.patient_info -> 'c1AddressLine1' AS patient_address
        , pp.patient_info -> 'c1City' AS patient_city
        , pp.patient_info -> 'c1State' AS patient_state
        , pp.patient_info -> 'c1Zip' AS patient_zip_code
        , pp.patient_info -> 'ssn' AS patient_ssn
        , pp.patient_info -> 'c1HomePhone' AS patient_phone_num
        , to_char(pp.birth_date, '<%= browserDateFormat %>') AS patient_dob
        , patient_guarantor.guarantor_last_name
        , patient_guarantor.guarantor_first_name
        , patient_guarantor.guarantor_address
        , patient_guarantor.guarantor_city
        , patient_guarantor.guarantor_state
        , patient_guarantor.guarantor_zip_zode
        , patient_guarantor.guarantor_phone_num
        , patient_guarantor.guarantor_ssn
        , SUM(bgct.charges_bill_fee_total) AS total_charges
        , SUM(bgct.adjustments_applied_total) AS total_adjustments
        , SUM(bgct.payments_applied_total) AS total_payments
        , SUM(bgct.claim_balance_total) AS patient_current_balance
        , icd_des.icd_description AS diagnosis_short_desc
        , cpt_details.cpt_codes AS procedure_code
        , cpt_details.cpt_description AS procedure_code_short_desc
        , p_pip.insurance_name AS primary_insurance_name
        , s_pip.insurance_name AS secondary_insurance_name
        , t_pip.insurance_name AS tertiary_insurance_name
        , p_ppi.group_number AS primary_subscriber_groupPolicy_num
        , s_ppi.group_number AS secondary_subscriber_group_policy_num
        , t_ppi.group_number AS tertiary_subscriber_group_policy_num
        , claim_status_id
    FROM
        billing.claims bc
    INNER JOIN billing.get_claim_totals(bc.id) bgct ON TRUE
    INNER JOIN billing.claim_status bcs ON bcs.id = bc.claim_status_id
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    INNER JOIN public.facilities f ON f.id = bc.facility_id
    INNER JOIN billing.providers bpr ON bpr.id = bc.billing_provider_id
    INNER JOIN LATERAL(
                 SELECT
                       array_agg(display_code) AS cpt_codes
                     , array_agg(pcc.short_description) AS cpt_description
                FROM
                    billing.charges bch
                INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
                WHERE
                    bch.claim_id = bc.id
            ) cpt_details ON true
    LEFT JOIN public.provider_contacts ren_ppc ON ren_ppc.id = bc.rendering_provider_contact_id
    LEFT JOIN public.providers ren_prov ON ren_prov.id = ren_ppc.provider_id
    LEFT JOIN public.provider_contacts ref_ppc ON ref_ppc.id = bc.referring_provider_contact_id
    LEFT JOIN public.providers ref_prov ON ref_prov.id = ref_ppc.provider_id
    LEFT JOIN LATERAL (
                SELECT
                     ppg.guarantor_info -> 'lastName' AS guarantor_last_name
                   , ppg.guarantor_info -> 'firstName' AS guarantor_first_name
                   , ppg.guarantor_info -> 'address1' AS guarantor_address
                   , ppg.guarantor_info -> 'city' AS guarantor_city
                   , ppg.guarantor_info -> 'state' AS guarantor_state
                   , ppg.guarantor_info -> 'zip' AS guarantor_zip_zode
                   , ppg.guarantor_info -> 'homePhone' AS guarantor_phone_num
                   , ppg.guarantor_info -> 'ssn' AS guarantor_ssn
                FROM
                     patient_guarantors ppg
                WHERE
                    pp.id = patient_id
                    AND NOT ppg.has_deleted /* patient_guarantors.has_deleted */
                ORDER BY id DESC
                LIMIT 1
            ) patient_guarantor ON TRUE
    LEFT JOIN billing.claim_patient_insurances bci ON bci.claim_id = bc.id AND bci.coverage_level = 'primary'
    LEFT JOIN billing.claim_patient_insurances bsi ON bsi.claim_id = bc.id AND bsi.coverage_level = 'secondary'
    LEFT JOIN billing.claim_patient_insurances bti ON bti.claim_id = bc.id AND bti.coverage_level = 'tertiary'
    LEFT JOIN public.patient_insurances p_ppi ON p_ppi.id = bci.patient_insurance_id
    LEFT JOIN public.patient_insurances s_ppi ON s_ppi.id = bsi.patient_insurance_id
    LEFT JOIN public.patient_insurances t_ppi ON t_ppi.id = bti.patient_insurance_id
    LEFT JOIN public.insurance_providers p_pip ON p_pip.id = p_ppi.insurance_provider_id
    LEFT JOIN public.insurance_providers s_pip ON s_pip.id = s_ppi.insurance_provider_id
    LEFT JOIN public.insurance_providers t_pip ON t_pip.id = t_ppi.insurance_provider_id
    LEFT JOIN LATERAL(
                SELECT
                    array_agg(pic.description) AS icd_description
                FROM
                    billing.claim_icds bci
                LEFT JOIN public.icd_codes pic ON pic.id = bci.icd_id WHERE bci.claim_id = bc.id
            ) icd_des ON true
    WHERE
        bcs.code = 'CR'
        AND <%=companyId%>
        AND <%= claimDate %>
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>
        <% if(billingProID) { %> AND <% print(billingProID); } %>
	GROUP BY GROUPING SETS((account_number), (
        account_number
        , bc.id
        , claim_date
        , attending_physician
        , referring_physician
        , patient_last_name
        , patient_first_name
        , patient_middle_name
        , patient_address
        , patient_city
        , patient_state
        , patient_zip_code
        , patient_ssn
        , patient_phone_num
        , patient_dob
        , guarantor_last_name
        , guarantor_first_name
        , guarantor_address
        , guarantor_city
        , guarantor_state
        , guarantor_zip_zode
        , guarantor_phone_num
        , guarantor_ssn
        , bgct.charges_bill_fee_total
        , bgct.adjustments_applied_total
        , bgct.payments_applied_total
        , bgct.claim_balance_total
        , diagnosis_short_desc
        , procedure_code
        , procedure_code_short_desc
        , primary_insurance_name
        , secondary_insurance_name
        , primary_subscriber_groupPolicy_num
        , secondary_subscriber_group_policy_num
        , tertiary_insurance_name
        , tertiary_subscriber_group_policy_num
        , f.time_zone
        , bc.claim_dt
        , bpr
        , claim_status_id
    ))
	ORDER BY account_no
		,claim_id
    )
    <% if (claimsToCollections === 'true') { %>
    , create_comments AS (
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
                    , 'auto'
                    , 'Claim sent to collections'
                    , <%= userId %>
                    , now()
                FROM
                    collections c
                WHERE
                    c.claim_id IS NOT NULL
            )
    )
    , update_cte AS (
        UPDATE billing.claims bc
        SET
            claim_status_id = ( SELECT id FROM billing.claim_status WHERE code = 'CIC' )
        FROM collections col
        WHERE
            bc.id = ANY(SELECT claim_id FROM collections)
            AND <%= claimDate %>
            <% if (facilityIds) { %>AND <% print(facilityIds); } %>
            <% if(billingProvider) { %> AND <% print(billingProvider); } %>
            RETURNING *,
            (SELECT row_to_json(old_row) FROM (
                SELECT
                  *
                FROM billing.claims i_bc
                WHERE i_bc.id = bc.id) old_row
            ) old_values

    ), insert_audit as(
        SELECT billing.create_audit(
            <%= reportCountryConfig.companyId %>
          , 'reports'
          ,  ucc.id
          , 'Claims'
          , 'reports'
          , 'Update Claim Status for ' || ucc.id || ' Collections Report'
          , '<%= userIp %>'
          ,  json_build_object(
              'old_values', COALESCE(old_values, '{}'),
              'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_cte i_uc WHERE i_uc.id = ucc.id) temp_row)
              )::jsonb
          ,  <%= userId %>
          ) AS id
          FROM update_cte ucc
          WHERE ucc.id IS NOT NULL
        )
    <% } %>
    <% if( reportCountryConfig.reportFormat === 'html' || reportCountryConfig.reportFormat === 'pdf') { %>
       , collection_data AS(
            SELECT
              account_number AS "Account #"
            , claim_id AS "Claim #"
            , patient_last_name AS "Patient Last Name"
            , patient_first_name AS "Patient First Name"
            , patient_dob AS "DOB"
            , patient_current_balance AS "Account Balance"
            , claim_date AS "Service Date"
            FROM
                collections)
       <% } else { %>
      , collection_data AS (
           SELECT
               account_number as "Account #"
             , claim_id as "Claim #"
             , claim_date as "Claim Date"
             , attending_physician as "Attending Physician"
             , referring_physician as "Referring Physician"
             , patient_last_name as "Patient Last Name"
             , Patient_first_name as "Patient First Name"
             , patient_middle_name as "Patient Middle Name"
             , patient_address as "Patient Address"
             , patient_city as "Patient City"
             , patient_state as "<%= reportCountryConfig.patientStateHeader %>"
             , patient_zip_code as "<%= reportCountryConfig.patientZipHeader %>"
             <% if (!reportCountryConfig.hidePatientSSN) { %>
                 , patient_ssn as "Patient SSN"
             <% } %>
	         , patient_phone_num as "Patient Phone #"
	         , patient_dob as "DOB"
	         , guarantor_last_name as "Guarantor Last Name"
	         , guarantor_first_name as "Guarantor First Name"
	         , guarantor_address as "Guarantor Address"
	         , guarantor_city as "Guarantor City"
	         , guarantor_state as "<%= reportCountryConfig.guarantorStateHeader %>"
	         , guarantor_zip_zode as "<%= reportCountryConfig.guarantorZipHeader %>"
             , guarantor_phone_num as "Guarantor Phone #"
             <% if (!reportCountryConfig.hideGuarantorSSN) { %>
                , guarantor_ssn as "Guarantor SSN"
             <% } %>
	         , total_charges as "Total Charges"
	         , total_adjustments as "Total Adjustments"
	         , total_payments as "Total Payments"
             , patient_current_balance as "Patient Current Balance"
             <% if (!reportCountryConfig.hideDiagnosis) { %>
                , diagnosis_short_desc as "Diagnosis Code Description"
             <% } %>
    	     , procedure_code as "<%= reportCountryConfig.cptHeader %>"
    	     , procedure_code_short_desc as "<%= reportCountryConfig.cptDescriptionHeader %>"
             , primary_insurance_name as "Primary Insurance Name"
             <% if (!reportCountryConfig.hideSecondaryInsurance) { %>
                , secondary_insurance_name as "Secondary Insurance Name"
                , tertiary_insurance_name as "Tertiary Insurance Name"
             <% } %>
             , primary_subscriber_groupPolicy_num as "<%= reportCountryConfig.groupNumberHeader %>"
             <% if (!reportCountryConfig.hideSecondaryInsurance) { %>
                , secondary_subscriber_group_policy_num as "Secondary Insurance Group Policy #"
                , tertiary_subscriber_group_policy_num as "Tertiary Insurance Group Policy #"
             <% } %>
        FROM collections
    )
    <% } %>
    <% if (claimsToCollections === 'true') { %>
        SELECT
            col.*
        FROM collection_data col, insert_audit
        WHERE
            col."Claim #" = insert_audit.id
    <% } else { %>
        SELECT
            col.*
        FROM collection_data col
    <% }  %>
`);

const api = {
    getReportData: (initialReportData) => {
        let countyCode = initialReportData.report.params.country_alpha_3_code;
        let collectionsColumnHeader = initialReportData.report.vars.columnHeader;
        let collectionsColumnHidden = initialReportData.report.vars.columnHidden;
        initialReportData.report.params.cptHeader = collectionsColumnHeader.cpt[countyCode];
        initialReportData.report.params.cptDescriptionHeader = collectionsColumnHeader.cptDescription[countyCode];
        initialReportData.report.params.patientStateHeader = collectionsColumnHeader.patientState[countyCode];
        initialReportData.report.params.patientZipHeader = collectionsColumnHeader.patientZip[countyCode];
        initialReportData.report.params.guarantorStateHeader = collectionsColumnHeader.guarantorState[countyCode];
        initialReportData.report.params.guarantorZipHeader = collectionsColumnHeader.guarantorZip[countyCode];
        initialReportData.report.params.groupNumberHeader = collectionsColumnHeader.groupNumber[countyCode];
        initialReportData.report.params.hideDiagnosis = collectionsColumnHidden.diagnosisCode[countyCode];
        initialReportData.report.params.hidePatientSSN = collectionsColumnHidden.patientSSN[countyCode];
        initialReportData.report.params.hideGuarantorSSN = collectionsColumnHidden.guarantorSSN[countyCode];
        initialReportData.report.params.hideSecondaryInsurance = collectionsColumnHidden.secondaryInsurance[countyCode];
        return Promise.join(
            api.createCollectionsDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            (collectionsDataSet, providerInfo) => {
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);
                initialReportData.dataSets.push(collectionsDataSet);
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                return initialReportData;
            });
    },

    transformReportData: (rawReportData) => {
        if (rawReportData.dataSets[0] && rawReportData.dataSets[0].rowCount === 0) {
            return Promise.resolve(rawReportData);
        }
        return new Promise((resolve, reject) => {
            let collectionReportColumns = rawReportData.dataSets[0].columns;
            const rowIndexes = {
                accountBalance: _.findIndex(collectionReportColumns, ['name', 'Account Balance'])
            }
            collectionReportColumns[rowIndexes.accountBalance] ? collectionReportColumns[rowIndexes.accountBalance].cssClass = 'text-right' : '';

            rawReportData.dataSets[0].rowAttributes = {};
            let accountBalanceTotal = [];
            _.each(rawReportData.dataSets[0].rows, function (dataSetValue, index) {
                if (dataSetValue[2] === null) {
                    accountBalanceTotal.push(index);
                }
            });
            _.each(accountBalanceTotal, function (arrayValue, index) {
                rawReportData.dataSets[0].rowAttributes[arrayValue] = { 'class': 'table-line-separator font-weight-bold font-italic' }; // add line separator, bold
            });
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

        if (params.allFacilities && params.facilityIds) {
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        }
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.map(Number).indexOf(parseInt(f.id, 10)) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        }

        if (params.allBillingProvider == 'true') {
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        }
        else {
            const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        }

        filtersUsed.push({ name: 'fromDate', label: 'Date From', value: commonIndex.getLocaleDate(params.fromDate, params.browserLocale) });
        filtersUsed.push({ name: 'toDate', label: 'Date To', value: commonIndex.getLocaleDate(params.toDate, params.browserLocale) });
        return filtersUsed;
    },

    createCollectionsDataSet: (reportParams) => {
        const queryContext = api.getCollectionsDataSetQueryContext(reportParams);
        const query = collectionsQueryTemplate(queryContext.templateData);
        return db.queryForReportData(query, queryContext.queryParams);
    },

    getCollectionsDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            claimDate: null,
            facilityIds: null,
            billingProID: null,
            userId: null,
            claimsToCollections: null,
            browserDateFormat: null,
            billingProvider: null
        }

        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        filters.userIp = reportParams.userIpAddress || '127.0.0.1';

        filters.userId = reportParams.userId;

        filters.claimsToCollections = reportParams.claimsToCollections;

        filters.browserDateFormat = commonIndex.getLocaleFormat(reportParams.browserLocale);

        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.claimDate = queryBuilder.whereDateInTz('bc.claim_dt', '=', [params.length], 'time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateInTzBetween('bc.claim_dt', [params.length - 1, params.length], 'time_zone');
        }

        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bpr.id', [params.length]);
            filters.billingProvider = queryBuilder.whereIn('bpr', [params.length]);
        }

        filters.reportCountryConfig = { ...reportParams }

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
