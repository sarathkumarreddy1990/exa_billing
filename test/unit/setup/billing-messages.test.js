const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const msgController = require('../../../server/controllers/setup/billing-messages');

describe('BillingMessages', () => {

    describe('getData', () => {
        it('should return array of rows', async () => {

            const data = await msgController.getData({
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
        it('should create/update billing class and return id', async () => {
            const data = await msgController.create({
                companyId: 1,
                code: '0-30',
                description: 'test_billing_message_create'
            });
            should.exist(data);
        });
    });
});
