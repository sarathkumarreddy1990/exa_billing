const { query, SQL } = require('./../index');

module.exports = {

    getEraFiles: async function (params) {

        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' ASC';
        params.sortField = params.sortField == 'id' ? ' edi_files.id ' : params.sortField;
        let {
            id,
            size,
            updated_date_time,
            current_status,
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            uploaded_file_name
        } = params;

        if (id) {
            whereQuery.push(` id = ${id} `);
        }

        if (uploaded_file_name) {
            whereQuery.push(` uploaded_file_name ILIKE '%${uploaded_file_name}%' `);
        }

        if (size) {
            whereQuery.push(` file_size = ${size}`);
        }

        if (updated_date_time) {
            whereQuery.push(` created_dt::date = '${updated_date_time}'::date`);
        }

        if (current_status) {
            whereQuery.push(` status = replace('${current_status}', '\\', '')`);
        }

        const sql = SQL`
            SELECT
                id,
                id AS file_name,
                file_store_id,
                created_dt AS updated_date_time,
                status AS current_status,
                file_type,
                file_path,
                file_size AS size,
                file_md5,
                uploaded_file_name,
                COUNT(1) OVER (range unbounded preceding) AS total_records
            FROM
                billing.edi_files
            WHERE
                company_id =  ${params.customArgs.companyID}

        `;

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
                             has_deleted = false AND
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
                                c.patient_id
                            FROM
                                application_details
                            INNER JOIN billing.claims c on c.id = application_details.claim_number
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
                                c.patient_id
                            FROM
                                application_details
                            INNER JOIN billing.claims c on c.id = application_details.claim_number
                            INNER JOIN billing.charges ch on ch.id = application_details.charge_id AND ch.claim_id = application_details.claim_number
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
                                    WHEN fcc.patient_lname != ''
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
                        )
                        ,update_payment AS (
                           UPDATE billing.payments
                            SET
                                amount = ( SELECT COALESCE(sum(payment),'0')::numeric FROM matched_claims ),
                                notes =  notes || E'\n' || 'Amount received for matching orders : ' || ( SELECT COALESCE(sum(payment),'0')::numeric FROM matched_claims ) || E'\n\n' || ${paymentDetails.uploaded_file_name}
                            WHERE id = ${paymentDetails.id}
                            AND 'EOB' = ${paymentDetails.isFrom}
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
                                    claim_id
                                    ,billing.change_responsible_party(claim_id, claim_status_code, ${paymentDetails.company_id}, original_reference, 0)
                                FROM
                                    matched_claims
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
                                DISTINCT ch.id AS charge_id
                                ,ch.claim_id
                                ,efp.payment_id
                                ,pa.applied_dt
                            FROM
                                billing.charges AS ch
                            INNER JOIN billing.payment_applications AS pa ON pa.charge_id = ch.id
                            INNER JOIN billing.payments AS p ON pa.payment_id  = p.id
                            INNER JOIN billing.edi_file_payments AS efp ON pa.payment_id = efp.payment_id
                            WHERE efp.edi_file_id = ${file_id}  AND mode = 'eft'
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
        const sql = `
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
                        WHERE id = ${params.file_id} `;

        return await query(sql);

    },

    getProcessedFileData: async function (params) {
        let {
            file_id
        } = params;

        const sql = SQL`

            WITH insurance_details AS(
                SELECT
                    bp.id as payment_id ,
                    pip.id ,
                    pip.insurance_name ,
                    pip.insurance_info->'PayerID' AS payer_id,
                    bp.payment_dt AS payment_dt,
                    pip.insurance_info->'Address1' AS address1,
                    pip.insurance_info->'Address2' AS address2,
                    pip.insurance_info->'City'  AS city,
                    pip.insurance_info->'State' AS state,
                    pip.insurance_info->'PhoneNo' AS phone_no,
                    pip.insurance_info->'ZipCode' AS zip,
				    fs.root_directory,
				    bef.id as file_name,
				    bef.file_path
                FROM
                    billing.edi_files bef
                    INNER JOIN file_stores fs on fs.id = bef.file_store_id
                    INNER JOIN billing.edi_file_payments befp ON befp.edi_file_id = bef.id
                    INNER JOIN billing.payments bp on bp.id = befp.payment_id
                    INNER JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
                    where bef.id = ${file_id} AND bp.mode = 'eft'
                ),
                charge_details AS (
                    (SELECT Json_agg(Row_to_json(chargeDetails)) "chargeDetails"
                    FROM
                   (
                    SELECT
                    bch.claim_id,
                    bch.charge_dt::date,
                    pcc.display_code AS cpt_decsription,
                    (bch.bill_fee * bch.units) AS bill_fee,
                    bpa.amount_type,
                    (bch.allowed_amount * bch.units) AS allowed_fee ,
                    (
                        SELECT
                         ('[' || modifier1.code || ',
                         ' || modifier2.code || ',
                         ' || modifier3.code ||  ',
                         ' || modifier4.code || ']')
                        FROM billing.charges
                        LEFT JOIN modifiers AS modifier1 on modifier1.id = modifier1_id
                        LEFT join modifiers AS modifier2 on modifier2.id = modifier2_id
                        LEFT join modifiers AS modifier3 on modifier3.id = modifier3_id
                        LEFT join modifiers AS modifier4 on modifier4.id = modifier4_id
                            WHERE charges.id = bpa.charge_id
                        ) as modifiers
                    FROM
                    billing.edi_files bef
                    LEFT JOIN billing.edi_file_payments befp ON befp.edi_file_id = bef.id
                    LEFT JOIN billing.payments bp on bp.id = befp.payment_id
                    --LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id

                    LEFT JOIN billing.payment_applications bpa on bpa.payment_id = bp .id
                    LEFT JOIN billing.charges bch on bch.id = bpa.charge_id
                    LEFT JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id

                    WHERE bef.id = ${file_id} AND bch.claim_id IS NOT NULL AND bp.mode = 'eft'
                ) AS chargeDetails )
                    ),
                claim_details AS (
                    (SELECT Json_agg(Row_to_json(claimsDetails)) "claimsDetails"
                     FROM
                    (  SELECT
                        patients.id,
                        patients.account_no,
                        get_full_name (patients.last_name,patients.first_name) AS pat_name,
                        claim_id
                        FROM
                        (
                            SELECT DISTINCT
                            bch.claim_id
                            FROM billing.edi_files
                            INNER JOIN billing.edi_file_payments efp on efp.edi_file_id  = edi_files.id
                            LEFT JOIN billing.payments pay on pay.id = efp.payment_id
                            LEFT  JOIN billing.payment_applications bpa on bpa.payment_id = pay.id
                            LEFT  JOIN billing.charges bch on bch.id = bpa.charge_id
                            where edi_files.id = ${file_id} AND pay.mode = 'eft'
                        ) AS claim_details

                        inner join billing.claims on claims.id = claim_details.claim_id
                        inner join patients on patients.id = claims.patient_id
                    ) AS claimsDetails      )
                )
                SELECT * FROM insurance_details, charge_details, claim_details
        `;

        return await query(sql);

    }
};
