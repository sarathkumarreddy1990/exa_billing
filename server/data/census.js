const { query, SQL } = require('./index');
const filterValidator = require('./filter-validator')();

module.exports = {

    getData: async (args) => {
        let sql;

        let {
            pageNo,
            isCount,
            pageSize,
            sortField,
            sortOrder,
            filterCol,
            filterData,
            customArgs: {
                orderingFacilityId
            } = {}
        } = args;

        const colModel = [
            {
                name: 'location',
                searchColumns: ['pofc.location'],
                searchFlag: '%'
            },
            {
                name: 'account_no',
                searchColumns: ['pp.account_no'],
                searchFlag: '%'
            },
            {
                name: 'accession_no',
                searchColumns: ['ps.accession_no'],
                searchFlag: '%'
            },
            {
                name: 'full_name',
                searchColumns: ['pp.full_name'],
                searchFlag: '%'
            },
            {
                name: 'study_dt',
                searchColumns: ['ps.study_dt'],
                searchFlag: 'date'
            },
            {
                name: 'study_description',
                searchColumns: ['ps.study_description'],
                searchFlag: '%'
            }
        ];

        let defaultWhere = " ps.study_status = 'APP' AND ps.deleted_dt IS NULL AND  pofc.billing_type = 'census' AND billed_status.id IS NULL ";

        if (orderingFacilityId) {
            defaultWhere += ` AND pof.id = ${orderingFacilityId} `;
        }

        args.filterQuery = await filterValidator.generateQuery(colModel, filterCol, filterData, {defaultwherefilter: defaultWhere});


        const joinQuery = `
        INNER JOIN patients pp ON pp.id = ps.patient_id
        INNER JOIN ordering_facility_contacts pofc ON pofc.id = ps.ordering_facility_contact_id
        INNER JOIN public.facilities pf ON pf.id = ps.facility_id
        INNER JOIN ordering_facilities pof ON pof.id = pofc.ordering_facility_id
        LEFT JOIN LATERAL (
            SELECT
                pst.approving_provider_id
            FROM public.study_transcriptions pst
            WHERE pst.study_id = ps.id
            LIMIT 1
        ) st_trans ON TRUE
        LEFT JOIN LATERAL (
            SELECT
                ppi.insurance_provider_id
            FROM public.order_patient_insurances opi
            INNER JOIN public.patient_insurances ppi ON ppi.id = opi.patient_insurance_id
            WHERE
                opi.order_id = ps.order_id
            AND opi.coverage_level = 'primary'
            AND (
                ppi.valid_to_date >= ps.study_dt
                OR ppi.valid_to_date IS NULL
            )
        ) order_ins ON TRUE
        LEFT JOIN LATERAL (
            SELECT
                ppi.insurance_provider_id
            FROM public.patient_insurances ppi
            WHERE
                ppi.patient_id = pp.id
            AND ppi.coverage_level = 'primary'
            AND (
                ppi.valid_to_date >= ps.study_dt
                OR ppi.valid_to_date IS NULL
            )
            ORDER BY ppi.id DESC
            LIMIT 1
        ) patient_ins ON TRUE
        LEFT JOIN LATERAL (
            SELECT
                pip.id AS claim_insurance_provider_id
            FROM public.insurance_providers pip
            WHERE pip.id = COALESCE(order_ins.insurance_provider_id, patient_ins.insurance_provider_id)::BIGINT
            AND pip.inactivated_dt IS NULL
        ) ins_prov_details ON TRUE
        LEFT JOIN LATERAL (
            SELECT
                bcs.id
            FROM billing.charges_studies bcs
            INNER JOIN billing.charges bc ON bc.id = bcs.charge_id
            WHERE bcs.study_id = ps.id
            LIMIT 1
        ) as billed_status ON TRUE `;

        if (isCount) {
            sql = SQL`
                    SELECT
                        COUNT(1) AS total_records
                    FROM studies ps
                    `;

            sql.append(joinQuery)
                .append(args.filterQuery);
        } else {

            sql = SQL`
                    SELECT
                        ps.id,
                        ps.facility_id,
                        NULLIF(pf.facility_info->'rendering_provider_id', '')::BIGINT AS facility_rendering_provider_contact_id,
                        ps.reading_physician_id AS study_rendering_provider_contact_id,
                        st_trans.approving_provider_id AS approving_provider_contact_id,
                        ins_prov_details.claim_insurance_provider_id,
                        ps.study_description,
                        ps.dicom_status,
                        ps.study_dt,
                        ps.patient_id,
                        ps.order_id,
                        ps.accession_no,
                        ps.id AS study_id,
                        pp.full_name,
                        pp.account_no,
                        pofc.id AS ordering_facility_location_id,
                        pofc.location
                    FROM studies ps
                    `;

            sql.append(joinQuery)
                .append(args.filterQuery)
                .append(SQL` ORDER BY `)
                .append(sortField)
                .append(' ')
                .append(sortOrder)
                .append(` LIMIT ${pageSize} OFFSET ${((pageNo - 1) * pageSize) || 0} `);
        }

        return await query(sql);
    },

};
