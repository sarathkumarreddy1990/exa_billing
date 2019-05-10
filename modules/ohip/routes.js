'use strict';

const logger = require('../../logger');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const ohip = require('./index');
const claimWorkbenchController = require('../../server/controllers/claim/claim-workbench');
const _ = require('lodash');
const httpHandler = require('../../server/shared/http');

module.exports = function () {

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
            ohipResponse.err = ohipErr;
            return httpHandler.send(req, res, ohipResponse);
        });
    });

    // OHIP File Management Screen
    router.get('/fileManagement', (req, res) => {
        ohip.fileManagement(req.query, (ohipErr, ohipResponse) => {
            return httpHandler.send(req, res, ohipErr || ohipResponse.rows);
        });
    });


    router.get('/downloadRemittanceAdvice', (req, res) => {
        ohip.downloadRemittanceAdvice(req.query, (ohipErr, ohipResponse) => {
            return httpHandler.send(req, res, ohipErr || ohipResponse);
        });
    });

    router.post('/applyRemittanceAdvice', (req, res) => {
        ohip.applyRemittanceAdvice(req.body, (ohipResponse) => {
            return httpHandler.send(req, res, ohipResponse);
        });
    });

    router.get('/ct', (req, res) => {
        ohip.conformanceTesting(req.query, (ohipErr, ohipResponse) => {
            return httpHandler.send(req, res, ohipErr || ohipResponse);
        });
    });

    router.post('/ct', (req, res) => {
        ohip.conformanceTesting(req.body, (ohipErr, ohipResponse) => {
            return httpHandler.send(req, res, ohipErr || ohipResponse);
        });
    });


    return router;
};
