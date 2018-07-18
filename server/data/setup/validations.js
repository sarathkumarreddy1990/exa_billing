const { query, SQL } = require('../index');

module.exports = {

    getData: async function () {
        const sql = SQL`SELECT 
                            id
                            , company_id
                            , edi_validation
                            , invoice_validation
                            , patient_validation
                        FROM   billing.validations`;

        return await query(sql);
    },

    createOrUpdate: async function (params) {

        let {
            companyId,
            ediValidation,
            invoiceValidation,
            patientValidation,
            screenName,
            clientIp,
            userId
        } = params;

        const sql = SQL` WITH insert_validations AS(
                                                INSERT INTO billing.validations
                                                    (   company_id
                                                    , edi_validation
                                                    , invoice_validation
                                                    , patient_validation)
                                                    SELECT 
                                                        ${companyId}
                                                    , ${JSON.stringify(ediValidation)}
                                                    , ${JSON.stringify(invoiceValidation)}
                                                    , ${JSON.stringify(patientValidation)}
                                                    WHERE NOT EXISTS(SELECT 1 FROM billing.validations)
                                                    RETURNING *, '{}'::jsonb old_values
                                                ),
                                                update_validations AS (
                                                    UPDATE 
                                                        billing.validations 
                                                    SET
                                                          edi_validation = ${JSON.stringify(ediValidation)}
                                                        , invoice_validation = ${JSON.stringify(invoiceValidation)}
                                                        , patient_validation = ${JSON.stringify(patientValidation)}
                                                    WHERE NOT EXISTS(SELECT 1 FROM insert_validations)
                                                    RETURNING * ,'{}'::jsonb old_values
                                                ),
                                                insert_audit_validations AS (
                                                    SELECT billing.create_audit(
                                                          ${companyId}
                                                        , 'validations'
                                                        , id
                                                        , ${screenName}
                                                        , 'setup'
                                                        , 'Billing Validations created ' 
                                                        , ${clientIp}
                                                        , json_build_object(
                                                            'old_values', COALESCE(old_values, '{}'),
                                                            'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM insert_validations) temp_row)
                                                          )::jsonb
                                                        , ${userId}
                                                      ) AS id 
                                                    FROM insert_validations
                                                    WHERE id IS NOT NULL
                                                ), 
                                                update_audit_validations AS (
                                                    SELECT billing.create_audit(
                                                          ${companyId}
                                                        , 'validations'
                                                        , id
                                                        , ${screenName}
                                                        , 'setup'
                                                        , 'Billing Validations Updated' 
                                                        , ${clientIp}
                                                        , json_build_object(
                                                            'old_values', COALESCE(old_values, '{}'),
                                                            'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_validations ) temp_row)
                                                          )::jsonb
                                                        , ${userId}
                                                      ) AS id 
                                                    FROM update_validations
                                                    WHERE id IS NOT NULL
                                                )
                                                SELECT * FROM insert_audit_validations
                                                UNION
                                                SELECT * FROM update_audit_validations`;

        return await query(sql);
    }

};
