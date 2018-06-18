const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const providerLevelCodesController = require('../../../server/controllers/setup/provider-level-codes');

describe('providerLevelCodes', () => {
    let id = null;

    describe('getData', () => {
        it('should return array of rows', async () => {
            const data = await providerLevelCodesController.getData({});

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('create', () => {
        it('should insert one row', async () => {
            const data = await providerLevelCodesController.create({
                companyId: 1,
                code: 'Exa_app_Test_Script',
                description: 'Exa_app_Test_Script',
                readingProviderPercentLevel: 1.5,
                isActive: true
            });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
            id = data.rows[0].id;

        });
    });
    describe('getById', () => {
        it('should return one row', async () => {
            const data = await providerLevelCodesController.getById({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('update', () => {
        it('should update one row', async () => {
            const data = await providerLevelCodesController.update({
                id: id,
                code: 'Exa_app_Test_Script',
                description: 'Exa_app_Test_Script',
                readingProviderPercentLevel: 1.5,
                isActive: true
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('delete', () => {
        it('should delete one row', async () => {
            const data = await providerLevelCodesController.delete({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});