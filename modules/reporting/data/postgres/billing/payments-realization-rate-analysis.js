const _ = require('lodash');
const Promise = require('bluebird');
const db = require('../db');
const dataHelper = require('../dataHelper');
const queryBuilder = require('../queryBuilder');
const moment = require('moment');

const paymentRealizationRateAnalysisQueryTemplate = _.template(`
    SELECT
        bc.id "Claim ID",
        TO_CHAR(payment_details.payment_accounting_date, '<%= dateFormat %>') "Payment Accounting Date",
        bp.name "Billing Provider",
        f.facility_name "Facility Name",
        payment_payer_details.payer_type "Payer Type",
        insurance_providers.insurance_name "Primary Insurance",
        ippt.description "Insurance Group",
        TO_CHAR(MAX(c.charge_dt), '<%= dateFormat %>') AS "Service Date",
        m.modality_code "Modality",
        get_full_name(pp.last_name,pp.first_name) "Patient Name",
        pp.account_no "Account #",
        bgch.charges_bill_fee_total "Charge",
        bgct.payments_applied_total "Payment",
        bgct.adjustments_applied_total "Adjustment",
        bgch.charges_bill_fee_total - (
            bgct.payments_applied_total +
            bgct.adjustments_applied_total +
            bgct.refund_amount
        ) "Balance",
        ROUND((CASE (bgch.charges_bill_fee_total)
            WHEN 0::MONEY THEN 0.0 ELSE
                (( bgct.payments_applied_total/bgch.charges_bill_fee_total) * 100) END )::decimal,2) "Rate Paid (%)"
    FROM
        public.orders AS o
    INNER JOIN public.studies s ON o.id = s.order_id
    INNER JOIN modalities m ON m.id = o.modality_id
    INNER JOIN billing.charges_studies cs ON s.id = cs.study_id
    INNER JOIN billing.charges c ON c.id = cs.charge_id
    INNER JOIN billing.claims bc ON bc.id = c.claim_id
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    INNER JOIN facilities f ON f.id = bc.facility_id
    INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
    INNER JOIN LATERAL(
        SELECT
            COALESCE(SUM(pa.amount) FILTER (WHERE pa.amount_type = 'payment'),0::MONEY)    AS payments_applied_total,
            COALESCE(SUM(pa.amount) FILTER (WHERE pa.amount_type = 'adjustment' AND (adj.accounting_entry_type != 'refund_debit' OR pa.adjustment_code_id IS NULL)),0::money) AS adjustments_applied_total,
            COALESCE(SUM(pa.amount) FILTER (WHERE adj.accounting_entry_type = 'refund_debit'),0::MONEY) AS refund_amount
        FROM billing.charges AS c
        INNER JOIN public.cpt_codes AS pc ON pc.id = c.cpt_id
        INNER JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
        LEFT JOIN billing.adjustment_codes adj ON adj.id = pa.adjustment_code_id
        WHERE c.claim_id = bc.id
    ) bgct ON TRUE
    INNER JOIN LATERAL(
        SELECT
             SUM(c.bill_fee * c.units) charges_bill_fee_total
        FROM
            billing.charges AS c
        INNER JOIN public.cpt_codes AS pc ON pc.id = c.cpt_id
        LEFT OUTER JOIN billing.charges_studies AS cs ON c.id = cs.charge_id
        WHERE
            c.claim_id = bc.id
    ) bgch ON TRUE
    LEFT JOIN LATERAL(
            SELECT
                i_bch.claim_id AS claim_id,
                MAX(accounting_date) AS payment_accounting_date
            FROM billing.payments bp
            INNER JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
            INNER JOIN billing.charges i_bch ON i_bch.id = bpa.charge_id
            WHERE i_bch.claim_id = bc.id
            GROUP BY i_bch.claim_id
    ) AS payment_details ON payment_details.claim_id = bc.id
    LEFT JOIN LATERAL(
               SELECT
                    i_bch.claim_id AS claim_id,
                    (CASE bp.payer_type
                          WHEN 'patient' THEN 'Patient'
                          WHEN 'insurance' THEN 'Insurance'
                          WHEN 'ordering_facility' THEN 'Ordering Facility'
                          WHEN 'ordering_provider' THEN 'Provider'
                          END
                    ) AS payer_type
               FROM
                    billing.payments bp
               INNER JOIN billing.payment_applications bpa  ON bpa.payment_id = bp.id
               INNER JOIN billing.charges i_bch ON i_bch.id = bpa.charge_id
               WHERE i_bch.claim_id = bc.id
               ORDER BY
                   bpa.id DESC
               LIMIT 1
          ) AS payment_payer_details ON payment_payer_details.claim_id = bc.id
          LEFT JOIN provider_contacts  ON provider_contacts.id = bc.referring_provider_contact_id
          LEFT JOIN providers AS ref_provider ON ref_provider.id=provider_contacts.id
          LEFT JOIN provider_contacts AS rendering_pro_contact ON rendering_pro_contact.id = bc.rendering_provider_contact_id
          LEFT JOIN providers AS render_provider ON render_provider.id=rendering_pro_contact.id
          LEFT JOIN billing.claim_patient_insurances bcpi ON bcpi.claim_id = bc.id AND bcpi.coverage_level = 'primary'
          LEFT JOIN public.patient_insurances ppi ON ppi.id = bcpi.patient_insurance_id
          LEFT JOIN insurance_providers ON insurance_providers.id = ppi.insurance_provider_id
          LEFT JOIN public.ordering_facility_contacts ofc ON ofc.id = bc.ordering_facility_contact_id
          LEFT JOIN public.ordering_facilities pof ON pof.id = ofc.ordering_facility_id
          LEFT JOIN insurance_provider_payer_types ippt ON ippt.id = insurance_providers.provider_payer_type_id
    WHERE
        bgch.charges_bill_fee_total - (
            bgct.payments_applied_total +
            bgct.adjustments_applied_total +
            bgct.refund_amount
        )  = 0::MONEY
        AND <%=companyId%>
        <% if(serviceDate) { %> AND <%=serviceDate%> <%}%>
        <% if(accountingDate) { %> AND <%=accountingDate%> <%}%>
        <% if(insuranceIds) { %> AND <%=insuranceIds%> <%}%>
        <% if(insGroups) { %> AND <%=insGroups%> <%}%>
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>
        <% if(billingProID) { %> AND <% print(billingProID); } %>
    GROUP BY
        bc.id,bp.id,f.id,pp.id,m.id,
        bgch.charges_bill_fee_total ,
        bgct.payments_applied_total,
        bgct.adjustments_applied_total,
        bgct.refund_amount,
        payment_details.payment_accounting_date,
        insurance_providers.insurance_name,
        payment_payer_details.payer_type,
        ippt.description
`);

