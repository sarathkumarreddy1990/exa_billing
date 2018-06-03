const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const validationsController = require('../../../server/controllers/setup/validations');

describe('validations', () => {

    describe('getData', () => {
        it('should return array of rows', async () => {
            const data = await validationsController.getData({});

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('createOrUpdate', () => {
        it('should insert or update one row', async () => {
            const data = await validationsController.createOrUpdate({
                companyId: 1,
                ediValidation: '[{"field":"billing_pro_addressLine1","enabled":"true"},{"field":"billing_pro_city","enabled":"true"}]',
                invoiceValidation: '[{"field":"billing_pro_addressLine1","enabled":"true"},{"field":"billing_pro_city","enabled":"true"}]',
                patientValidation: null
            });

            should.exist(data);
            data.rowCount.should.equal(1);

        });
    });

});