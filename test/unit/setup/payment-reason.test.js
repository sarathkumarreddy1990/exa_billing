const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const reasonController = require('../../../server/controllers/setup/billing-codes');

describe('PaymentReasons', () => {
    let id = null;
    describe('getData', () => {
        it('should return array of rows', async () => {
            const data = await reasonController.getData({
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
        it('should create payment reason and return id', async () => {
            const data = await reasonController.create({
                companyId: 1,
                code: 'unit_test_payement_reason_create',
                description: 'unit_test_payment_reason_create',  
                isActive: true
            });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
            id = data.rows[0].id;
        });
    });

    describe('getDataById', () => {
        it('should return data of a row', async () => {
            const data = await reasonController.getDataById({
                id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('update', () => {
        it('should update particular billing code', async () => {
            const data = await reasonController.update({
                code: 'unit_test_payment_reason_update',
                description: 'unit_test_payment_reason_update',  
                isActive: false,
                id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('delete', () => {
        it('should delete particular payment reason', async () => {
            const data = await reasonController.delete({
                id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});
