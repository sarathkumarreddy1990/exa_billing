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

    createEdiPayment: async function(params){

        const sql =SQL`WITH 
                            is_payment_exists AS (
                                SELECT 
                                    id
                                FROM 
                                    billing.edi_file_payments 
                                WHERE edi_file_id = ${params.file_id}
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

    createPaymentApplication: async function(params, paymentDetails){

        let {
            lineItems
            , ediFileClaims
            , claimComments
            , audit_details
        } = params;

        const sql =SQL` WITH application_details AS (
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
                                ,cas_details jsonb
                                ,claim_status_code bigint
                             )
                            ),
                           selected_Items AS (
                                SELECT 
                                    application_details.claim_number,
                                    application_details.claim_status_code,
                                    json_build_object(
                                        'charge_id',charges.id,
                                        'payment',application_details.payment,
                                        'adjustment',application_details.adjustment,
                                        'cas_details',application_details.cas_details)
                                FROM 
                                    application_details  
                                INNER JOIN billing.claims c on c.id = application_details.claim_number
                                INNER JOIN public.patients p on p.id = c.patient_id
                                INNER JOIN LATERAL (
                                    SELECT 
                                       ch.id
                                    FROM 
                                        billing.charges ch	
                                   INNER JOIN cpt_codes on cpt_codes.id = ch.cpt_id 
                                   WHERE 
                                    ch.claim_id = c.id 
                                    AND NOT cpt_codes.has_deleted 
                                    AND cpt_codes.is_active 
                                    AND (
                                        CASE 
                                          WHEN ( application_details.charge_id != 0 ) THEN application_details.charge_id = ch.id
                                          WHEN ( application_details.charge_id  = 0 AND application_details.cpt_code !='' ) THEN cpt_codes.display_code = application_details.cpt_code
                                        END
                                    )
                                    ORDER BY id ASC LIMIT 1
                                ) AS charges ON true
                                WHERE 
			                    	(   CASE 
                                        WHEN    ( application_details.patient_fname != '' ) 
			                    		    AND ( application_details.patient_lname != '' ) 
			                    		    AND ( CASE WHEN application_details.patient_mname  != ''  THEN p.middle_name = application_details.patient_mname  else '1' END) 
			                    		    AND ( CASE WHEN application_details.patient_prefix != ''  THEN p.prefix_name = application_details.patient_prefix else '1' END) 
			                    		    AND ( CASE WHEN application_details.patient_suffix != ''  THEN p.suffix_name = application_details.patient_suffix else '1' END) 
                                        THEN ( p.first_name = application_details.patient_fname AND p.last_name = application_details.patient_lname )
    			                    	    ELSE '0'
                                        END 
                                    )
                           ), 
                           insert_payment_adjustment AS (
                                SELECT
                                    selected_Items.claim_number
                                    ,selected_Items.claim_status_code
                                    ,billing.create_payment_applications(
                                        ${paymentDetails.id}
                                        ,( SELECT id FROM billing.adjustment_codes WHERE code ='ERA' ORDER BY id ASC LIMIT 1 )
                                        ,${paymentDetails.created_by}
                                        ,json_build_array(selected_Items.json_build_object)::jsonb
                                        ,(${JSON.stringify(audit_details)})::json
                                    )
                                FROM
	                                selected_Items
                            ),
                            inserted_claims AS ( 
                                SELECT 
                                    DISTINCT claim_number as claim_id
                                    ,claim_status_code
                                FROM 
                                    insert_payment_adjustment 
                            ),
                            ,matched_claim_payment AS (
                                SELECT
                                    sum(c.bill_fee * c.units)::numeric AS claim_bill_fee_total
                                    ,'Amount received for matching orders : ' || COALESCE(sum(c.bill_fee * c.units),'0')::numeric AS notes ||
                                FROM
                                    billing.charges AS c
                                    INNER JOIN inserted_claims ON inserted_claims.claim_id = c.claim_id
                                    INNER JOIN public.cpt_codes AS pc ON pc.id = c.cpt_id
                            )
                            ,update_payment AS (
                               UPDATE billing.payments
                                SET 
                                    amount = ( SELECT claim_bill_fee_total FROM matched_claim_payment ),
                                    notes =  notes || E'\n' || ( SELECT notes FROM matched_claim_payment ) || E'\n' || ${paymentDetails.id} || '.ERA'
                                WHERE id = ${paymentDetails.id}
                            )
                            insert_edi_file_claims AS (
                                INSERT INTO billing.edi_file_claims
                                (
                                    claim_id
                                    ,edi_file_id
                                )
                                SELECT 
                                    claim_number 
                                    ,edi_file_id
                                FROM 
                                    json_to_recordset(${JSON.stringify(ediFileClaims)}) AS edi_claims
                                    (
                                        claim_number bigint
                                        ,edi_file_id bigint
                                    )
                                INNER JOIN inserted_claims ic on ic.claim_id = edi_claims.claim_number
                                RETURNING claim_id, edi_file_id
                                ),
                            insert_claim_comments AS (
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
                                INNER JOIN inserted_claims ic on ic.claim_id = claim_notes.claim_number
                                RETURNING id AS claim_comment_id
                                ),
                                claim_details AS (
                                    SELECT
                                         bc.id as claim_id
                                        ,bc.claim_status_id
                                        ,inserted_claims.claim_status_code
                                        ,(SELECT charges_bill_fee_total::numeric from billing.get_claim_totals(bc.id)) AS bill_fee
                                        ,( SELECT adjustments_applied_total::numeric from billing.get_claim_totals(bc.id) ) AS adjustment
                                        ,( SELECT payments_applied_total::numeric from billing.get_claim_totals(bc.id) ) AS payment
                                        ,(SELECT (charges_bill_fee_total - (payments_applied_total + adjustments_applied_total))::numeric FROM billing.get_claim_totals(bc.id)) AS balance
                                    FROM billing.claims bc
                                        INNER JOIN inserted_claims ON inserted_claims.claim_id = bc.id
                                        INNER JOIN billing.charges bch ON bch.claim_id = bc.id 
                                        LEFT JOIN billing.payment_applications bpa ON bpa.charge_id  =  bch.id -- For getting applid and pending payments 
                                        LEFT JOIN billing.payments bp ON bp.id = bpa.payment_id 
                                    GROUP BY bc.id,bc.claim_status_id,inserted_claims.claim_status_code
                                ),
                                update_claim_status AS (

                                    UPDATE billing.claims
                                      SET claim_status_id = 
                                      ( 
                                        CASE WHEN claim_details.claim_status_code = 4 THEN ( SELECT COALESCE(id, claim_details.claim_status_id ) FROM billing.claim_status WHERE company_id = 1 AND code = 'DENIED' AND inactivated_dt IS NULL )
                                           ELSE
                                            CASE 
                                                WHEN claim_details.bill_fee = claim_details.adjustment AND claim_details.payment = 0.00
                                                    THEN ( SELECT COALESCE(id, claim_details.claim_status_id ) FROM billing.claim_status WHERE company_id = 1 AND code = 'DENIED' AND inactivated_dt IS NULL )
                                                WHEN claim_details.balance = 0.00
                                                    THEN ( SELECT COALESCE(id, claim_details.claim_status_id ) FROM billing.claim_status WHERE company_id = 1 AND code = 'PAIDFULL' AND inactivated_dt IS NULL )
                                                WHEN claim_details.balance < 0.00
                                                    THEN ( SELECT COALESCE(id, claim_details.claim_status_id ) FROM billing.claim_status WHERE company_id = 1 AND code = 'OVERPYMT' AND inactivated_dt IS NULL )
                                                WHEN claim_details.balance > 0.00
                                                    THEN ( SELECT COALESCE(id, claim_details.claim_status_id ) FROM billing.claim_status WHERE company_id = 1 AND code = 'PYMTPEN' AND inactivated_dt IS NULL )
                                                ELSE
                                                    claim_details.claim_status_id
                                            END
                                        END	
                                       )
                                    FROM 
                                        claim_details 
                                    WHERE claim_details.claim_id = billing.claims.id  
                                    RETURNING billing.claims.id, billing.claims.claim_status_id 
                                )
                            SELECT
	                            ( SELECT json_agg(row_to_json(insert_payment_adjustment)) insert_payment_adjustment
                                            FROM (
                                                    SELECT
                                                          *
                                                    FROM
                                                    insert_payment_adjustment
                                            
                                                ) AS insert_payment_adjustment
                                     ) AS insert_payment_adjustment,
	                            ( SELECT json_agg(row_to_json(insert_edi_file_claims)) insert_edi_file_claims
                                            FROM (
                                                    SELECT
                                                        claim_id as claim_number
                                                        ,edi_file_id
                                                        ,true AS applied
                                                    FROM
                                                    insert_edi_file_claims
                                            
                                                ) AS insert_edi_file_claims
                                ) AS insert_edi_file_claims
                            `;
        
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
                FROM 
                    billing.edi_files ef
                INNER JOIN file_stores fs on fs.id = ef.file_store_id
                WHERE ef.id = ${file_id} AND ef.company_id = ${company_id}
        `;
        
        return await query(sql); 
    },

    checkExistsERAPayment : async function(params){

        const sql =SQL`SELECT 
                            efp.payment_id AS id
                            ,p.created_by
                        FROM 
                            billing.edi_file_payments efp 
                        INNER JOIN billing.payments p ON p.id = efp.payment_id
                        WHERE edi_file_id = ${params.file_id} `;

        return await query(sql);
         
    }
};
