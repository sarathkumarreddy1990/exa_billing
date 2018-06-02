const should = require('chai').should();
const ediConnect = require('../../../../modules/edi');

describe('EDI-Connect', () => {
    let templateName = "test22";

    describe('getTemplatesList', () => {
        it('should return list of template names', async () => {
            const templates = await ediConnect.getTemplatesList();

            should.exist(templates);
            templates.should.be.an('array');
            templates.should.have.lengthOf.above(0);
        });
    });

    describe('getTemplate', () => {
        it('should return template definition', async () => {
            const templates = await ediConnect.getTemplatesList();
            templates.should.have.lengthOf.above(0);

            const data = await ediConnect.getTemplate(templates[0]);

            should.exist(data);
            data.should.be.an('object');
        });
    });

    describe('createTemplate', () => {
        it('should create and return all template names', async () => {
            const templates = await ediConnect.createTemplate(templateName);
            templates.should.be.an('array');
            templates.should.have.lengthOf.above(0);
            templates.should.include(templateName);
        });
    });

    describe('updateTemplate', () => {
        it('should create and return all template names', async () => {
            let templateBody = {
                "testData": "test"
            };

            const response = await ediConnect.updateTemplate(templateName, templateBody);
            response.should.be.an('object');
            response.status.should.equal('ok');
        });
    });

    describe('deleteTemplate', () => {
        it('should delete and return other template names', async () => {
            const templates = await ediConnect.deleteTemplate(templateName);
            templates.should.be.an('array');
            templates.should.have.lengthOf.above(0);
            templates.should.not.include(templateName);
        });
    });
});
