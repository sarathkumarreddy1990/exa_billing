const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const codesController = require('../../../server/controllers/setup/billing-codes');

describe('BillingCodes', () => {
    let id = null;
    describe('getData', () => {
        it('should return array of rows', async () => {

            const data = await codesController.getData({
                sortField:'id',
                pageNo:1,
                pageSize:10
            });

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('create', () => {
        it('should create billing code and return id', async () => {
            const data = await codesController.create({
                companyId: 1,
                code: 'unit_test_billing_code_create',
                description: 'unit_test_billing_code_create',  
                inactivated_dt: null
            });

            should.exist(data);
            data.rows.should.be.an('array');
            id = data.rows[0].id;
        });
    });

    describe('getDataById', () => {
        it('should return data of a row', async () => {
            const data = await codesController.getDataById({
                id:id
            });

            should.exist(data);
            data.rows.should.be.an('array');
        });
    });

    describe('update', () => {
        it('should update particular billing code', async () => {
            const data = await codesController.update({
                code: 'unit_test_billing_code_update',
                description: 'unit_test_billing_code_update',  
                inactivated_dt: '04/06/2018',
                id:id
            });

            should.exist(data);
            data.rows.should.be.an('array');
        });
    });

    describe('delete', () => {
        it('should delete particular billing code', async () => {
            const data = await codesController.delete({
                id:id
            });

            should.exist(data);
            data.rows.should.be.an('array');
        });
    });
});
