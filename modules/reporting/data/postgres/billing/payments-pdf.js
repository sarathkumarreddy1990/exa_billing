const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , config = require('../../../../../server/config')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const paymentsPDFDataSetQueryTemplate = _.template(`
WITH payments_pdf as (
    SELECT
         bp.id AS payment_id,
         get_full_name(pu.last_name,pu.first_name) AS user_full_name,
         CASE WHEN payer_type = 'patient' THEN
            get_full_name(pp.last_name,pp.first_name)
         END AS patient_full_name,
         get_full_name(ppr.last_name,ppr.first_name) AS provider_full_name,
         pip.insurance_name,
         pip.insurance_code,
         bp.alternate_payment_id,
         bp.facility_id,
         bp.payment_dt,
         to_char(bp.accounting_date, 'MM/DD/YYYY') AS accounting_date,
         bp.payer_type,
         bp.invoice_no,
         bp.amount,
         bp.notes,
         bp.card_number AS cheque_card_number,
         pp.account_no,
         (SELECT payments_applied_total FROM billing.get_payment_totals(bp.id)) AS applied,
         (SELECT adjustments_applied_total FROM billing.get_payment_totals(bp.id)) AS adjustments,
         (SELECT payment_balance_total FROM billing.get_payment_totals(bp.id)) AS balance,
         (SELECT payment_status FROM billing.get_payment_totals(bp.id)) AS status,
         CASE WHEN payer_type = 'patient' THEN  pp.full_name
              WHEN payer_type = 'insurance' THEN pip.insurance_name
              WHEN payer_type = 'ordering_facility' THEN ppg.group_name
              WHEN payer_type = 'ordering_provider' THEN ppr.full_name
         END payer_name,
         pf.facility_name,
         to_char(to_facility_date(bp.facility_id, bp.payment_dt),'MM/DD/YYYY') AS payment_date,
         CASE WHEN '<%= countryFlag %>'  = 'can' AND bp.mode = 'check'
              THEN 'Cheque'ELSE InitCap(bp.mode) 
         END AS payment_mode
    FROM
         billing.payments bp
    INNER JOIN public.users pu ON pu.id = bp.created_by
    LEFT JOIN public.patients pp ON pp.id = bp.patient_id
    LEFT JOIN public.insurance_providers pip ON pip.id = bp.insurance_provider_id
    LEFT JOIN public.provider_groups ppg ON ppg.id = bp.provider_group_id
    LEFT JOIN public.provider_contacts ppc ON ppc.id = bp.provider_contact_id
    LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
    LEFT JOIN public.facilities pf ON pf.id = bp.facility_id
    JOIN LATERAL (
        SELECT
            payment_status
        FROM
            billing.get_payment_totals(bp.id) AS status
        <% if (paymentStatus) { %> WHERE <% print(paymentStatus); } %>
         ) payment_status ON TRUE
    WHERE <%= companyId %>
    <% if(payerType) { %>
        AND payer_type = '<%= payerType %>'
    <% } %>
    <% if(paymentId) { %>
        AND <%= paymentId %>
    <% } %>
    <% if(displayId) { %>
        AND bp.alternate_payment_id ILIKE '%<%= displayId %>%'
    <% } %>
    <% if(payerName) { %>
        <% if(payerType) { %>
        AND  (
            CASE '<%= payerType %>'
                WHEN 'insurance' THEN pip.insurance_name
                WHEN 'ordering_facility' THEN ppg.group_name
                WHEN 'ordering_provider' THEN ppr.full_name
                WHEN 'patient' THEN  pp.full_name
            END)  ILIKE '%<%= payerName %>%'
      <% } else { %>
        AND ( pip.insurance_name  ILIKE '%<%= payerName %>%'
        OR ppg.group_name  ILIKE '%<%= payerName %>%'
        OR ppr.full_name  ILIKE '%<%= payerName %>%'
        OR pp.full_name ILIKE '%<%= payerName %>%' )
      <% } %>
    <% } %>
    <% if(amount) { %>
        AND (SELECT payment_balance_total FROM billing.get_payment_totals(bp.id))::numeric = <%= amount %>
    <%}%>
    <% if(adjustmentAmount) { %>
        AND  (SELECT adjustments_applied_total FROM billing.get_payment_totals(bp.id))::numeric = <%= adjustmentAmount %>
    <%}%>
    <% if(applied) { %>
        AND (SELECT payments_applied_total from billing.get_payment_totals(bp.id))::numeric = <%=applied %>
    <%}%>
    <% if(payment_amount) { %>
        AND amount::numeric = <%=payment_amount %>
    <%}%>

    <% if(userName) { %>
        AND  get_full_name(pu.last_name, pu.first_name)  ILIKE '%<%= userName %>%'
    <%}%>
    <% if(facilityId) { %>
        AND  pf.id = <%= facilityId %>
    <%}%>
    <% if(paymentMode) { %>
        AND  mode ILIKE '%<%= paymentMode %>%'
    <%}%>
    <% if(paymentDate) { %>
        AND  <%= paymentDate %>
    <%}%>
    <% if(accounting_date) { %>
        AND  <%= accounting_date %>
    <%}%>
    <% if(accountNo) { %>
        AND account_no  ILIKE  '%<%=accountNo %>%'
    <%}%>
    <% if(notes) { %>
        AND bp.notes  ILIKE  '%<%=notes %>%'
    <%}%>
    ORDER BY
      payment_id DESC
    LIMIT
     <%=  pageSize %>
    )
  SELECT
    facility_name           AS "Facility Name",
    payment_id              AS "Payment ID",
    patient_full_name       AS "Patient Name",
    account_no              AS "MRN #",
    notes                   AS "Note",
    cheque_card_number      AS "CHK/CC#",
    payment_date            AS "Payment Date",
    accounting_date         AS "Accounting Date",
    payment_mode            AS "Payment Mode",
    user_full_name          AS "Posted By",
    COALESCE(INITCAP(status), '~~ TOTAL ~~') AS "Payment Status" ,
    SUM(amount)             AS "Payment"
  FROM payments_pdf
  GROUP BY
     grouping sets(
        ( facility_name),
            (
              facility_name,
              payment_id,
              patient_full_name,
              account_no,
              notes,              
              cheque_card_number,
              payment_date,
              accounting_date,
              payment_mode,
              user_full_name,
              status)
           )

           UNION ALL

        SELECT
            NULL AS "Facility Name",
            NULL AS "Payment ID",
            NULL AS "Patient Name",
            NULL AS "MRN #",
            NULL AS "Note",
            NULL AS "CHK/CC#",
            NULL AS "Payment Date",
            NULL AS "Accounting Date",
            NULL AS "Payment Mode",
            NULL AS "Posted By",
            'GRAND TOTAL'::TEXT AS "Payment Status" ,
            SUM(amount) AS "Payment"
        FROM payments_pdf
        HAVING count(*) > 0 -- "Total" should not print if no records are fetched. Hence having clause used.
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createpaymentsPDFDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (paymentsPDFDataSet) => {
                // add report filters
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(paymentsPDFDataSet);
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
        return new Promise((resolve, reject) => {
            const rowIndexes = {
                paymentAmount: _.findIndex(rawReportData.dataSets[0].columns, ['name', 'Payment'])
            }

            rawReportData.dataSets[0].columns[rowIndexes.paymentAmount].cssClass = 'text-right';
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

    },

    // ================================================================================================================
    // --- DATA SET - paymentsPDF count

    createpaymentsPDFDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getpaymentsPDFDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = paymentsPDFDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getpaymentsPDFDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            paymentDate: null,
            paymentStatus: null,
            pageSize: null,
            from: null,
            payerType: null,
            paymentId: null,
            displayId: null,
            payerName: null,
            amount: null,
            adjustmentAmount: null,
            userName: null,
            paymentMode: null,
            applied: null,
            facilityId: null,
            accounting_date: null,
            payment_amount:null,
            accountNo : null,
            notes : null,
            countryFlag: null
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bp.company_id', '=', [params.length]);
        filters.countryFlag = reportParams.countryCode;

        if (reportParams.paymentStatus) {
            params.push(reportParams.paymentStatus);
            filters.paymentStatus = queryBuilder.whereIn('payment_status', [params.length]);
        }

        if (reportParams.filterFlag === 'paymentsExportPDFFlag' || reportParams.from === 'ris' ) {
            if (config.get('paymentsExportRecordsCount')) {
                filters.pageSize = config.get('paymentsExportRecordsCount');
            } else {
                filters.pageSize = 1000;
            }
        }

        filters.from = reportParams.from;

        _.each(reportParams.filterColumn, function (value, i) {

            if (value == "payment_dt") {
                let paymentDateRange = reportParams.filterData[i].split(' - ');
                let paymentFromDate = paymentDateRange[0] || "";
                let paymentToDate = paymentDateRange[1] || "";
                if (paymentFromDate && paymentToDate == "") {
                    params.push(paymentFromDate);
                    filters.paymentDate = queryBuilder.whereDateInTz('bp.payment_dt', '=', [params.length], 'pf.time_zone');
                }
                else if (paymentFromDate === paymentToDate) {
                    params.push(paymentFromDate);
                    filters.paymentDate = queryBuilder.whereDateInTz('bp.payment_dt', '=', [params.length], 'pf.time_zone');
                } else {
                    params.push(paymentFromDate);
                    params.push(paymentToDate);
                    filters.paymentDate = queryBuilder.whereDateInTzBetween('bp.payment_dt', [params.length - 1, params.length], 'pf.time_zone');
                }
            }

            if (value == "accounting_date") {
                let accounting_date_range = reportParams.filterData[i].split(' - ');
                let accounting_from_date = accounting_date_range[0] || "";
                let accounting_to_date = accounting_date_range[1] ||  "";
                if (accounting_from_date && accounting_to_date == "") {
                    params.push(accounting_from_date);
                    filters.accounting_date = queryBuilder.whereDate('bp.accounting_date', '=', [params.length]);
                }
                else if (accounting_from_date === accounting_to_date) {
                    params.push(accounting_from_date);
                    filters.accounting_date = queryBuilder.whereDate('bp.accounting_date', '=', [params.length]);
                } else {
                    params.push(accounting_from_date);
                    params.push(accounting_to_date);
                    filters.accounting_date = queryBuilder.whereDateBetween('bp.accounting_date', [params.length - 1, params.length]);
                }
            }

            if (value == "payer_type") {
                    filters.payerType = reportParams.filterData[i].replace(/\\/g, "");
            }

            if (value == "payment_id") {
                params.push(reportParams.filterData[i]);
                filters.paymentId = queryBuilder.where('bp.id', '=', [params.length]);
            }

            if (value == "display_id") {
                filters.displayId = reportParams.filterData[i];
            }

            if (value == "payer_name") {
                filters.payerName = reportParams.filterData[i];
            }

            if (value == "facility_name") {
                filters.facilityId = reportParams.filterData[i];
            }

            if (value == "payment_mode") {
                filters.paymentMode = reportParams.filterData[i];
            }

            if (value == "available_balance") {
                filters.amount = reportParams.filterData[i];
            }

            if (value == "amount") {
                filters.payment_amount = reportParams.filterData[i];
            }

            if (value == "adjustment_amount") {
                filters.adjustmentAmount = reportParams.filterData[i];
            }

            if (value == "applied") {
                filters.applied = reportParams.filterData[i];
            }

            if (value == "user_full_name") {
                filters.userName = reportParams.filterData[i];
            }

            if (value == "account_no") {
                filters.accountNo = reportParams.filterData[i];
            }

            if (value == "notes") {
                filters.notes = reportParams.filterData[i];
            }
        });

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
