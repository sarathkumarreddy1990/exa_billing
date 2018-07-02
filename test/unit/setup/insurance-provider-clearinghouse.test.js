const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const chController = require('../../../server/controllers/setup/insurance-provider-clearinghouse');

describe('ClearingHouse of Insurance Provider', () => {
    let id = null;

    describe('getData', () => {
        it('should return array of rows', async () => {

            const data = await chController.getData({
                sortField:'insurance_id',
                pageNo:1,
                pageSize:10
            });

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('create', () => {
        it('should create clearing House of insurance provider and return insurance_id', async () => {
            const data = await chController.create({
                insuranceId: 1,
                clearingHouseId: 7,  
            });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
            id = data.rows[0].insurance_id;
        });
    });

    describe('getDataById', () => {
        it('should return data of a row', async () => {
            const data = await chController.getDataById({
                insurance_id:id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('update', () => {
        it('should update particular clearing house of insurance provider', async () => {
            const data = await chController.update({
                clearingHouseId: 19,  
                insurance_id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('delete', () => {
        it('should delete particular clearing house of insurance provider', async () => {
            const data = await chController.delete({
                insurance_id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});
