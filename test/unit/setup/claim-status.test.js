const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const statusController = require('../../../server/controllers/setup/claim-status');

describe('ClaimStatus', () => {
    let id = null;
    
    describe('getData', () => {
        it('should return array of rows', async () => {

            const data = await statusController.getData({
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
        it('should createClaim Status and return id', async () => {
            const data = await statusController.create({
                companyId: 1,
                code: 'unit_test_claim_status_create',
                description: 'unit_test_claim_status_create', 
                isSystemStatus: 'true', 
                isActive: null
            });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
            id = data.rows[0].id;
        });
    });

    describe('getDataById', () => {
        it('should return data of a row', async () => {
            const data = await statusController.getDataById({
                id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('update', () => {
        it('should update particular claim status', async () => {
            const data = await statusController.update({
                code: 'unit_test_claim_status_update',
                description: 'unit_test_claim_status_update',  
                isActive: false,
                isSystemStatus: 'true',
                id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('delete', () => {
        it('should delete particular claim status', async () => {
            const data = await statusController.delete({
                id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});
