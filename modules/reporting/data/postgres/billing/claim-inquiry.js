const _ = require('lodash')
        , Promise = require('bluebird')
        , db = require('../db')
        , dataHelper = require('../dataHelper')
        , queryBuilder = require('../queryBuilder')
        , logger = require('../../../../../logger');

    // generate query template ***only once*** !!!

    const claimInquiryDataSetQueryTemplate = _.template(`
    WITH claim_data as (
        SELECT
           bc.id as claim_id,
           p.full_name as patient_name,
           p.account_no,
           COALESCE(p.patient_info->'ssn','') AS ssn,
           COALESCE(to_char(p.birth_date,'MM/DD/YYYY'),'') AS dob,
           COALESCE(p.patient_info->'c1HomePhone','') AS phone,
           claim_totals.claim_balance_total,
           bc.payer_type,
           NULLIF(ip.insurance_name,'')  AS insurance_name,
           NULLIF(ip.insurance_code,'')  AS insurance_code,
           NULLIF(ip.insurance_info->'Address1','')  AS address1,
           NULLIF(ip.insurance_info->'Address2','')  AS address2,
           NULLIF(ip.insurance_info->'City','') AS city,
           NULLIF(ip.insurance_info->'State','')  AS state,
           NULLIF(ip.insurance_info->'ZipCode','')  AS zip,
           NULLIF(ip.insurance_info->'ZipPlus','')  AS zip_plus,
           NULLIF(ip.insurance_info->'PhoneNo','')  AS phone_no,
           NULLIF(ip.insurance_info->'FaxNo','')  AS fax_no,
           to_char(bc.claim_dt, 'MM/DD/YYYY'),
           CASE
             WHEN bc.payer_type = 'primary_insurance' THEN ip.insurance_name
             WHEN bc.payer_type = 'secondary_insurance'  THEN ip.insurance_name
             WHEN bc.payer_type = 'tertiary_insurance' THEN ip.insurance_name
             WHEN bc.payer_type = 'patient'  THEN p.full_name
             WHEN bc.payer_type = 'ordering_facility' THEN f.facility_name
             WHEN bc.payer_type = 'referring_provider' THEN null
             ELSE  NULL
           END AS carrier,
           json_build_object('coverage_level',pi.coverage_level,'insurance_name',ip.insurance_name,'expire_date',to_char(pi.valid_to_date,'MM/DD/YYYY'),'PolicyNo',pi.policy_number, 'GroupNo',pi.group_number),
           bp.name,
           (SELECT
                claim_balance_total
            FROM
                billing.get_claim_totals(bc.id)) AS claim_balance
        FROM
            billing.claims bc
        INNER JOIN LATERAL billing.get_claim_totals(bc.id) AS claim_totals ON TRUE
        INNER JOIN public.patients p on p.id = bc.patient_id
        INNER JOIN public.facilities f on f.id = bc.facility_id
        INNER JOIN billing.providers bp on bp.id = bc.billing_provider_id
        LEFT JOIN public.patient_insurances pi on pi.id = (
                                                    CASE WHEN  bc.payer_type = 'primary_insurance' THEN
                                                       primary_patient_insurance_id
                                                    WHEN  bc.payer_type = 'secondary_insurance' THEN
                                                       secondary_patient_insurance_id
                                                    WHEN  bc.payer_type = 'tertiary_insurance' THEN
                                                       tertiary_patient_insurance_id
                                                    END
                                                )
        <% if (billingProID) { %> INNER JOIN billing.providers bpp ON bpp.id = bc.billing_provider_id <% } %>

        LEFT JOIN public.patient_insurances ppi ON ppi.id =  bc.primary_patient_insurance_id
        LEFT JOIN public.insurance_providers ip ON ip.id = ppi.insurance_provider_id
        LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = ip.provider_payer_type_id
        LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
        LEFT JOIN public.providers pr ON  pr.id = ppc.provider_id

        JOIN LATERAL (
            SELECT
                        DISTINCT bch.claim_id
                    FROM billing.payments bp
                   INNER JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
                   INNER JOIN billing.charges bch ON bch.id = bpa.charge_id
                   <% if (userIds) { %>  INNER join public.users on users.id = bp.created_by    <% } %>
                   WHERE bch.claim_id = bc.id
                   <% if(CPTDate) { %> AND <%=CPTDate%> <%}%>
                   <% if (userIds) { %>AND <% print(userIds); } %>
                   <%
                   if(patPaid && !insPaid && !unPaid) { %> AND ( bp.payer_type = 'patient')   <% }
                   else if(!patPaid && insPaid && !unPaid) { %> AND ( bp.payer_type = 'insurance') <% }
                   else if(!patPaid && !insPaid && unPaid)  { %> AND  NOT EXISTS (select 1  From billing.charges  ibch
                       INNER JOIN billing.payment_applications ibpa on ibch.id = ibpa.charge_id
                       WHERE ibch.claim_id = bc.id) <% }
                   else if(insPaid && patPaid && !unPaid)  { %> AND ( bp.payer_type = 'patient'  OR  bp.payer_type = 'insurance' ) <% }
                   else if(patPaid &&  unPaid && !insPaid)  { %> AND ( bp.payer_type = 'patient' OR NOT EXISTS (select 1  From billing.charges  ibch
                       INNER JOIN billing.payment_applications ibpa on ibch.id = ibpa.charge_id
                       WHERE ibch.claim_id = bc.id) ) <% }
                   else if(unPaid && insPaid && !patPaid)  { %> AND ( bp.payer_type = 'insurance' OR NOT EXISTS (select 1  From billing.charges  ibch
                       INNER JOIN billing.payment_applications ibpa on ibch.id = ibpa.charge_id
                       WHERE ibch.claim_id = bc.id)) <% }
                   else if(unPaid && insPaid && patPaid)  { %> AND ( bp.payer_type = 'patient' OR bp.payer_type = 'insurance' OR NOT EXISTS (select 1  From billing.charges  ibch
                       INNER JOIN billing.payment_applications ibpa on ibch.id = ibpa.charge_id
                       WHERE ibch.claim_id = bc.id) ) <% }
                   %>


        ) payments  on true
        WHERE 1=1
        AND  <%= companyId %>
        <% if(claimDate) { %> AND <%=claimDate%> <%}%>
        <% if(sumbittedDt) { %> AND <%=sumbittedDt%> <%}%>
        <% if(insuranceIds) { %> AND <%=insuranceIds%> <%}%>
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>
        <% if(billingProID) { %> AND <% print(billingProID); } %>
        <% if(insGroups) { %> AND <%=insGroups%> <%}%>

         ORDER BY p.full_name,p.account_no ASC)
        SELECT
             *
        FROM
             claim_data
    `);

    const claimInquiryDataSetQueryTemplate1 = _.template(`
    with claim_data_comments as (
        SELECT
        bc.id as claim_id
        , p.full_name
        ,p.account_no
     FROM
         billing.claims bc
     INNER JOIN public.patients p on p.id = bc.patient_id
     INNER JOIN public.facilities f on f.id = bc.facility_id
     INNER JOIN billing.providers bp on bp.id = bc.billing_provider_id
     INNER JOIN billing.charges bch ON bch.claim_id = bc.id
     LEFT JOIN public.patient_insurances pi on pi.id = (
                                                 CASE WHEN  bc.payer_type = 'primary_insurance' THEN
                                                    primary_patient_insurance_id
                                                 WHEN  bc.payer_type = 'secondary_insurance' THEN
                                                    secondary_patient_insurance_id
                                                 WHEN  bc.payer_type = 'tertiary_insurance' THEN
                                                    tertiary_patient_insurance_id
                                                 END
                                             )
                                             <% if (billingProID) { %> INNER JOIN billing.providers bpp ON bpp.id = bc.billing_provider_id <% } %>
                                             LEFT JOIN public.patient_insurances ppi ON ppi.id =  bc.primary_patient_insurance_id
                                             LEFT JOIN public.insurance_providers ip ON ip.id = ppi.insurance_provider_id
                                             LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = ip.provider_payer_type_id
                                             LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
                                             LEFT JOIN public.providers pr ON  pr.id = ppc.provider_id
     WHERE 1=1
     AND  <%= companyId %>
     <% if(claimDate) { %> AND <%=claimDate%> <%}%>
        <% if(sumbittedDt) { %> AND <%=sumbittedDt%> <%}%>
        <% if(insuranceIds) { %> AND <%=insuranceIds%> <%}%>
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>
        <% if(billingProID) { %> AND <% print(billingProID); } %>
        <% if(insuranceIds) { %> AND <%=insuranceIds%> <%}%>
        <% if(insGroups) { %> AND <%=insGroups%> <%}%>
      GROUP BY bc.id , p.full_name,p.account_no
      ORDER BY p.full_name,p.account_no ASC),

      billing_comments as
        (
        SELECT
                 cc.claim_id AS id
                ,'claim' AS type
                , note   AS comments
                , to_char(created_dt, 'MM/DD/YYYY') AS commented_dt
                , null AS charges
                , u.username AS commented_by
                , null::money AS adjustment_amount
                , null::money AS payment_amount
                , null::bigint AS payment_id
                , null AS cpt_codes
        FROM
              billing.claim_comments cc
        INNER JOIN claim_data_comments cd on cd.claim_id = cc.claim_id
        INNER join users u  on u.id = cc.created_by
        UNION ALL
        SELECT
                c.claim_id AS id
              , 'charge' AS type
              , cc.short_description AS comments
              , to_char(c.charge_dt,'MM/DD/YYYY') AS commented_dt
              , (c.bill_fee*c.units) AS amount
              , u.username AS commented_by
              , null::money AS adjustment_amount
              , null::money AS payment_amount
              , null::bigint AS payment_id
              , cc.display_code as cpt_codes
        FROM
             billing.charges c
        INNER JOIN claim_data_comments cd on cd.claim_id = c.claim_id
        INNER JOIN cpt_codes cc on cc.id = c.cpt_id
        INNER JOIN users u  on u.id = c.created_by
        UNION ALL
        SELECT
                bc.claim_id AS id
              , amount_type AS type,
                CASE
                    WHEN bp.payer_type = 'patient' THEN
                        pp.full_name
                    WHEN bp.payer_type = 'insurance' THEN
                        ip.insurance_name
                    WHEN bp.payer_type = 'ordering_facility' THEN
                        pg.group_name
                    WHEN bp.payer_type = 'ordering_provider' THEN
                        p.full_name
                    END     AS comments,
                to_char(bp.accounting_dt,'MM/DD/YYYY') as commented_dt,
                pa.amount as amount,
                u.username as commented_by,
                (bp.amount) AS total_payment,
                (SELECT adjustments_applied_total FROM billing.get_payment_totals(bp.id)) AS adjustments,
                bp.id as payment_id,
                null
        FROM
                    billing.payments bp
        INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
        INNER JOIN billing.charges bc on bc.id = pa.charge_id
        INNER JOIN claim_data_comments cd on cd.claim_id = bc.claim_id
        INNER JOIN users u  on u.id = bp.created_by
        LEFT JOIN public.patients pp on pp.id = bp.patient_id
        LEFT JOIN public.insurance_providers ip on ip.id = bp.insurance_provider_id
        LEFT JOIN public.provider_groups  pg on pg.id = bp.provider_group_id
        LEFT JOIN public.provider_contacts  pc on pc.id = bp.provider_contact_id
        LEFT JOIN public.providers p on p.id = pc.provider_id
        <% if (userIds) { %>  INNER join public.users on users.id = bp.created_by    <% } %>

        WHERE 1 =1
        <% if(CPTDate) { %> AND <%=CPTDate%> <%}%>
        <%
        if(patPaid && !insPaid && !unPaid) { %> AND ( bp.payer_type = 'patient')   <% }
        else if(!patPaid && insPaid && !unPaid) { %> AND ( bp.payer_type = 'insurance') <% }
        else if(!patPaid && !insPaid && unPaid)  { %> AND  NOT EXISTS (select 1  From billing.charges  ibch
			INNER JOIN billing.payment_applications ibpa on ibch.id = ibpa.charge_id
			WHERE ibch.claim_id = bc.id) <% }
        else if(insPaid && patPaid && !unPaid)  { %> AND ( bp.payer_type = 'patient'  OR  bp.payer_type = 'insurance' ) <% }
        else if(patPaid &&  unPaid && !insPaid)  { %> AND ( bp.payer_type = 'patient' OR NOT EXISTS (select 1  From billing.charges  ibch
			INNER JOIN billing.payment_applications ibpa on ibch.id = ibpa.charge_id
			WHERE ibch.claim_id = bc.id) ) <% }
        else if(unPaid && insPaid && !patPaid)  { %> AND ( bp.payer_type = 'insurance' OR NOT EXISTS (select 1  From billing.charges  ibch
			INNER JOIN billing.payment_applications ibpa on ibch.id = ibpa.charge_id
			WHERE ibch.claim_id = bc.id)) <% }
        else if(unPaid && insPaid && patPaid)  { %> AND ( bp.payer_type = 'patient' OR bp.payer_type = 'insurance' OR NOT EXISTS (select 1  From billing.charges  ibch
			INNER JOIN billing.payment_applications ibpa on ibch.id = ibpa.charge_id
			WHERE ibch.claim_id = bc.id) ) <% }
        %>

        <% if (userIds) { %>AND <% print(userIds); } %>
        )
        SELECT
            *
        FROM
           billing_comments
        ORDER BY
         CASE type
            WHEN 'charge' THEN 1
            WHEN 'payment' THEN 2
            WHEN 'adjustment' THEN 3
            ELSE 4
         END
    `);

    const api = {

        /**
         * STAGE 2
         * This method is called by controller pipline after report data is initialized (common lookups are available).
         */
        getReportData: (initialReportData) => {
            initialReportData.filters = api.createReportFilters(initialReportData);


            if (initialReportData.report.params.userIds && initialReportData.report.params.userIds.length > 0) {
                initialReportData.report.params.userIds = initialReportData.report.params.userIds.map(Number);
            }

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

                api.createclaimInquiryDataSet(initialReportData.report.params),
                api.createclaimInquiryDataSet1(initialReportData.report.params),
                // other data sets could be added here...
                (adjustmentCodeInfo, cptCodesInfo, insuranceProvidersInfo, providerGroupInfo, patientInfo, providerInfo, referringPhysicianInfo,claimInquiryDataSet, claimInquiryDataSet1) => {
                    // add report filters
                    initialReportData.lookups.adjustmentCodes = adjustmentCodeInfo || [];
                    initialReportData.lookups.cptCodeLists = cptCodesInfo || [];
                    initialReportData.lookups.insuranceProviders = insuranceProvidersInfo || [];
                    initialReportData.lookups.providerGroup = providerGroupInfo || [];
                    initialReportData.lookups.patientInfo = patientInfo || [];
                    initialReportData.lookups.billingProviderInfo = providerInfo || [];
                    initialReportData.lookups.referringPhyInfo = referringPhysicianInfo || [];

                    initialReportData.filters = api.createReportFilters(initialReportData);
                    for (i = 0; i < claimInquiryDataSet.rows.length; i++) {
                        var comments = [];
                        for (j = 0; j < claimInquiryDataSet1.rows.length; j++) {
                            if (claimInquiryDataSet1.rows[j][0] === claimInquiryDataSet.rows[i][0]) {
                                comments.push(claimInquiryDataSet1.rows[j]);
                            }
                        }
                        claimInquiryDataSet.rows[i].push(comments);

                    }
                    // add report specific data sets
                    initialReportData.dataSets.push(claimInquiryDataSet);
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
            filtersUsed.push({ name: 'FromPayDate', label: 'CommentDate From', value: params.cmtFromDate });
            filtersUsed.push({ name: 'ToPayDate', label: 'CommentDate To', value: params.cmtToDate });
        }

        if (params.billCreatedDateFrom != '' && params.billCreatedDateTo != '') {
            filtersUsed.push({ name: 'FromBillCreated', label: 'Bill Created From', value: params.billCreatedDateFrom });
            filtersUsed.push({ name: 'ToBillCreated', label: 'Bill Created To', value: params.billCreatedDateTo });
        }


        if (params.userIds && params.userIds.length > 0) {
            filtersUsed.push({ name: 'users', label: 'Users', value: params.userName });
        }
        else {
            filtersUsed.push({ name: 'users', label: 'Users', value: 'All' });
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
        // --- DATA SET - claimInquiry count

        createclaimInquiryDataSet: (reportParams) => {
            // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
            const queryContext = api.getclaimInquiryDataSetQueryContext(reportParams);
            console.log('context__', queryContext)
            // 2 - geenrate query to execute
            const query = claimInquiryDataSetQueryTemplate(queryContext.templateData);
            // 3a - get the report data and return a promise
            return db.queryForReportData(query, queryContext.queryParams);
        },

        createclaimInquiryDataSet1: (reportParams) => {
            const queryContext = api.getclaimInquiryDataSetQueryContext(reportParams);
            const query = claimInquiryDataSetQueryTemplate1(queryContext.templateData);
            return db.queryForReportData(query, queryContext.queryParams);
        },

        getclaimInquiryDataSetQueryContext: (reportParams) => {
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
            orderBy: null   ,
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

            if (reportParams.insurancePayerTypeOption && reportParams.insurancePayerTypeOption.length > 0) {
                filters.insPaid = _.includes(reportParams.insurancePayerTypeOption, 'InsPaid');
                filters.patPaid = _.includes(reportParams.insurancePayerTypeOption, 'PatPaid');
                filters.unPaid = _.includes(reportParams.insurancePayerTypeOption, 'UnPaid');
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
            filters.insuranceIds = queryBuilder.whereIn(`ip.id`, [params.length]);
        }


        if (reportParams.insuranceGroupList && reportParams.insuranceGroupList.length > 0) {
            params.push(reportParams.insuranceGroupList);
            filters.insGroups = queryBuilder.whereIn(`pippt.id`, [params.length]);
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

        if (reportParams.claimFrom && reportParams.claimTo) {
            params.push(reportParams.claimFrom);
            params.push(reportParams.claimTo);
            filters.claimNoSearch = queryBuilder.whereBetween('bc.id', [params.length - 1, params.length]);
        }

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
