const _ = require('lodash');
const db = require('../db');
const queryBuilder = require('../queryBuilder');
const dataHelper = require('../dataHelper');
const commonIndex = require('../../../../../server/shared/index');

// generate query template ***only once*** !!!

const invoiceActivityStatementTemplate = _.template(`
WITH get_payer_details AS(
    SELECT
    <%= selectDetails %>
    FROM
        billing.claims bc
    <%= joinCondition %>
    WHERE
        bc.invoice_no IS NOT NULL
        AND bc.id = <%= claimId %>
),

claim_details AS(
    SELECT
        ppr.full_name AS referring_physician_name,
        CASE
            WHEN payer_type = 'primary_insurance' THEN
                json_build_object(
                    'name',pip.insurance_name,
                    'address',pip.insurance_info->'Address1',
                    'address2',pip.insurance_info->'Address2',
                    'city',pip.insurance_info->'City',
                    'state',pip.insurance_info->'State',
                    'zip_code',pip.insurance_info->'ZipCode',
                    'phone_no',pip.insurance_info->'PhoneNo')
            WHEN payer_type = 'secondary_insurance' THEN
                json_build_object(
                    'name',pip.insurance_name,
                    'address',pip.insurance_info->'Address1',
                    'address2',pip.insurance_info->'Address2',
                    'city',pip.insurance_info->'City',
                    'state',pip.insurance_info->'State',
                    'zip_code',pip.insurance_info->'ZipCode',
                    'phone_no',pip.insurance_info->'PhoneNo')
            WHEN payer_type = 'tertiary_insurance' THEN
                json_build_object(
                    'name',pip.insurance_name,
                    'address',pip.insurance_info->'Address1',
                    'address2',pip.insurance_info->'Address2',
                    'city',pip.insurance_info->'City',
                    'state',pip.insurance_info->'State',
                    'zip_code',pip.insurance_info->'ZipCode',
                    'phone_no',pip.insurance_info->'PhoneNo')
            WHEN payer_type = 'referring_provider' THEN
                json_build_object(
                    'name',ppr.full_name,
                    'address',ppc.contact_info->'ADDR1',
                    'address2',ppc.contact_info->'ADDR2',
                    'city',ppc.contact_info->'CITY',
                    'state',ppc.contact_info->'c1State',
                    'zip_code',ppc.contact_info->'c1Zip',
                    'phone_no',ppc.contact_info->'PHNO')
            WHEN payer_type = 'patient' THEN
                json_build_object(
                    'name',get_full_name(pp.last_name,pp.first_name),
                    'address',pp.patient_info->'c1AddressLine1',
                    'address2',pp.patient_info->'c1AddressLine2',
                    'city',pp.patient_info->'c1City',
                    'state',pp.patient_info->'STATE',
                    'zip_code',pp.patient_info->'ZIP',
                    'phone_no',pp.patient_info->'c1HomePhone')
            WHEN payer_type = 'ordering_facility' THEN
                json_build_object(
                    'name',pof.name,
                    'address',pof.address_line_1,
                    'address2',pof.address_line_2,
                    'city',pof.city,
                    'state',pof.state,
                    'zip_code',pof.zip_code,
                    'phone_no',ofc.phone_number)
        END AS responsible_party_address,
        json_build_object(
            'name', bp.name,
            'address', bp.address_line1,
            'address2', bp.address_line2,
            'city', bp.city,
            'state', bp.state,
            'zip_code', bp.zip_code,
            'phone_no', bp.phone_number) AS billing_provider_details,
        json_build_object(
            'name', bp.name,
            'address', bp.pay_to_address_line1,
            'address2', bp.pay_to_address_line2,
            'city', bp.pay_to_city,
            'state', bp.pay_to_state,
            'zip_code', bp.pay_to_zip_code,
            'phone_no', bp.pay_to_phone_number) AS pay_to_provider_address
    FROM
        billing.claims bc
    INNER JOIN public.facilities f ON f.id = bc.facility_id
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
    ${commonIndex.getClaimPatientInsuranceId('bc')}
    LEFT JOIN public.patient_insurances ppi ON ppi.id = pat_claim_ins.patient_insurance
    LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
    LEFT JOIN public.ordering_facility_contacts ofc ON ofc.id = bc.ordering_facility_contact_id
    LEFT JOIN public.ordering_facilities pof ON pof.id = ofc.ordering_facility_id
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
         SUM(claim_totals.claim_balance_total) AS balance
    FROM billing.claims bc
        <%= joinQuery %>
        INNER JOIN LATERAL (SELECT * FROM billing.get_claim_totals(bc.id)) claim_totals ON true
    WHERE
        bc.invoice_no IS NOT NULL
        AND bc.billing_method = 'direct_billing'
        <%= whereQuery %>
    GROUP BY
        invoice_no
    ORDER BY
        invoice_no::INT
),

invoice_payment_details AS(
    SELECT
        COALESCE(MAX(date_part('day', (now() - bc.submitted_dt))),0) AS age,
        claim_totals.claim_balance_total AS balance
    FROM
        billing.claims bc
    <%= joinQuery %>
    INNER JOIN LATERAL (SELECT * FROM billing.get_claim_totals(bc.id)) claim_totals ON true
    WHERE
        bc.invoice_no IS NOT NULL
        AND bc.billing_method = 'direct_billing'
        <%= whereQuery %>
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
        const query = invoiceActivityStatementTemplate(queryContext.templateData);
        return db.queryForReportData(query, queryContext.queryParams);
    },

    getinvoiceActivityDataSetQueryContext: (reportParams) => {
        const params = [];
        let {
            claimId = null,
            payerType = null
        } = reportParams;
        const filters = {
            browserDateFormat: null,
            claimId,
            payerType,
            selectDetails: '',
            joinCondition: '',
            joinQuery: '',
            whereQuery: ''

        };

        filters.browserDateFormat = commonIndex.getLocaleFormat(reportParams.browserLocale);
        switch (payerType) {
            case 'ordering_facility':
                filters.selectDetails = ' pof.id AS ordering_facility_id, bc.payer_type ';
                filters.joinCondition = ' INNER JOIN public.ordering_facility_contacts ofc ON ofc.id = bc.ordering_facility_contact_id  INNER JOIN public.ordering_facilities pof ON pof.id = ofc.ordering_facility_id ';
                filters.joinQuery = `INNER JOIN public.ordering_facility_contacts ofc ON ofc.id = bc.ordering_facility_contact_id
                                     INNER JOIN get_payer_details gpd ON gpd.ordering_facility_id = ofc.ordering_facility_id AND gpd.payer_type = bc.payer_type`;
                break;
            case 'primary_insurance':
                filters.selectDetails = ' ppi.insurance_provider_id AS insurance_provider_id, bc.payer_type ';
                filters.joinQuery = `
                    LEFT JOIN billing.claim_patient_insurances bcpi ON bcpi.claim_id = bc.id AND bcpi.coverage_level = 'primary'
                    INNER JOIN LATERAL (
                        SELECT id
                        FROM public.patient_insurances ppi
                        INNER JOIN get_payer_details gpd ON gpd.insurance_provider_id = ppi.insurance_provider_id
                    ) ppi ON TRUE `;
                filters.whereQuery = ` AND bc.payer_type = 'primary_insurance' AND bcpi.patient_insurance_id = ppi.id `;
                filters.joinCondition = `
                    INNER JOIN billing.claim_patient_insurances bcpi ON bcpi.claim_id = bc.id AND bcpi.coverage_level = 'primary'
                    INNER JOIN public.patient_insurances ppi ON ppi.id = bcpi.patient_insurance_id `;
                break;
            case 'secondary_insurance':
                filters.selectDetails = ' ppi.insurance_provider_id AS insurance_provider_id, bc.payer_type ';
                filters.joinQuery = `
                    LEFT JOIN billing.claim_patient_insurances bcsi ON bcsi.claim_id = bc.id AND bcsi.coverage_level = 'secondary'
                    INNER JOIN LATERAL (
                        SELECT id
                        FROM public.patient_insurances ppi
                        INNER JOIN get_payer_details gpd ON gpd.insurance_provider_id = ppi.insurance_provider_id
                    ) ppi ON TRUE `;
                filters.whereQuery = `AND bc.payer_type = 'secondary_insurance' AND bcsi.patient_insurance_id = ppi.id `;
                filters.joinCondition = `
                    INNER JOIN billing.claim_patient_insurances bcsi ON bcsi.claim_id = bc.id AND bcsi.coverage_level = 'secondary'
                    INNER JOIN public.patient_insurances ppi ON ppi.id = bcsi.patient_insurance_id `;
                break;
            case 'tertiary_insurance':
                filters.selectDetails = ' ppi.insurance_provider_id AS insurance_provider_id, bc.payer_type ';
                filters.joinQuery = `
                    LEFT JOIN billing.claim_patient_insurances bcti ON bcti.claim_id = bc.id AND bcti.coverage_level = 'tertiary'
                    INNER JOIN LATERAL (
                        SELECT id
                        FROM public.patient_insurances ppi
                        INNER JOIN get_payer_details gpd ON gpd.insurance_provider_id = ppi.insurance_provider_id
                    ) ppi ON TRUE `;
                filters.whereQuery = ` AND bc.payer_type = 'tertiary_insurance' AND bcti.patient_insurance_id = ppi.id `;
                filters.joinCondition = `
                    INNER JOIN billing.claim_patient_insurances bcti ON bcti.claim_id = bc.id AND bcti.coverage_level = 'tertiary'
                    INNER JOIN public.patient_insurances ppi ON ppi.id = bcti.patient_insurance_id `;
                break;
            case 'referring_provider':
                filters.selectDetails = ' bc.referring_provider_contact_id AS referring_provider_contact_id, bc.payer_type ';
                filters.joinCondition = 'INNER JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id';
                filters.joinQuery = 'INNER JOIN get_payer_details gpd ON gpd.referring_provider_contact_id = bc.referring_provider_contact_id AND gpd.payer_type = bc.payer_type';
                break;
        }

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
