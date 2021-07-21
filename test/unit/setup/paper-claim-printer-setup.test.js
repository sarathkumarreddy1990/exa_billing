const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const paperClaimPrinterSetupController = require('../../../server/controllers/setup/paper-claim-printer-setup');

describe('paperClaimPrinterSetup', () => {
    let id = null;

    describe('getData', () => {
        it('should return array of rows', async () => {
            const data = await paperClaimPrinterSetupController.getData({});

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('create', () => {
        it('should insert one row', async () => {
            const data = await paperClaimPrinterSetupController.create({
                companyId: 1,
                printerName: 'Exa_app_Test_Script',
                leftMargin: 1.5,
                rightMargin: 1.5,
                topMargin: 1.5,
                bottomMargin: 1.5,
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
            const data = await paperClaimPrinterSetupController.getById({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('update', () => {
        it('should update one row', async () => {
            const data = await paperClaimPrinterSetupController.update({
                id: id,
                printerName: 'Exa_app_Test_Script_Update',
                leftMargin: 1.5,
                rightMargin: 1.5,
                topMargin: 1.5,
                bottomMargin: 1.5,
                isActive: true
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('delete', () => {
        it('should delete one row', async () => {
            const data = await paperClaimPrinterSetupController.delete({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});