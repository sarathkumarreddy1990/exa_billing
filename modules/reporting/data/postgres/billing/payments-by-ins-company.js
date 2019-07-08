const _ = require('lodash');
const Promise = require('bluebird');
const db = require('../db');
const dataHelper = require('../dataHelper');
const queryBuilder = require('../queryBuilder');

// generate query template ***only once*** !!!
const paymentByInsuranceCompanyDataSetQueryTemplate = _.template(`
    WITH paymentsByInsCompany AS (
        SELECT
            bp.id AS payment_id,
            ip.insurance_code,
            ip.insurance_name,
            f.facility_name,
            f.id AS facility_id,
            ippt.description AS provider_type,
            SUM((SELECT payment_balance_total FROM billing.get_payment_totals(bp.id))) AS payment_balance,
            SUM((SELECT payments_applied_total FROM billing.get_payment_totals(bp.id))) AS payment_applied_amount,
            SUM(bp.amount) AS amount,
            bp.card_number AS cheque_card_number,
            CASE
                WHEN bp.mode = 'check' AND '<%= countryCode %>' = 'can' THEN 'Cheque'
                ELSE InitCap(bp.mode)
            END AS payment_mode,
            timezone(f.time_zone,bp.payment_dt) AS payment_date
        FROM
            billing.payments bp
            INNER JOIN public.insurance_providers ip ON ip.id = bp.insurance_provider_id
            LEFT JOIN public.facilities f ON f.id = bp.facility_id
            LEFT JOIN insurance_provider_payer_types ippt ON ippt.id = ip.provider_payer_type_id
            <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
        WHERE TRUE
            AND bp.payer_type = 'insurance'
            AND <%= companyId %>
            AND <%= paymentDate %>
            <% if (facilityIds) { %>AND <% print(facilityIds); } %>
            <% if(billingProID) { %> AND <% print(billingProID); } %>
            <% if(insuranceIds) { %> AND <%=insuranceIds%> <% } %>
            <% if (insGroups) { %>AND <% print(insGroups); } %>
        GROUP BY
            GROUPING SETS(
                (ip.insurance_name),
                ( payment_id,
                  insurance_code,
                  ip.insurance_name,
                  ippt.description,
                  facility_name,
                  f.id,
                  bp.card_number,
                  bp.mode,payment_date
                ),())
        ORDER BY
            ip.insurance_name,
            bp.id
    )
    SELECT
        payment_id AS "Payment ID",
        insurance_name AS "Insurance Name",
        provider_type AS "Provider Type",
        amount AS "Amount",
        payment_applied_amount AS "Applied",
        payment_balance AS "Balance",
        cheque_card_number AS  "<%= countryConfigCard %>",
        payment_mode AS "Payment Mode",
        to_char(payment_date, 'MM/DD/YYYY') AS "Payment Date"
    FROM
        paymentsByInsCompany
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        let countryCode = initialReportData.report.params.countryCode;
        initialReportData.report.params.countryConfigCard = initialReportData.report.vars.columnHeader.card_cheque[countryCode];
        return Promise.join(
            api.createpaymentByInsuranceCompanyDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            dataHelper.getInsuranceProvidersInfo(initialReportData.report.params.companyId, initialReportData.report.params.insuranceIds),
            dataHelper.getInsuranceGroupInfo(initialReportData.report.params.companyId, initialReportData.report.params.insuranceGroupIds),
            // other data sets could be added here...
            (paymentByInsuranceCompanyDataSet, providerInfo, insuranceProvidersInfo, providerGroupInfo) => {
                // add report filters
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.lookups.insuranceProviders = insuranceProvidersInfo || [];
                initialReportData.lookups.providerGroup = providerGroupInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(paymentByInsuranceCompanyDataSet);
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                return initialReportData;
            });
    },

    /**
     * STAGE 3
     * This method is called by controller pipeline after getReportData().
     * All data sets will be avaliable and can be used for any complex, interdependent data set manipulations.
     * Note:
     *  If no transformations are to take place just return resolved promise => return Promise.resolve(rawReportData);
     */
    transformReportData: (rawReportData) => {
        let rawReportDataSet = rawReportData.dataSets[0];
        if (rawReportDataSet && rawReportDataSet.rowCount === 0) {
            return Promise.resolve(rawReportData);
        }
        return new Promise((resolve, reject) => {
            let paymentColumns = rawReportDataSet.columns;
            const rowIndexes = {
                totalPaymentApplied: _.findIndex(paymentColumns, ['name', 'Amount']),
                totalPaymentUnApplied: _.findIndex(paymentColumns, ['name', 'Applied']),
                totalPaymentAmount: _.findIndex(paymentColumns, ['name', 'Balance'])
            }
            paymentColumns[rowIndexes.totalPaymentApplied].cssClass = 'text-right';
            paymentColumns[rowIndexes.totalPaymentUnApplied].cssClass = 'text-right';
            paymentColumns[rowIndexes.totalPaymentAmount].cssClass = 'text-right';
            return resolve(rawReportData);
        });
    },

    /**
     * Report specific jsreport options, which will be merged with default ones in the controller.
     * Allows each report to add its own, or override default settings.
     * Note:
     *  You must at least set a template (based on format)!
     */
    getJsReportOptions: (reportParams, reportDefinition) => {
        // here you could dynamically modify jsreport options *per report*....
        // if options defined in report definition are all that is needed, then just select them based on report format
        return reportDefinition.jsreport[reportParams.reportFormat];
    },

    // ================================================================================================================
    // PRIVATE ;) functions

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
        if (params.insuranceIds && params.insuranceIds.length) {
            const insuranceInfo = _(lookups.insuranceProviders).map(f => f.name).value();
            filtersUsed.push({ name: 'insurance', label: 'Insurance', value: insuranceInfo });
        }
        else {
            filtersUsed.push({ name: 'insurance', label: 'Insurance', value: 'All' });
        }

        if (params.insuranceGroupIds && params.insuranceGroupIds.length) {
            const insuranceGroupInfo = _(lookups.providerGroup).map(f => f.description).value();
            filtersUsed.push({ name: 'insuranceGroup', label: 'Insurance Group', value: insuranceGroupInfo });
        }
        else {
            filtersUsed.push({ name: 'insuranceGroup', label: 'Insurance Group', value: 'All' });
        }
        filtersUsed.push({ name: 'fromDate', label: 'Date From', value: params.fromDate });
        filtersUsed.push({ name: 'toDate', label: 'Date To', value: params.toDate });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - paymentByInsuranceCompany count

    createpaymentByInsuranceCompanyDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getpaymentByInsuranceCompanyDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = paymentByInsuranceCompanyDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getpaymentByInsuranceCompanyDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            paymentDate: null,
            facilityIds: null,
            billingProID: null,
            countryCode: null,
            insuranceIds: null,
            insGroups: null
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bp.company_id', '=', [params.length]);

        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bp.facility_id', [params.length]);
        }

        filters.countryCode = reportParams.countryCode;

        //  Accounting Date
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.paymentDate = queryBuilder.whereDate('bp.accounting_date', '=', [params.length]);
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.paymentDate = queryBuilder.whereDateBetween('bp.accounting_date', [params.length - 1, params.length]);
        }

          // Insurance Id Mapping
          if (reportParams.insuranceIds && reportParams.insuranceIds.length) {
            params.push(reportParams.insuranceIds);
            filters.insuranceIds = queryBuilder.whereIn(`ip.id`, [params.length]);
        }

        // Insurance Group ID Mapping
        if (reportParams.insuranceGroupIds && reportParams.insuranceGroupIds.length) {
            params.push(reportParams.insuranceGroupIds);
            filters.insGroups = queryBuilder.whereIn(`ippt.id`, [params.length]);
        }


        filters.countryConfigCard = reportParams.countryConfigCard;

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
