const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');
;

const summaryQueryTemplate = _.template(`
          WITH paymentsSummaryQuery as (
                SELECT     
                    bp.payer_type as payer_type,
                    bp.id as payment_id,
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
                LEFT JOIN billing.payment_applications bpa on bpa.payment_id = bp.id
                INNER JOIN billing.charges bch on bch.id = bpa.charge_id
                INNER JOIN billing.claims bc on bc.id = bch.claim_id
                INNER JOIN facilities f on f.id = bc.facility_id
                <% if (billingProID) { %>  INNER JOIN billing.providers bpr ON bpr.id = bc.billing_provider_id <% } %>
                <% if (userIds) { %>  INNER join public.users on users.id = bp.created_by    <% } %>
                WHERE 1=1 
                    AND  <%= companyId %>
                    AND <%= claimDate %>
                <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
                <% if(billingProID) { %> AND <% print(billingProID); } %>
                <% if (userIds) { %>AND <% print(userIds); } %>
                GROUP BY
                     bp.payer_type, bp.id
          )
          SELECT 
                CASE  
                    WHEN payer_type IS NULL THEN 'Payer Type Total' 
                    ELSE 
                        payer_type 
                    END             AS "Payer Type", 
                    SUM(payment_applied)    AS "Total Payment applied",
                    SUM(adjustment) AS "Total Adjustment",
                    SUM(total_payment) AS "Total Payment Amount"
            FROM 
                paymentsSummaryQuery
            GROUP BY
                    ROLLUP (payer_type) ORDER BY payer_type 
        `);
// Data set #2, detailed query
const detailQueryTemplate = _.template(`
         WITH payment_data as 
         (
            SELECT 
                bp.id payment_id,
                bc.id  claim_id,
                SUM(CASE WHEN amount_type= 'payment' then bpa.amount  else 0::money end) as applied_amount,
                SUM(CASE WHEN amount_type= 'adjustment' then bpa.amount  else 0::money end) as adjustment
                <% if (userIds) { %> , MAX(users.username) AS user_name    <% } %>
            FROM 
                billing.payments bp 
            LEFT JOIN billing.payment_applications bpa on bpa.payment_id = bp.id
            LEFT JOIN billing.charges bch on bch.id = bpa.charge_id
            LEFT Join billing.claims  bc on bc.id = bch.claim_id
            INNER JOIN facilities f on f.id = bc.facility_id
            <% if (billingProID) { %>  INNER JOIN billing.providers bpr ON bpr.id = bc.billing_provider_id <% } %>
            <% if (userIds) { %>  INNER join public.users  users on users.id = bp.created_by    <% } %>
            WHERE 1=1 
            AND  <%= companyId %>
            AND <%= claimDate %>
            <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
            <% if(billingProID) { %> AND <% print(billingProID); } %>
            <% if (userIds) { %>AND <% print(userIds); } %>
            GROUP BY bp.id,bc.id )
                SELECT
                    to_char(p.accounting_dt, 'MM/DD/YYYY')   AS "Accounting Date",
                    f.facility_name  AS "Facility Name",
                    pd.payment_id AS "Payment Id",
         	        pd.claim_id AS "Claim  Id",
         	        get_full_name(pp.last_name, pp.first_name, pp.middle_name, pp.prefix_name, pp.suffix_name) AS "Patient Name",
         	        pp.account_no "Account #" ,
         	        to_char(c.claim_dt, 'MM/DD/YYYY') "Claim Date",
         	        p.payer_type "Payer Type",
                     CASE
                      WHEN
                         p.payer_type = 'patient' THEN 
                         get_full_name(pp.last_name, 
                                    pp.first_name,
                                    pp.middle_name,
                                    pp.prefix_name,
                                    pp.suffix_name
                                ) 
                       WHEN
                        p.payer_type = 'insurance' THEN ip.insurance_name
                       WHEN
                         p.payer_type = 'ordering_facility' THEN f.facility_name
                        WHEN
                         p.payer_type = 'ordering_provider' then pr.last_name ||','|| pr.first_name
         	            END  AS "Payer Name",
         	        p.mode "Payment AS Mode",
         	        p.card_number AS "Check #",
         	        payment_totals.payments_applied_total AS "Applied Amount",
         	        p.amount "Payment Amount",
                    (p.amount - payment_totals.payments_applied_total) AS "Balance",                  
                    pd.applied_amount AS "Applied Amount",
                    pd.adjustment AS "Adjustment Amount"
                    <% if (userIds) { %>, user_name AS "User Name"   <% } %>
                FROM 
                    payment_data pd
                INNER join billing.payments p on p.id = pd.payment_id
                INNER JOIN LATERAL billing.get_payment_totals(p.id) AS payment_totals ON TRUE
                LEFT join facilities f on f.id = p.facility_id
                LEFT join billing.claims c on c.id = pd.claim_id
                LEFT join billing.claim_status cs on cs.id = c.claim_status_id 
                LEFT join public.insurance_providers ip on ip.id = p.insurance_provider_id
                LEFT join public.Provider_contacts pc on pc.id = provider_contact_id
                LEFT join public.Providers pr on pr.id = pc.provider_id
                LEFT join public.patients pp on pp.id = c.patient_id
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

        return Promise.join(
            api.createSummaryDataSet(initialReportData.report.params),
            api.createDetailDataSet(initialReportData.report.params),
            // other data sets could be added here...
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            (summaryDataSet, detailDataSet, providerInfo) => {

                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.dataSets.push(detailDataSet);
                initialReportData.dataSets[0].summaryDataSets = [summaryDataSet];
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                initialReportData.filters = api.createReportFilters(initialReportData);
                return initialReportData;
            });
    },

    transformReportData: (rawReportData) => {
        //   if (rawReportData.dataSets[0].rowCount === 0) {
        return Promise.resolve(rawReportData);
        // }
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
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.map(Number).indexOf(parseInt(f.id, 10)) > -1).map(f => f.name).value();
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


        filtersUsed.push({ name: 'fromDate', label: 'Date From', value: params.fromDate });
        filtersUsed.push({ name: 'toDate', label: 'Date To', value: params.toDate });
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
            companyId: null,
            claimDate: null,
            facilityIds: null,
            billingProID: null,
            userIds: null
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        //  scheduled_dt
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.claimDate = queryBuilder.whereDate(' bp.accounting_dt', '=', [params.length], 'f.time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateBetween(' bp.accounting_dt', [params.length - 1, params.length], 'f.time_zone');
        }

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        }

        // User id
        if (reportParams.userIds && reportParams.userIds.length > 0) {
            if (reportParams.userIds) {
                params.push(reportParams.userIds);
                filters.userIds = queryBuilder.whereIn('bp.created_by', [params.length]);
            }
        }


        return {
            queryParams: params,
            templateData: filters
        }
    },
    // ================================================================================================================
    // --- DATA SET #2
    createDetailDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getDetailQueryContext(reportParams);
        // 2 - geenrate query to execute
        const query = detailQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    getDetailQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            claimDate: null,
            facilityIds: null,
            billingProID: null,
            userIds: null
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bp.facility_id', [params.length]);
        }

        //  scheduled_dt
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.claimDate = queryBuilder.whereDate('bp.accounting_dt', '=', [params.length], 'f.time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateBetween('bp.accounting_dt', [params.length - 1, params.length], 'f.time_zone');
        }

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        }

        // User id
        if (reportParams.userIds && reportParams.userIds.length > 0) {
            if (reportParams.userIds) {
                params.push(reportParams.userIds);
                filters.userIds = queryBuilder.whereIn('bp.created_by', [params.length]);
            }
        }
        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
