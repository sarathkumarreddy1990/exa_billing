const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const providerIdCodeQualifiersController = require('../../../server/controllers/setup/provider-id-code-qualifiers');

describe('providerIdCodeQualifiers', () => {
    let id = null;

    describe('getData', () => {
        it('should return array of rows', async () => {
            const data = await providerIdCodeQualifiersController.getData({});

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('create', () => {
        it('should insert one row', async () => {
            const data = await providerIdCodeQualifiersController.create({
                companyId: 1,
                code: 'Exa_app_Test_Script',
                description: 'Exa_app_Test_Script',
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
            const data = await providerIdCodeQualifiersController.getById({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('update', () => {
        it('should update one row', async () => {
            const data = await providerIdCodeQualifiersController.update({
                id: id,
                printerName: 'Exa_app_Test_Script_Update',
                code: 'Exa_app_Test_Script',
                description: 'Exa_app_Test_Script',
                isActive: true
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('delete', () => {
        it('should delete one row', async () => {
            const data = await providerIdCodeQualifiersController.delete({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});