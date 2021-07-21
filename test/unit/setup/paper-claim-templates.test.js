const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const paperController = require('../../../server/controllers/setup/printer-templates');

describe('PaperClaimTemplates', () => {
    let id = null;

    describe('getData', () => {
        it('should return array of rows', async () => {

            const data = await paperController.getData({
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
        it('should create paper claim templates and return id', async () => {
            const data = await paperController.create({
                companyId:1,
                name: 'unit_test_paperClaim_templates_create',
                bodyContent: 'unit_test_paperClaim_templates_create',  
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
            const data = await paperController.getDataById({
                id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('update', () => {
        it('should update particular paper Claim templates code', async () => {
            const data = await paperController.update({
                name: 'unity_test_paperClaim_templates_update',
                bodyContent: 'unity_test_paperClaim_templates_update',  
                isActive: false,
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('delete', () => {
        it('should delete particular Paper Claim Templates', async () => {
            const data = await paperController.delete({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});
