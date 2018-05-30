const should = require('chai').should();

const config = require('../../server/config');
config.initialize();

const studiesController = require('../../server/controllers/studies');

describe('Studies-GetData', () => {
    it('should return array of rows', async () => {
        const data = await studiesController.getData();

        should.exist(data);
        data.rows.should.be.an('array');
    });
});
