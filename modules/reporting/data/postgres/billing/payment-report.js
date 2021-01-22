const _ = require('lodash');
const Promise = require('bluebird');
const db = require('../db');
const dataHelper = require('../dataHelper');
const queryBuilder = require('../queryBuilder');
const moment = require('moment');

const summaryQueryTemplate = _.template(`
    WITH paymentSummaryQuery AS (
        SELECT
             bp.payer_type,
             bp.id AS payment_id,
             CASE
                WHEN bp.mode = 'eft' THEN
                     UPPER(bp.mode)
                WHEN bp.mode = 'check' AND '<%= country_alpha_3_code %>' = 'can'
                THEN
                     'Cheque'
                ELSE
                    InitCap(bp.mode)
             END  AS payment_mode,
             SUM(CASE
                     WHEN bpa.amount_type ='payment' THEN
                          bpa.amount
                     ELSE
                          0.00::MONEY
                 END
                ) AS payment_applied,
             SUM(CASE
                     WHEN bpa.amount_type ='adjustment' THEN
                         bpa.amount
                     ELSE
                         0.00::MONEY
                     END
                ) AS adjustment,
             MAX(bp.amount) AS total_payment
        FROM
            billing.payments bp
        LEFT JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
        LEFT JOIN facilities f ON f.id = bp.facility_id
        <% if (billingProID || facilityLists) { %>
           INNER JOIN billing.charges bch ON bch.id = bpa.charge_id
           INNER JOIN billing.claims bc ON bc.id = bch.claim_id
           INNER JOIN billing.providers bpr ON bpr.id = bc.billing_provider_id
        <% } %>
        <% if (userIds) { %>  INNER JOIN public.users ON users.id = bp.created_by <% } %>
           <% if (userRoleIds) { %>
             <% if (userIds) { %>
               INNER JOIN  public.user_groups ON users.user_group_id = public.user_groups.id AND public.user_groups.is_active
               INNER JOIN public.user_roles ON  public.user_roles.id = ANY(public.user_groups.user_roles) AND public.user_roles.is_active
             <% } else { %>
               INNER JOIN public.users  ON users.id = bp.created_by
               INNER JOIN  public.user_groups ON users.user_group_id = public.user_groups.id AND public.user_groups.is_active
               INNER JOIN public.user_roles ON  public.user_roles.id = ANY(public.user_groups.user_roles) AND public.user_roles.is_active
             <% } %>
           <%  } %>
        <% if (paymentStatus) { %>  INNER JOIN LATERAL billing.get_payment_totals(bp.id) AS payment_totals ON TRUE   <% } %>
        <% if (adjustmentCodeIds || allAdjustmentCode == 'true') { %>
        INNER JOIN LATERAL (
            SELECT
                DISTINCT i_bpa.payment_id AS payment_id,
                i_bpa.charge_id AS charge_id,
                CASE when adjustment_code_id is null then false else true END AS has_adjustment
            FROM
                billing.payment_applications i_bpa
            WHERE
                i_bpa.payment_id = bp.id
                AND i_bpa.adjustment_code_id is not null
                <% if (adjustmentCodeIds) { %> AND  <% print(adjustmentCodeIds); } %>
        ) have_adjustment ON have_adjustment.payment_id = bp.id and have_adjustment.charge_id = bpa.charge_id
        <% } %>
        <% if(insGroups || insuranceIds) { %>
           LEFT JOIN insurance_providers ip ON ip.id = bp.insurance_provider_id
           LEFT JOIN provider_groups ON bp.provider_group_id = provider_groups.id
           LEFT JOIN insurance_provider_payer_types ippt ON ippt.id = ip.provider_payer_type_id
        <% } %>
        WHERE
           <%= claimDate %>
           <% if (facilityIds) { %>AND <% print(facilityIds); } %>
           <% if (facilityLists) { %>AND <% print(facilityLists); } %>
           <% if(billingProID) { %> AND <% print(billingProID); } %>
           <% if (userIds) { %>AND <% print(userIds); } %>
           <% if (userRoleIds) { %>AND <% print(userRoleIds); } %>
           <% if (paymentStatus) { %>AND  <% print(paymentStatus); } %>
           <% if(insuranceIds) { %> AND <%=insuranceIds%> <%}%>
           <% if(insGroups) { %> AND <%=insGroups%> <%}%>
        GROUP BY
             bp.payer_type, bp.id
    )
        SELECT
             <% if (summaryType == "Payment Mode")  { %>
                CASE
                   WHEN payment_mode IS NULL THEN 'Total'
                ELSE
                   payment_mode
                END AS "Payment Mode",
            <% } else { %>
                CASE
                   WHEN payer_type IS NULL THEN 'Payer Type Total'
                ELSE
                    CASE
                        WHEN payer_type = 'patient' THEN  'Patient'
                        WHEN payer_type = 'insurance' THEN 'Insurance'
                        WHEN payer_type = 'ordering_facility' THEN 'Ordering Facility'
                        WHEN payer_type = 'ordering_provider' THEN 'Provider'
                    END
                END  AS "Payer Type",
            <% } %>
            SUM(payment_applied) AS "Total Payment Applied",
            SUM(total_payment - payment_applied) AS "Total Payment UnApplied",
            SUM(total_payment) AS "Total Payment Amount",
            SUM(adjustment) AS "Total Adjustment"
        FROM
            paymentSummaryQuery
        <% if (summaryType == "Payment Mode")  { %>
            GROUP BY
                ROLLUP (payment_mode)
            ORDER BY payment_mode
        <% } else { %>
            GROUP BY
                ROLLUP (payer_type)
            ORDER BY payer_type
        <% } %>
  `);
