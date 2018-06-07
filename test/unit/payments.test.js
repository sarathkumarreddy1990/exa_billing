const should = require('chai').should();

const config = require('../../server/config');
config.initialize();

const paymentsController = require('../../server/controllers/payments');
const testHelpersController = require('../../server/controllers/test-helpers');

describe('Payments', () => {
    let paymentId = null;
    let patient_id = null;

    describe('getPayments', () => {
        it('should return array of rows', async () => {
            const data = await paymentsController.getPayments({ pageSize: 10, pageNo: 1 });

            should.exist(data);
            data.rows.should.be.an('array');
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

    describe('createOrUpdatePayment', () => {
        it('should return one row', async () => {
            const patientdata = await testHelpersController.getPatientId();
            patient_id = patientdata.rows[0].id;
            const data = await paymentsController.createOrUpdatePayment({
                paymentId: null,
                company_id: 1,
                facility_id: 1,
                patient_id: patient_id,
                insurance_provider_id: null,
                provider_group_id: null,
                provider_contact_id: null,
                payment_reason_id: null,
                amount: 500,
                accounting_date: '01/01/2018',
                user_id: 1,
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
            let val = data.rows[0].id;
        });
    });

});