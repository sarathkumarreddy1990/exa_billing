const _ = require('lodash');
const db = require('../db');
const commonIndex = require('../../../../../server/shared/index');
const claimInquiryData = require('../../../../../server/data/claim/claim-inquiry');

// generate query template ***only once*** !!!
const invoiceActivityStatementTemplate2 = _.template(`
WITH get_payer_details AS (
    SELECT
        <%= selectDetails %>
    FROM billing.claims bc
    <%= joinCondition %>
    WHERE bc.invoice_no IS NOT NULL
    AND bc.payer_type = '<%= payerType %>'
    AND bc.id = <%= claimId %>
),

invoice_payments AS (
    SELECT
        bc.invoice_no,
        bc.submitted_dt::DATE AS submitted_dt,
        claim_totals.charges_bill_fee_total AS bill_fee,
        claim_totals.payments_applied_total AS payment,
        claim_totals.adjustments_applied_total AS adjustment,
        claim_totals.claim_balance_total AS balance,
        bc.id AS claim_id,
        bc.facility_id
    FROM billing.claims bc
    <%= joinQuery %>
    INNER JOIN LATERAL (SELECT * FROM billing.get_claim_totals(bc.id)) claim_totals ON true
    WHERE bc.invoice_no IS NOT NULL
    AND bc.billing_method = 'direct_billing'
    <%= whereQuery %>
),

total_invoice_details AS (
    SELECT
        ROW_NUMBER () OVER (ORDER BY invoice_no) AS id,
        invoice_no::INT AS invoice_no,
        to_char(timezone(public.get_facility_tz(facility_id::INT), MAX(submitted_dt)::TIMESTAMP), '<%= dateFormat %>') AS invoice_date,
        SUM(bill_fee) AS invoice_bill_fee,
        SUM(payment) AS invoice_payment,
        SUM(adjustment) AS invoice_adjustment,
        SUM(balance) AS invoice_balance,
        COUNT(1) OVER (range unbounded preceding) AS total_records,
        ARRAY_AGG(claim_id) AS claim_ids,
        facility_id
    FROM invoice_payments
    GROUP BY invoice_no,facility_id
    ORDER BY invoice_no
),

invoice_age_balance AS (
    SELECT
        COALESCE(max(date_part('day', (now() - submitted_dt))),0) AS age,
        balance
    FROM invoice_payments
    GROUP BY submitted_dt, balance
),

age_details AS (
    SELECT
        COALESCE(sum(balance) FILTER(WHERE age <= 0), 0::money) AS current_balance,
        COALESCE(sum(balance) FILTER(WHERE age > 0 and age <= 30 ), 0::money) AS age_30,
        COALESCE(sum(balance) FILTER(WHERE age > 30 and age <= 60), 0::money) AS age_60,
        COALESCE(sum(balance) FILTER(WHERE age > 60 and age <= 90), 0::money) AS age_90,
        COALESCE(sum(balance) FILTER(WHERE age > 90 and age <= 120), 0::money) AS age_120,
        sum(balance) AS total_balance
    FROM invoice_age_balance
),

providers_details AS (
    SELECT
        CASE
            WHEN payer_type IN ('primary_insurance', 'secondary_insurance', 'tertiary_insurance') THEN
                jsonb_build_object(
                    'name', pip.insurance_name,
                    'address', pip.insurance_info->'Address1',
                    'address2', pip.insurance_info->'Address2',
                    'city', pip.insurance_info->'City',
                    'state', pip.insurance_info->'State',
                    'zip_code', pip.insurance_info->'ZipCode',
                    'phone_no', pip.insurance_info->'PhoneNo'
                )
            WHEN payer_type = 'referring_provider' THEN
                jsonb_build_object(
                    'name', ppr.full_name,
                    'address', ppc.contact_info->'ADDR1',
                    'address2', ppc.contact_info->'ADDR2',
                    'city', ppc.contact_info->'CITY',
                    'state', ppc.contact_info->'c1State',
                    'zip_code', ppc.contact_info->'c1Zip',
                    'phone_no', ppc.contact_info->'PHNO'
                )
            WHEN payer_type = 'patient' THEN
                jsonb_build_object(
                    'name', get_full_name(pp.last_name,pp.first_name),
                    'address', pp.patient_info->'c1AddressLine1',
                    'address2', pp.patient_info->'c1AddressLine2',
                    'city', pp.patient_info->'c1City',
                    'state', pp.patient_info->'STATE',
                    'zip_code', pp.patient_info->'ZIP',
                    'phone_no', pp.patient_info->'c1HomePhone'
                )
            WHEN payer_type = 'ordering_facility' THEN
                jsonb_build_object(
                    'name', pof.name,
                    'address', pof.address_line_1,
                    'address2', pof.address_line_2,
                    'city', pof.city,
                    'state', pof.state,
                    'zip_code', pof.zip_code,
                    'phone_no', ofc.phone_number
                )
        END AS responsible_party_address,
        jsonb_build_object(
            'name', bp.name
        ) AS billing_provider_details,
        jsonb_build_object(
            'name', bp.name,
            'address', bp.pay_to_address_line1,
            'address2', bp.pay_to_address_line2,
            'city', bp.pay_to_city,
            'state', bp.pay_to_state,
            'zip_code', bp.pay_to_zip_code,
            'phone_no', bp.pay_to_phone_number
        ) AS pay_to_provider_address
    FROM billing.claims bc
    INNER JOIN public.facilities f ON f.id = bc.facility_id
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
    LEFT JOIN LATERAL (
        SELECT
            CASE bc.payer_type
                WHEN 'primary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'primary')
                WHEN 'secondary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'secondary')
                WHEN 'tertiary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'tertiary')
            END AS patient_insurance
        FROM billing.claim_patient_insurances
        WHERE claim_id = bc.id
    ) AS pat_claim_ins ON TRUE
    LEFT JOIN public.patient_insurances ppi ON ppi.id = pat_claim_ins.patient_insurance
    LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
    LEFT JOIN public.ordering_facility_contacts ofc ON ofc.id = bc.ordering_facility_contact_id
    LEFT JOIN public.ordering_facilities pof ON pof.id = ofc.ordering_facility_id
    LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
    LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
    WHERE bc.id = <%= claimId %>
),

providers_cte AS (
    SELECT
        jsonb_agg(jsonb_build_object(
            'responsible_party_address', responsible_party_address,
            'billing_provider_details', billing_provider_details,
            'pay_to_provider_address', pay_to_provider_address
        )) AS info
    FROM providers_details
),

invoice_totals_cte AS (
    SELECT
        jsonb_agg(jsonb_build_object(
            'invoice_no', invoice_no,
            'invoice_date', invoice_date,
            'bill_fee', invoice_bill_fee,
            'payment', invoice_payment,
            'adjustment', invoice_adjustment,
            'balance', invoice_balance
        )) AS info
    FROM total_invoice_details
),

age_cte AS (
    SELECT
        jsonb_agg(jsonb_build_object(
            'current_balance', current_balance,
            'age_30', age_30,
            'age_60', age_60,
            'age_90', age_90,
            'age_120', age_120,
            'total_balance', total_balance
        )) AS info
    FROM age_details
)

SELECT
    p.info,
    i.info,
    a.info
FROM providers_cte AS p
JOIN invoice_totals_cte AS i ON TRUE
JOIN age_cte AS a ON TRUE
`);

