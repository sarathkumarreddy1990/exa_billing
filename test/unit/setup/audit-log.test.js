const should = require('chai').should();

const config = require('../../../server/config');
const moment = require('moment');
config.initialize();

const auditLogController = require('../../../server/controllers/setup/audit-log');

describe('AuditLog', () => {
    let log_id = null;
    describe('getData', () => {
        it('should return array of rows', async () => {

            const data = await auditLogController.getData({
                sortField:'al.id',
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
        it('should return array of  between range of logged In date(created date)', async () => {

            const data = await auditLogController.getData({
                sortField:'id',
                pageNo:1,
                pageSize:10,
                fromDate: ' 2017-01-03T00:00:00-08:00', 
                toDate: ' 2018-01-03T00:00:00-08:00'  
            });

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('getDataById', () => {
        it('should return data of a row', async () => {
            const data = await auditLogController.getDataById({
                id:log_id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});
