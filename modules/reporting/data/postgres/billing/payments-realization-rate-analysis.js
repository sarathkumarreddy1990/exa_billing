const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder');

const paymentRealizationRateAnalysisQueryTemplate = _.template(`
    WITH
        paymaneRealizationRateAnalysis AS (
      SELECT
          bc.id AS claim_id,
          payment_details.payment_accounting_date,
          insurance_providers.insurance_name AS payer_name,
          payment_payer_details.payer_type,
          bp.name AS provider_name,
          ippt.description AS insurance_payer_name ,
          f.facility_name AS Facility_name,
          MAX(c.charge_dt) AS scheduled_dt,
          get_full_name(pp.last_name,pp.first_name) AS patient_name,
          pp.account_no AS account_no,
          m.modality_code AS modality_code,
          bgct.charges_bill_fee_total AS bill_fee,
          bgct.payments_applied_total AS applied,
          bgct.adjustments_applied_total As adjustment,
          bgct.claim_balance_total As balance,
          round((CASE (bgct.charges_bill_fee_total)
               WHEN 0::money THEN 0.0 ELSE
                      (( bgct.payments_applied_total/bgct.charges_bill_fee_total) * 100) END )::decimal,2)AS rate_paid
      FROM
          public.orders AS o
          INNER JOIN public.studies s ON o.id = s.order_id
          INNER JOIN modalities m ON m.id = o.modality_id
          INNER JOIN billing.charges_studies cs ON s.id = cs.study_id
          INNER JOIN billing.charges c ON c.id = cs.charge_id
          INNER JOIN billing.claims bc ON bc.id = c.claim_id
          INNER JOIN billing.get_claim_totals(bc.id) bgct on true
          INNER JOIN public.patients pp ON pp.id = bc.patient_id
          INNER JOIN facilities f ON f.id = bc.facility_id
          INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
          LEFT JOIN LATERAL(
               SELECT
                      i_bch.claim_id AS claim_id,
		max(accounting_date) AS payment_accounting_date
               FROM billing.payments bp
               INNER JOIN billing.payment_applications bpa  ON bpa.payment_id = bp.id
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
          LEFT JOIN patient_insurances ON patient_insurances.id = bc.primary_patient_insurance_id
          LEFT JOIN insurance_providers ON insurance_providers.id = patient_insurances.insurance_provider_id
          LEFT JOIN provider_groups ON bc.ordering_facility_id = provider_groups.id
          LEFT JOIN insurance_provider_payer_types ippt ON ippt.id = insurance_providers.provider_payer_type_id
      WHERE
          bgct.claim_balance_total = 0::MONEY
          AND <%=companyId%>
          <% if(serviceDate) { %> AND <%=serviceDate%> <%}%>
          <% if(accountingDate) { %> AND <%=accountingDate%> <%}%>
          <% if(insuranceIds) { %> AND <%=insuranceIds%> <%}%>
          <% if(insGroups) { %> AND <%=insGroups%> <%}%>
          <% if (facilityIds) { %>AND <% print(facilityIds); } %>
          <% if(billingProID) { %> AND <% print(billingProID); } %>
       GROUP BY
          bc.id,bp.id,f.id,pp.id,m.id,
          bgct.charges_bill_fee_total ,
          bgct.payments_applied_total,
          bgct.adjustments_applied_total,
          bgct.claim_balance_total,
          payment_details.payment_accounting_date,
          payer_name,
          payment_payer_details.payer_type,
          insurance_payer_name)
      SELECT
          claim_id AS "Claim ID"
        , to_char(payment_accounting_date, 'MM/DD/YYYY') AS "Payment Accounting Date"
        , provider_name   AS "Billing Provider"
        , facility_name AS "Facility Name"
        , payer_type AS "Payer Type"
        , payer_name AS "Primary Insurance"
        , insurance_payer_name AS "Insurance Group"
        , to_char(scheduled_dt, 'MM/DD/YYYY') AS "Service Date"
        , modality_code AS "Modality"
        , patient_name AS "Patient Name"
        , account_no AS "Account #"
        , bill_fee AS "Charge"
        , applied AS "Payment"
        , adjustment AS "Adjustment"
        , balance AS "Balance"
        , rate_paid AS "Rate Paid (%)"
    FROM
          paymaneRealizationRateAnalysis
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
            filtersUsed.push({ name: 'accountingfromDate', label: 'Accounting Date From', value: params.accountingDateFrom });
            filtersUsed.push({ name: 'accountingtoDate', label: 'Accounting Date To', value: params.accountingDateTo });
        }

        if (params.serviceDateFrom != '' && params.serviceDateTo != '') {
            filtersUsed.push({ name: 'serviceDateFrom', label: 'Service Date From', value: params.serviceDateFrom });
            filtersUsed.push({ name: 'serviceDateTo', label: 'Service Date To', value: params.serviceDateTo });
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

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
