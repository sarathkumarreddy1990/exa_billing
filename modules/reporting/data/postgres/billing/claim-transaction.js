const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const claimTransactionDataSetQueryTemplate = _.template(`
WITH details AS(
    SELECT 
        bc.id AS "Claim#",
        pp.last_name AS "Last Name",
        pp.first_name AS "First Name",
        pip.insurance_name AS "Insurance Name",
        pip.insurance_code AS  "Insurance Code",
        (SELECT payments_applied_total FROM billing.get_claim_totals(bc.id)) AS paid_amount,
        MAX(to_char(bp.payment_dt,'MM/DD/YYYY'))           AS "Payment Date",
        MAX(to_char(bp.accounting_dt,'MM/DD/YYYY') )       AS "Accounting Date",
        SUM(bch.bill_fee * bch.units) AS charge_amount,
        CASE WHEN bc.payer_type = 'primary_insurance'  OR  bc.payer_type = 'secondary_insurance' OR bc.payer_type = 'tertiary_insurance' THEN (SELECT claim_balance_total FROM billing.get_claim_totals(bc.id)) END AS ins_balance,
        to_char(bc.claim_dt,'MM/DD/YYYY') AS "Claim Date",
        CASE WHEN (SELECT payments_applied_total FROM billing.get_claim_totals(bc.id)) != 0::money AND bc.payer_type = 'primary_insurance' THEN  pip.insurance_name
         WHEN (SELECT payments_applied_total FROM billing.get_claim_totals(bc.id)) != 0::money AND bc.payer_type = 'secondary_insurance' THEN  pip.insurance_name
         WHEN (SELECT payments_applied_total FROM billing.get_claim_totals(bc.id)) != 0::money AND bc.payer_type = 'tertiary_insurance' THEN  pip.insurance_name
        ELSE pip.insurance_name 
        END AS "Insurance Paid", 
       CASE WHEN  (SELECT payments_applied_total FROM billing.get_claim_totals(bc.id)) != 0::money AND bc.payer_type = 'primary_insurance' THEN  pip.insurance_code
         WHEN (SELECT payments_applied_total FROM billing.get_claim_totals(bc.id)) != 0::money AND bc.payer_type = 'secondary_insurance' THEN  pip.insurance_code
         WHEN (SELECT payments_applied_total FROM billing.get_claim_totals(bc.id)) != 0::money AND bc.payer_type = 'tertiary_insurance' THEN  pip.insurance_code
        ELSE pip.insurance_code
        END AS Ins_Cur,
        pr.full_name AS "Ref. Doctor"        
        --, ac.description       AS "Insurance Payer Type"    
    FROM billing.claims bc
    INNER JOIN billing.charges bch ON bch.claim_id = bc.id 
    INNER JOIN public.patients pp on pp.id = bc.patient_id  
    LEFT JOIN billing.payment_applications bpa ON bpa.charge_id = bch.id
    LEFT JOIN billing.payments bp ON bp.id = bpa.payment_id
    <% if (cptCodeLists) { %>   inner join cpt_codes cc on cc.id = bch.cpt_id  <% } %>
    LEFT JOIN public.patient_insurances ppi ON ppi.id = CASE WHEN bc.payer_type = 'primary_insurance' THEN bc.primary_patient_insurance_id
                                                             WHEN bc.payer_type = 'secondary_insurance' THEN bc.secondary_patient_insurance_id
                                                             WHEN bc.payer_type = 'tertiary_insurance' THEN bc.tertiary_patient_insurance_id
                                 ELSE bc.primary_patient_insurance_id
                                                             END
    LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
    LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
    LEFT JOIN public.providers pr ON  pr.id = ppc.provider_id
     INNER JOIN public.facilities f ON f.id = bc.facility_id
    <% if (billingProID) { %> INNER JOIN billing.providers bpp ON bp.id = bc.billing_provider_id <% } %>
        WHERE 1 = 1
        AND <%=companyId%>       
   
        <% if(claimDate) { %> AND <%=claimDate%> <%}%>
        <% if(CPTDate) { %> AND <%=CPTDate%> <%}%>
        <% if(sumbittedDt) { %> AND <%=sumbittedDt%> <%}%>
        <% if(insuranceIds) { %> AND <%=insuranceIds%> <%}%>
        <% if(insGroups) { %> AND <%=insGroups%> <%}%>
    
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
        <% if(billingProID) { %> AND <% print(billingProID); } %>
        <% if(cptCodeLists) { %> AND <% print(cptCodeLists); } %>
        <% if(referringProIds) { %>AND <% print(referringProIds);} %>
    
        <%
        if(insPaid) { %> AND ( bp.payer_type = 'patient')   <% }
        else if(patPaid) { %> AND ( bp.payer_type = 'insurance') <% }
        else if(unPaid)  { %> AND ( bp.id is null ) <% }
        else if(insPaid && patPaid )  { %> AND ( bp.payer_type = 'patient' ) OR ( bp.payer_type = 'insurance' ) <% }
        else if(patPaid &&  unPaid)  { %> AND ( bp.payer_type = 'patient' OR bp.id is null ) <% }
        else if(unPaid && insPaid)  { %> AND ( bp.payer_type = 'insurance' OR bp.id is null) <% }
        else if(unPaid && insPaid && patPaid)  { %> AND ( bp.payer_type = 'patient' OR bp.payer_type = 'insurance' OR bp.id is null ) <% }
        %>  
        
    GROUP BY bc.id,pip.insurance_name,pip.insurance_code,pp.last_name,pp.first_name,pr.full_name

    <% if (orderBy == "claimId") { %>  
           ORDER BY  bc.id
        <% } else if(orderBy == "serviceDate")  { %>
               ORDER BY bc.claim_dt
            <%} else if(orderBy == "commentDate"){ %>
                ORDER BY bc.submitted_dt                
                <%} else { %>
                    ORDER BY pip.insurance_name
                    <% } %>
         )
        SELECT * FROM details
        UNION ALL
        SELECT
             null,'---','---','---','---'
             ,(SELECT SUM(a.paid_amount) from details AS a)
         ,null,null
             ,(SELECT SUM(a.charge_amount) FROM details AS a)
             ,(SELECT SUM(a.ins_balance)::money from details AS a)
            ,null,'---','---','---'
        WHERE (SELECT COUNT(*) FROM details) > 0
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        initialReportData.filters = api.createReportFilters(initialReportData);

        //convert array of insuranceProviderIds array of string to integer
        if (initialReportData.report.params.insuranceIds) {
            initialReportData.report.params.insuranceIds = initialReportData.report.params.insuranceIds.map(Number);
        }

        if (initialReportData.report.params.insuranceGroupList) {
            initialReportData.report.params.insuranceGroupList = initialReportData.report.params.insuranceGroupList.map(Number);
        }
        //convert array of Referring Provider array of string to integer
        if (initialReportData.report.params.referringProIds) {
            initialReportData.report.params.referringProIds = initialReportData.report.params.referringProIds.map(Number);
        }
        //convert array of cpt code id array of string to integer
        if (initialReportData.report.params.cptCodeLists) {
            initialReportData.report.params.cptCodeLists = initialReportData.report.params.cptCodeLists.map(Number);
        }

        // convert adjustmentCodeIds array of string to integer
        if (initialReportData.report.params.adjustmentCodeIds) {
            initialReportData.report.params.adjustmentCodeIds = initialReportData.report.params.adjustmentCodeIds.map(Number);
        }

        return Promise.join(

            dataHelper.getAdjustmentCodeInfo(initialReportData.report.params.companyId, initialReportData.report.params.adjustmentCodeIds),
            dataHelper.getCptCodesInfo(initialReportData.report.params.companyId, initialReportData.report.params.cptCodeLists),
            dataHelper.getInsuranceProvidersInfo(initialReportData.report.params.companyId, initialReportData.report.params.insuranceGroupList),
            dataHelper.getProviderGroupInfo(initialReportData.report.params.companyId, initialReportData.report.params.groupIds),
            dataHelper.getPatientInfo(initialReportData.report.params.companyId, initialReportData.report.params.patientIds),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            dataHelper.getReferringPhysicianInfo(initialReportData.report.params.companyId, initialReportData.report.params.referringProIds),

            api.createclaimTransactionDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (adjustmentCodeInfo, cptCodesInfo, insuranceProvidersInfo, providerGroupInfo, patientInfo, providerInfo, referringPhysicianInfo, claimTransactionDataSet) => {
                // add report filters            
                initialReportData.lookups.adjustmentCodes = adjustmentCodeInfo || [];
                initialReportData.lookups.cptCodeLists = cptCodesInfo || [];
                initialReportData.lookups.insuranceProviders = insuranceProvidersInfo || [];
                initialReportData.lookups.providerGroup = providerGroupInfo || [];
                initialReportData.lookups.patientInfo = patientInfo || [];
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.lookups.referringPhyInfo = referringPhysicianInfo || [];

                initialReportData.filters = api.createReportFilters(initialReportData);
                // add report specific data sets
                initialReportData.dataSets.push(claimTransactionDataSet);
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

        if (params.allFacilities && (params.facilityIds && params.facilityIds.length < 0))
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.indexOf(f.id) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        }

        // // Billing provider Filter
        if (params.allBillingProvider == 'true')
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        else {
            const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        }
        if (params.fromDate != '' && params.toDate != '') {
            filtersUsed.push({ name: 'fromDate', label: 'Claim Date From', value: params.fromDate });
            filtersUsed.push({ name: 'toDate', label: 'Claim Date To', value: params.toDate });
        }

        if (params.cptDateFrom != '' && params.cptDateTo != '') {
            filtersUsed.push({ name: 'FromPayDate', label: 'PayDate From', value: params.cptDateFrom });
            filtersUsed.push({ name: 'ToPayDate', label: 'PayDate To', value: params.cptDateTo });
        }

        if (params.billCreatedDateFrom != '' && params.billCreatedDateTo != '') {
            filtersUsed.push({ name: 'FromBillCreated', label: 'Bill Created From', value: params.billCreatedDateFrom });
            filtersUsed.push({ name: 'ToBillCreated', label: 'Bill Created To', value: params.billCreatedDateTo });
        }

        //Referring Physician Info
        
        if (params.referringProIds) {
            const referringPhysicianInfo = _(lookups.referringPhyInfo).map(f => f.name).value();
            filtersUsed.push({ name: 'referringPhysicianInfo', label: 'Referring Provider', value: referringPhysicianInfo });
        }
        else
            filtersUsed.push({ name: 'referringPhysicianInfo', label: 'Referring Provider', value: 'All' });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - claimTransaction count

    createclaimTransactionDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getclaimTransactionDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = claimTransactionDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getclaimTransactionDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            claimDate: null,
            facilityIds: null,
            billingProID: null,
            adjustmentCodeIds: null,
            studyDate: null,
            insuranceIds: null,
            referringProIds: null,
            sumbittedDt: null,
            CPTDate: null,
            allClaim: true,
            insPaid: null,
            patPaid: null,
            unPaid: null,
            claimNoSearch: null,
            orderBySelection: null,
            insGroups: null,
            cptPaymentDate: null,
            cptCodeLists: null,
            CPTDate_count: null,
            orderBy: null
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        //  claim Date 
        if (reportParams.fromDate != '' && reportParams.toDate != '') {
            if (reportParams.fromDate === reportParams.toDate) {
                params.push(reportParams.fromDate);
                filters.claimDate = queryBuilder.whereDate('bc.claim_dt', '=', [params.length], 'f.time_zone');
            } else {
                params.push(reportParams.fromDate);
                params.push(reportParams.toDate);
                filters.claimDate = queryBuilder.whereDateBetween('bc.claim_dt', [params.length - 1, params.length], 'f.time_zone');
            }
        }

        if (reportParams.referringProIds && reportParams.referringProIds.length > 0) {
            params.push(reportParams.referringProIds);
            filters.referringProIds = queryBuilder.whereIn(`pr.id`, [params.length]);
        }

        // Date filter  (CPT Date)
        if (reportParams.cmtFromDate != '' && reportParams.cmtToDate != '') {
            let filterDate = reportParams.cptDateOption ? reportParams.cptDateOption : 'payment_dt';
            filters.cptPaymentDate = reportParams.cptDateOption == 'accounting_dt' ? false : true;
            if (reportParams.cptDateFrom === reportParams.toDate && (reportParams.cptDateFrom && reportParams.toDate)) {
                params.push(reportParams.cptDateFrom);
                filters.CPTDate = queryBuilder.whereDate('bp.' + filterDate, '=', [params.length]);
            } else {
                params.push(reportParams.cmtFromDate);
                params.push(reportParams.cmtToDate);
                filters.CPTDate = queryBuilder.whereDateBetween('bp.' + filterDate, [params.length - 1, params.length]);
                filters.CPTDate_count = queryBuilder.whereDateBetween('bp.' + filterDate, [params.length - 1, params.length]);
            }
        }

        if (reportParams.billCreatedDateFrom != '' && reportParams.billCreatedDateTo != '') {
            if (reportParams.billCreatedDateFrom === reportParams.toDate) {
                params.push(reportParams.billCreatedDateFrom);
                filters.sumbittedDt = queryBuilder.whereDateInTz('bc.submitted_dt', '=', [params.length], 'f.time_zone');
            } else {
                params.push(reportParams.billCreatedDateFrom);
                params.push(reportParams.billCreatedDateTo);
                filters.sumbittedDt = queryBuilder.whereDateInTzBetween('bc.submitted_dt', [params.length - 1, params.length], 'f.time_zone');
            }
        }

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bpp.id', [params.length]);
        }

        if (reportParams.insuranceIds && reportParams.insuranceIds.length > 0) {
            params.push(reportParams.insuranceIds);
            filters.insuranceIds = queryBuilder.whereIn(`ppi.id`, [params.length]);
        }


        if (reportParams.insuranceGroupList && reportParams.insuranceGroupList.length > 0) {
            params.push(reportParams.insuranceGroupList);
            filters.insGroups = queryBuilder.whereIn(`pip.insurance_info->'providerType'`, [params.length]);
        }

        if (reportParams.cptCodeLists && reportParams.cptCodeLists.length > 0) {
            params.push(reportParams.cptCodeLists);
            filters.cptCodeLists = queryBuilder.whereIn(`cc.id`, [params.length]);
        }
        filters.orderBy = reportParams.orderBy || 0;

          // claim Selection
          if (reportParams.insurancePayerTypeOption && reportParams.insurancePayerTypeOption.length > 0) {
            filters.insPaid = _.includes(reportParams.insurancePayerTypeOption, 'InsPaid');
            filters.patPaid = _.includes(reportParams.insurancePayerTypeOption, 'PatPaid');
            filters.unPaid = _.includes(reportParams.insurancePayerTypeOption, 'UnPaid');
          }

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
