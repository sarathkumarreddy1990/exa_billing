const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');
// generate query template ***only once*** !!!
const chargePaymentReceiptDataSetQueryTemplate = _.template(`
WITH company_details AS (
	SELECT
	   c.company_name                                     AS company_name
          , c.company_info->'company_address1'                 AS company_address1
          , c.company_info->'company_address2'                 AS company_address2
          , c.company_info->'company_city'                     AS company_city
          , c.company_info->'company_state'                    AS company_state
          , c.company_info->'company_zip'                      AS company_zip
          , c.company_info->'company_contactNo'                AS company_contactNo
	  , coalesce(get_full_name(p.last_name, p.first_name,
                    p.middle_name, p.prefix_name, p.suffix_name),'')
                                                                 AS full_name
         , p.account_no                                          AS account_no
         , p.alt_account_no                                      AS alt_account_no
         , p.patient_info->'c1AddressLine1'                      AS address1
         , p.patient_info->'c1AddressLine2'                      AS address2
         , p.patient_info->'c1City'                              AS city
         , p.patient_info->'c1State'                             AS state
         , p.patient_info->'c1Zip'                               AS zip
         , (SELECT NEXTVAL('billing.receipt_no_seq'))            AS receipt_no
	FROM
        public.orders o
        INNER JOIN public.companies c ON c.id = o.company_id
	    LEFT JOIN public.patients p ON p.id = o.patient_id
        WHERE  <%= patient_id_det %>
)
,charge_details AS (
	SELECT
	    TRIM(s.study_description) AS study_description
      , row_number() OVER (ORDER BY s.id ASC) charge_index   
      , to_char(timezone(f.time_zone, s.study_dt), 'MM/DD/YYYY') AS study_dt
      , s.accession_no
      , sc.cpt_code AS study_cpt
      , cc.short_description AS cpt_description
	FROM  public.studies s
    INNER JOIN public.facilities AS f  ON f.id = s.facility_id
    INNER JOIN public.study_cpt sc ON sc.study_id = s.id
    INNER JOIN public.cpt_codes cc ON cc.id = sc.cpt_code_id
    WHERE
        s.deleted_dt IS NULL
        AND sc.deleted_dt IS NULL
        AND (
            <%= study_id %>
            <% if(studyCptIds) { %> OR <% print(studyCptIds);} %>
        )
)
,payments AS (
 SELECT
        p.accounting_date::text
        ,p.mode
        ,p.card_number
        ,p.id AS payment_id
        ,p.notes
        ,u.username
        ,p.amount::numeric
        ,p.payment_reason_id
        ,(SELECT payment_status FROM billing.get_payment_totals(p.id))
  FROM
	billing.payments p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE <%= payment_id %>
        ORDER BY p.id ASC
)
SELECT  ( SELECT COALESCE(json_agg(row_to_json(company_details)),'[]') company_details
                                        FROM (
                                                SELECT
                                                    *
                                                    FROM company_details
                                            ) AS company_details
        ) AS company_details
        ,( SELECT COALESCE(json_agg(row_to_json(charges)),'[]') charges
                                        FROM (
                                                SELECT
                                                    *
                                                    FROM charge_details
                                             ) AS charges
                                ) AS charges
        ,( SELECT COALESCE(json_agg(row_to_json(payments)),'[]') payments
                                        FROM (
                                                SELECT
                                                    *
                                                    FROM payments
                                             ) AS payments
                                ) AS payments
`);
const api = {
    getReportData: (initialReportData) => {
        if (initialReportData.report.params.cptCodeIds) {
            initialReportData.report.params.cptCodeIds = initialReportData.report.params.cptCodeIds.map(Number);
        }
        if (initialReportData.report.params.studyIds) {
            initialReportData.report.params.studyIds = initialReportData.report.params.studyIds.map(Number);
        }
        return Promise.join(
            dataHelper.getCptCodesInfo(initialReportData.report.params.companyId, initialReportData.report.params.cptCodeIds),
            dataHelper.getStudyInfo(initialReportData.report.params.companyId, initialReportData.report.params.studyIds),
            api.createchargePaymentReceiptDataSet(initialReportData.report.params),
            (cptCodesInfo, studyInfo, chargePaymentReceiptDataSet) => {
                initialReportData.lookups.cptCodes = cptCodesInfo || [];
                initialReportData.lookups.studyId = studyInfo || [];
                initialReportData.dataSets.push(chargePaymentReceiptDataSet);
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                return initialReportData;
            });
    },
    transformReportData: (rawReportData) => {
        return Promise.resolve(rawReportData);
    },
    getJsReportOptions: (reportParams, reportDefinition) => {
        return reportDefinition.jsreport[reportParams.reportFormat];
    },
    createchargePaymentReceiptDataSet: (reportParams) => {
        const queryContext = api.getchargePaymentReceiptDataSetQueryContext(reportParams);
        const query = chargePaymentReceiptDataSetQueryTemplate(queryContext.templateData);
        return db.queryForReportData(query, queryContext.queryParams);
    },
    getchargePaymentReceiptDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            cptCodeId: null,
            patient_id: null,
            patient_id_det: null,
            payment_id: null,
            study_id: null,
            studyCptIds: null
        };
        if (reportParams.patient_id) {
            params.push(reportParams.patient_id);
            filters.patient_id = queryBuilder.where('p.patient_id', '=', [params.length]);
            filters.patient_id_det = queryBuilder.where('p.id', '=', [params.length]);
        }
        if (reportParams.payment_id) {
            params.push(reportParams.payment_id);
            filters.payment_id = queryBuilder.where('p.id', '=', [params.length]);
        }

        params.push(reportParams.studyIds || null);
        filters.study_id = queryBuilder.whereIn('s.id', [params.length]);

        if (reportParams.studyCptIds) {
            params.push(reportParams.studyCptIds.map(Number));
            filters.studyCptIds = queryBuilder.whereIn('sc.id', [params.length]);
        }
        return {
            queryParams: params,
            templateData: filters
        }
    }
}
module.exports = api;