// Data set #2, detailed query
const detailQueryTemplate = _.template(`
    WITH payment_data AS (
        SELECT
            bp.id payment_id,
            bc.id  claim_id,
            SUM(CASE WHEN amount_type= 'payment' then bpa.amount  else 0::money end) AS applied_amount,
            SUM(CASE WHEN amount_type= 'adjustment' then bpa.amount  else 0::money end) AS adjustment,
            ARRAY_REMOVE(ARRAY_AGG(bac.description),null) AS description
            <% if (userIds) { %> , MAX(users.username) AS user_name  <% } %>
        FROM
            billing.payments bp
        LEFT JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
        LEFT JOIN billing.charges bch ON bch.id = bpa.charge_id
        LEFT JOIN billing.claims  bc ON bc.id = bch.claim_id
        <% if (billingProID) { %>  INNER JOIN billing.providers bpr ON bpr.id = bc.billing_provider_id <% } %>
        <% if (userIds) { %>  INNER JOIN public.users  users ON users.id = bp.created_by    <% } %>
        <% if (userRoleIds) { %>
            <% if (userIds) { %>
                INNER JOIN  public.user_groups ON users.user_group_id = public.user_groups.id AND public.user_groups.is_active
                INNER JOIN public.user_roles ON  public.user_roles.id = ANY(public.user_groups.user_roles) AND public.user_roles.is_active
            <% } else { %>
                INNER JOIN public.users users ON users.id = bp.created_by
                INNER JOIN  public.user_groups ON users.user_group_id = public.user_groups.id AND public.user_groups.is_active
                INNER JOIN public.user_roles ON  public.user_roles.id = ANY(public.user_groups.user_roles) AND public.user_roles.is_active
            <% } %>
        <% } %>
        <% if (adjustmentCodeIds || allAdjustmentCode == 'true') { %>
            INNER JOIN LATERAL (
                SELECT
                    DISTINCT i_bpa.payment_id AS payment_id,
                    i_bpa.charge_id AS charge_id,
                    CASE
                        WHEN adjustment_code_id IS NULL THEN FALSE
                    ELSE
                        TRUE
                    END AS has_adjustment
                FROM
                    billing.payment_applications i_bpa
                WHERE
                    i_bpa.payment_id = bp.id
                    AND i_bpa.adjustment_code_id is not null
                    <% if (adjustmentCodeIds) { %> AND  <% print(adjustmentCodeIds); } %>
            ) have_adjustment ON have_adjustment.payment_id = bp.id and have_adjustment.charge_id = bpa.charge_id
        <% } %>
        LEFT JOIN billing.adjustment_codes bac ON bac.id = bpa.adjustment_code_id
        WHERE
            <%= claimDate %>
            <% if (facilityIds) { %>AND <% print(facilityIds); } %>
            <% if (facilityLists) { %>AND <% print(facilityLists); } %>
            <% if(billingProID) { %> AND <% print(billingProID); } %>
            <% if (userIds) { %>AND <% print(userIds); } %>
            <% if (userRoleIds) { %>AND <% print(userRoleIds); } %>
        GROUP BY
            bp.id, bc.id
    )
    SELECT
        to_char(p.accounting_date, '<%= dateFormat %>')   AS "Accounting Date",
        f.facility_name  AS "Paid Location",
        fac.facility_name  AS "Claim Facility",
        pd.payment_id AS "Payment ID",
        pd.claim_id AS "Claim  ID",
        get_full_name(pp.last_name, pp.first_name, pp.middle_name, pp.prefix_name, pp.suffix_name) AS "Patient Name",
        pp.account_no "Account #",
        to_char(c.claim_dt, '<%= dateFormat %>') "Claim Date",
        CASE
            WHEN p.payer_type = 'patient' THEN  'Patient'
            WHEN p.payer_type = 'insurance' THEN 'Insurance'
            WHEN p.payer_type = 'ordering_facility' THEN 'Ordering Facility'
            WHEN p.payer_type = 'ordering_provider' THEN 'Provider'
        END AS "Payer Type",
        pippt.description AS "Payer Group",
        CASE
            WHEN p.payer_type = 'patient' THEN
                get_full_name(p_pp.last_name,
                            p_pp.first_name,
                            p_pp.middle_name,
                            p_pp.prefix_name,
                            p_pp.suffix_name)
            WHEN p.payer_type = 'insurance' THEN ip.insurance_name
            WHEN p.payer_type = 'ordering_facility' THEN pg.group_name
            WHEN p.payer_type = 'ordering_provider' then pr.last_name ||','|| pr.first_name
        END AS "Payer Name",
        CASE
           WHEN p.mode = 'eft' THEN
                UPPER(p.mode)
           WHEN p.mode = 'check' AND '<%= country_alpha_3_code %>' = 'can' THEN
                'Cheque'
           ELSE
               InitCap(p.mode)
        END AS "Payment Mode",
        <% if (country_alpha_3_code == 'can') { %>
            p.card_number AS "Cheque #",
        <% } else { %>
            p.card_number AS "Check #",
        <% } %>
        payment_totals.payments_applied_total AS "Applied Total",
        p.amount "Payment Amount",
        (p.amount - payment_totals.payments_applied_total) AS "Balance",
        pd.applied_amount AS "Applied Amount",
        pd.adjustment AS "Adjustment Amount",
        pd.description AS "Adjustment Code"
        <% if (userIds) { %>, user_name AS "User Name" <% } %>
    FROM
        payment_data pd
    INNER JOIN billing.payments p ON p.id = pd.payment_id
    INNER JOIN LATERAL billing.get_payment_totals(p.id) AS payment_totals ON TRUE
    LEFT JOIN facilities f ON f.id = p.facility_id
    LEFT JOIN billing.claims c ON c.id = pd.claim_id
    LEFT JOIN facilities fac ON fac.id = c.facility_id
    LEFT JOIN billing.claim_status cs ON cs.id = c.claim_status_id
    LEFT JOIN public.insurance_providers ip ON ip.id = p.insurance_provider_id
    LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = ip.provider_payer_type_id
    LEFT JOIN public.Provider_contacts pc ON pc.id = provider_contact_id
    LEFT JOIN public.Providers pr ON pr.id = pc.provider_id
    LEFT JOIN public.patients pp ON pp.id = c.patient_id
    LEFT JOIN public.patients p_pp ON p_pp.id = p.patient_id
    LEFT JOIN public.provider_groups pg ON pg.id = p.provider_group_id
    <% if(insGroups) { %>
       LEFT JOIN provider_groups ON p.provider_group_id  = provider_groups.id
       LEFT JOIN  insurance_provider_payer_types ippt ON ippt.id = ip.provider_payer_type_id
    <% } %>
    WHERE TRUE
        <% if (paymentStatus) { %> AND <%= paymentStatus %> <% } %>
        <% if(insuranceIds) { %> AND <%=insuranceIds%> <%}%>
        <% if(insGroups) { %> AND <%=insGroups%> <%}%>
 `);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        if (initialReportData.report.params.userIds && initialReportData.report.params.userIds.length > 0) {
            initialReportData.report.params.userIds = initialReportData.report.params.userIds.map(Number);
        }

        if (initialReportData.report.params.userRoleIds && initialReportData.report.params.userRoleIds.length > 0) {
            initialReportData.report.params.userRoleIds = initialReportData.report.params.userRoleIds.map(Number);
        }

        // convert adjustmentCodeIds array of string to integer
        if (initialReportData.report.params.adjustmentCodeIds && initialReportData.report.params.adjustmentCodeIds.length) {
            initialReportData.report.params.adjustmentCodeIds = initialReportData.report.params.adjustmentCodeIds.map(Number);
        }

        //convert array of insuranceProviderIds array of string to integer
        if (initialReportData.report.params.insuranceIds) {
            initialReportData.report.params.insuranceIds = initialReportData.report.params.insuranceIds.map(Number);
        }

        if (initialReportData.report.params.insuranceGroupIds) {
            initialReportData.report.params.insuranceGroupIds = initialReportData.report.params.insuranceGroupIds.map(Number);
        }

        return Promise.join(
            api.createSummaryDataSet(initialReportData.report.params),
            api.createDetailDataSet(initialReportData.report.params),
            // other data sets could be added here...
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            dataHelper.getInsuranceProvidersInfo(initialReportData.report.params.companyId, initialReportData.report.params.insuranceIds),
            dataHelper.getInsuranceGroupInfo(initialReportData.report.params.companyId, initialReportData.report.params.insuranceGroupIds),
            (summaryDataSet, detailDataSet, providerInfo, insuranceProvidersInfo, providerGroupInfo) => {
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.lookups.insuranceProviders = insuranceProvidersInfo || [];
                initialReportData.lookups.providerGroup = providerGroupInfo || [];
                initialReportData.dataSets.push(detailDataSet);
                initialReportData.dataSets[0].summaryDataSets = [summaryDataSet];
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                initialReportData.filters = api.createReportFilters(initialReportData);
                return initialReportData;
            });
    },

    transformReportData: (rawReportData) => {
        let rawReportDataSet = rawReportData.dataSets[0];
        let summaryDataSet = rawReportData.dataSets[0].summaryDataSets[0];
        if (rawReportDataSet && rawReportDataSet.rowCount === 0) {
            return Promise.resolve(rawReportData);
        }
        return new Promise((resolve, reject) => {
            let paymentColumns = rawReportDataSet.columns;
            let paymentSummaryColumns = summaryDataSet.columns;
            const rowIndexes = {
                totalPaymentApplied: _.findIndex(paymentSummaryColumns, ['name', 'Total Payment Applied']),
                totalPaymentUnApplied: _.findIndex(paymentSummaryColumns, ['name', 'Total Payment UnApplied']),
                totalPaymentAmount: _.findIndex(paymentSummaryColumns, ['name', 'Total Payment Amount']),
                totalAdjustment: _.findIndex(paymentSummaryColumns, ['name', 'Total Adjustment']),
                appliedTotal: _.findIndex(paymentColumns, ['name', 'Applied Total']),
                paymentAmount: _.findIndex(paymentColumns, ['name', 'Payment Amount']),
                balance: _.findIndex(paymentColumns, ['name', 'Balance']),
                appliedAmount: _.findIndex(paymentColumns, ['name', 'Applied Amount']),
                adjustmentAmount: _.findIndex(paymentColumns, ['name', 'Adjustment Amount'])
            }
            paymentSummaryColumns[rowIndexes.totalPaymentApplied].cssClass = 'text-right';
            paymentSummaryColumns[rowIndexes.totalPaymentUnApplied].cssClass = 'text-right';
            paymentSummaryColumns[rowIndexes.totalPaymentAmount].cssClass = 'text-right';
            paymentSummaryColumns[rowIndexes.totalAdjustment].cssClass = 'text-right';
            paymentColumns[rowIndexes.appliedTotal].cssClass = 'text-right';
            paymentColumns[rowIndexes.paymentAmount].cssClass = 'text-right';
            paymentColumns[rowIndexes.balance].cssClass = 'text-right';
            paymentColumns[rowIndexes.appliedAmount].cssClass = 'text-right';
            paymentColumns[rowIndexes.adjustmentAmount].cssClass = 'text-right';
            return resolve(rawReportData);
        });
    },

    getJsReportOptions: (reportParams, reportDefinition) => {
        return reportDefinition.jsreport[reportParams.reportFormat];
    },
    // ================================================================================================================
    // ================================================================================================================
    // PRIVATE ;) functions
    createReportFilters: (initialReportData) => {
        const lookups = initialReportData.lookups;
        const params = initialReportData.report.params;
        const filtersUsed = [];
        if (params.allFacilities && params.facilityIds)
            filtersUsed.push({ name: 'facilities', label: 'Paid Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.map(Number).indexOf(parseInt(f.id, 10)) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Paid Facilities', value: facilityNames });
        }
        if (params.selectAllFacilities && params.facilityLists)
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityLists && params.facilityLists.map(Number).indexOf(parseInt(f.id, 10)) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        }
        // Billing provider Filter
        if (params.allBillingProvider == 'true')
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        else {
            const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        }

        // User Filter
        if (params.userIds && params.userIds.length > 0) {
            filtersUsed.push({ name: 'users', label: 'Users', value: params.userName });
        }
        else {
            filtersUsed.push({ name: 'users', label: 'Users', value: 'All' });
        }

        // user tol filter
        if (params.userRoleIds && params.userRoleIds.length > 0) {
            filtersUsed.push({ name: 'User Roles', label: 'User Roles', value: params.userRoleName });
        }
        else {
            filtersUsed.push({ name: 'User Roles', label: 'User Roles', value: 'All' });
        }

        // Payment Status
        if (params.paymentStatus) {
            filtersUsed.push({ name: 'Payment Status', label: 'Payment Status', value: params.paymentStatus });
        }
        else {
            filtersUsed.push({ name: 'Payment Status', label: 'Payment Status', value: 'All' });
        }

        // Adjustment Code
        if (params.adjustmentCodeIds && params.adjustmentCodeIds.length) {
            filtersUsed.push({ name: 'Adjustment Code', label: 'Adjustment Code', value: params.adjustmentCode });
        }
        else {
            filtersUsed.push({ name: 'Adjustment Code', label: 'Adjustment Code', value: 'All' });
        }

        filtersUsed.push({ name: 'fromDate', label: 'Date From', value: moment(params.fromDate).format(params.dateFormat) });
        filtersUsed.push({ name: 'toDate', label: 'Date To', value: moment(params.toDate).format(params.dateFormat) });

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
    // ================================================================================================================
    // --- DATA SET #1
    createSummaryDataSet: (reportParams) => {
        const queryContext = api.getSummaryQueryContext(reportParams);
        const query = summaryQueryTemplate(queryContext.templateData);
        return db.queryForReportData(query, queryContext.queryParams, false);
    },
    getSummaryQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            claimDate: null,
            facilityIds: null,
            billingProID: null,
            userIds: null,
            userRoleIds: null,
            paymentStatus: null,
            adjustmentCodeIds: null,
            allAdjustmentCode: null,
            insuranceIds: null,
            insGroups: null,
            country_alpha_3_code: null,
            facilityLists: null
        };


        //Paid facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bp.facility_id', [params.length]);
        }

        //claim facilities
        if (!reportParams.selectAllFacilities && reportParams.facilityLists) {
            params.push(reportParams.facilityLists);
            filters.facilityLists = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        //  scheduled_dt
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.claimDate = queryBuilder.whereDate(' bp.accounting_date', '=', [params.length]);
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateBetween(' bp.accounting_date', [params.length - 1, params.length]);
        }

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bc.billing_provider_id', [params.length]);
        }

        // User id
        if (reportParams.userIds && reportParams.userIds.length > 0) {
            if (reportParams.userIds) {
                params.push(reportParams.userIds);
                filters.userIds = queryBuilder.whereIn('bp.created_by', [params.length]);
            }
        }

        // User Role id
        if (reportParams.userRoleIds && reportParams.userRoleIds.length > 0) {
            if (reportParams.userRoleIds) {
                params.push(reportParams.userRoleIds);
                filters.userRoleIds = queryBuilder.whereIn('user_roles.id', [params.length]);
            }
        }
        filters.summaryType = reportParams.summaryType;

        // Payment Status
        if (reportParams.paymentStatus) {
            params.push(reportParams.paymentStatus)
            filters.paymentStatus = queryBuilder.whereIn('payment_totals.payment_status', [params.length]);
        }

        // Adjustment Code ID
        if (reportParams.adjustmentCodeIds) {
            params.push(reportParams.adjustmentCodeIds);
            filters.adjustmentCodeIds = queryBuilder.whereIn('i_bpa.adjustment_code_id', [params.length]);
        }

        // Select All Adjustment Code
        filters.allAdjustmentCode = reportParams.allAdjustmentCode;

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
        filters.country_alpha_3_code = reportParams.country_alpha_3_code;

        return {
            queryParams: params,
            templateData: filters
        }
    },
    // ================================================================================================================
    // --- DATA SET #2
    createDetailDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based ON report params and query/queries to be executed...
        const queryContext = api.getDetailQueryContext(reportParams);
        // 2 - geenrate query to execute
        const query = detailQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    getDetailQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            claimDate: null,
            facilityIds: null,
            billingProID: null,
            userIds: null,
            userRoleIds: null,
            summaryType: null,
            paymentStatus: null,
            adjustmentCodeIds: null,
            allAdjustmentCode: null,
            insuranceIds: null,
            insGroups: null,
            country_alpha_3_code: null,
            facilityLists: null
        };


        //Payment facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bp.facility_id', [params.length]);
        }

        //Claim facilities
        if (!reportParams.selectAllFacilities && reportParams.facilityLists) {
            params.push(reportParams.facilityLists);
            filters.facilityLists = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        //  scheduled_dt
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.claimDate = queryBuilder.whereDate('bp.accounting_date', '=', [params.length]);
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateBetween('bp.accounting_date', [params.length - 1, params.length]);
        }

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bc.billing_provider_id', [params.length]);
        }

        // User id
        if (reportParams.userIds && reportParams.userIds.length > 0) {
            if (reportParams.userIds) {
                params.push(reportParams.userIds);
                filters.userIds = queryBuilder.whereIn('bp.created_by', [params.length]);
            }
        }

        // User Role id
        if (reportParams.userRoleIds && reportParams.userRoleIds.length > 0) {
            if (reportParams.userRoleIds) {
                params.push(reportParams.userRoleIds);
                filters.userRoleIds = queryBuilder.whereIn('user_roles.id', [params.length]);
            }
        }

        // Payment Status
        if (reportParams.paymentStatus) {
            params.push(reportParams.paymentStatus)
            filters.paymentStatus = queryBuilder.whereIn('payment_totals.payment_status', [params.length]);
        }

        // Adjustment Code ID
        if (reportParams.adjustmentCodeIds) {
            params.push(reportParams.adjustmentCodeIds);
            filters.adjustmentCodeIds = queryBuilder.whereIn('i_bpa.adjustment_code_id', [params.length]);
        }

        // Select All Adjustment Code
        filters.allAdjustmentCode = reportParams.allAdjustmentCode;

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

        filters.country_alpha_3_code = reportParams.country_alpha_3_code;

        filters.dateFormat = reportParams.dateFormat;
        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
