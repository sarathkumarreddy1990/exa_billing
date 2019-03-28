'use strict';

const logger = require('../../logger');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const OHIPModule = require('./index');
const claimWorkbenchController = require('../../server/controllers/claim/claim-workbench');
const _ = require('lodash');
const httpHandler = require('../../server/shared/http');

module.exports = function (billingApi) {

    const ohip = new OHIPModule(billingApi);

    router.get('/downloadAndProcessResponseFiles', (req, res) => {
        ohip.downloadAndProcessResponseFiles(req.query, (ohipErr, ohipResponse) => {
            return httpHandler.send(req, res, ohipErr || ohipResponse);
        });
    });


    //TODO needs to be POST
    router.use('/submitClaims', async (req, res) => {

        // req.body.company_id = req.body.companyId;
        // req.body.user_id = req.body.userId;
        // const data = await claimWorkbenchController.getData(req.body);
        // req.body.claimIds = _.map(data.rows, 'claim_id');
        ohip.submitClaims(req, (submitErr, submitResponse) => {
            return httpHandler.send(req, res, submitErr || submitResponse);
        });
    });

    // example API call:
    // http://localhost/exa_modules/billing/ohip/hcv?healthNumber=1234567890&versionCode=OK
    router.get('/validateHealthCard', (req, res) => {
        ohip.validateHealthCard(req.query, (ohipErr, ohipResponse) => {
            return httpHandler.send(req, res, ohipErr || ohipResponse);
        });
    });

    // OHIP File Management Screen
    router.get('/fileManagement', (req, res) => {
        ohip.fileManagement(req.query, (ohipErr, ohipResponse) => {
            return httpHandler.send(req, res, ohipErr || ohipResponse);
        });
    });


    router.get('/downloadRemittanceAdvice', (req, res) => {
        ohip.downloadRemittanceAdvice(req.query, (ohipErr, ohipResponse) => {
            return httpHandler.send(req, res, ohipErr || ohipResponse);
        });
    });

    router.post('/applyRemittanceAdvice', (req, res) => {
        const ohip = new OHIPModule(billingApi);
        ohip.applyRemittanceAdvice(req.body, (ohipResponse) => {
            return httpHandler.send(req, res, ohipErr || ohipResponse);
        });
    });

    router.get('/ct', (req, res) => {
        const ohip = new OHIPModule(billingApi);
        ohip.conformanceTesting(req.query, (err, ohipResponse) => {
            return httpHandler.send(req, res, ohipErr || ohipResponse);
        });
    });

    router.post('/ct', (req, res) => {
        const ohip = new OHIPModule(billingApi);
        ohip.conformanceTesting(req.body, (err, ohipResponse) => {
            return httpHandler.send(req, res, ohipErr || ohipResponse);
        });
    });


    return router;
};
