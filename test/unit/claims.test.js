const should = require('chai').should();

const config = require('../../server/config');
config.initialize();

const claimsController = require('../../server/controllers/claim');
const testHelpersController = require('../../server/controllers/test-helpers');

describe('Claims', () => {
    let patientInsuranceId = null;

    describe('getLineItemsDetails', () => {
        it('should return array of rows', async () => {
            const testStudydata = await testHelpersController.getStudyIds({});
            let studyID = testStudydata.rows[0].id;
            const data = await claimsController.getLineItemsDetails({ study_ids: studyID });

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('getPatientInsurances', () => {
        it('should return array of rows', async () => {
            const testPatientdata = await testHelpersController.getPatientId({});
            let patientId = testPatientdata.rows[0].id;
            const data = await claimsController.getPatientInsurances({ patient_id: patientId });

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
            patientInsuranceId = data.rows[0].id;
        });
    });

    describe('getPatientInsurancesById', () => {
        it('should return array of rows', async () => {
            const data = await claimsController.getPatientInsurancesById({ id: patientInsuranceId });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
        });
    });

    describe('getMasterDetails', () => {
        it('should return one detailed json row', async () => {
            const data = await claimsController.getMasterDetails({ company_id: 1 });

            should.exist(data);
            data.rowCount.should.equal(1);
            data.rows.should.have.lengthOf.above(0);
        });
    });

});