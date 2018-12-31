const { query, SQL } = require('./../index');
const moment = require('moment');

module.exports = {

    getPendingPayments: async function (params) {

        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' ASC';

        if (params.sortField == 'pp.full_name') {
            params.sortField = ' get_full_name(pp.last_name, pp.first_name) ';
        }

        let {
            claim_id,
            invoice_no,
            full_name,
            claim_date,
            account_no,
            display_description,
            billing_fee,
            balance,
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            isFromClaim,
            paymentID
        } = params;


        if (invoice_no) {
            whereQuery.push(` bc.invoice_no = '${invoice_no}'`);
        }

        if (claim_id) {
            whereQuery.push(`bc.id::text = '${claim_id}'::text`);
        }

        if (full_name) {
            whereQuery.push(` pp.full_name  ILIKE '%${full_name}%' `);
        }

        if (claim_date) {
            whereQuery.push(`to_facility_date(bc.facility_id, claim_dt) = '${claim_date}'::date`);
        }

        if (account_no) {
            whereQuery.push(` pp.account_no ='${account_no}'`);
        }

        if ((params.customArgs && params.customArgs.patientId && params.customArgs.patientId > 0) || params.customArgs && (params.customArgs.claimIdToSearch || params.customArgs.invoiceNoToSearch)) {
            if (display_description) {
                whereQuery.push(` display_code  ILIKE '%${display_description}%' `);
            }
        }

        if (billing_fee) {
            whereQuery.push(`(select charges_bill_fee_total from billing.get_claim_totals(bc.id))=${billing_fee}::money`);
        }

        if (balance) {
            whereQuery.push(`((SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) FROM billing.get_claim_totals(bc.id)) = ${balance}::money)`);
        }

        if (params.customArgs && params.customArgs.patientId && params.customArgs.patientId > 0) {

            const sql = SQL`
                    SELECT
                    bc.id AS claim_id,
                    bc.patient_id,
                    bc.facility_id,
                    bc.id,
                    bc.invoice_no,
                    get_full_name(pp.last_name,pp.first_name) AS full_name,
                    bc.claim_dt AS claim_date,
                    pp.account_no,
                    array_agg(pcc.display_code) AS display_description,
                    (SELECT charges_bill_fee_total from billing.get_claim_totals(bc.id)) AS billing_fee,
                    (SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total + refund_amount) FROM billing.get_claim_totals(bc.id)) AS balance,
                    COUNT(1) OVER (range unbounded preceding) AS total_records
                FROM billing.claims bc
                INNER JOIN public.patients pp on pp.id = bc.patient_id
                INNER JOIN billing.charges bch on bch.claim_id = bc.id
                INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id
            `;

            sql.append(SQL` WHERE bc.patient_id = ${params.customArgs.patientId}`);

            if (whereQuery.length) {
                sql.append(SQL` AND `);
            }

            if (whereQuery.length) {
                sql.append(whereQuery.join(' AND '));
            }

            sql.append(SQL` GROUP BY  bc.id, pp.last_name, pp.first_name,  pp.account_no`);

            if (sortField) {
                sql.append(` , ${sortField}  `);
            }

            sql.append(SQL` ORDER BY  `)
                .append(sortField)
                .append(' ')
                .append(sortOrder)
                .append(SQL` LIMIT ${pageSize}`)
                .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

            return await query(sql);
        }
        else if ((params.customArgs && (params.customArgs.claimIdToSearch || params.customArgs.invoiceNoToSearch)) || isFromClaim && paymentID == 0) {
            const sql = SQL`
                    SELECT
                        bc.id AS claim_id,
                        bc.patient_id,
                        bc.facility_id,
                        bc.id,
                        bc.invoice_no,
                        get_full_name(pp.last_name,pp.first_name) AS full_name,
                        claim_dt AS claim_date,
                        bc.claim_dt,
                        pp.account_no,
                        array_agg(pcc.display_code) AS display_description,
                        (SELECT charges_bill_fee_total from billing.get_claim_totals(bc.id)) AS billing_fee,
                        (SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total + refund_amount) FROM billing.get_claim_totals(bc.id)) AS balance,
                        COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM billing.claims bc
                    INNER JOIN public.patients pp on pp.id = bc.patient_id
                    INNER JOIN billing.charges bch on bch.claim_id = bc.id
                    INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id
            `;

            if (params.customArgs && params.customArgs.claimIdToSearch) {
                sql.append(SQL` WHERE bc.id = ${params.customArgs.claimIdToSearch} `);
            }

            if (params.customArgs && params.customArgs.invoiceNoToSearch) {
                sql.append(SQL` WHERE bc.invoice_no = ${params.customArgs.invoiceNoToSearch} `);
            }

            if (whereQuery.length) {
                sql.append(SQL` AND `);
            }

            if (whereQuery.length) {
                sql.append(whereQuery.join(' AND '));
            }

            sql.append(SQL` GROUP BY  bc.id, pp.last_name, pp.first_name,  pp.account_no`);

            if (sortField) {
                sql.append(` , ${sortField}  `);
            }

            if (!isFromClaim) {
                sql.append(SQL` ORDER BY  `)
                    .append(sortField)
                    .append(' ')
                    .append(sortOrder)
                    .append(SQL` LIMIT ${pageSize}`)
                    .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);
            }

            return await query(sql);
        }

        if (display_description) {
            whereQuery.push(` array_to_string(claim_totals.claim_cpt_description,',')  ILIKE '%${display_description}%' `);
        }

        let joinQuery = ' ';
        let paymentWhereQuery = ` WHERE NOT EXISTS (SELECT 1 FROM billing.payment_applications bpa
        INNER JOIN billing.payments bp ON bp.id = bpa.payment_id
        WHERE  bpa.charge_id = bch.id
        AND payment_id = ${params.customArgs.paymentID})
        AND (claim_totals.charges_bill_fee_total - (claim_totals.payments_applied_total + claim_totals.adjustments_applied_total + refund_amount)) > 0::money  `;

        paymentWhereQuery = params.customArgs.payerType == 'patient' ? paymentWhereQuery + ` AND bc.patient_id = ${params.customArgs.payerId} ` : paymentWhereQuery;
        paymentWhereQuery = params.customArgs.payerType == 'ordering_facility' ? paymentWhereQuery + ` AND bc.ordering_facility_id = ${params.customArgs.payerId}  AND bc.payer_type = 'ordering_facility'` : paymentWhereQuery;
        paymentWhereQuery = params.customArgs.payerType == 'ordering_provider' ? paymentWhereQuery + ` AND bc.referring_provider_contact_id = ${params.customArgs.payerId}  AND bc.payer_type = 'referring_provider'` : paymentWhereQuery;


        // let invoiceQuery = await this.checkInvoiceExists(params.customArgs.paymentID);

        // if (invoiceQuery.rows && invoiceQuery.rows.length && invoiceQuery.rows[0].invoice_no) {
        //     paymentWhereQuery += ` AND bc.invoice_no = '${ invoiceQuery.rows[0].invoice_no }'`;
        // }

        if (params.customArgs.payerType == 'insurance') {
            joinQuery = `
        LEFT  JOIN public.patient_insurances AS pip ON pip.id = CASE WHEN bc.payer_type = 'primary_insurance' THEN bc.primary_patient_insurance_id
                                                WHEN bc.payer_type = 'secondary_insurance' THEN bc.secondary_patient_insurance_id
                                                WHEN bc.payer_type = 'tertiary_insurance' THEN bc.tertiary_patient_insurance_id
                                        END`;

            paymentWhereQuery = paymentWhereQuery + ` AND pip.insurance_provider_id = ${params.customArgs.payerId} `;
        }

        const sql = SQL`SELECT
                    bc.id AS claim_id,
                    bc.patient_id,
                    bc.id,
                    bc.facility_id,
                    bc.invoice_no,
                    get_full_name(pp.last_name,pp.first_name) AS full_name,
                    claim_dt AS claim_date,
                    bc.claim_dt,
                    pp.account_no,

                    claim_totals.claim_cpt_description AS display_description,
                    claim_totals.charges_bill_fee_total as billing_fee,
                    claim_totals.charges_bill_fee_total - (claim_totals.payments_applied_total + claim_totals.adjustments_applied_total + refund_amount) AS balance,

                    COUNT(1) OVER (range unbounded preceding) AS total_records
                FROM billing.claims bc
                INNER JOIN LATERAL (SELECT * FROM billing.get_claim_totals(bc.id)) AS claim_totals ON true
                INNER JOIN public.patients pp on pp.id = bc.patient_id
                INNER JOIN billing.charges bch on bch.claim_id = bc.id `;

        sql.append(joinQuery);
        sql.append(paymentWhereQuery);

        if (whereQuery.length) {
            sql.append(SQL` AND `);
        }

        if (whereQuery.length) {
            sql.append(whereQuery.join(' AND '));
        }

        // sql.append(SQL` group by bc.id, bc.invoice_no, bc.claim_dt, pp.account_no, get_full_name(pp.last_name, pp.first_name) `)
        sql.append(SQL` ORDER BY  `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${params.pageSize} OFFSET ${((params.pageNo - 1) * params.pageSize)} `);

        return await query(sql);
    },

    checkInvoiceExists: async (paymentID) => {
        let sqlQry =
            SQL`
                SELECT
                    invoice_no
                FROM
                    billing.payments
                WHERE
                    id = ${paymentID}
        `;

        return await query(sqlQry);
    },

    getAppliedPayments: async function (params) {
        let whereQuery = [];
        let havingQuery = [];

        if (params.sortField == 'order_id_grid' || params.sortField == 'order_payment_ref') {
            params.sortField = 'bc.id';
        }

        params.sortOrder = params.sortOrder || ' ASC';
        let {
            invoice_no,
            order_id_grid,
            claim_id,
            full_name,
            bill_fee,
            patient_paid,
            others_paid,
            adjustment,
            this_adjustment,
            balance,
            display_description,
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            payment,
            payerType,
            claim_date,
            isFromClaim,
            paymentID,
            paymentApplicationId
        } = params;

        paymentID = isFromClaim && paymentID  || params.customArgs.paymentID;

        if (invoice_no) {
            whereQuery.push(` bc.invoice_no = '${invoice_no}'`);
        }

        if (order_id_grid) {
            whereQuery.push(` bc.id = '${order_id_grid}'`);
        }

        if (full_name) {
            whereQuery.push(` pp.full_name  ILIKE '%${full_name}%' `);
        }

        if (claim_id) {
            whereQuery.push(`bc.id::text = '${claim_id}'::text`);
        }

        if (display_description) {
            whereQuery.push(`(SELECT claim_cpt_description from billing.get_claim_totals(bc.id))::text  ILIKE '%${display_description}%' `);
        }

        if (bill_fee) {
            whereQuery.push(` (SELECT charges_bill_fee_total from billing.get_claim_totals(bc.id)) = '${bill_fee}'::money`);
        }

        if (payment) {
            havingQuery.push(`  COALESCE(sum(bpa.amount) FILTER(where bpa.amount_type = 'payment'),0::money) = '${payment}'::money`);
        }

        if (this_adjustment) {
            havingQuery.push(` COALESCE(sum(bpa.amount) FILTER(where bpa.amount_type = 'adjustment'), 0::money) = '${this_adjustment}'::money`);
        }

        if (patient_paid) {
            whereQuery.push(` (SELECT patient_paid FROM billing.get_claim_patient_other_payment(bc.id)) = '${patient_paid}'::money`);
        }

        if (others_paid) {
            whereQuery.push(` (SELECT others_paid FROM billing.get_claim_patient_other_payment(bc.id)) = '${others_paid}'::money`);
        }

        if (adjustment) {
            havingQuery.push(`((SELECT adjustments_applied_total from billing.get_claim_totals(bc.id)) - COALESCE(sum(bpa.amount) FILTER(where bpa.amount_type = 'adjustment'),0::money)) = (${adjustment})::money`);
        }

        if (balance) {
            whereQuery.push(`((SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total + refund_amount) from billing.get_claim_totals(bc.id)) = (${balance})::money)`);
        }

        if (claim_date) {
            whereQuery.push(`to_facility_date(bc.facility_id, claim_dt) = '${claim_date}'::date`);
        }

        let sql =SQL` SELECT
                ROW_NUMBER () OVER (ORDER BY bc.id) as id,
                bc.id AS claim_id,
                bc.invoice_no,
                get_full_name(pp.last_name,pp.first_name) AS full_name,
                bc.claim_dt AS claim_date,
                max(bpa.id) AS payment_application_id,
                CASE WHEN 'patient' = ${payerType} THEN
                    gcp_other_payment.patient_paid -  COALESCE(sum(bpa.amount) FILTER(where bpa.amount_type = 'payment'),0::money)
                ELSE
                    gcp_other_payment.patient_paid
                END AS patient_paid,
                CASE WHEN 'patient' != ${payerType} THEN
                    gcp_other_payment.others_paid -  COALESCE(sum(bpa.amount) FILTER(where bpa.amount_type = 'payment'),0::money)
                ELSE
                    gcp_other_payment.others_paid
                END AS others_paid,
                COALESCE(sum(bpa.amount) FILTER(where bpa.amount_type = 'adjustment'),0::money) AS this_adjustment,
                COALESCE(sum(bpa.amount) FILTER(where bpa.amount_type = 'payment'),0::money) AS payment,
                gct.adjustments_applied_total - COALESCE(sum(bpa.amount) FILTER(where bpa.amount_type = 'adjustment'),0::money) AS adjustment,
                gct.charges_bill_fee_total AS bill_fee,
                gct.claim_cpt_description as display_description,
                gct.balance,
                COUNT(1) OVER (range unbounded preceding) AS total_records `;

        if (isFromClaim && paymentApplicationId) {
            sql.append(SQL` ,( SELECT xmin AS payment_row_version FROM billing.payments WHERE id = ${paymentID} ) `);
            whereQuery.push(`bpa.id = ${paymentApplicationId}`);
        }

        sql.append(SQL`
            FROM billing.payments bp
                INNER JOIN billing.payment_applications bpa on bpa.payment_id = bp.id
                INNER JOIN billing.charges bch on bch.id = bpa.charge_id
                INNER JOIN billing.claims bc on bc.id = bch.claim_id
                INNER JOIN public.patients pp on pp.id = bc.patient_id
                INNER JOIN LATERAL (
                    SELECT
                        claim_cpt_description,
                        adjustments_applied_total,
                        charges_bill_fee_total,
                        charges_bill_fee_total - (payments_applied_total + adjustments_applied_total + refund_amount) as balance
                    FROM
                        billing.get_claim_totals(bc.id)
                ) AS gct ON TRUE
                INNER JOIN LATERAL (
                    SELECT
                        patient_paid,
                        others_paid
                    FROM
                        billing.get_claim_patient_other_payment(bc.id)
                ) AS gcp_other_payment ON TRUE
        `);

        whereQuery.push(` bp.id = ${paymentID} `);

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        sql.append(SQL`GROUP BY bc.id, bc.invoice_no, get_full_name(pp.last_name,pp.first_name), bc.claim_dt, bpa.applied_dt, display_description, balance, adjustments_applied_total, charges_bill_fee_total, patient_paid, others_paid `);

        if (havingQuery.length) {
            sql.append(SQL` HAVING `)
                .append(havingQuery.join(' AND '));
        }

        if (!isFromClaim) {
            sql.append(SQL` ORDER BY  `)
                .append(sortField)
                .append(' ')
                .append(sortOrder)
                .append(SQL` LIMIT ${pageSize}`)
                .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);
        }

        return await query(sql);
    },

    getClaimBasedCharges: async function (params) {
        let joinQuery = '';
        let selectQuery = ' ';
        let groupByQuery = '';

        if (params.paymentStatus && params.paymentStatus == 'applied') {
            joinQuery = `INNER JOIN billing.get_payment_applications(${params.paymentId},${params.paymentApplicationId}) ppa ON ppa.charge_id = bch.id `;
            selectQuery = ' , ppa.id AS payment_application_id,ppa.adjustment_code_id AS adjustment_code_id,ppa.payment_amount::numeric AS payment_amount,ppa.adjustment_amount::numeric AS adjustment_amount , ppa.payment_application_adjustment_id as adjustment_id, ppa.payment_applied_dt AS payment_applied_dt';
            groupByQuery = ', ppa.payment_id , ppa.id,ppa.adjustment_code_id, ppa.payment_amount,ppa.adjustment_amount , ppa.payment_application_adjustment_id,ppa.payment_applied_dt ';
        }

        return await query(`
        WITH payer_types AS
        (
            SELECT Json_agg(Row_to_json(payer_types)) payer_types
                FROM   (
                    SELECT bc.patient_id,
                            bc.facility_id,
                            bc.billing_notes,
                            bc.primary_patient_insurance_id AS primary,
                            bc.secondary_patient_insurance_id AS secondary,
                            bc.tertiary_patient_insurance_id AS tertiary,

                            bc.ordering_facility_id AS order_facility_id,
                            bc.referring_provider_contact_id,
                            payer_type ,
                            patients.full_name AS patient_name,
                            facilities.facility_name AS facility_name,

                            pips.insurance_name AS primary_ins_provider_name,
                            pips.insurance_code AS primary_ins_provider_code,

                            sips.insurance_name AS secondary_ins_provider_name,
                            sips.insurance_code AS secondary_ins_provider_code,

                            tips.insurance_name AS tertiary_ins_provider_name,
                            tips.insurance_code AS tertiary_ins_provider_code,

                            provider_groups.group_name AS ordering_facility_name,
                            providers.full_name AS provider_name,
                            bc.claim_status_id
                    FROM billing.claims bc
                        LEFT JOIN public.patients ON patients.id = bc.patient_id
                        LEFT JOIN public.facilities ON facilities.id = bc.facility_id

                        LEFT  JOIN public.patient_insurances AS pip ON pip.id = bc.primary_patient_insurance_id
                        LEFT  JOIN public.patient_insurances AS sip ON sip.id = bc.secondary_patient_insurance_id
                        LEFT  JOIN public.patient_insurances AS tip ON tip.id = bc.tertiary_patient_insurance_id

                        LEFT JOIN public.insurance_providers pips ON pips.id = pip.insurance_provider_id
                        LEFT JOIN public.insurance_providers sips ON sips.id = sip.insurance_provider_id
                        LEFT JOIN public.insurance_providers tips ON tips.id = tip.insurance_provider_id

                        LEFT JOIN provider_groups ON provider_groups.id = bc.ordering_facility_id
                        LEFT JOIN public.providers ON providers.id = bc.referring_provider_contact_id
                    WHERE bc.id =  ${params.claimId}
                        )
                AS payer_types ),
                    adjustment_codes AS(
                        SELECT Json_agg(Row_to_json(adjustment_codes)) adjustment_codes
                            FROM  (
                                SELECT
                                    id,
                                    code,
                                    description,
                                    accounting_entry_type ,
                                    accounting_entry_type AS type
                            FROM billing.adjustment_codes
                            WHERE company_id = ${params.companyID}
                                AND inactivated_dt IS NULL
                            )
                    AS adjustment_codes),
                charges AS(
                SELECT Json_agg(Row_to_json(charges)) charges
                    FROM  (
                        SELECT
                            bch.id,
                            (bch.bill_fee * bch.units)::NUMERIC AS bill_fee,
                            (bch.allowed_amount * bch.units)::NUMERIC AS allowed_amount,
                            (select other_payment FROM billing.get_charge_other_payment_adjustment(bch.id))::numeric AS other_payment,
                            (select other_adjustment FROM billing.get_charge_other_payment_adjustment(bch.id))::numeric AS other_adjustment,
                            bch.charge_dt,
                            array_agg(pcc.short_description) as cpt_description,
                            array_agg(pcc.display_code) as cpt_code
                            ${selectQuery}
                        FROM billing.charges bch
                        INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id
                        ${joinQuery}
                        WHERE bch.claim_id = ${params.claimId}
                        GROUP BY bch.id ${groupByQuery}
                )
                AS charges)
                    SELECT *
                        FROM
                        payer_types,
                        adjustment_codes,
                        charges
                 `
        );
    },

    getGroupCodesAndReasonCodes: async function (params) {

        const sql =  SQL`
        WITH cte_cas_group_codes AS
        (
            SELECT Json_agg(Row_to_json(cas_group_codes)) cas_group_codes
                FROM   (
                    SELECT
                    id,
                    code,
                    name,
                    description
                    FROM billing.cas_group_codes
                WHERE company_id =  ${params.companyID}
                    AND inactivated_dt IS NULL
                    )
            AS cas_group_codes ),
                 cte_cas_reason_codes AS(
            SELECT Json_agg(Row_to_json(cas_reason_codes)) cas_reason_codes
                FROM  (
                    SELECT
                        id,
                        code,
                        description
                        FROM billing.cas_reason_codes
                    WHERE company_id = ${params.companyID}
                        AND inactivated_dt IS NULL
                    ORDER BY regexp_replace(code, '^([^[:digit:]]*).*$', '\\1'),
                             regexp_replace(code, '^.*?([[:digit:]]*)$', '\\1')::bigint
                        )
                    AS cas_reason_codes)
            SELECT *
                FROM
                cte_cas_group_codes,
                cte_cas_reason_codes`;

        return await query(sql);
    },

    getPayemntApplications: async function (params) {
        return await query(
            `
                SELECT
                    id,
                    cas_group_code_id,
                    cas_reason_code_id,
                    amount
                FROM
                    billing.cas_payment_application_details
                WHERE
                payment_application_id = ${params.paymentApplicationId}
            `
        );
    },

    filterPatients: function (filter) {
        const f = filter.fields || {};
        const filter_from = ['advanced', 'physician_portal', 'ordering_facility', 'payments'];
        const showOwner = filter.showOwner === 'true';

        filter.joinQuery = showOwner ? '\nLEFT OUTER JOIN owners ON patients.owner_id = owners.id' : '';

        if (!filter.fromPTSL) {
            if (filter_from.includes(filter.patientFlag)) {
                filter.filterQuery += ` AND patients.has_deleted = false AND patients.id ${filter.symbol} ${filter.searchId} AND patients.company_id = ${filter.company_id}`;
            } else {
                filter.filterQuery = ` WHERE patients.has_deleted = false AND patients.id ${filter.symbol} ${filter.searchId} AND patients.company_id = ${filter.company_id}`;
            }
        } else {
            filter.filterQuery = ` WHERE patients.has_deleted = false AND patients.company_id = ${filter.company_id}`;
        }

        if (filter.showInactive === 'false') {
            filter.filterQuery += ' AND patients.is_active = true ';
        }

        if (filter.facility_id && filter.facility_id > 0) {
            filter.filterQuery += ` AND patients.facility_id = ${filter.facility_id} `;
        }

        if (f.lname) {
            filter.filterQuery += ` AND ${this.buildPatientSearchQuery((showOwner ? 'owners.' : 'patients.') + 'last_name', f.lname, false, filter.type)} `;
        }

        if (f.fname) {
            filter.filterQuery += ` AND ${this.buildPatientSearchQuery((showOwner ? 'owners.' : 'patients.') + 'first_name', f.fname, false, filter.type)} `;
        }

        if (f.dob) {
            const birthDay = moment(new Date(f.dob));

            if (birthDay.isValid()) {
                filter.filterQuery += ` AND patients.birth_date = '${birthDay.format('YYYY-MM-DD')}' ::date `;
            }
        }

        if (f.mrn) {
            filter.filterQuery += ` AND (${this.buildPatientSearchQuery('account_no', f.mrn, false, filter.type)}`;
            filter.filterQuery += ` OR ${this.buildPatientSearchQuery('alt_account_no', f.mrn, false, filter.type)}`;
            filter.filterQuery += ` OR ${this.buildPatientSearchQuery('dicom_patient_id', f.mrn, false, filter.type)}) `;
        }

        if (f.ssn) {
            filter.filterQuery += ` AND patient_info -> ${this.buildPatientSearchQuery('ssn', f.ssn, true, filter.type)} `;
        }

        if (f.phone) {
            if (showOwner) {
                filter.filterQuery += ` AND owner_info -> ${this.buildPatientSearchQuery('owner_phoneNo', f.phone, true, filter.type)} `;
            }
            else {
                filter.filterQuery += ` AND (patient_info -> ${this.buildPatientSearchQuery('c1HomePhone', f.phone, true, filter.type)} `;
                filter.filterQuery += ` OR patient_info -> ${this.buildPatientSearchQuery('c1WorkPhone', f.phone, true, filter.type)} `;
                filter.filterQuery += ` OR patient_info -> ${this.buildPatientSearchQuery('c1MobilePhone', f.phone, true, filter.type)}) `;
            }
        }

        if (f.address) {
            if (showOwner) {
                filter.filterQuery += ` AND (owner_info -> ${this.buildPatientSearchQuery('owner_address1', f.address, true, filter.type)}) `;
            }
            else {
                filter.filterQuery += ` AND (patient_info -> ${this.buildPatientSearchQuery('c1AddressLine1', f.address, true, filter.type)} `;
                filter.filterQuery += ` OR patient_info -> ${this.buildPatientSearchQuery('c2AddressLine1', f.address, true, filter.type)}) `;
            }
        }

        if (f.zip) {
            if (showOwner) {
                filter.filterQuery += ` AND (owner_info -> ${this.buildPatientSearchQuery('owner_zip', f.zip, true, filter.type)}) `;
            }
            else {
                filter.filterQuery += ` AND (patient_info -> ${this.buildPatientSearchQuery('c1Zip', f.zip, true, filter.type)} `;
                filter.filterQuery += ` OR patient_info -> ${this.buildPatientSearchQuery('c2Zip', f.zip, true, filter.type)}) `;
            }
        }
    },

    getAll: async function (filter) {
        await this.filterPatients(filter);

        switch (filter.sortField) {
            case 'ssn':
                filter.sortField = 'patient_info->\'" + filter.sortField + "\'';
                break;
            case 'address':
                filter.sortField = 'patient_info->\'c1AddressLine1\'';
                break;
            case 'phone':
                filter.sortField = 'patient_info->\'c1HomePhone\'';
                break;
            case 'zip':
                filter.sortField = 'patient_info->\'c1Zip\'';
                break;
            case 'commPref':
                filter.sortField = 'patient_info->\'commPref\'';
                break;
            case 'age':
                filter.sortField = 'age(patients.birth_date)';
                break;
        }

        let sql = '';

        if (filter.showOwner == 'true') {
            sql = `SELECT alt_account_no,account_no,facility_id,patients.id,rcopia_id,dicom_patient_id,date_part('year',age(birth_date))as age,patients.first_name as first_name,patients.last_name as last_name,
                patients.has_deleted AS has_deleted,gender,patients.is_active as is_active,full_name,patients.owner_id,owner_info,owners.first_name as owner_first_name,owners.last_name as owner_last_name,
                patient_info,birth_date::text FROM (SELECT patients.id as patients_id FROM patients LEFT JOIN owners ON patients.owner_id = owners.id left join studies on patients.id = studies.patient_id  ${filter.filterQuery}
                GROUP BY patients.id ORDER BY ${filter.sortField}  ${filter.sortOrder}  LIMIT ${filter.pageSize} ) AS finalPatients INNER JOIN patients ON finalPatients.patients_id = patients.id ' +
                LEFT JOIN owners ON patients.owner_id = owners.id ORDER BY ${filter.sortField}  ${filter.sortOrder}`;
        }
        else {
            if (filter.fromPTSL) {
                sql = `
                SELECT
                    account_no,
                    alt_account_no,
                    gender,
                    facility_id,
                    patients.id,
                    rcopia_id,
                    date_part('year',age(birth_date)) as age,
                    dicom_patient_id,
                    first_name,
                    last_name,
                    has_deleted,
                    is_active,
                    get_full_name(
                        last_name,
                        first_name,
                        middle_name,
                        prefix_name,
                        suffix_name) AS full_name,
                    owner_id,
                    patient_info as more_info,
                    birth_date::text
                FROM patients
                ${filter.filterQuery}
                ORDER BY ${filter.sortField} ASC
                LIMIT ${filter.pageSize}
                OFFSET ${filter.pageSize * (filter.pageNo - 1)}
                `;
            } else {
                sql = `
                SELECT
                    account_no,
                    alt_account_no,
                    gender,
                    facility_id,
                    patients.id,
                    rcopia_id,
                    date_part('year',age(birth_date)) as age,
                    dicom_patient_id,
                    patients.first_name as first_name,
                    patients.last_name as last_name,
                    patients.has_deleted as has_deleted,
                    patients.is_active as is_active,
                    full_name,patients.owner_id,
                    patient_info as more_info,
                    birth_date::text
                FROM (
                    SELECT
                        distinct(patients.id) AS patients_id,
                        patients.last_name
                    FROM patients
                    LEFT JOIN orders ON orders.patient_id = patients.id
                    LEFT JOIN studies on patients.id = studies.patient_id
                    ${filter.filterQuery}
                    ORDER BY ${filter.sortField} ${filter.sortOrder}
                    LIMIT ${filter.pageSize}
                ) AS finalPatients
                INNER JOIN patients ON finalPatients.patients_id = patients.id
                ORDER BY ${filter.sortField} ${filter.sortOrder}
                `;
            }

            return await query(sql);
        }
    },

    getTotalPatients: async function (filter) {
        await this.filterPatients(filter);

        const sql = `
            SELECT
                  COUNT(DISTINCT patients.id) AS total_records
                , max(patients.id)            AS lastid
            FROM
                patients
                ${filter.joinQuery}
            ${filter.filterQuery}
            `;

        return await query(sql);
    },

    buildPatientSearchQuery: function (fieldname, fieldvalue, ishstore, searchType) {
        let likeQuery = '';
        fieldvalue = fieldvalue.replace(/'/g, '');

        switch (searchType) {
            case 'start':
                likeQuery = (ishstore) ? fieldname + ' ILIKE ' + fieldvalue + '%' : fieldname + ' ILIKE \'' + fieldvalue + '%\' ';
                break;
            case 'end':
                likeQuery = (ishstore) ? '\'' + fieldname + '\'' + ' ILIKE \'%' + fieldvalue + '\'' : fieldname + ' ILIKE \'%' + fieldvalue + '\'';
                break;
            default:
                likeQuery = (ishstore) ? '\'' + fieldname + '\'' + ' ILIKE \'%' + fieldvalue + '%\'' : fieldname + ' ILIKE \'%' + fieldvalue + '%\'';
                break;
        }

        return likeQuery;
    },

    getFeeDetails: async function (params) {

        let {
            paymentId,
            paymentApplicationId,
            claimId
        } = params;

        paymentApplicationId = paymentApplicationId || 0;

        return await query(
            `   with get_payment_details AS (
                SELECT
                    sum(bgpa.payment_amount) AS payment_amount,
                    sum(bgpa.adjustment_amount) AS adjustment_amount
                FROM billing.get_payment_applications(${paymentId},${paymentApplicationId}) bgpa
                INNER JOIN billing.charges bch on bch.id = bgpa.charge_id where bch.claim_id =  ${claimId}
               )
                SELECT
                    (SELECT charges_bill_fee_total from billing.get_claim_totals(bc.id)) AS bill_fee,
                    COALESCE(sum(bpa.amount) FILTER(where bp.payer_type = 'patient' and bpa.amount_type = 'payment'),0::money) AS patient_paid,
                    COALESCE(sum(bpa.amount) FILTER(where bp.payer_type != 'patient' and bpa.amount_type = 'payment'),0::money) AS others_paid,
                    (SELECT adjustments_applied_total from billing.get_claim_totals(bc.id)) AS total_adjustment,
                    (SELECT adjustment_amount from get_payment_details) AS adjustment,
                    (SELECT payment_amount from get_payment_details) AS payment,
                    (SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total + refund_amount) FROM billing.get_claim_totals(bc.id)) AS balance
                FROM billing.claims bc
                    INNER JOIN billing.charges bch ON bch.claim_id = bc.id
                    LEFT JOIN billing.payment_applications bpa ON bpa.charge_id  =  bch.id -- For getting applid and pending payments
                    LEFT JOIN billing.payments bp ON bp.id = bpa.payment_id
                WHERE bc.id = ${claimId}
                    GROUP BY bc.id
                    `
        );
    }

};
