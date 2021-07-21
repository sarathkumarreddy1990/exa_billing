const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const userLogController = require('../../../server/controllers/setup/user-log');

describe('UserLog', () => {
    let log_id = null;
    describe('getData', () => {
        it('should return array of rows', async () => {

            const data = await userLogController.getData({
                sortField:'id',
                pageNo:1,
                pageSize:10
            });

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
            log_id = data.rows[0].id;
        });
    });

    describe('getData', () => {
        it('should return array of  between range of loggedIn and last asccessed date', async () => {

            const data = await userLogController.getData({
                sortField:'id',
                pageNo:1,
                pageSize:10,
                loggedInDate: '2018-06-11',
                last_access_dt: '2018-06-11'
            });

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('getDataById', () => {
        it('should return data of a row', async () => {
            const data = await userLogController.getDataById({
                id:log_id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});
