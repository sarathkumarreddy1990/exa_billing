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
            patientValidation } = params;

        const sql = SQL` WITH insertValidations AS(INSERT INTO billing.validations
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
                                                RETURNING id)
                                                UPDATE 
                                                    billing.validations 
                                                SET
                                                    edi_validation = ${JSON.stringify(ediValidation)}
                                                  , invoice_validation = ${JSON.stringify(invoiceValidation)}
                                                  , patient_validation = ${JSON.stringify(patientValidation)}
                                                WHERE NOT EXISTS(SELECT 1 FROM insertValidations)
                                                RETURNING id
                                                `;

        return await query(sql);
    }

};