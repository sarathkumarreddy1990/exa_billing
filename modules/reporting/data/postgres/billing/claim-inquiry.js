const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger')
    , moment = require('moment');
// generate query template ***only once*** !!!
const claimInquiryDataSetQueryTemplate = _.template(`
    WITH patient_paid_claims as
        (
            SELECT
                DISTINCT bch.claim_id
            FROM billing.payments bp
            INNER JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
            INNER JOIN billing.charges bch ON bch.id = bpa.charge_id
            WHERE bp.payer_type = 'patient'
        ),
      insurance_paid_claims as (
            SELECT
                DISTINCT bch.claim_id
            FROM billing.payments bp
            INNER JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
            INNER JOIN billing.charges bch ON bch.id = bpa.charge_id
            WHERE bp.payer_type = 'insurance'
        ),
      unpaid_claims as (
            SELECT
                id as claim_id
            FROM billing.claims bc
            WHERE NOT EXISTS(SELECT
                                DISTINCT bch.claim_id
                            FROM billing.payments bp
                            INNER JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
                            INNER JOIN billing.charges bch ON bch.id = bpa.charge_id
                            WHERE bch.claim_id = bc.id)
        ),
      total_claims as (
        <% if(patPaid && !insPaid && !unPaid) { %> <%= patPaidQuery %>  <% }
        else if(!patPaid && insPaid && !unPaid) { %> <%= insPaidQuery %>  <% }
        else if(!patPaid && !insPaid && unPaid) { %> <%= unpaidQuery %> <% }
        else if(patPaid && insPaid && !unPaid) { %>
            <%= [patPaidQuery,insPaidQuery].join(' UNION ') %>
        <% } else if(!patPaid && insPaid && unPaid) { %>
            <%= [insPaidQuery,unpaidQuery ].join(' UNION ') %>
        <% } else if(patPaid && !insPaid && unPaid) { %>
            <%= [patPaidQuery,unpaidQuery].join(' UNION ') %>
        <% } else { %>
            <%= [patPaidQuery,insPaidQuery,unpaidQuery].join(' UNION ') %>
        <% } %>
        ),
    claim_data as (
        SELECT
           bc.id as claim_id,
           p.full_name as patient_name,
           p.account_no,
           COALESCE(p.patient_info->'ssn','') AS ssn,
           COALESCE(to_char(p.birth_date,'<%= dateFormat %>'),'') AS dob,
           COALESCE(p.patient_info->'c1HomePhone','') AS phone,
           COALESCE(claim_totals.claim_balance_total, 0::MONEY) AS claim_balance_total,
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
             WHEN bc.payer_type = 'primary_insurance' OR bc.payer_type = 'secondary_insurance' OR bc.payer_type = 'tertiary_insurance' THEN ip.insurance_name
             WHEN bc.payer_type = 'patient'  THEN p.full_name
             WHEN bc.payer_type = 'ordering_facility' THEN f.facility_name
             WHEN bc.payer_type = 'referring_provider' THEN null
             ELSE  NULL
           END AS carrier,
           coalesce(coverage_level.primary_coverage_level,'{}'),
           coalesce(coverage_level.secondary_coverage_level,'{}'),
           coalesce(coverage_level.tertiary_coverage_level,'{}'),
           bp.name,
           coalesce(claim_totals.claim_balance_total,0::money)::numeric AS claim_balance,
           CASE
             WHEN bc.payer_type = 'primary_insurance' OR bc.payer_type = 'secondary_insurance' OR bc.payer_type = 'tertiary_insurance' THEN ip.id
             WHEN bc.payer_type = 'patient'  THEN p.id
             WHEN bc.payer_type = 'ordering_facility' THEN f.id
             WHEN bc.payer_type = 'referring_provider' THEN null
             ELSE  NULL
           END AS carrier_id
        FROM
            billing.claims bc
        INNER JOIN LATERAL billing.get_claim_totals(bc.id) AS claim_totals ON TRUE
        INNER JOIN total_claims ON total_claims.claim_id = bc.id
        INNER JOIN public.patients p on p.id = bc.patient_id
        INNER JOIN public.facilities f on f.id = bc.facility_id
        INNER JOIN billing.providers bp on bp.id = bc.billing_provider_id
        <% if(commentedDt) { %>
        INNER JOIN LATERAL (
            SELECT
                    i_cc.claim_id,
                    created_dt::date AS commented_dt
                FROM billing.claim_comments i_cc
                WHERE  i_cc.is_internal
                UNION
                SELECT
                    i_c.claim_id,
                    i_c.charge_dt::date AS commented_dt
                FROM billing.charges i_c
                UNION
                SELECT
                  i_bc.claim_id,
                  bp.accounting_date AS commented_dt
                FROM billing.payments bp
                INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
                INNER JOIN billing.charges i_bc on i_bc.id = pa.charge_id
            ) billing_comments ON billing_comments.claim_id = bc.id
        <%}%>
        <% if (paymentUserIds ||  chargeUserIds || comentUserIds) { %>
            INNER JOIN LATERAL (
                SELECT
                    i_bch.claim_id
                FROM billing.charges i_bch
                WHERE <% print(chargeUserIds) %>
                UNION
                SELECT
                    i_bcc.claim_id
                FROM billing.claim_comments i_bcc
                WHERE <% print(comentUserIds) %>
                UNION
                SELECT
                    i_bch.claim_id
                FROM billing.payments i_bp
                INNER JOIN billing.payment_applications i_bpa on i_bpa.payment_id = i_bp.id
                INNER JOIN billing.charges i_bch on i_bch.id = i_bpa.charge_id
                WHERE <% print(paymentUserIds) %>
            ) user_claim_ids ON user_claim_ids.claim_id = bc.id
        <%}%>
        LEFT JOIN public.patient_insurances pi on pi.id = ( CASE WHEN  bc.payer_type = 'primary_insurance' THEN primary_patient_insurance_id
                                                                 WHEN  bc.payer_type = 'secondary_insurance' THEN secondary_patient_insurance_id
                                                                 WHEN  bc.payer_type = 'tertiary_insurance' THEN tertiary_patient_insurance_id END)
            INNER JOIN LATERAL (
            SELECT
               i_bc.id AS claim_id,
               json_build_array(p_pi.coverage_level,p_ip.insurance_name,to_char(p_pi.valid_to_date,'MM/DD/YYYY'),p_pi.policy_number,p_pi.group_number) AS primary_coverage_level,
               json_build_array(s_pi.coverage_level,s_ip.insurance_name,to_char(s_pi.valid_to_date,'MM/DD/YYYY'),s_pi.policy_number,s_pi.group_number) AS secondary_coverage_level,
               json_build_array(t_pi.coverage_level,t_ip.insurance_name,to_char(t_pi.valid_to_date,'MM/DD/YYYY'),t_pi.policy_number,t_pi.group_number) AS tertiary_coverage_level
            FROM billing.claims i_bc
            LEFT JOIN public.patient_insurances p_pi ON p_pi.id = i_bc.primary_patient_insurance_id
            LEFT JOIN public.patient_insurances s_pi ON s_pi.id = i_bc.secondary_patient_insurance_id
            LEFT JOIN public.patient_insurances t_pi ON t_pi.id = i_bc.tertiary_patient_insurance_id
            LEFT JOIN public.insurance_providers p_ip ON p_ip.id = p_pi.insurance_provider_id
            LEFT JOIN public.insurance_providers s_ip ON s_ip.id = s_pi.insurance_provider_id
            LEFT JOIN public.insurance_providers t_ip ON t_ip.id = t_pi.insurance_provider_id
            WHERE i_bc.id = bc.id
            <% if(insuranceIds) { %> AND (<% print(p_insuranceIds); %> OR <% print(s_insuranceIds); %> OR <% print(t_insuranceIds); %> ) <%}%>
        ) coverage_level ON coverage_level.claim_id = bc.id
        <% if (billingProID) { %> INNER JOIN billing.providers bpp ON bpp.id = bc.billing_provider_id <% } %>
       LEFT JOIN public.insurance_providers ip ON ip.id = pi.insurance_provider_id
        LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = ip.provider_payer_type_id
        LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
        LEFT JOIN public.providers pr ON  pr.id = ppc.provider_id
        WHERE <%= companyId %>
        <% if(claimDate) { %> AND <%=claimDate%> <%}%>
        <% if(commentedDt) { %> AND <%=commentedDt%> <%}%>
        <% if(sumbittedDt) { %> AND <%=sumbittedDt%> <%}%>
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>
        <% if(insGroups) { %> AND <%=insGroups%> <%}%>
        <% if(billingProID) { %> AND <% print(billingProID); } %>
         ORDER BY p.full_name,p.account_no ASC)
        SELECT
             *
        FROM
             claim_data
        ORDER BY carrier
    `);
