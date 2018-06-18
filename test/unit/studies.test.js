const should = require('chai').should();

const config = require('../../server/config');
config.initialize();

const studiesController = require('../../server/controllers/studies');

describe('Studies', () => {
    describe('getData', () => {
        it('should return array of rows', async () => {
            const data = await studiesController.getData();

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('getDataByDate', () => {
        it('should return array of rows', async () => {
            const data = await studiesController.getDataByDate({
                fromDate: '01-01-2018',
                toDate: '02-01-2018'
            });

            should.exist(data);
            data.rows.should.be.an('array');
        });
    });
});
