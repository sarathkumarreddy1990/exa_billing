const should = require('chai').should();
const ediConnect = require('../../../../modules/edi');

describe('EDI-Connect', () => {
    let templateName = 'test22_' + (new Date()).toTimeString().substr(0, 8).replace(/:/g, '_');

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

    describe('createTemplate - edi', () => {
        it('should create and return all template names', async () => {
            const templates = await ediConnect.createTemplate(templateName, 'edi');
            templates.should.be.an('array');
            templates.should.have.lengthOf.above(0);
            templates.should.include(templateName);
        });
    });

    describe('createTemplate - eri', () => {
        it('should create and return all template names', async () => {
            const templates = await ediConnect.createTemplate(templateName, 'era');
            templates.should.be.an('array');
            templates.should.have.lengthOf.above(0);
            templates.should.include(templateName);
        });
    });

    describe('updateTemplate', () => {
        it('should update and return all template names', async () => {
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
