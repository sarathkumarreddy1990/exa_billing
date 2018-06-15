const { query, SQL, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (params) {

        params.pageNo = 1;
        params.pageSize = 10;
        params.sortOrder = params.sortOrder || ' DESC';
        let {
            code,
            name,
            address,
            phoneNumber,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        let whereQuery = [];

        if (code) {
            whereQuery.push(` code ILIKE '%${code}%'`);
        }

        if (name) {
            whereQuery.push(` name ILIKE '%${name}%'`);
        }

        if (address) {
            whereQuery.push(` (address_line1 ILIKE '%${address}%' OR address_line2 ILIKE '%${address}%') `);
        }

        if (phoneNumber) {
            whereQuery.push(` phone_number ILIKE '%${phoneNumber}%'`);
        }

        const sql = SQL`SELECT 
                            id
                          , company_id
                          , inactivated_dt
                          , name
                          , code
                          , short_description
                          , federal_tax_id
                          , npi_no
                          , taxonomy_code
                          , contact_person_name
                          , address_line1 as address
                          , address_line2
                          , city
                          , state
                          , zip_code
                          , zip_code_plus
                          , email
                          , phone_number as "phoneNumber"
                          , fax_number
                          , web_url
                          , pay_to_address_line1
                          , pay_to_address_line2
                          , pay_to_city
                          , pay_to_state
                          , pay_to_zip_code
                          , pay_to_zip_code_plus
                          , pay_to_email
                          , pay_to_phone_number
                          , pay_to_fax_number
                          , communication_info
                          , COUNT(1) OVER (range unbounded preceding) as total_records
                        FROM   billing.providers `;

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);


        return await query(sql);

    },

    getById: async function (params) {

        let { id } = params;

        const sql = SQL`SELECT 
                            id
                            , company_id
                            , inactivated_dt
                            , name
                            , code
                            , short_description
                            , federal_tax_id
                            , npi_no
                            , taxonomy_code
                            , contact_person_name
                            , address_line1
                            , address_line2
                            , city
                            , state
                            , zip_code
                            , zip_code_plus
                            , email
                            , phone_number
                            , fax_number
                            , web_url
                            , pay_to_address_line1
                            , pay_to_address_line2
                            , pay_to_city
                            , pay_to_state
                            , pay_to_zip_code
                            , pay_to_zip_code_plus
                            , pay_to_email
                            , pay_to_phone_number
                            , pay_to_fax_number
                            , communication_info
                        FROM   billing.providers
                        WHERE 
                            id = ${id} `;

        return await query(sql);
    },

    create: async function (params) {

        let {
            name,
            code,
            shortDescription,
            federalTaxId,
            npiNo,
            taxonomyCode,
            contactPersonName,
            addressLine1,
            addressLine2,
            city,
            state,
            zipCode,
            zipCodePlus,
            email,
            phoneNumber,
            faxNumber,
            webUrl,
            payToAddressLine1,
            payToAddressLine2,
            payToCity,
            payToState,
            payToZipCode,
            payToZipCodePlus,
            payToEmail,
            payToPhoneNumber,
            payToFaxNumber,
            communicationInfo,
            companyId,
            isActive
        } = params;
        let inactivated_dt = isActive ? null : 'now()';

        const sql = SQL` INSERT INTO billing.providers
                                                ( name
                                                , code
                                                , short_description
                                                , federal_tax_id
                                                , npi_no
                                                , taxonomy_code
                                                , contact_person_name
                                                , address_line1
                                                , address_line2
                                                , city
                                                , state
                                                , zip_code
                                                , zip_code_plus
                                                , email
                                                , phone_number
                                                , fax_number
                                                , web_url
                                                , pay_to_address_line1
                                                , pay_to_address_line2
                                                , pay_to_city
                                                , pay_to_state
                                                , pay_to_zip_code
                                                , pay_to_zip_code_plus
                                                , pay_to_email
                                                , pay_to_phone_number
                                                , pay_to_fax_number
                                                , communication_info
                                                , company_id
                                                , inactivated_dt)
                                            values
                                                (
                                                  ${name}
                                                , ${code}
                                                , ${shortDescription}
                                                , ${federalTaxId}
                                                , ${npiNo}
                                                , ${taxonomyCode}
                                                , ${contactPersonName}
                                                , ${addressLine1}
                                                , ${addressLine2}
                                                , ${city}
                                                , ${state}
                                                , ${zipCode}
                                                , ${zipCodePlus}
                                                , ${email}
                                                , ${phoneNumber}
                                                , ${faxNumber}
                                                , ${webUrl}
                                                , ${payToAddressLine1}
                                                , ${payToAddressLine2}
                                                , ${payToCity}
                                                , ${payToState}
                                                , ${payToZipCode}
                                                , ${payToZipCodePlus}
                                                , ${payToEmail}
                                                , ${payToPhoneNumber}
                                                , ${payToFaxNumber}
                                                , ${communicationInfo}
                                                , ${companyId}
                                                , ${inactivated_dt})
                                            RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Created ${shortDescription}(${name})`
        });
    },

    update: async function (params) {

        let {
            id,
            name,
            code,
            shortDescription,
            federalTaxId,
            npiNo,
            taxonomyCode,
            contactPersonName,
            addressLine1,
            addressLine2,
            city,
            state,
            zipCode,
            zipCodePlus,
            email,
            phoneNumber,
            faxNumber,
            webUrl,
            payToAddressLine1,
            payToAddressLine2,
            payToCity,
            payToState,
            payToZipCode,
            payToZipCodePlus,
            payToEmail,
            payToPhoneNumber,
            payToFaxNumber,
            communicationInfo,
            isActive
        } = params;
        let inactivated_dt = isActive ? null : 'now()';

        const sql = SQL` UPDATE
                              billing.providers
                         SET
                              name = ${name}
                            , code = ${code}
                            , short_description = ${shortDescription}
                            , federal_tax_id = ${federalTaxId}
                            , npi_no = ${npiNo}
                            , taxonomy_code = ${taxonomyCode}
                            , contact_person_name = ${contactPersonName}
                            , address_line1 = ${addressLine1}
                            , address_line2 = ${addressLine2}
                            , city = ${city}
                            , state = ${state}
                            , zip_code = ${zipCode}
                            , zip_code_plus = ${zipCodePlus}
                            , email = ${email}
                            , phone_number = ${phoneNumber}
                            , fax_number = ${faxNumber}
                            , web_url = ${webUrl}
                            , pay_to_address_line1 = ${payToAddressLine1}
                            , pay_to_address_line2 = ${payToAddressLine2}
                            , pay_to_city = ${payToCity}
                            , pay_to_state = ${payToState}
                            , pay_to_zip_code = ${payToZipCode}
                            , pay_to_zip_code_plus = ${payToZipCodePlus}
                            , pay_to_email = ${payToEmail}
                            , pay_to_phone_number = ${payToPhoneNumber}
                            , pay_to_fax_number = ${payToFaxNumber}
                            , communication_info = ${communicationInfo}
                            , inactivated_dt = ${inactivated_dt}
                         WHERE
                              id = ${id}
                              RETURNING *,
                                (
                                    SELECT row_to_json(old_row) 
                                    FROM   (SELECT * 
                                            FROM   billing.adjustment_codes 
                                            WHERE  id = ${id}) old_row 
                                ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Updated ${shortDescription}(${name})`
        });
    },

    delete: async function (params) {

        let { id } = params;

        const sql = SQL` WITH delete_billing_provider AS(
                                DELETE FROM
                                    billing.provider_id_codes
                                WHERE
                                    billing_provider_id = ${id}
                            )
                            DELETE FROM
                                billing.providers
                            WHERE
                                id = ${id}RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: 'Deleted.'
        });
    }
};