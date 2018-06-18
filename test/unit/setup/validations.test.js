const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const validationsController = require('../../../server/controllers/setup/validations');

describe('validations', () => {
    let invoiceValidation = null;
    let ediValidation = null;
    let patientValidation = null;

    describe('getData', () => {
        it('should return array of rows', async () => {
            const data = await validationsController.getData({});

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
            invoiceValidation = data.rows[0].invoice_validation;
            ediValidation = data.rows[0].edi_validation;
            patientValidation = data.rows[0].patient_validation;
        });
    });

    describe('createOrUpdate', () => {
        it('should insert or update one row', async () => {
            const data = await validationsController.createOrUpdate({
                companyId: 1,
                ediValidation: JSON.stringify(ediValidation),
                invoiceValidation: JSON.stringify(invoiceValidation),
                patientValidation: JSON.stringify(patientValidation)
            });

            should.exist(data);
            data.rowCount.should.equal(1);

        });
    });

});