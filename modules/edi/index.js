const request = require('request-promise-native');

//const logger = require('../../logger');
const ediServerUri = 'http://localhost:5581';

module.exports = {

    getTemplatesList: async function () {
        let options = {
            uri: ediServerUri + '/edi/api/templates',
            json: true
        };

        return await request(options);
    },

    getTemplate: async function (templateName) {

        if (!templateName) {
            throw new Error('Invalid template name');
        }

        let options = {
            uri: ediServerUri + '/edi/api/template/' + templateName,
            json: true
        };

        return await request(options);
    },

    getEraTemplate: async function () {

    },

    createTemplate: async function (templateName) {

        if (!templateName) {
            throw new Error('Invalid template name');
        }

        let options = {
            method: 'POST',
            uri: ediServerUri + '/edi/api/new_template',
            body: {
                templateName: templateName
            },
            json: true
        };

        return await request(options);
    },

    updateTemplate: async function (templateName, templateBody) {

        if (!templateName) {
            throw new Error('Invalid template name');
        }

        let options = {
            method: 'POST',
            uri: ediServerUri + '/edi/api/template/' + templateName,
            body: templateBody,
            json: true
        };

        return await request(options);
    },

    deleteTemplate: async function (templateName) {

        if (!templateName) {
            throw new Error('Invalid template name');
        }

        let options = {
            method: 'DELETE',
            uri: ediServerUri + '/edi/api/template/' + templateName,
            json: true
        };

        return await request(options);
    },
};
