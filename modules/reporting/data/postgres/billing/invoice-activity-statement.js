const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , queryBuilder = require('../queryBuilder')
    , dataHelper = require('../dataHelper')
    , commonIndex = require('../../../../../server/shared/index');

// generate query template ***only once*** !!!

const invoiceActivityStatementTemplate = _.template(`
WITH get_payer_details AS(
    SELECT
        bc.ordering_facility_id AS ordering_facility_id
    FROM
        billing.claims bc
    INNER JOIN public.provider_groups ppg ON ppg.id = bc.ordering_facility_id
    WHERE
        bc.invoice_no IS NOT NULL
        AND bc.id =  <%= claimId %>
),

claim_details AS(
    SELECT
        ppr.full_name AS referring_physician_name,
        CASE
            WHEN payer_type = 'primary_insurance' THEN
                json_build_object('name',pip.insurance_name,'address',pip.insurance_info->'Address1','address2',pip.insurance_info->'Address2','city',pip.insurance_info->'City','state',pip.insurance_info->'State','zip_code',pip.insurance_info->'ZipCode','phone_no',pip.insurance_info->'PhoneNo')
            WHEN payer_type = 'secondary_insurance' THEN
                json_build_object('name',pip.insurance_name,'address',pip.insurance_info->'Address1', 'address2',pip.insurance_info->'Address2','city',pip.insurance_info->'City','state',pip.insurance_info->'State','zip_code',pip.insurance_info->'ZipCode','phone_no',pip.insurance_info->'PhoneNo')
            WHEN payer_type = 'tertiary_insurance' THEN
                json_build_object('name',pip.insurance_name,'address',pip.insurance_info->'Address1','address2',pip.insurance_info->'Address2','city',pip.insurance_info->'City','state',pip.insurance_info->'State','zip_code',pip.insurance_info->'ZipCode','phone_no',pip.insurance_info->'PhoneNo')
            WHEN payer_type = 'referring_provider' THEN
                json_build_object('name',ppr.full_name,'address',ppc.contact_info->'ADDR1','address2',ppc.contact_info->'ADDR2', 'city',ppc.contact_info->'CITY','state',ppc.contact_info->'c1State','zip_code',ppc.contact_info->'c1Zip','phone_no',ppc.contact_info->'PHNO')
            WHEN payer_type = 'patient' THEN
                json_build_object('name',get_full_name(pp.last_name,pp.first_name),'address',pp.patient_info->'c1AddressLine1','address2',pp.patient_info->'c1AddressLine2','city',pp.patient_info->'c1City','state',pp.patient_info->'STATE','zip_code',pp.patient_info->'ZIP','phone_no',pp.patient_info->'c1HomePhone')
            WHEN payer_type = 'ordering_facility' THEN
                json_build_object('name',ppg.group_name,'address',ppg.group_info->'AddressLine1','address2',ppg.group_info->'AddressLine2','city',ppg.group_info->'City','state',ppg.group_info->'State','zip_code',ppg.group_info->'Zip','phone_no',ppg.group_info->'Phone')
        END AS responsible_party_address,
        json_build_object('name', bp.name, 'address', bp.address_line1, 'address2', bp.address_line2, 'city', bp.city, 'state', bp.state, 'zip_code', bp.zip_code, 'phone_no', bp.phone_number) AS billing_provider_details,
        json_build_object('name', bp.name, 'address', bp.pay_to_address_line1, 'address2', bp.pay_to_address_line2, 'city', bp.pay_to_city, 'state', bp.pay_to_state, 'zip_code', bp.pay_to_zip_code, 'phone_no', bp.pay_to_phone_number) AS pay_to_provider_address
    FROM
        billing.claims bc
    INNER JOIN public.facilities f ON f.id = bc.facility_id
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
    LEFT JOIN public.patient_insurances ppi ON ppi.id = CASE
                                                            WHEN payer_type = 'primary_insurance' THEN primary_patient_insurance_id
                                                            WHEN payer_type = 'secondary_insurance' THEN secondary_patient_insurance_id
                                                            WHEN payer_type = 'tertiary_insurance' THEN tertiary_patient_insurance_id
                                                        END
    LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
    LEFT JOIN public.provider_groups ppg ON ppg.id = bc.ordering_facility_id
    LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
    LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
    WHERE
        bc.id = <%= claimId %>
),

charge_details AS(
    SELECT
         bc.invoice_no AS invoice_no,
         MAX(to_char(bc.submitted_dt, 'MM/DD/YYYY')) AS invoice_date,
         SUM(claim_totals.charges_bill_fee_total) AS bill_fee,
         SUM(claim_totals.payments_applied_total) AS payment,
         SUM(claim_totals.adjustments_applied_total) AS adjustment,
         SUM(claim_totals.claim_balance_total) AS balance,
         ARRAY_AGG(bc.id) AS claim_id,
         bc.facility_id
    FROM billing.claims bc
        INNER JOIN get_payer_details gpd ON gpd.ordering_facility_id = bc.ordering_facility_id
        INNER JOIN LATERAL (SELECT * FROM billing.get_claim_totals(bc.id)) claim_totals ON true
    WHERE
        bc.invoice_no IS NOT NULL
    GROUP BY
        invoice_no,
        facility_id
    ORDER BY
        invoice_no DESC
),

invoice_payment_details AS(
    SELECT
        COALESCE(MAX(date_part('day', (now() - bc.submitted_dt))),0) AS age,
        claim_totals.claim_balance_total AS balance
    FROM
        billing.claims bc
    INNER JOIN get_payer_details gpd ON gpd.ordering_facility_id = bc.ordering_facility_id
    INNER JOIN LATERAL (SELECT * FROM billing.get_claim_totals(bc.id)) claim_totals ON true
    WHERE
        bc.invoice_no IS NOT NULL
    GROUP BY
        submitted_dt,
        claim_totals.claim_balance_total
),

age_calculation AS (
    SELECT
       COALESCE(SUM(balance) FILTER(WHERE ipd.age <= 0 ) , 0::MONEY) AS current_balance,
       COALESCE(SUM(balance) FILTER(WHERE ipd.age > 0 AND ipd.age <= 30 ) , 0::MONEY) AS age_30,
       COALESCE(SUM(balance) FILTER(WHERE ipd.age > 30 AND ipd.age <= 60) , 0::MONEY) AS age_60,
       COALESCE(SUM(balance) FILTER(WHERE ipd.age > 60 AND ipd.age <= 90 ) , 0::MONEY) AS age_90,
       COALESCE(SUM(balance) FILTER(WHERE ipd.age > 90 AND ipd.age <= 120 ) , 0::MONEY) AS age_120,
       SUM(balance) AS total_balance
    FROM
        invoice_payment_details ipd
)

SELECT
    (SELECT
        json_agg(row_to_json(claim_details)) AS claim_details
            FROM (
                    SELECT
                        *
                    FROM
                        claim_details
                 ) AS claim_details
    ),
    (SELECT
        json_agg(row_to_json(charge_details)) AS charge_details
            FROM (
                    SELECT
                        *
                    FROM
                        charge_details
                 ) AS charge_details
    ),
    (SELECT
            json_agg(row_to_json(age_calculation)) AS age_calculation
                FROM (
                        SELECT
                            *
                        FROM
                            age_calculation
                     ) AS age_calculation
    )
`);

const api = {
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createInvoiceActivityStatementDataSet(initialReportData.report.params),
            (invoiceActivityDataSet) => {
                initialReportData.filters = api.createReportFilters(initialReportData);
                initialReportData.dataSets.push(invoiceActivityDataSet);
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                return initialReportData;
            });
    },

    transformReportData: (rawReportData) => {
        return Promise.resolve(rawReportData);
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
        const query = invoiceActivityStatementTemplate(queryContext.templateData);
        return db.queryForReportData(query, queryContext.queryParams);
    },

    getinvoiceActivityDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            browserDateFormat: null,
            claimId: null
        };

        filters.browserDateFormat = commonIndex.getLocaleFormat(reportParams.browserLocale);

        filters.claimId = reportParams.claimId;

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
