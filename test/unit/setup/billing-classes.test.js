const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const classController = require('../../../server/controllers/setup/billing-classes');

describe('BillingClass', () => {
    let id = null; 

    describe('getData', () => {
        it('should return array of rows', async () => {

            const data = await classController.getData({
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
        it('should create billing class and return id', async () => {
            const data = await classController.create({
                companyId: 1,
                code: 'test_billing_class_create',
                description: 'test_billing_class_create',  
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
            const data = await classController.getDataById({
                id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('update', () => {
        it('should update particular billing class', async () => {
            const data = await classController.update({
                code: 'test_billing_class_update',
                description: 'test_billing_class_update',  
                isActive: true,
                id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('delete', () => {
        it('should delete particular billing class', async () => {
            const data = await classController.delete({
                id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});
