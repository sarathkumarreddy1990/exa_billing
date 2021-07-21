const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const ediClearinghousesController = require('../../../server/controllers/setup/edi-clearinghouses');

describe('ediClearinghouses', () => {
    let id = null;

    describe('getData', () => {
        it('should return array of rows', async () => {
            const data = await ediClearinghousesController.getData({});

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('create', () => {
        it('should insert one row', async () => {
            const data = await ediClearinghousesController.create({
                companyId: 1,
                code: 1000000000,
                name: 'EXA_billing_test_script',
                receiverName: 'EXA_billing_test_script',
                receiverId: 1000000000,
                communicationInfo: '{"FtpHost": "", "FtpType": "", "FtpPassword": "", "FtpUserName": "", "IsFtpEnabled": "false", "FtpPortNumber": "", "FtpSentFolder": "", "FtpIdentityFile": "", "FtpReceiveFolder": "", "FtpReceiveFolderLocal": ""}',
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
            const data = await ediClearinghousesController.getById({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('update', () => {
        it('should update one row', async () => {
            const data = await ediClearinghousesController.update({
                id: id,
                code: 1000000000,
                name: 'EXA_billing_test_script',
                receiverName: 'EXA_billing_test_script',
                receiverId: 1000000000,
                communicationInfo: '{"FtpHost": "", "FtpType": "", "FtpPassword": "", "FtpUserName": "", "IsFtpEnabled": "false", "FtpPortNumber": "", "FtpSentFolder": "", "FtpIdentityFile": "", "FtpReceiveFolder": "", "FtpReceiveFolderLocal": ""}',
                isActive: true
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('delete', () => {
        it('should delete one row', async () => {
            const data = await ediClearinghousesController.delete({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});