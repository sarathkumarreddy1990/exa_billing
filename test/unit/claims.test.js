const should = require('chai').should();

const config = require('../../server/config');
config.initialize();

const claimsController = require('../../server/controllers/claims');
const exaTestScriptController = require('../../server/controllers/test-helpers');

describe('Claims', () => {
    let id = null;

    describe('getLineItemsDetails', () => {
        it('should return array of rows', async () => {
            const testStudydata = await exaTestScriptController.getStudyIds({});
            let studyID = testStudydata.rows[0].id;
            const data = await claimsController.getLineItemsDetails({ study_ids: studyID });

            should.exist(data);
            data.rows.should.be.an('array');
            data.rows.should.have.lengthOf.above(0);
        });
    });
});