const request = require('request-promise-native');
const logger = require('../../logger');

//const logger = require('../../logger');
const ediServerUri = 'http://localhost:5581/edi/api';

const doRequest = async function (options) {
    try {
        return await request(options);
    } catch (err) {
        logger.error(err);
        return err;
    }
};

const ediProxyServer = {

    getTemplatesList: async function (flag = 'edi') {

        let options = {
            uri: ediServerUri + '/templates/' + flag,
            json: true
        };

        return await doRequest(options);
    },

    getTemplate: async function (flag = 'edi', templateName) {

        if (!templateName) {
            throw new Error('Invalid template name');
        }

        let options = {
            uri: ediServerUri + '/template/' + flag + '/' + templateName,
            json: true
        };

        return await doRequest(options);
    },

    createTemplate: async function (flag = 'edi', templateName) {

        if (!templateName) {
            throw new Error('Invalid template name');
        }

        let options = {
            method: 'POST',
            uri: ediServerUri + '/new_template/' + flag,
            body: {
                templateName: templateName
            },
            json: true
        };

        return await doRequest(options);
    },

    updateTemplate: async function (flag = 'edi', templateName, templateBody) {

        if (!templateName) {
            throw new Error('Invalid template name');
        }

        let options = {
            method: 'POST',
            uri: ediServerUri + '/template/' + flag + '/' + templateName,
            body: templateBody,
            json: true
        };

        return await doRequest(options);
    },

    deleteTemplate: async function (flag = 'edi', templateName) {

        if (!templateName) {
            throw new Error('Invalid template name');
        }

        let options = {
            method: 'DELETE',
            uri: ediServerUri + '/template/' + flag + '/' + templateName,
            json: true
        };

        return await doRequest(options);
    },

    generateEdi: async function (templateName, jsonData) {

        if (!templateName) {
            throw new Error('Invalid template name');
        }

        let options = {
            method: 'POST',
            uri: ediServerUri + '/to_edi/' + templateName,
            body: {
                ediJson: jsonData
            },
            json: true
        };

        return await doRequest(options);
    },

    parseEra: async function (templateName, ediText) {

        if (!templateName) {
            throw new Error('Invalid template name');
        }

        let options = {
            method: 'POST',
            uri: ediServerUri + '/to_json/' + templateName,
            body: {
                ediText
            },
            json: true
        };

        return await doRequest(options);
    },
};

module.exports = ediProxyServer;