const claimInquiryDataSetQueryTemplate1 = _.template(`
    with claim_data as (
        SELECT
        bc.id as claim_id
        , p.full_name
        , p.account_no
     FROM
         billing.claims bc
     INNER JOIN public.patients p on p.id = bc.patient_id
     INNER JOIN public.facilities f on f.id = bc.facility_id
     INNER JOIN billing.charges bch ON bch.claim_id = bc.id
     <% if (billingProID) { %> INNER JOIN billing.providers bpp ON bpp.id = bc.billing_provider_id <% } %>
     <% if(commentedDt) { %>
        INNER JOIN LATERAL (
            SELECT
                    i_cc.claim_id,
                    created_dt::date AS commented_dt
                FROM billing.claim_comments i_cc
                WHERE  i_cc.is_internal
                UNION
                SELECT
                    i_c.claim_id,
                    i_c.charge_dt::date AS commented_dt
                FROM billing.charges i_c
                UNION
                SELECT
                  i_bc.claim_id,
                  bp.accounting_date AS commented_dt
                FROM billing.payments bp
                INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
                INNER JOIN billing.charges i_bc on i_bc.id = pa.charge_id
            ) billing_comments ON billing_comments.claim_id = bc.id
        <%}%>
        <% if (paymentUserIds ||  chargeUserIds || comentUserIds) { %>
            INNER JOIN LATERAL (
                SELECT
                    i_bch.claim_id
                FROM billing.charges i_bch
                WHERE <% print(chargeUserIds) %>
                UNION
                SELECT
                    i_bcc.claim_id
                FROM billing.claim_comments i_bcc
                WHERE <% print(comentUserIds) %>
                UNION
                SELECT
                    i_bch.claim_id
                FROM billing.payments i_bp
                INNER JOIN billing.payment_applications i_bpa on i_bpa.payment_id = i_bp.id
                INNER JOIN billing.charges i_bch on i_bch.id = i_bpa.charge_id
                WHERE <% print(paymentUserIds) %>
            ) user_claim_ids ON user_claim_ids.claim_id = bc.id
        <%}%>
    LEFT JOIN public.patient_insurances pi on pi.id = ( CASE WHEN  bc.payer_type = 'primary_insurance' THEN primary_patient_insurance_id
                                                              WHEN  bc.payer_type = 'secondary_insurance' THEN secondary_patient_insurance_id
                                                              WHEN  bc.payer_type = 'tertiary_insurance' THEN tertiary_patient_insurance_id END)
    LEFT JOIN public.insurance_providers ip ON ip.id = pi.insurance_provider_id
    INNER JOIN LATERAL (
        SELECT
           i_bc.id AS claim_id
        FROM billing.claims i_bc
        LEFT JOIN public.patient_insurances p_pi ON p_pi.id = i_bc.primary_patient_insurance_id
        LEFT JOIN public.patient_insurances s_pi ON s_pi.id = i_bc.secondary_patient_insurance_id
        LEFT JOIN public.patient_insurances t_pi ON t_pi.id = i_bc.tertiary_patient_insurance_id
        LEFT JOIN public.insurance_providers p_ip ON p_ip.id = p_pi.insurance_provider_id
        LEFT JOIN public.insurance_providers s_ip ON s_ip.id = s_pi.insurance_provider_id
        LEFT JOIN public.insurance_providers t_ip ON t_ip.id = t_pi.insurance_provider_id
        WHERE i_bc.id = bc.id
        <% if(insuranceIds) { %> AND (<% print(p_insuranceIds); %> OR <% print(s_insuranceIds); %> OR <% print(t_insuranceIds); %> ) <%}%>
    ) coverage_level ON coverage_level.claim_id = bc.id
     LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = ip.provider_payer_type_id
     LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
     LEFT JOIN public.providers pr ON  pr.id = ppc.provider_id
     WHERE <%= companyId %>
           <% if(claimDate) { %> AND <%=claimDate%> <%}%>
           <% if(sumbittedDt) { %> AND <%=sumbittedDt%> <%}%>
           <% if(commentedDt) { %> AND <%=commentedDt%> <%}%>
           <% if (facilityIds) { %>AND <% print(facilityIds); } %>
           <% if(billingProID) { %> AND <% print(billingProID); } %>
           <% if(insGroups) { %> AND <%=insGroups%> <%}%>
      GROUP BY bc.id , p.full_name,p.account_no
      ORDER BY p.full_name,p.account_no ASC),
      billing_comments as
        (
            select
                cc.claim_id as id,
                'claim' as type ,
                note as comments ,
                to_char(created_dt::date,'<%= dateFormat %>') as commented_dt,
                null as amount,
                u.username as commented_by,
                null as code,
                null::bigint as payment_id
            from  billing.claim_comments cc
            INNER JOIN claim_data cd on cd.claim_id = cc.claim_id
            inner join users u  on u.id = cc.created_by
            where  cc.is_internal
            UNION ALL
            select
                c.claim_id as id,
                'charge' as type,
                cc.short_description as comments,
                to_char(c.charge_dt::date,'<%= dateFormat %>') as commented_dt,
                (c.bill_fee*c.units) as amount,
                u.username as commented_by,
                cc.display_code as code,
                null::bigint as payment_id
            from billing.charges c
            INNER JOIN claim_data cd on cd.claim_id = c.claim_id
            inner join cpt_codes cc on cc.id = c.cpt_id
            inner join users u  on u.id = c.created_by
            UNION ALL
            select  bc.claim_id as id,amount_type as type,
            CASE WHEN bp.payer_type = 'patient' THEN
                       pp.full_name
                 WHEN bp.payer_type = 'insurance' THEN
                       pip.insurance_name
                 WHEN bp.payer_type = 'ordering_facility' THEN
                       pg.group_name
                 WHEN bp.payer_type = 'ordering_provider' THEN
                       p.full_name
            END as comments,
            to_char(bp.accounting_date,'<%= dateFormat %>') as commented_dt,
            sum(pa.amount) as amount,
            u.username as commented_by,
            CASE amount_type
                 WHEN 'adjustment' THEN 'Adj'
                 WHEN 'payment' THEN (CASE bp.payer_type
                                     WHEN 'patient' THEN 'Patient'
                                     WHEN 'insurance' THEN 'Insurance'
                                     WHEN 'ordering_facility' THEN 'Ordering facility'
                                     WHEN 'ordering_provider' THEN 'Provider'
                                     END)
            END as code,
            bp.id as payment_id
            from billing.payments bp
            inner join billing.payment_applications pa on pa.payment_id = bp.id
            inner join billing.charges bc on bc.id = pa.charge_id
            INNER JOIN claim_data cd on cd.claim_id = bc.claim_id
            inner join users u  on u.id = bp.created_by
            LEFT JOIN public.patients pp on pp.id = bp.patient_id
            LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
            LEFT JOIN public.provider_groups  pg on pg.id = bp.provider_group_id
            LEFT JOIN public.provider_contacts  pc on pc.id = bp.provider_contact_id
            LEFT JOIN public.providers p on p.id = pc.provider_id
        group by bp.id,bc.claim_id,amount_type,comments,commented_dt,commented_by,code
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
        initialReportData.report.styles.cssStyleSSN = initialReportData.report.vars.columnHidden.ssn[initialReportData.report.params.country_alpha_3_code] ? "display: none" : "";
        initialReportData.report.styles.cssStyleExpiration = initialReportData.report.vars.columnHidden.expiration[initialReportData.report.params.country_alpha_3_code] ? "display: none" : "";
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
            (adjustmentCodeInfo, cptCodesInfo, insuranceProvidersInfo, providerGroupInfo, patientInfo, providerInfo, referringPhysicianInfo, claimInquiryDataSet, claimInquiryDataSet1) => {
                // add report filters
                initialReportData.lookups.adjustmentCodes = adjustmentCodeInfo || [];
                initialReportData.lookups.cptCodeLists = cptCodesInfo || [];
                initialReportData.lookups.insuranceProviders = insuranceProvidersInfo || [];
                initialReportData.lookups.providerGroup = providerGroupInfo || [];
                initialReportData.lookups.patientInfo = patientInfo || [];
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.lookups.referringPhyInfo = referringPhysicianInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);

                var carrierNameIndex = 19;
                var carrierIdIndex = 25;
                var lastCarrierId = 0;
                var lastCarrierName = '';
                var lastProcessedIndex = 0;
                var commentsByCarrier = {};
                var commentsByClaim = [];
                var finalInquiryDataset = { rows: [] };
                var coverage_result = [];
                var total_balance;

                function addCommentsByCarrier(carrierName, comments) {

                    finalInquiryDataset.rows.push({
                        [carrierName]: comments
                    });

                    // finalInquiryDataset[carrierName] = comments;
                }

                for (var i = 0; i < claimInquiryDataSet.rows.length; i++) {
                    total_balance = 0;
                    if (i > -1 && Object.keys(commentsByCarrier).length && claimInquiryDataSet.rows[i][carrierIdIndex] != lastCarrierId) {
                        var index = 1;
                        _.map(commentsByCarrier, function (Obj) {
                            Obj.claim[0].carrier_count = index;
                            total_balance += JSON.parse(Obj.claim[0].claim_balance.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, ''));
                            index++;
                        });

                        _.map(commentsByCarrier, function (Obj) {
                            Obj.claim[0].carrier_balance = parseFloat(total_balance).toFixed(2) || '0.00';
                        });

                        addCommentsByCarrier(lastCarrierName, commentsByCarrier);
                        commentsByCarrier = {};
                        lastCarrierId = 0;
                    }
                    else {
                        total_balance += JSON.parse(claimInquiryDataSet.rows[0][6].replace(/[&\/\\#,+()$~%'":*?<>{}]/g, ''));
                    }

                    commentsByClaim = [];
                    lastCarrierId = claimInquiryDataSet.rows[i][carrierIdIndex];
                    lastCarrierName = claimInquiryDataSet.rows[i][carrierNameIndex];

                    var claimId = claimInquiryDataSet.rows[i][0];
                    if (claimId == claimInquiryDataSet.rows[i][0]) {
                        coverage_result.push(claimInquiryDataSet.rows[i][20]);
                    }

                    for (var j = 0; j < claimInquiryDataSet1.rows.length; j++) {
                        if (claimInquiryDataSet1.rows[j][0] === claimId) {
                            commentsByClaim.push(claimInquiryDataSet1.rows[j]);
                        }
                    }

                    var carrier_count = 1;
                    var duplicateObj = _.findLast(commentsByCarrier[claimId], {
                        claim_id: claimId
                    });
                    if (duplicateObj) {
                        carrier_count = duplicateObj.carrier_count && duplicateObj.carrier_count ? duplicateObj.carrier_count + 1 : 1;
                    }
                    var coverageArr = [];
                    coverageArr['coverage_level'] = claimInquiryDataSet.rows[i][20].coverage_level;
                    coverageArr['expire_date'] = claimInquiryDataSet.rows[i][20].expire_date;
                    coverageArr['GroupNo'] = claimInquiryDataSet.rows[i][20].GroupNo;
                    coverageArr['insurance_name'] = claimInquiryDataSet.rows[i][20].insurance_name;
                    coverageArr['PolicyNo'] = claimInquiryDataSet.rows[i][20].PolicyNo;
                    var claimObj = {
                        claim_id: claimInquiryDataSet.rows[i][0],
                        patient_name: claimInquiryDataSet.rows[i][1],
                        account_no: claimInquiryDataSet.rows[i][2],
                        ssn: claimInquiryDataSet.rows[i][3],
                        dob: claimInquiryDataSet.rows[i][4],
                        phone_no: claimInquiryDataSet.rows[i][5],
                        order_balance: claimInquiryDataSet.rows[i][6],
                        payer_type: claimInquiryDataSet.rows[i][7],
                        insurance_name: claimInquiryDataSet.rows[i][8],
                        insurance_code: claimInquiryDataSet.rows[i][9],
                        address1: claimInquiryDataSet.rows[i][10],
                        address2: claimInquiryDataSet.rows[i][11],
                        city: claimInquiryDataSet.rows[i][12],
                        state: claimInquiryDataSet.rows[i][13],
                        zip: claimInquiryDataSet.rows[i][14],
                        zipplus: claimInquiryDataSet.rows[i][15],
                        phone: claimInquiryDataSet.rows[i][16],
                        fax: claimInquiryDataSet.rows[i][17],
                        claim_dt: claimInquiryDataSet.rows[i][18],
                        carrier: claimInquiryDataSet.rows[i][19],
                        p_coverage: claimInquiryDataSet.rows[i][20].length ? (claimInquiryDataSet.rows[i][20].slice(0))[0] : '',
                        p_company_name: claimInquiryDataSet.rows[i][20].length ? (claimInquiryDataSet.rows[i][20].slice(0))[1] : '',
                        p_exp_date: claimInquiryDataSet.rows[i][20].length ? (claimInquiryDataSet.rows[i][20].slice(0))[2] : '',
                        p_policy_no: claimInquiryDataSet.rows[i][20].length ? (claimInquiryDataSet.rows[i][20].slice(0))[3] : '',
                        p_group_no: claimInquiryDataSet.rows[i][20].length ? (claimInquiryDataSet.rows[i][20].slice(0))[4] : '',
                        s_coverage: claimInquiryDataSet.rows[i][21].length ? (claimInquiryDataSet.rows[i][21].slice(0))[0] : '',
                        s_company_name: claimInquiryDataSet.rows[i][21].length ? (claimInquiryDataSet.rows[i][21].slice(0))[1] : '',
                        s_exp_date: claimInquiryDataSet.rows[i][21].length ? (claimInquiryDataSet.rows[i][21].slice(0))[2] : '',
                        s_policy_no: claimInquiryDataSet.rows[i][21].length ? (claimInquiryDataSet.rows[i][21].slice(0))[3] : '',
                        s_group_no: claimInquiryDataSet.rows[i][21].length ? (claimInquiryDataSet.rows[i][21].slice(0))[4] : '',
                        t_coverage: claimInquiryDataSet.rows[i][22].length ? (claimInquiryDataSet.rows[i][22].slice(0))[0] : '',
                        t_company_name: claimInquiryDataSet.rows[i][22].length ? (claimInquiryDataSet.rows[i][22].slice(0))[1] : '',
                        t_exp_date: claimInquiryDataSet.rows[i][22].length ? (claimInquiryDataSet.rows[i][22].slice(0))[2] : '',
                        t_policy_no: claimInquiryDataSet.rows[i][22].length ? (claimInquiryDataSet.rows[i][22].slice(0))[3] : '',
                        t_group_no: claimInquiryDataSet.rows[i][22].length ? (claimInquiryDataSet.rows[i][22].slice(0))[4] : '',
                        billing_provider: claimInquiryDataSet.rows[i][23],
                        claim_balance: claimInquiryDataSet.rows[i][24],
                        carrier_count: 1,
                        total_carrier_balance: parseFloat(total_balance).toFixed(2) || '0.00'
                    };

                    claimObj.policyHeader = initialReportData.report.vars.columnHeader.policy[initialReportData.report.params.country_alpha_3_code];
                    claimObj.groupHeader = initialReportData.report.vars.columnHeader.group[initialReportData.report.params.country_alpha_3_code];

                    commentsByCarrier[claimId] = {
                        claim: [claimObj],
                        commentsByClaim
                    };

                }

                var index = 1;
                total_balance = 0;

                _.map(commentsByCarrier, function (Obj) {
                    Obj.claim[0].carrier_count = index;
                    total_balance += JSON.parse(Obj.claim[0].claim_balance.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, ''));
                    index++;
                });

                _.map(commentsByCarrier, function (Obj) {
                    Obj.claim[0].carrier_balance = parseFloat(total_balance).toFixed(2) || '0.00';
                });

                addCommentsByCarrier(lastCarrierName, commentsByCarrier);

                // add report specific data sets
                initialReportData.dataSets.push(finalInquiryDataset);
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
            filtersUsed.push({ name: 'fromDate', label: 'Claim Date From', value: moment(params.fromDate).format(params.dateFormat) });
            filtersUsed.push({ name: 'toDate', label: 'Claim Date To', value: moment(params.toDate).format(params.dateFormat) });
        }

        if (params.cmtFromDate != '' && params.cmtToDate != '') {
            filtersUsed.push({ name: 'FromPayDate', label: 'Comment Date From', value: moment(params.cmtFromDate).format(params.dateFormat) });
            filtersUsed.push({ name: 'ToPayDate', label: 'Comment Date To', value: moment(params.cmtToDate).format(params.dateFormat) });
        }
        if (params.billCreatedDateFrom != '' && params.billCreatedDateTo != '') {
            filtersUsed.push({ name: 'FromBillCreated', label: 'Bill Created From', value: moment(params.billCreatedDateFrom).format(params.dateFormat) });
            filtersUsed.push({ name: 'ToBillCreated', label: 'Bill Created To', value: moment(params.billCreatedDateTo).format(params.dateFormat) });
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
            p_insuranceIds: null,
            s_insuranceIds: null,
            t_insuranceIds: null,
            adjustmentCodeIds: null,
            studyDate: null,
            insuranceIds: null,
            referringProIds: null,
            sumbittedDt: null,
            commentedDt: null,
            allClaim: true,
            insPaid: null,
            patPaid: null,
            unPaid: null,
            claimNoSearch: null,
            orderBySelection: null,
            insGroups: null,
            cptPaymentDate: null,
            cptCodeLists: null,
            orderBy: null,
            chargeUserIds: null,
            comentUserIds: null,
            paymentUserIds: null,
            patPaidQuery:null,
            insPaidQuery:null,
            unpaidQuery:null
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
            filters.unPaid = _.includes(reportParams.insurancePayerTypeOption, 'Unpaid');
            filters.patPaidQuery = 'SELECT claim_id FROM patient_paid_claims';
            filters.insPaidQuery = 'SELECT claim_id FROM insurance_paid_claims';
            filters.unpaidQuery = 'SELECT claim_id FROM unpaid_claims';
        }
        //  claim Date
        if (reportParams.fromDate != '' && reportParams.toDate != '') {
            if (reportParams.fromDate === reportParams.toDate) {
                params.push(reportParams.fromDate);
                filters.claimDate = queryBuilder.whereDateInTz('bc.claim_dt', '=', [params.length], 'f.time_zone');
            } else {
                params.push(reportParams.fromDate);
                params.push(reportParams.toDate);
                filters.claimDate = queryBuilder.whereDateInTzBetween('bc.claim_dt', [params.length - 1, params.length], 'f.time_zone');
            }
        }
        if (reportParams.referringProIds && reportParams.referringProIds.length > 0) {
            params.push(reportParams.referringProIds);
            filters.referringProIds = queryBuilder.whereIn(`pr.id`, [params.length]);
        }
        // Date filter  (CPT Date)
        if (reportParams.cmtFromDate != '' && reportParams.cmtToDate != '') {
            if (reportParams.cmtFromDate === reportParams.cmtToDate) {
                params.push(reportParams.cmtFromDate);
                filters.commentedDt = queryBuilder.whereDate('billing_comments.commented_dt', '=', [params.length]);
            } else {
                params.push(reportParams.cmtFromDate);
                params.push(reportParams.cmtToDate);
                filters.commentedDt = queryBuilder.whereDateBetween('billing_comments.commented_dt', [params.length - 1, params.length]);
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
            filters.p_insuranceIds = queryBuilder.whereIn('p_ip.id', [params.length]);
            filters.s_insuranceIds = queryBuilder.whereIn('s_ip.id', [params.length]);
            filters.t_insuranceIds = queryBuilder.whereIn('t_ip.id', [params.length]);
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
            filters.unPaid = _.includes(reportParams.insurancePayerTypeOption, 'Unpaid');
        }
        if (reportParams.claimFrom && reportParams.claimTo) {
            params.push(reportParams.claimFrom);
            params.push(reportParams.claimTo);
            filters.claimNoSearch = queryBuilder.whereBetween('bc.id', [params.length - 1, params.length]);
        }
        if (reportParams.userIds && reportParams.userIds.length > 0) {
            if (reportParams.userIds) {
                params.push(reportParams.userIds);
                filters.chargeUserIds = queryBuilder.whereIn('i_bch.created_by', [params.length]);
                filters.comentUserIds = queryBuilder.whereIn('i_bcc.created_by', [params.length]);
                filters.paymentUserIds = queryBuilder.whereIn('i_bp.created_by', [params.length]);
            }
        }

        filters.dateFormat = reportParams.dateFormat;
        return {
            queryParams: params,
            templateData: filters
        }
    }
}
module.exports = api;
