const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const paymentsPrintPDFDataSetQueryTemplate = _.template(`
WITH patient_dtails AS (

    SELECT
       get_full_name(pp.last_name, pp.first_name) AS patient_name,
       pp.account_no as account_no,
       (pp.patient_info->'c1AddressLine1'::text) || ' , ' || (pp.patient_info->'c1AddressLine2'::text) ||' , '|| (pp.patient_info->'c1City'::text) As address,
       (pp.patient_info->'c1WorkPhone'::text)  As phone_number,
       to_char(bc.claim_dt,'MM/DD/YYYY') as claim_dt,
       bgct.adjustments_applied_total as adjustmet,
       bgct.claim_balance_total as balance,
       bgct.charges_allowed_amount_total as allowed_amount,
       bhcpop.patient_paid as patient_paid,
       bhcpop.others_paid as others_paid,
       bc.id as claim_id
    FROM
        billing.claims bc
    INNER JOIN billing.charges bch on bch.claim_id = bc.id
    INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id
    INNER JOIN public.patients pp on bc.patient_id = pp.id
    INNER JOIN lateral billing.get_claim_totals(bc.id) bgct ON true
    INNER JOIN lateral billing.get_claim_patient_other_payment(bc.id) bhcpop ON true
    WHERE
         <%= patientId %>
),
charge_details AS (

    SELECT
        get_full_name(pp.last_name, pp.first_name) AS patient_name
      , (pp.patient_info->'c1AddressLine1'::text) || ' , ' || (pp.patient_info->'c1AddressLine2'::text) ||' , '|| (pp.patient_info->'c1City'::text) AS address
      , (pp.patient_info->'c1WorkPhone'::text)  AS phone_number
      , bc.id AS claim_id
      , to_char(date(timezone(facilities.time_zone,claim_dt)), 'MM/DD/YYYY') AS claim_dt
      , pcc.display_code
      , pcc.display_description
      , billing.get_charge_icds(ch.id)
      , to_char(ch.charge_dt, 'MM/DD/YYYY') as commented_dt
      , ( ch.bill_fee * ch.units) AS charge_amount
      , billing.get_charge_icds(ch.id) AS charge_pointer
      , bgct.claim_balance_total as balance
      , bgct.adjustments_applied_total as adjustmet
      , bgct.charges_allowed_amount_total as allowed_amount
      , bhcpop.patient_paid as patient_paid
      , bhcpop.others_paid as others_paid
      , (select
            SUM (bill_fee * units)
        from
            billing.charges bchl
        INNER JOIN billing.claims bc on bc.id = bchl.claim_id
        where
                bchl.claim_id = claim_info.claim_id ) total_bill_fee
    FROM
        billing.charges ch
    INNER JOIN billing.claims bc on bc.id = ch.claim_id
    INNER JOIN public.cpt_codes pcc on pcc.id = ch.cpt_id
    INNER JOIN public.patients pp on bc.patient_id = pp.id
    INNER JOIN facilities ON facilities.id=bc.facility_id
    INNER JOIN lateral billing.get_claim_totals(bc.id) bgct ON true
    INNER JOIN lateral billing.get_claim_patient_other_payment(bc.id) bhcpop ON true
    JOIN LATERAL (
        SELECT
             max( bch.claim_id) AS claim_id
        FROM
             billing.charges bch
        INNER JOIN billing.payment_applications pa ON bch.id = pa.charge_id
        WHERE
            <%= paymentId %>
        ) AS claim_info on True
            WHERE bc.id = claim_info.claim_id
 ),
 payment_details AS(
    SELECT
                          pp.account_no as account_no
                        , bp.mode as payment_mode
                        , bp.id::text AS payment_id
                        , get_full_name(pp.last_name, pp.first_name) AS payer
                        , CASE WHEN bp.payer_type = 'patient' THEN
                                pp.full_name
                            WHEN bp.payer_type = 'insurance' THEN
                                    pip.insurance_name
                            WHEN bp.payer_type = 'ordering_facility' THEN
                                    pg.group_name
                            WHEN bp.payer_type = 'ordering_provider' THEN
                                    p.full_name
                            END  as payer
                        , to_char(bp.payment_dt,'MM/DD/YYYY') as payment_date
                        , to_char(bp.accounting_date,'MM/DD/YYYY') as accounting_date
                        , SUM(CASE WHEN pa.amount_type = 'payment' THEN pa.amount ELSE 0.00::money END)::text as payment_amount
                        , SUM(CASE
                            WHEN pa.amount_type ='payment' THEN
                                 pa.amount
                            ELSE
                                 0.00::MONEY
                          END
                           )  AS payment_applied
                       , (SUM(
                            CASE
                                WHEN
                                    pa.amount_type = 'payment' THEN
                                        pa.amount
                                    ELSE
                                        0.00::money END)  -
                           SUM(CASE
                                        WHEN pa.amount_type ='payment' THEN
                                            pa.amount
                                        ELSE
                                            0.00::MONEY
                                        END)
                          )AS total_payment_unapplied
                       , claim_info.claim_id
                        , (select SUM (payment_insurance_total + payment_patient_total) from BILLING.get_claim_payments(claim_info.claim_id)) AS paid_amount
                        , (select payments_applied_total from BILLING.get_claim_payments(claim_info.claim_id)) AS payment_applied
                    FROM
                        billing.payments bp
                        INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
                        INNER JOIN billing.charges ch on ch.id = pa.charge_id
                        INNER JOIN billing.claims bc on bc.id = ch.claim_id
                         LEFT JOIN public.patients pp on pp.id = bp.patient_id
                         LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
                         LEFT JOIN public.provider_groups  pg on pg.id = bp.provider_group_id
                         LEFT JOIN public.provider_contacts  pc on pc.id = bp.provider_contact_id
                         LEFT JOIN public.providers p on p.id = pc.provider_id
                         LEFT JOIN billing.adjustment_codes adj ON adj.id = pa.adjustment_code_id
                         JOIN LATERAL (
                            SELECT
                                 max( bch.claim_id) AS claim_id
                            FROM
                                 billing.charges bch
                            INNER JOIN billing.payment_applications pa ON bch.id = pa.charge_id
                            WHERE
                            <%= paymentId %>
                         ) AS claim_info on True

                    WHERE
                        ch.claim_id = claim_info.claim_id
                        AND  CASE
                                WHEN
                                    pa.amount_type = 'adjustment' THEN
                                    pa.amount != 0.00::money
                                    ELSE 1=1
                                END

                        --AND (accounting_entry_type != 'refund_debit' OR adjustment_code_id IS NULL)
                    GROUP BY
                        pa.applied_dt,
                        bp.id ,
                        pp.account_no,
                        get_full_name(pp.last_name, pp.first_name),
                        claim_info.claim_id, pp.full_name, pip.insurance_name, pg.group_name, p.full_name
)

        SELECT
                ( SELECT
                     COALESCE(json_agg(row_to_json(patient_dtails)),'[]') patient_dtails
                        FROM (
                                 SELECT
                                     *
                                 FROM
                                    patient_dtails
                            ) AS patient_dtails
			            ) AS patient_dtails,

                ( SELECT COALESCE(json_agg(row_to_json(charge_details)),'[]') charge_details
                        FROM (
                                SELECT
                                  *
                                FROM
                                    charge_details
                            ) AS charge_details
			    ) AS charge_details,
			   ( SELECT COALESCE(json_agg(row_to_json(payment_details)),'[]') payment_details
                        FROM (
                                SELECT
                                   *
                                 FROM payment_details
                              ) AS payment_details
			    ) AS payment_details
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createpaymentsPrintPDFDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (paymentsPrintPDFDataSet) => {
                // add report filters
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(paymentsPrintPDFDataSet);
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


        filtersUsed.push({ name: 'fromDate', label: 'Date From', value: params.fromDate });
        filtersUsed.push({ name: 'toDate', label: 'Date To', value: params.toDate });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - paymentsPrintPDF count

    createpaymentsPrintPDFDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getpaymentsPrintPDFDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = paymentsPrintPDFDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getpaymentsPrintPDFDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            paymentId: null,
            patient_id: null,
            patientId : null
        };

        params.push(reportParams.pamentIds);
        filters.paymentId = queryBuilder.where('pa.payment_id', '=', [params.length]);

        params.push(reportParams.patient_id);
        filters.patient_id = queryBuilder.where('bp.patient_id', '=', [params.length]);
        filters.patientId = queryBuilder.where('pp.id', '=', [params.length]);

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
