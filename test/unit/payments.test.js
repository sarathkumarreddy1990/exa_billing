const should = require('chai').should();

const config = require('../../server/config');
config.initialize();

const paymentsController = require('../../server/controllers/payments/payments');
const testHelpersController = require('../../server/controllers/test-helpers');

describe('Payments', () => {
    let paymentId = null;
    let patient_id = null;
    let insurance_provider_id = null;
    let provider_group_id = null;
    let provider_contact_id = null;
    let payment_reason_id = null;
    let company_id = null;
    let facility_id = null;
    let user_id = null;

    describe('getPayments', () => {
        it('should return array of rows', async () => {
            const data = await paymentsController.getPayments({ pageSize: 10, pageNo: 1 });

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('createOrUpdatePayment', () => {
        getTotalData();

        async function getTotalData() {

            const patientdata = await testHelpersController.getPatientId();
            patient_id = patientdata.rows[0].id;
            patient_id = patient_id ? patient_id : null;

            const insuranceProviderdata = await testHelpersController.getinsuranceProviderId();
            insurance_provider_id = insuranceProviderdata.rows[0].id;
            insurance_provider_id = insurance_provider_id ? insurance_provider_id : null;

            const ProviderGroupdata = await testHelpersController.getProviderGroupId();
            provider_group_id = ProviderGroupdata.rows[0].id;
            provider_group_id = provider_group_id ? provider_group_id : null;

            const providerContactdata = await testHelpersController.getProviderContactId();
            provider_contact_id = providerContactdata.rows[0].id;
            provider_contact_id = provider_contact_id ? provider_contact_id : null;

            const paymentReasonData = await testHelpersController.getPaymentReasonId();
            payment_reason_id = paymentReasonData.rows[0].id;
            payment_reason_id = payment_reason_id ? payment_reason_id : null;

            const companyData = await testHelpersController.getCompanyId();
            company_id = companyData.rows[0].id;
            company_id = company_id ? company_id : null;

            const facilityData = await testHelpersController.getFacilityId();
            facility_id = facilityData.rows[0].id;
            facility_id = facility_id ? facility_id : null;

            const userData = await testHelpersController.getUserId();
            user_id = userData.rows[0].id;
            user_id = user_id ? user_id : null;

        };

        describe('Create a payment with all mandatory columns', () => {
            it('should return one row', async () => {

                const data = await paymentsController.createOrUpdatePayment({
                    company_id: company_id,
                    patient_id: patient_id,
                    amount: 500,
                    user_id: user_id,
                    payer_type: 'patient',
                });

                should.exist(data);
                data.rowCount.should.equal(1);
                data.rows.should.have.lengthOf.above(0);
                paymentId = data.rows[0].id;
            });
        });

        describe('Delete payment', () => {
            it('should delete one row', async () => {
                const data = await paymentsController.deletePayment({ id: paymentId });

                should.exist(data);
                data.rowCount.should.equal(1);
            });
        });

        describe('Create a payment with all columns', () => {
            it('should return one row', async () => {
                paymentId = null;
                const data = await paymentsController.createOrUpdatePayment({
                    paymentId: null,
                    company_id: company_id,
                    facility_id: facility_id,
                    patient_id: patient_id,
                    insurance_provider_id: insurance_provider_id,
                    provider_group_id: provider_group_id,
                    provider_contact_id: provider_contact_id,
                    payment_reason_id: payment_reason_id,
                    amount: 500,
                    accounting_date: '01/01/2018',
                    user_id: user_id,
                    invoice_no: 'XXXXXXXXX',
                    display_id: 'XXXXXXXX',
                    payer_type: 'patient',
                    notes: 'Test',
                    payment_mode: 'check',
                    credit_card_name: 'XXXXXXXX',
                    credit_card_number: 'XXXXXXXXXXX'
                });

                should.exist(data);
                data.rowCount.should.equal(1);
                data.rows.should.have.lengthOf.above(0);
                paymentId = data.rows[0].id;
            });
        });

        describe('getPayment', () => {
            it('should return one row', async () => {
                const data = await paymentsController.getPayments({ id: paymentId });

                should.exist(data);
                data.rowCount.should.equal(1);
                data.rows.should.have.lengthOf.above(0);
            });
        });

        describe('Update a payment', () => {
            it('should return one row', async () => {

                const data = await paymentsController.createOrUpdatePayment({
                    paymentId: paymentId,
                    company_id: company_id,
                    facility_id: facility_id,
                    patient_id: patient_id,
                    insurance_provider_id: insurance_provider_id,
                    provider_group_id: provider_group_id,
                    provider_contact_id: provider_contact_id,
                    payment_reason_id: payment_reason_id,
                    amount: 1000,
                    accounting_date: '01/01/2018',
                    user_id: user_id,
                    invoice_no: '11111111111111',
                    display_id: '11111111111111',
                    payer_type: 'ordering_facility',
                    notes: 'Test1',
                    payment_mode: 'check',
                    credit_card_name: '1111111111',
                    credit_card_number: '11111111111'
                });

                should.exist(data);
                data.rowCount.should.equal(1);
            });
        });

        describe('Delete payment', () => {
            it('should delete one row', async () => {
                const data = await paymentsController.deletePayment({ id: paymentId });

                should.exist(data);
                data.rowCount.should.equal(1);
            });
        });

    });

});