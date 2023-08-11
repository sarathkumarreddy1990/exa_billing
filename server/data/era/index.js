const { query, queryRows, SQL } = require('./../index');
const _ = require('lodash');
const queryMakers = require('./../query-maker-map');
const generator = queryMakers.get('datetime');

module.exports = {

    getEraFiles: async function (params) {

        let whereQuery = [];
        let filterCondition = '';
        let paymentIds = [];
        params.sortOrder = params.sortOrder || ' ASC';
        params.sortField = params.sortField == 'id' ? ' ef.id ' : params.sortField;
        let {
            id,
            size,
            updated_date_time,
            current_status,
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            uploaded_file_name,
            payment_id,
            fromDate,
            toDate,
            customArgs
        } = params;

        whereQuery.push(` ef.file_type NOT IN ('EOB', '837', 'can_ab_wcb_c568', 'can_ab_wcb_c570', 'can_ahs_a', 'can_ahs_c', 'can_ahs_r', 'can_ahs_d') `);  // removing claim submission records shown in EOB screen

        if (id) {
            whereQuery.push(` ef.id = ${id} `);
        }

        if (uploaded_file_name) {
            whereQuery.push(` ef.uploaded_file_name ILIKE '%${uploaded_file_name}%' `);
        }

        if (size) {
            whereQuery.push(` ef.file_size = ${size}`);
        }

        if (updated_date_time) {
            const updatedDateTimeFilter = generator('ef.created_dt', updated_date_time, customArgs);
            whereQuery.push(updatedDateTimeFilter);

        } else if (fromDate && toDate) {
            whereQuery.push(` ef.created_dt::date BETWEEN '${fromDate}'::date AND '${toDate}'::date`);

        }

        if (current_status) {
            whereQuery.push(` ef.status = replace('${current_status}', '\\', '')`);
        }

        paymentIds = payment_id && payment_id.split(`,`) || [];
        paymentIds = _.filter(paymentIds, e => e !== '');

        if (paymentIds.length) {
            filterCondition = ` AND efp.payment_id = ANY(ARRAY[${paymentIds}]) `;
            whereQuery.push(' file_payments.payment_id IS NOT NULL ');
        }

        const sql = SQL`
                SELECT
                    ef.id,
                    ef.id AS file_name,
                    ef.file_store_id,
                    ef.created_dt AS updated_date_time,
                    ef.status AS current_status,
                    ef.file_type,
                    ef.file_path,
                    ef.file_size AS size,
                    ef.file_md5,
                    ef.uploaded_file_name,
                    file_payments.payment_id,
                    eob.eob_file_id,
                    COUNT(1) OVER (range unbounded preceding) AS total_records
                FROM
                    billing.edi_files ef
                    LEFT JOIN LATERAL (
                        SELECT
                            array_agg(efp.payment_id) as payment_id
                        FROM
                            billing.edi_file_payments efp
                        WHERE
                            efp.edi_file_id = ef.id `;

        if (paymentIds.length) {
            sql.append(filterCondition);
        }

        sql.append(SQL`) AS file_payments ON TRUE
                                LEFT JOIN LATERAL (
                                                SELECT
                                                   DISTINCT efp.edi_file_id AS eob_file_id
                                                FROM
                                                    billing.edi_file_payments efp
                                                WHERE
                                                    efp.payment_id = ANY(file_payments.payment_id)
                                                    AND efp.edi_file_id != ef.id
                                                ) AS eob ON TRUE
                                INNER JOIN companies ON companies.id = ${params.companyId}
                                WHERE
                                company_id = ${params.companyId} `);

        if (whereQuery.length) {
            sql.append(SQL` AND `);
        }

        if (whereQuery.length) {
            sql.append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY  `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);
    },

    getERAExtensions: async () => {
        const sql = SQL`
            SELECT
                ARRAY_AGG(era_file_ext) AS era_file_extension,
                ARRAY_AGG(communication_info->>'sftp_era_file_ext') AS sftp_era_file_extension
            FROM billing.edi_clearinghouses`

        return await queryRows(sql);
    },

    selectInsuranceEOB: async function (params) {

        const paymentSQL = SQL`WITH
                    is_payer_exists AS (
                        SELECT
                            ip.id
                            ,ip.insurance_code
                            ,ip.insurance_name
                            ,ip.insurance_info->'PayerID' AS payer_id
                        FROM
                           billing.edi_file_payments efp
                        INNER JOIN billing.payments p ON p.id = efp.payment_id
                        INNER JOIN insurance_providers ip ON ip.id = p.insurance_provider_id
                        WHERE efp.edi_file_id = ${params.file_id}  ORDER BY efp.id ASC LIMIT 1
                    ),
                    current_payer AS (
                         SELECT
                             id
                             ,insurance_code
                             ,insurance_name
                             ,insurance_info->'PayerID' AS payer_id
                         FROM
                             insurance_providers
                         WHERE
                             deleted_dt IS NULL AND
                             company_id = ${params.company_id} AND
                             insurance_info->'PayerID' = ${params.payer_id}::text
                    )
                    SELECT * FROM is_payer_exists
                    UNION
                    SELECT * FROM current_payer `;

        return await query(paymentSQL);
    },

    createEdiPayment: async function (params) {

        const sql = SQL`WITH
                            is_payment_exists AS (
                                SELECT
                                    id
                                FROM
                                    billing.edi_file_payments
                                WHERE edi_file_id = ${params.file_id} AND payment_id = ${params.id}
                            ),
                            edi_file_payments AS (
                                INSERT INTO billing.edi_file_payments
                                    (   edi_file_id
                                        ,payment_id
                                    )
                                    SELECT
                                        ${params.file_id}
                                        ,${params.id}
                                    WHERE NOT EXISTS ( SELECT id FROM is_payment_exists )
                                RETURNING id
                            ),
                            update_edi_file AS (
                                UPDATE billing.edi_files
                                SET
                                    status = 'in_progress'
                                WHERE id = ${params.file_id}
                                AND EXISTS ( SELECT * FROM edi_file_payments )
                            )
                        SELECT * FROM  edi_file_payments `;

        return await query(sql);
    },

    getDefaultPayer: async function () {

        const sql = SQL` SELECT
                            insurance_provider_id
                         FROM
                            billing.insurance_provider_details WHERE is_default_payer`;

        return await query(sql);
    },

    createPaymentApplication: async function (params, paymentDetails) {

        let {
            lineItems
            , claimComments
            , audit_details
        } = params;

        const sql = SQL` WITH
                        application_details AS (
                            SELECT
                                *
                            FROM json_to_recordset(${JSON.stringify(lineItems)}) AS (
                                claim_number bigint
                                ,charge_id bigint
                                ,payment money
                                ,adjustment money
                                ,cpt_code text
                                ,patient_fname text
                                ,patient_lname text
                                ,patient_mname text
                                ,patient_prefix text
                                ,patient_suffix text
                                ,original_reference text
                                ,cas_details jsonb
                                ,claim_status_code bigint
                                ,service_date date
                                ,index integer
                                ,duplicate boolean
                                ,code text
                                ,is_debit boolean
                                ,claim_index bigint
                                ,claim_status text
                            )
                        )
                        ,un_matched_charges AS (
                            SELECT
                                application_details.claim_number AS claim_id,
                                application_details.claim_status_code,
                                application_details.original_reference,
                                application_details.service_date,
                                application_details.code,
                                billing.get_era_charge_id(application_details.claim_number, application_details.cpt_code, application_details.duplicate, application_details.index) as charge_id,
                                application_details.payment,
                                application_details.adjustment,
                                application_details.cas_details,
                                application_details.is_debit,
                                application_details.patient_fname,
                                application_details.patient_lname,
                                application_details.patient_mname,
                                application_details.patient_prefix,
                                application_details.patient_suffix,
                                application_details.claim_index,
                                application_details.claim_status,
                                c.claim_status_id,
                                c.patient_id,
                                cs.code AS claim_payment_status
                            FROM
                                application_details
                            INNER JOIN billing.claims c on c.id = application_details.claim_number
                            LEFT JOIN billing.claim_status cs ON cs.id = c.claim_status_id
                            WHERE application_details.charge_id NOT IN ( SELECT id FROM billing.charges WHERE claim_id = application_details.claim_number )
                        )
                        ,matched_charges AS (
                            SELECT
                                application_details.claim_number AS claim_id,
                                application_details.claim_status_code,
                                application_details.original_reference,
                                application_details.service_date,
                                application_details.code,
                                application_details.charge_id,
                                application_details.payment,
                                application_details.adjustment,
                                application_details.cas_details,
                                application_details.is_debit,
                                application_details.patient_fname,
                                application_details.patient_lname,
                                application_details.patient_mname,
                                application_details.patient_prefix,
                                application_details.patient_suffix,
                                application_details.claim_index,
                                application_details.claim_status,
                                c.claim_status_id,
                                c.patient_id,
                                cs.code AS claim_payment_status
                            FROM
                                application_details
                            INNER JOIN billing.claims c on c.id = application_details.claim_number
                            INNER JOIN billing.charges ch on ch.id = application_details.charge_id AND ch.claim_id = application_details.claim_number
                            LEFT JOIN billing.claim_status cs ON cs.id = c.claim_status_id
                        )
                        ,final_claim_charges AS (
                            SELECT * FROM matched_charges
                                UNION ALL
                            SELECT * FROM un_matched_charges
                        )
                        ,matched_claims AS (
                            SELECT
                                fcc.claim_id,
                                fcc.claim_status_code,
                                fcc.payment,
                                fcc.original_reference,
                                fcc.service_date,
                                fcc.code,
                                fcc.claim_status,
                                fcc.claim_status_id,
                                json_build_object(
                                    'payment'       ,fcc.payment,
                                    'charge_id'     ,fcc.charge_id,
                                    'adjustment'    ,fcc.adjustment,
                                    'cas_details'   ,fcc.cas_details,
                                    'applied_dt'    ,CASE WHEN fcc.is_debit
                                    THEN now() + INTERVAL '0.02' SECOND * fcc.claim_index
                                    ELSE now() + INTERVAL '0.01' SECOND * fcc.claim_index
                                    END
                                )
                            FROM
                                final_claim_charges fcc
                            INNER JOIN public.patients p on p.id = fcc.patient_id
                            INNER JOIN billing.charges ch on ch.id = fcc.charge_id
                            WHERE
                                (   CASE
                                    WHEN 'OHIP_EOB' = ${paymentDetails.from} AND fcc.claim_payment_status = 'PP' THEN true
                                    WHEN fcc.patient_lname != '' AND 'OHIP_EOB' != ${paymentDetails.from}
                                    THEN lower(p.last_name) = lower(fcc.patient_lname)
                                        ELSE '0'
                                    END
                                )
                        ),
                        insert_payment_adjustment AS (
                            SELECT
                                matched_claims.claim_id
                                ,matched_claims.claim_status_code
                                ,billing.create_payment_applications(
                                    ${paymentDetails.id}
                                    ,( SELECT id FROM billing.adjustment_codes WHERE code = matched_claims.code ORDER BY id ASC LIMIT 1 )
                                    ,${paymentDetails.created_by}
                                    ,json_build_array(matched_claims.json_build_object)::jsonb
                                    ,(${JSON.stringify(audit_details)})::jsonb
                                )
                            FROM
                                matched_claims
                            ORDER BY matched_claims.claim_id ASC
                        )
                        ,update_payment AS (
                           UPDATE billing.payments
                            SET
                                notes =  notes || E'\n' || 'Amount received for matching orders : ' || ( SELECT COALESCE(sum(payment),'0')::numeric FROM matched_claims ) || E'\n\n' || ${paymentDetails.messageText}
                            WHERE id = ${paymentDetails.id}
                            AND ${paymentDetails.from} IN ('EOB', 'OHIP_EOB')
                        )
                        ,insert_claim_comments AS (
                            INSERT INTO billing.claim_comments
                            (
                                claim_id
                                ,note
                                ,type
                                ,created_by
                                ,created_dt
                            )
                            SELECT
                                claim_number
                                ,note
                                ,type
                                ,${paymentDetails.created_by}
                                ,'now()'
                            FROM
                                json_to_recordset(${JSON.stringify(claimComments)}) AS claim_notes
                                (
                                    claim_number bigint
                                    ,note text
                                    ,type text
                                )
                            WHERE EXISTS ( SELECT claim_id FROM matched_claims WHERE claim_id = claim_notes.claim_number LIMIT 1 )
                            RETURNING id AS claim_comment_id
                        ),
                        update_claim_status_and_payer AS (
                            SELECT
                                DISTINCT claim_id
                                ,billing.update_claim_responsible_party(claim_id, claim_status_code, ${paymentDetails.company_id}, original_reference, 0, false, ${paymentDetails.id}, null)
                            FROM
                                matched_claims
                            INNER JOIN billing.get_claim_totals(matched_claims.claim_id) bgct ON TRUE
                            WHERE
                                ${paymentDetails.from} NOT IN ('TOS_PAYMENT', 'OHIP_EOB')
                                AND ('patient' != ${paymentDetails.payer_type} OR bgct.claim_balance_total = 0::MONEY)
                        )
                        ------------------------------------------------------------
                        -- This query triggred only for OHIP process
                        ------------------------------------------------------------
                        ,update_claim_status AS (
                            UPDATE billing.claims
                                SET
                                claim_status_id =
                                (
                                    CASE
                                        WHEN claim_details.claim_balance_total = 0::money
                                            THEN ( SELECT COALESCE(id, mc.claim_status_id ) FROM billing.claim_status WHERE company_id = ${paymentDetails.company_id} AND code = 'PIF' AND inactivated_dt IS NULL )
                                        WHEN claim_details.claim_balance_total < 0::money
                                            THEN ( SELECT COALESCE(id, mc.claim_status_id ) FROM billing.claim_status WHERE company_id = ${paymentDetails.company_id} AND code = 'OP' AND inactivated_dt IS NULL )
                                        WHEN '0'::MONEY IN (SELECT payment FROM matched_claims mc WHERE mc.claim_id = billing.claims.id)
                                            THEN (SELECT COALESCE(id, mc.claim_status_id) FROM billing.claim_status WHERE company_id = ${paymentDetails.company_id} AND code = 'D' AND inactivated_dt IS NULL)
                                        WHEN claim_details.claim_balance_total > 0::money
                                            THEN ( SELECT COALESCE(id, mc.claim_status_id ) FROM billing.claim_status WHERE company_id = ${paymentDetails.company_id} AND code = 'PAP' AND inactivated_dt IS NULL )
                                    ELSE
                                        mc.claim_status_id
                                    END
                                )
                            FROM matched_claims mc
                            INNER JOIN billing.get_claim_totals(mc.claim_id) claim_details ON TRUE
                            WHERE billing.claims.id = mc.claim_id
                                AND 'OHIP_EOB' = ${paymentDetails.from}
                            RETURNING id as claim_id
                        )
                        SELECT
                        ( SELECT json_agg(row_to_json(insert_payment_adjustment)) insert_payment_adjustment
                                    FROM (
                                            SELECT
                                                    *
                                            FROM
                                                insert_payment_adjustment

                                        ) AS insert_payment_adjustment
                        ) AS insert_payment_adjustment
                        ,(
                            SELECT
                                array_agg(claim_id)
                            FROM
                                update_claim_status_and_payer
                            )  AS update_claim_status_and_payer
                        ,(
                            SELECT
                                array_agg(claim_id)
                            FROM
                                update_claim_status
                        )  AS update_claim_status
                        `;
        return await query(sql);
    },

    applyPaymentApplication: async function (audit_details, params) {
        let {
            file_id,
            created_by,
            code
        } = params;

        const sql = SQL`
                    WITH claim_payment AS (
                            SELECT
                                 ch.claim_id
                                ,efp.payment_id
                                ,pa.applied_dt
                            FROM
                                billing.charges AS ch
                            INNER JOIN billing.payment_applications AS pa ON pa.charge_id = ch.id
                            INNER JOIN billing.payments AS p ON pa.payment_id  = p.id
                            INNER JOIN billing.edi_file_payments AS efp ON pa.payment_id = efp.payment_id
                            WHERE efp.edi_file_id = ${file_id}  AND mode = 'eft'
                            GROUP BY ch.claim_id, efp.payment_id, pa.applied_dt
                            ORDER BY pa.applied_dt DESC
                    )
                    ,unapplied_charges AS (
                        SELECT cp.payment_id,
                            json_build_object('charge_id',ch.id,'payment',0,'adjustment',0,'cas_details','[]'::jsonb,'applied_dt',cp.applied_dt)
                        FROM
                            billing.charges ch
                        INNER JOIN billing.claims AS c ON ch.claim_id = c.id
                        INNER JOIN claim_payment AS cp ON cp.claim_id = c.id
                        WHERE ch.id NOT IN ( SELECT charge_id FROM  billing.payment_applications pa WHERE pa.charge_id = ch.id AND pa.payment_id = cp.payment_id AND pa.applied_dt = cp.applied_dt )
                    ),insert_payment_adjustment AS (
                        SELECT
                            billing.create_payment_applications(
                                uc.payment_id
                                ,( SELECT id FROM billing.adjustment_codes WHERE code = ${code} ORDER BY id ASC LIMIT 1 )
                                ,${created_by}
                                ,json_build_array(uc.json_build_object)::jsonb
                                ,(${audit_details})::jsonb
                            )
                        FROM
                            unapplied_charges uc
                    )
                    SELECT * FROM insert_payment_adjustment `;

        return await query(sql);
    },

    isProcessed: async function (file_md5, company_id) {
        const sql = `

            WITH upload_info AS
                (
                    SELECT Json_agg(file_exists) file_exists
                    FROM   (
                        SELECT
                            EXISTS(
                                SELECT 1
                                    FROM
                                        billing.edi_files
                                    WHERE
                                file_md5 = '${file_md5}'
                            )
                        AS file_exists
                )
                    AS file_exists ),
            file_store_info AS(
                SELECT Json_agg(Row_to_json(file_store_info)) file_store_info
                    FROM(
                        Select
                            root_directory,
                            companies.file_store_id
                        FROM
                            file_stores
                            LEFT JOIN companies ON companies.file_store_id = file_stores.id
                        WHERE
                            companies.id = ${company_id}
                        )
                    AS file_store_info)
            SELECT *
                FROM
                    upload_info,
                    file_store_info
        `;

        return await query(sql);
    },

    saveERAFile: async function (params) {
        let sql = `
            INSERT INTO
                billing.edi_files
                    (company_id,
                     file_store_id,
                     created_dt,
                     status,
                     file_type,
                     file_path,
                     file_size,
                     file_md5,
                     uploaded_file_name)
                     (
                        SELECT
                           ${params.company_id}
                         ,${params.file_store_id}
                         ,now()
                         ,'${params.status}'
                         ,'${params.file_type}'
                         ,'${params.file_path}'
                         , ${params.file_size}
                         ,'${params.file_md5}'
                         ,'${params.fileName}'
                        )
                        RETURNING id
        `;

        if(params.isEOB) {
            sql  = `WITH insert_edi_file AS (
                        ${sql}
                    ),
                    insert_edi_file_payments AS (
                        INSERT INTO
                            billing.edi_file_payments(
                                edi_file_id,
                                payment_id
                            )
                            SELECT
                                (SELECT id FROM insert_edi_file) AS edi_file_id,
                                    payment_id
                                FROM
                                    billing.edi_file_payments efp
                                WHERE efp.edi_file_id = ${params.id}
                                        RETURNING edi_file_id
                    )
                    SELECT edi_file_id AS id FROM insert_edi_file_payments
                    `;
        }

        return await query(sql);
    },

    getFileStorePath: async function (params) {
        const sql = `
                Select
                    root_directory
                FROM file_stores
                    LEFT JOIN companies ON companies.file_store_id = file_stores.id
                WHERE companies.id = ${params.company_id}
        `;

        return await query(sql);
    },

    getcasReasonGroupCodes: async function (params) {

        let { company_id } = params;

        const sql = ` SELECT
                        ( SELECT json_agg(row_to_json(cas_group_codes)) cas_group_codes
                                    FROM (
                                            SELECT
                                                id
                                                ,code
                                            FROM
                                                billing.cas_group_codes
                                            WHERE inactivated_dt IS NULL AND company_id = ${company_id}
                                        ) AS cas_group_codes
                        ) AS cas_group_codes,
                        ( SELECT json_agg(row_to_json(cas_reason_codes)) cas_reason_codes
                                    FROM (
                                            SELECT
                                                id
                                                ,code
                                            FROM
                                                billing.cas_reason_codes
                                            WHERE inactivated_dt IS NULL AND company_id = ${company_id}
                                        ) AS cas_reason_codes
                        ) AS cas_reason_codes `;

        return await query(sql);
    },

    getERAFilePathById: async function (params) {
        let {
            file_id,
            company_id
        } = params;

        const sql = `
                Select
                    ef.id
                    ,ef.status
                    ,ef.file_type
                    ,ef.file_path
                    ,fs.root_directory
                    ,ef.uploaded_file_name
                FROM
                    billing.edi_files ef
                INNER JOIN file_stores fs on fs.id = ef.file_store_id
                WHERE ef.id = ${file_id} AND ef.company_id = ${company_id}
        `;

        return await query(sql);
    },

    checkExistsERAPayment: async function (params) {

        const sql = SQL`SELECT
                            efp.payment_id AS id
                            ,p.created_by
                        FROM
                            billing.edi_file_payments efp
                        INNER JOIN billing.payments p ON p.id = efp.payment_id
                        WHERE edi_file_id = ${params.file_id} `;

        return await query(sql);

    },

    updateERAFileStatus: async function (params) {

        const sql = SQL` UPDATE billing.edi_files
                        SET
                            status = (
                                CASE
                                    WHEN EXISTS ( SELECT 1 FROM billing.edi_file_payments WHERE edi_file_id = ${params.file_id} ) THEN 'success'
                                    WHEN NOT EXISTS ( SELECT 1 FROM billing.edi_file_payments WHERE edi_file_id = ${params.file_id} ) THEN 'failure'
                                    ELSE
                                        'in_progress'
                                END
                            )
                        WHERE id = ${params.file_id}
                        RETURNING id, status `;

        return await query(sql);

    },

    getProcessedFileData: async function (params) {
        let {
            file_id
        } = params;

        const sql = SQL`
                    WITH
                        payer_details AS (
                            SELECT
                                pip.id,
                                pip.insurance_name,
                                pip.insurance_info->'PayerID' AS payer_id,
                                timezone(get_facility_tz(bp.facility_id::int),bp.payment_dt) AS payment_dt,
                                pip.insurance_info->'Address1' AS address1,
                                pip.insurance_info->'Address2' AS address2,
                                pip.insurance_info->'City' AS city,
                                pip.insurance_info->'State' AS state,
                                pip.insurance_info->'PhoneNo' AS phone_no,
                                pip.insurance_info->'ZipCode' AS zip,
                                fs.root_directory,
                                bef.id::text AS file_name,
                                bef.file_path
                            FROM billing.edi_files bef
                            INNER JOIN file_stores fs ON fs.id = bef.file_store_id
                            INNER JOIN billing.edi_file_payments befp ON befp.edi_file_id = bef.id
                            INNER JOIN billing.payments bp ON bp.id = befp.payment_id
                            INNER JOIN public.insurance_providers pip ON pip.id = bp.insurance_provider_id
                            WHERE bef.id = ${file_id} AND bp.mode = 'eft'
                            LIMIT 1
                        ),
                        charge_payments AS (
                            SELECT
                                bp.id AS payment_id,
                                bch.claim_id,
                                bpa.charge_id,
                                pcc.display_code AS cpt_decsription,
                                (bch.bill_fee * bch.units) AS bill_fee,
                                COALESCE(SUM(bpa.amount) FILTER (WHERE bpa.amount_type = 'payment'), 0::money) AS payments_applied,
                                COALESCE(SUM(bpa.amount) FILTER (WHERE bpa.amount_type = 'adjustment'), 0::money) AS adjustments_applied,
                                bpa.applied_dt
                            FROM billing.edi_files bef
                            INNER JOIN billing.edi_file_payments befp ON befp.edi_file_id = bef.id
                            INNER JOIN billing.payments bp ON bp.id = befp.payment_id
                            INNER JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
                            INNER JOIN billing.charges bch ON bch.id = bpa.charge_id
                            INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
                            INNER JOIN billing.claims ON claims.id = bch.claim_id
                            INNER JOIN patients ON patients.id = claims.patient_id
                            WHERE bef.id = ${file_id}
                            AND bch.claim_id IS NOT NULL
                            AND bp.mode = 'eft'
                            GROUP BY bpa.applied_dt, bpa.charge_id, bp.id, bch.claim_id, pcc.display_code, bch.bill_fee, bch.units
                            ORDER BY bp.id, bch.claim_id, bpa.applied_dt
                        ),
                        grouped_claim_payments AS (
                            SELECT
                                payment_id,
                                claim_id,
                                applied_dt,
                                SUM(payments_applied) AS tot_payments_applied,
                                SUM(adjustments_applied) AS tot_adjustments_applied,
                                SUM(bill_fee) AS tot_bill_fee
                            FROM charge_payments
                            GROUP BY payment_id, claim_id, applied_dt
                            ORDER BY payment_id
                        ),
                        processed_eob_payments AS(
                            SELECT
                                payment_id,
                                gcp.claim_id,
                                applied_dt,
                                cpp.*,
                                patients.id AS patient_id,
                                patients.account_no,
                                get_full_name (patients.last_name,patients.first_name) AS pat_name,
                                gcp.tot_payments_applied,
                                gcp.tot_adjustments_applied,
                                gcp.tot_bill_fee
                            FROM grouped_claim_payments gcp
                            INNER JOIN billing.claims ON claims.id = claim_id
                            INNER JOIN patients ON patients.id = claims.patient_id
                            LEFT JOIN LATERAL (
                                SELECT
                                    c.claim_id,
                                    json_agg(row_to_json(c.*)) AS charges
                                FROM charge_payments c
                                WHERE c.applied_dt = gcp.applied_dt
                                GROUP BY c.applied_dt, c.claim_id
                            ) cpp ON cpp.claim_id = gcp.claim_id
                            ORDER BY payment_id
                        )
                    SELECT
                        ( SELECT (row_to_json(payer_details.*)) AS payer_details FROM payer_details ),
                        ( SELECT json_agg(row_to_json(processed_eob_payments.*)) AS processed_eob_payments FROM processed_eob_payments )`;

        return await query(sql);

    },

    getEOBFileId: async (paymentID) => {
        let sql = SQL`SELECT
                        edi_files.id AS eob_file_id
                    FROM billing.edi_file_payments
                    INNER JOIN billing.edi_files ON edi_files.id = edi_file_payments.edi_file_id AND file_type = 'EOB'
                    WHERE edi_file_payments.payment_id = ${paymentID}`;

        return await query(sql);
    },

    /**
    * {@param} company_id
    * {@response} Returns file store for configured company
    */
    getCompanyFileStore: (company_id) => {
        const fileSql = SQL`
        SELECT
            fs.id AS file_store_id,
            fs.root_directory
        FROM file_stores fs
        INNER JOIN companies c ON c.file_store_id = fs.id
        WHERE c.id = ${company_id}`;

        return query(fileSql.text, fileSql.values);

    },

    getClearingHouseList: async (companyId) => {
        let sql = SQL`SELECT
                        id AS clearing_house_id,
                        code AS clearing_house_code,
                        name AS clearing_house_name,
                        era_file_ext AS era_file_extension,
                        jsonb_build_object(
                            'ftp_host', communication_info->>'ftp_host',
                            'ftp_port', communication_info->>'ftp_port',
                            'ftp_type', communication_info->>'ftp_type',
                            'enable_ftp', communication_info->>'enable_ftp',
                            'ftp_password', communication_info->>'ftp_password',
                            'ftp_user_name', communication_info->>'ftp_user_name',
                            'ftp_receive_folder', communication_info->>'ftp_receive_folder',
                            'era_file_extension', communication_info->>'sftp_era_file_ext',
                            'ftp_ready_timeout', communication_info->>'ftp_readyTimeout'
                        ) AS config
                    FROM billing.edi_clearinghouses
                    WHERE inactivated_dt IS NULL
                    AND company_id = ${companyId}
                    AND coalesce(communication_info->>'enable_ftp','false') = 'true' `;

        return await queryRows(sql);
    },

    getReportingCharges: async (args, payerId) => {
        let {
            patient_fname,
            patient_lname,
            patient_mname,
            patient_prefix,
            patient_suffix,
            payerClaimContorlNumber,
            claim_number,
            claimStatusCode,
            claim_index
        } = args;

        let sql = SQL`SELECT
                        DISTINCT(cc.display_code),
                        cc.display_code AS cpt_code,
                        bc.bill_fee,
                        bc.id AS charge_id,
                        bc.bill_fee AS adjustment,
                        0::MONEY AS payment,
                        ${patient_fname} AS patient_fname,
                        ${patient_lname} AS patient_lname,
                        ${patient_mname} AS patient_mname,
                        ${patient_prefix} AS patient_prefix,
                        false AS duplicate,
                        false AS is_debit,
                        null AS adjustment_code,
                        ${payerClaimContorlNumber} AS original_reference,
                        0 AS claim_status_code,
                        null AS cas_details,
                        null AS cas_total_amt,
                        ${patient_suffix} AS patient_suffix,
                        ${claimStatusCode} AS claimStatusCode,
                        ${claim_number} AS claim_number,
                        ${claim_index} AS claim_index
                    FROM billing.charges bc
                    INNER JOIN public.cpt_codes cc ON cc.id = bc.cpt_id
                    WHERE bc.claim_id = ${claim_number}
                    AND bc.bill_fee = '0.01'
                    AND NOT EXISTS (
                        SELECT
                            1
                        FROM billing.claims bcc
                        LEFT JOIN billing.claim_patient_insurances cpi ON cpi.claim_id = bcc.id
                        LEFT JOIN patient_insurances pi ON pi.id = cpi.patient_insurance_id
                        WHERE bcc.id = ${claim_number}
                        AND pi.insurance_provider_id = ${payerId}
                        AND cpi.coverage_level IN ('secondary', 'tertiary')
                    )`;
        return await queryRows(sql);
    }

};