const api = {
    getReportData: (initialReportData) => {
        let invoiceActivityData = api.createInvoiceActivityStatementDataSet(initialReportData.report.params);

        return Promise.all([
            (invoiceActivityData)]).then
             (function(invoiceActivityDataSet){
                initialReportData.filters = api.createReportFilters(initialReportData);
                initialReportData.dataSets.push(invoiceActivityDataSet[0]);
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                return initialReportData;
            });
    },

    transformReportData: (rawReportData) => {
        return new Promise((resolve, reject) => {
            if(rawReportData){
                return resolve(rawReportData);
            } else {
                reject();
            }
        });
    },

    getJsReportOptions: (reportParams, reportDefinition) => {
        return reportDefinition.jsreport[reportParams.reportFormat];
    },

    createReportFilters: (initialReportData) => {
        const lookups = initialReportData.lookups;
        const filtersUsed = [];
        filtersUsed.push({ name: 'company', label: 'Company', value: lookups.company.name });

        return filtersUsed;
    },

    createInvoiceActivityStatementDataSet: (reportParams) => {
        const queryContext = api.getinvoiceActivityDataSetQueryContext(reportParams);
        const query = invoiceActivityStatementTemplate2(queryContext.templateData);
        return db.queryForReportData(query, queryContext.queryParams);
    },

    getinvoiceActivityDataSetQueryContext: (reportParams) => {
        const params = [];
        let {
            claimId = null,
            payerType = null,
            browserLocale
        } = reportParams;

        const filters = {
            claimId,
            payerType,
            selectDetails: '',
            joinCondition: '',
            joinQuery: '',
            whereQuery: '',
            dateFormat: null
        };

        let {
            joinCondition,
            selectDetails,
            joinQuery,
            whereQuery
        } = claimInquiryData.getInvoiceDetails(reportParams.payerType, reportParams);

        filters.selectDetails = selectDetails;
        filters.joinCondition = joinCondition;
        filters.joinQuery = joinQuery;
        filters.payerType = payerType;
        filters.whereQuery = whereQuery;
        filters.dateFormat = commonIndex.getLocaleFormat(browserLocale);

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
