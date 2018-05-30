const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')    
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const paymentsDataSetQueryTemplate = _.template(`
with payment_data as 
(
select 
bp.id payment_id,
bc.id  claim_id,
sum(CASE WHEN amount_type= 'payment' then bpa.amount  else 0::money end) as applied_amount,
sum(CASE WHEN amount_type= 'adjustment' then bpa.amount  else 0::money end) as adjustment
FROM billing.payments bp 
LEFT JOIN billing.payment_applications bpa on bpa.payment_id = bp.id
LEFT JOIN billing.charges bch on bch.id = bpa.charge_id
left Join billing.claims  bc on bc.id = bch.claim_id
WHERE 1=1 
AND  <%= companyId %>
group by bp.id,bc.id )
select
        p.accounting_dt::date,
        f.facility_name,
        pd.payment_id,
	pd.claim_id,
	get_full_name(pp.last_name, pp.first_name, pp.middle_name, pp.prefix_name, pp.suffix_name) AS patient_name,
	pp.account_no,
	c.claim_dt::date,
	p.payer_type,
	Case when p.payer_type = 'patient' then get_full_name(pp.last_name, pp.first_name, pp.middle_name, pp.prefix_name, pp.suffix_name) 
	     when p.payer_type = 'insurance' then ip.insurance_name
	     when p.payer_type = 'ordering_facility' then f.facility_name
	     when p.payer_type = 'ordering_provider' then pr.last_name||','||pr.first_name
	end as payer_name,
	p.mode,
	p.card_number,
	payment_totals.payments_applied_total,
	p.amount,
   (p.amount - payment_totals.payments_applied_total) as balance,
    cs.code,
    pd.applied_amount,
	pd.adjustment

from payment_data pd
inner join billing.payments p on p.id = pd.payment_id
INNER JOIN LATERAL billing.get_payment_totals(p.id) AS payment_totals ON TRUE
inner join facilities f on f.id = p.facility_id
inner join billing.claims c on c.id = pd.claim_id
inner join billing.claim_status cs on cs.id = c.claim_status_id 
left join public.insurance_providers ip on ip.id = p.insurance_provider_id
left join public.Provider_contacts pc on pc.id = provider_contact_id
left join public.Providers pr on pr.id = pc.provider_id
left join public.patients pp on pp.id = c.patient_id

`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        console.log('iiiiiiiiiii', initialReportData)
        return Promise.join(            
            api.createpaymentsDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (paymentsDataSet) => {
                // add report filters                
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(paymentsDataSet);
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
        console.log('wwwww', initialReportData)
        const lookups = initialReportData.lookups;
        const params = initialReportData.report.params;
        const filtersUsed = [];
        filtersUsed.push({ name: 'company', label: 'Company', value: lookups.company.name });

        // if (params.allFacilities && (params.facilityIds && params.facilityIds.length < 0))
        //     filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        // else {
        //     const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.indexOf(f.id) > -1).map(f => f.name).value();
        //     filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        // }
        // // Billing provider Filter
        // if (params.allBillingProvider == 'true')
        //     filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        // else {
        //     const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
        //     filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        // }

        // filtersUsed.push({ name: 'fromDate', label: 'Date From', value: params.fromDate });
        // filtersUsed.push({ name: 'toDate', label: 'Date To', value: params.toDate });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - payments count

    createpaymentsDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getpaymentsDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = paymentsDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getpaymentsDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null
           
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        // // order facilities
        // if (!reportParams.allFacilities && reportParams.facilityIds) {
        //     params.push(reportParams.facilityIds);
        //     filters.facilityIds = queryBuilder.whereIn('c.facility_id', [params.length]);
        // }

        // //  scheduled_dt
        // if (reportParams.fromDate === reportParams.toDate) {
        //     params.push(reportParams.fromDate);
        //     filters.studyDate = queryBuilder.whereDate('c.claim_dt', '=', [params.length], 'f.time_zone');
        // } else {
        //     params.push(reportParams.fromDate);
        //     params.push(reportParams.toDate);
        //     filters.studyDate = queryBuilder.whereDateBetween('c.claim_dt', [params.length - 1, params.length], 'f.time_zone');
        // }
        // // billingProvider single or multiple
        // if (reportParams.billingProvider) {
        //     params.push(reportParams.billingProvider);
        //     filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        // }

        return {
            queryParams: params,
            templateData: filters         
        }
        console.log('12312312',queryParams )
    }
}

module.exports = api;
