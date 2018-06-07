const should = require('chai').should();
const ediConnect = require('../../../../modules/edi');

const ediTemplateBody = require('./sample-edi-template');
const eraTemplateBody = require('./sample-era-template');
const ediRequestJson = require('./sample-edi-request');
const eraRequestText = require('./sample-era-request');

ediConnect.init('http://192.168.1.102:5581/edi/api');

describe('EDI-Connect', () => {

    const deleteEdiTemplate = function (flag, templateName) {
        describe('deleteTemplate - ' + flag, () => {
            it('should delete and return other template names', async () => {
                const templates = await ediConnect.deleteTemplate(flag, templateName);
                templates.should.be.an('array');
                templates.should.have.lengthOf.above(0);
                templates.should.not.include(templateName);
            });
        });
    }

    const testEdiConnect = function (flag, templateName) {

        describe('getTemplatesList - ' + flag, () => {
            it('should return list of template names', async () => {
                const templates = await ediConnect.getTemplatesList();

                should.exist(templates);
                templates.should.be.an('array');
                templates.should.have.lengthOf.above(0);
            });
        });

        describe('createTemplate - ' + flag, () => {
            it('should create and return all template names', async () => {
                const templates = await ediConnect.createTemplate(flag, templateName);
                templates.should.be.an('array');
                templates.should.have.lengthOf.above(0);
                templates.should.include(templateName);

                describe('updateTemplate - ' + flag, () => {
                    it('should update and return all template names', async () => {
                        let templateBody = flag === 'edi' ? ediTemplateBody : eraTemplateBody;

                        const response = await ediConnect.updateTemplate(flag, templateName, templateBody);
                        response.should.be.an('object');
                        response.status.should.equal('ok');

                        describe('getTemplate - ' + flag, () => {
                            it('should return template definition', async () => {
                                const data = await ediConnect.getTemplate(flag, templateName);

                                should.exist(data);
                                data.should.be.an('object');

                                describe('generateEdi/parseEra - ' + flag, () => {
                                    it('should return EDI/ERA', async () => {
                                        if (flag === 'edi') {
                                            const ediResponse = await ediConnect.generateEdi(templateName, ediRequestJson);

                                            deleteEdiTemplate(flag, templateName);

                                            should.exist(ediResponse);
                                            should.exist(ediResponse.ediText);
                                            ediResponse.ediText.should.be.a('string');
                                        } else {
                                            const eraResponseJson = await ediConnect.parseEra(templateName, eraRequestText);

                                            deleteEdiTemplate(flag, templateName);

                                            should.exist(eraResponseJson);
                                            eraResponseJson.should.have.lengthOf.above(0);
                                        }
                                    });
                                });
                            });
                        });
                    });
                });

            });
        });
    }

    let templateName = 'test22_edi_' + (new Date()).toTimeString().substr(0, 8).replace(/:/g, '_');
    testEdiConnect('edi', templateName);

    templateName = 'test22_era_' + (new Date()).toTimeString().substr(0, 8).replace(/:/g, '_');
    testEdiConnect('era', templateName);
});
