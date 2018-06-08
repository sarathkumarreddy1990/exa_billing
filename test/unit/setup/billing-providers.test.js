const should = require('chai').should();

const config = require('../../../server/config');
config.initialize();

const billingProvidersController = require('../../../server/controllers/setup/billing-providers');
const providerIdCodesController = require('../../../server/controllers/setup/provider-id-codes');
const providerIdCodeQualifiersController = require('../../../server/controllers/setup/provider-id-code-qualifiers');

describe(' billingProviders', () => {
    let id = null;

    describe('getData', () => {
        it('should return array of rows', async () => {
            const data = await billingProvidersController.getData({});

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('create', () => {
        it('should insert one row', async () => {
            const data = await billingProvidersController.create({
                companyId: 1,
                name: 'Exa_billing_test_script',
                code: 'Exa_billing_test_script',
                shortDescription: 'Exa_billing_test_script',
                federalTaxId: '111111111111',
                npiNo: '1111111111',
                taxonomyCode: '1111111111',
                contactPersonName: 'Exa_billing_test_script',
                addressLine1: 'Exa_billing_test_script',
                addressLine2: 'Exa_billing_test_script',
                city: 'Exa_billing_test_script',
                state: 'Exa_billing_test_script',
                zipCode: '111111',
                zipCodePlus: '11',
                email: 'Exa_billing_test_script@emdsys.com',
                phoneNumber: '1111111111',
                faxNumber: '1111111111',
                webUrl: 'www.emdsys.com',
                payToAddressLine1: 'Exa_billing_test_script',
                payToAddressLine2: 'Exa_billing_test_script',
                payToCity: 'Exa_billing_test_script',
                payToState: 'Exa_billing_test_script',
                payToZipCode: '111111',
                payToZipCodePlus: '11',
                payToEmail: 'emdsys@emdsys.com',
                payToPhoneNumber: '1111111111',
                payToFaxNumber: '11',
                communicationInfo: null,
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
            const data = await billingProvidersController.getById({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
        });
    });

    //Start Provider id codes test cases 
    describe('providerIdCodes', () => {
        let codeId = null;
        let qualifierId = null;

        describe('create providerIdCode', () => {
            it('should insert one row', async () => {
                const qualifierData = await providerIdCodeQualifiersController.getData({});
                qualifierId = qualifierData.rows[0].id;
                const data = await providerIdCodesController.create({
                    qualifierId: qualifierId,
                    provider_id: id,
                    insuranceProviderId: 1,
                    payerAssignedProviderId: 'TestCreate11'
                });

                should.exist(data);
                data.rowCount.should.equal(1);
                data.rows.should.have.lengthOf.above(0);
                codeId = data.rows[0].id;

            });
        });

        describe('getData providerIdCode', () => {
            it('should return array of rows', async () => {
                const data = await providerIdCodesController.getData({}, { provider_id: id });

                should.exist(data);
                data.rows.should.be.an('array');
                data.rows.should.have.lengthOf.above(0);
            });
        });

        describe('getById providerIdCode', () => {
            it('should return one row', async () => {
                const data = await providerIdCodesController.getById({
                    id: codeId,
                    provider_id: id
                });

                should.exist(data);
                data.rowCount.should.equal(1);
                data.rows.should.have.lengthOf.above(0);
            });
        });

        describe('update providerIdCode', () => {
            it('should update one row', async () => {
                const data = await providerIdCodesController.update({
                    id: codeId,
                    qualifierId: qualifierId,
                    provider_id: id,
                    insuranceProviderId: 1,
                    payerAssignedProviderId: 'TestUpdate11'
                });

                should.exist(data);
                data.rowCount.should.equal(1);
            });
        });

        describe('delete providerIdCode', () => {
            it('should delete one row', async () => {
                const data = await providerIdCodesController.delete({
                    id: codeId,
                    provider_id: id
                });

                should.exist(data);
                data.rowCount.should.equal(1);
            });
        });
    });
    //End Provider id codes test cases 

    describe('update', () => {
        it('should update one row', async () => {
            const data = await billingProvidersController.update({
                id: id,
                name: 'Exa_billing_test_script',
                code: 'Exa_billing_test_script',
                shortDescription: 'Exa_billing_test_script',
                federalTaxId: '111111111111',
                npiNo: '1111111111',
                taxonomyCode: '1111111111',
                contactPersonName: 'Exa_billing_test_script',
                addressLine1: 'Exa_billing_test_script',
                addressLine2: 'Exa_billing_test_script',
                city: 'Exa_billing_test_script',
                state: 'Exa_billing_test_script',
                zipCode: '111111',
                zipCodePlus: '11',
                email: 'Exa_billing_test_script@emdsys.com',
                phoneNumber: '1111111111',
                faxNumber: '1111111111',
                webUrl: 'www.emdsys.com',
                payToAddressLine1: 'Exa_billing_test_script',
                payToAddressLine2: 'Exa_billing_test_script',
                payToCity: 'Exa_billing_test_script',
                payToState: 'Exa_billing_test_script',
                payToZipCode: '111111',
                payToZipCodePlus: '11',
                payToEmail: 'emdsys@emdsys.com',
                payToPhoneNumber: '1111111111',
                payToFaxNumber: '11',
                communicationInfo: null,
                isActive: true
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });

    describe('delete', () => {
        it('should delete one row', async () => {
            const data = await billingProvidersController.delete({
                id: id
            });

            should.exist(data);
            data.rowCount.should.equal(1);
        });
    });
});