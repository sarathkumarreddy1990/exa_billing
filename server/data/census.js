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

        let defaultWhere = " ps.study_status = 'APP' AND pofc.billing_type = 'census' AND billed_status.id IS NULL ";

        if (orderingFacilityId) {
            defaultWhere += ` AND pof.id = ${orderingFacilityId} `;
        }

        args.filterQuery = await filterValidator.generateQuery(colModel, filterCol, filterData, {defaultwherefilter: defaultWhere});


        const joinQuery = `
        INNER JOIN patients pp ON pp.id = ps.patient_id
        INNER JOIN ordering_facility_contacts pofc ON pofc.id = ps.ordering_facility_contact_id
        INNER JOIN ordering_facilities pof ON pof.id = pofc.ordering_facility_id
        LEFT JOIN LATERAL (
            SELECT bcs.id FROM billing.charges_studies bcs inner JOIN billing.charges bc ON bc.id=
                  bcs.charge_id  WHERE bcs.study_id = ps.id LIMIT 1
        ) as billed_status ON TRUE `;

        if (isCount) {
            sql = SQL`
                    SELECT  
                        COUNT(1) AS total_records
                    FROM  studies ps
                    `;

            sql.append(joinQuery)
                .append(args.filterQuery);
        } else {

            sql = SQL`
                    SELECT  
                        ps.id,    
                        ps.study_description,
                        ps.dicom_status,
                        ps.study_dt,
                        ps.patient_id,
                        ps.order_id,
                        ps.accession_no,
                        ps.id AS study_id,
                        pp.full_name,
                        pp.account_no,
                        pofc.location
                    FROM  studies ps
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
