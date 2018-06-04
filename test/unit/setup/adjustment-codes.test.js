const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const adjController = require('../../../server/controllers/setup/adjustment-codes');

describe('AdjustmentCodes', () => {
    let id = null;

    describe('getData', () => {
        it('should return array of rows', async () => {

            const data = await adjController.getData({
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
        it('should create adjustment codes and return id', async () => {
            const data = await adjController.create({
                companyId:1,
                code: 'unit_test_adjcodes_create',
                description: 'unit_test_adjcodes_create',  
                type: 'credit', 
                inactivated_dt: null
            });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
            id = data.rows[0].id;
        });
    });

    describe('getDataById', () => {
        it('should return data of a row', async () => {
            const data = await adjController.getDataById({
                id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('update', () => {
        it('should update particular adjustment code', async () => {
            const data = await adjController.update({
                code: 'unity_test_adjcodes_update',
                description: 'unity_test_adjcodes_update',  
                type: 'credit', 
                inactivated_dt: null,
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('delete', () => {
        it('should delete particular adjustment code', async () => {
            const data = await adjController.delete({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});