const api = {

    getReportData: (initialReportData) => {
        initialReportData.filters = api.createReportFilters(initialReportData);

        //convert array of insuranceProviderIds array of string to integer
        if (initialReportData.report.params.insuranceIds) {
            initialReportData.report.params.insuranceIds = initialReportData.report.params.insuranceIds.map(Number);
        }

        if (initialReportData.report.params.insuranceGroupIds) {
            initialReportData.report.params.insuranceGroupIds = initialReportData.report.params.insuranceGroupIds.map(Number);
        }

        return Promise.join(
            dataHelper.getInsuranceProvidersInfo(initialReportData.report.params.companyId, initialReportData.report.params.insuranceIds),
            dataHelper.getInsuranceGroupInfo(initialReportData.report.params.companyId, initialReportData.report.params.insuranceGroupIds),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProviders),

            api.createPaymentRealizationRateAnalysisDataSet(initialReportData.report.params),
            (insuranceProvidersInfo, providerGroupInfo, providerInfo, paymentRealizationRateAnalysisDataSet) => {
                // add report filters
                initialReportData.lookups.insuranceProviders = insuranceProvidersInfo || [];
                initialReportData.lookups.providerGroup = providerGroupInfo || [];
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);
                // add report specific data sets
                initialReportData.dataSets.push(paymentRealizationRateAnalysisDataSet);
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
        const params = initialReportData.report.params;
        const filtersUsed = [];
        filtersUsed.push({ name: 'company', label: 'Company', value: lookups.company.name });

        if (params.allFacilities && params.facilityIds)
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.map(Number).indexOf(parseInt(f.id, 10)) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        }

        if (params.allBillingProvider === 'true')
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        else {
            const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        }

        if (params.accountingDateFrom != '' && params.accountingDateTo != '') {
            filtersUsed.push({ name: 'accountingfromDate', label: 'Accounting Date From', value: moment(params.accountingDateFrom).format(params.dateFormat) });
            filtersUsed.push({ name: 'accountingtoDate', label: 'Accounting Date To', value: moment(params.accountingDateTo).format(params.dateFormat) });
        }

        if (params.serviceDateFrom != '' && params.serviceDateTo != '') {
            filtersUsed.push({ name: 'serviceDateFrom', label: 'Service Date From', value: moment(params.serviceDateFrom).format(params.dateFormat) });
            filtersUsed.push({ name: 'serviceDateTo', label: 'Service Date To', value: moment(params.serviceDateTo).format(params.dateFormat) });
        }

        if (params.insuranceIds && params.insuranceIds.length) {
            const insuranceInfo = _(lookups.insuranceProviders).map(f => f.name).value();
            filtersUsed.push({ name: 'insurance', label: 'Insurance', value: insuranceInfo });
        }
        else
            filtersUsed.push({ name: 'insurance', label: 'Insurance', value: 'All' });

        if (params.insuranceGroupIds && params.insuranceGroupIds.length) {
            const insuranceGroupInfo = _(lookups.providerGroup).map(f => f.description).value();
            filtersUsed.push({ name: 'insuranceGroup', label: 'Insurance Group', value: insuranceGroupInfo });
        }
        else
            filtersUsed.push({ name: 'insuranceGroup', label: 'Insurance Group', value: 'All' });

        return filtersUsed;
    },

    createPaymentRealizationRateAnalysisDataSet: (reportParams) => {
        const queryContext = api.getpaymentRealizationRateAnalysisDataSetQueryContext(reportParams);
        const query = paymentRealizationRateAnalysisQueryTemplate(queryContext.templateData);
        return db.queryForReportData(query, queryContext.queryParams);
    },

    getpaymentRealizationRateAnalysisDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            accountingDate: null,
            facilityIds: null,
            billingProID: null,
            studyDate: null,
            insuranceIds: null,
            serviceDate: null,
            insGroups: null
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        //facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        //  Accounting Date
        if (reportParams.accountingDateFrom != '' && reportParams.accountingDateTo != '') {
            if (reportParams.accountingDateFrom === reportParams.toDate) {
                params.push(reportParams.accountingDateFrom);
                filters.accountingDate = queryBuilder.whereDate('payment_details.payment_accounting_date', '=', [params.length]);
            } else {
                params.push(reportParams.accountingDateFrom);
                params.push(reportParams.accountingDateTo);
                filters.accountingDate = queryBuilder.whereDateBetween('payment_details.payment_accounting_date', [params.length - 1, params.length]);
            }
        }

        // Service Date
        if (reportParams.serviceDateFrom != '' && reportParams.serviceDateTo != '') {
            if (reportParams.serviceDateFrom === reportParams.serviceDateTo) {
                params.push(reportParams.serviceDateFrom);
                filters.serviceDate = queryBuilder.whereDateInTz('c.charge_dt', '=', [params.length], 'f.time_zone');
            } else {
                params.push(reportParams.serviceDateFrom);
                params.push(reportParams.serviceDateTo);
                filters.serviceDate = queryBuilder.whereDateInTzBetween('c.charge_dt', [params.length - 1, params.length], 'f.time_zone');
            }
        }

        // billingProvider single or multiple
        if (reportParams.billingProviders && reportParams.billingProviders) {
            params.push(reportParams.billingProviders);
            filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        }

        // Insurance Id Mapping
        if (reportParams.insuranceIds && reportParams.insuranceIds.length) {
            params.push(reportParams.insuranceIds);
            filters.insuranceIds = queryBuilder.whereIn(`insurance_providers.id`, [params.length]);
        }

        // Insurance Group ID Mapping
        if (reportParams.insuranceGroupIds && reportParams.insuranceGroupIds.length) {
            params.push(reportParams.insuranceGroupIds);
            filters.insGroups = queryBuilder.whereIn(`ippt.id`, [params.length]);
        }

        filters.dateFormat = reportParams.dateFormat;
        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
