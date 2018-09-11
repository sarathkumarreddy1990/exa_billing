const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const claimActivityDataSetQueryTemplate = _.template(`
with claim_details as (
SELECT
    bc.id as claim_id,
    get_full_name(p.last_name,p.first_name,p.middle_name,p.prefix_name,p.suffix_name) as patient_name,
    p.account_no as account_no,
    bc.claim_dt::date as claim_date,
	get_full_name(ppref.last_name,ppref.first_name,ppref.middle_initial,null,ppref.suffix) as referring_physician,
	get_full_name(ppren.last_name,ppren.first_name,ppren.middle_initial,null,ppren.suffix) as reading_physician,
    pg.group_name as ordering_facility,
    f.time_zone as facility_timezone,
    f.facility_code as facility_code
FROM
   billing.claims bc
   INNER JOIN public.patients p on p.id = bc.patient_id
   INNER JOIN public.facilities f on f.id = bc.facility_id
   LEFT JOIN public.provider_contacts pcref on pcref.id = bc.referring_provider_contact_id
   LEFT JOIN public.providers ppref on ppref.id =pcref.provider_id
   LEFT JOIN public.provider_contacts pcren on pcren.id = bc.rendering_provider_contact_id
   LEFT JOIN public.providers ppren on ppren.id = pcren.provider_id
   LEFT JOIN public.provider_groups pg on pg.id = bc.ordering_facility_id
   <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
   WHERE 1=1
   AND  <%= companyId %>
   AND <%= claimDate %>
   <% if (facilityIds) { %>AND <% print(facilityIds); } %>
   <% if(billingProID) { %> AND <% print(billingProID); } %>
      ),

charge_details as (
SELECT
    ps.accession_no as accession_no,
    cd.claim_id as claim_id,
    cd.patient_name as patient_name,
    cd.account_no as account_no,
    (cd.claim_date)::date as claim_date,
    cd.referring_physician as referring_physician,
    cd.reading_physician as reading_physician,
    cd.ordering_facility as ordering_facility,
    cd.facility_code as facility_code,
    ('charge')::text as type,
    null::bigint as payment_id,
    null::date as payment_date,
    null::date as accounting_date,
    pcpt.display_code as code,
    pcpt.display_description as description,
    array[pm1.code,pm2.code,pm3.code,pm4.code] as modifiers,
    (bch.bill_fee*bch.units) as amount,
    bch.charge_dt::date as created_on,
	get_full_name(u.last_name,u.first_name,u.middle_initial,null,u.suffix) as created_by
from
    claim_details cd
    INNER JOIN billing.charges bch on bch.claim_id = cd.claim_id
    INNER JOIN public.cpt_codes pcpt on pcpt.id = bch.cpt_id
    INNER JOIN public.users u on u.id = bch.created_by
    LEFT JOIN billing.charges_studies bchs on bchs.charge_id = bch.id
    LEFT JOIN public.studies ps on ps.id = bchs.study_id
    LEFT JOIN public.modifiers pm1 on pm1.id = bch.modifier1_id
    LEFT JOIN public.modifiers pm2 on pm2.id = bch.modifier2_id
    LEFT JOIN public.modifiers pm3 on pm3.id = bch.modifier3_id
    LEFT JOIN public.modifiers pm4 on pm4.id = bch.modifier4_id
    GROUP BY cd.claim_id,cd.patient_name,cd.claim_date,claim_date,cd.account_no,ps.accession_no,
    referring_physician,reading_physician,ordering_facility,facility_code,payment_id,
    payment_date,accounting_date,pcpt.display_code,pcpt.display_description,amount,
    created_on,created_by,pm1.code,pm2.code,pm3.code,
    pm4.code,get_full_name(u.last_name,u.first_name,u.middle_initial,null,u.suffix)
),

payment_details as(
SELECT
    cd.claim_id as claim_id,
    cd.patient_name as patient_name,
    cd.account_no as account_no,
    (cd.claim_date)::date as claim_date,
    cd.referring_physician as referring_physician,
    cd.reading_physician as reading_physician,
    cd.ordering_facility as ordering_facility,
    cd.facility_code as facility_code,
    pa.amount_type as type,
    bp.id as payment_id,
    bp.payment_dt::date as payment_date,
    bp.accounting_dt::date as accounting_date,
    null::text as code,
    CASE WHEN bp.payer_type = 'patient' THEN
           pp.full_name
     WHEN bp.payer_type = 'insurance' THEN
           pip.insurance_name
     WHEN bp.payer_type = 'ordering_facility' THEN
           pg.group_name
     WHEN bp.payer_type = 'ordering_provider' THEN
           p.full_name
    END as description, --Payment description is payer
    array['']::text[] as modifiers,
    sum(pa.amount) as amount,
    bp.payment_dt::date as created_on,
    get_full_name(u.last_name,u.first_name,u.middle_initial,null,u.suffix) as created_by,
    null as accession_no
FROM claim_details cd
     INNER JOIN billing.charges bch on bch.claim_id = cd.claim_id
     INNER JOIN billing.payment_applications pa on pa.charge_id= bch.id
     INNER JOIN billing.payments bp on bp.id = pa.payment_id
     INNER JOIN public.users u on u.id = bp.created_by
     LEFT JOIN public.patients pp on pp.id = bp.patient_id
     LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
     LEFT JOIN public.provider_groups  pg on pg.id = bp.provider_group_id
     LEFT JOIN public.provider_contacts  pc on pc.id = bp.provider_contact_id
     LEFT JOIN public.providers p on p.id = pc.provider_id
     GROUP by bp.id,cd.claim_id,cd.patient_name,cd.account_no,cd.claim_date, cd.referring_physician,
     cd.reading_physician,cd.ordering_facility,cd.facility_code,bp.payment_dt,bp.accounting_dt,description,pa.amount_type,
     modifiers,created_on,get_full_name(u.last_name,u.first_name,u.middle_initial,null,u.suffix)
)
SELECT
    accession_no as "Accession No",
    claim_id as "Claim#",
    patient_name as "Patient Name",
    account_no as "Account#",
    to_char(claim_date,'MM/DD/YYYY') AS "Claim Date",
    referring_physician as "Referring Physician",
    reading_physician as "Reading Physician",
    ordering_facility as "Ordering Facility",
    facility_code as "Facility Code" ,
    TYPE as "Type",
    payment_id as "Payment ID",
    to_char(payment_date,'MM/DD/YYYY') AS "Payment Date",
    to_char(accounting_date,'MM/DD/YYYY') AS "Accounting Date",
    code as "CPT Code",
    description as "Description",
    modifiers as "Modifiers",
    amount as "Amount",
    to_char(created_on,'MM/DD/YYYY') AS "Created On",
    created_by as "Created By"
FROM
    charge_details
UNION ALL
SELECT
    accession_no,
    claim_id,
    patient_name,
    account_no,
    to_char(claim_date,'MM/DD/YYYY') AS claim_date,
    referring_physician,
    reading_physician,
    ordering_facility,
    facility_code,
    TYPE,
    payment_id,
    to_char(payment_date,'MM/DD/YYYY') AS payment_date,
    to_char(accounting_date,'MM/DD/YYYY') AS accounting_date,
    code,
    description,
    modifiers,
    amount,
    to_char(created_on,'MM/DD/YYYY') AS created_on,
    created_by
FROM
    payment_details
ORDER BY
"Claim#",
"Accession No",
"Payment ID",
"Type"
DESC
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createclaimActivityDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            // other data sets could be added here...
            (claimActivityDataSet, providerInfo) => {
                // add report filters
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(claimActivityDataSet);
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
        return Promise.resolve(rawReportData);
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

        // Facility Filter
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

        filtersUsed.push({ name: 'fromDate', label: 'Date From', value: params.fromDate });
        filtersUsed.push({ name: 'toDate', label: 'Date To', value: params.toDate });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - claimActivity count

    createclaimActivityDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getclaimActivityDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = claimActivityDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getclaimActivityDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            claimDate: null,
            facilityIds: null,
            billingProID: null

        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        // //  Claim Date
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.claimDate = queryBuilder.whereDate('bc.claim_dt', '=', [params.length], 'f.time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateBetween('bc.claim_dt', [params.length - 1, params.length], 'f.time_zone');
        }

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        }

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
