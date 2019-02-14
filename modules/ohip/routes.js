'use strict';

const logger = require('../../logger');
const express = require('express');
const router = express.Router();
const OHIPModule = require('./index');

module.exports = function (billingApi) {

    const ohip = new OHIPModule(billingApi);

    const restrictAccess = ( req, res, next ) => {
        const ipList = [
            `127.0.0.1`,
            `::1`,
            `::ffff:127.0.0.1`,
        ];

        if ( ipList.indexOf(req.ip) === -1 ) {
            return res.status(401)
                .end();
        }
        return next();

    };

    const checkProgress = ( req, res, next ) => {
        const {
            endpoint,
        } = req.params;

        if ( ohip[ `${endpoint}InProgress` ] ) {
            return res.send({
                'successful': false,
                'inProgress': true,
            });
        }

        ohip[ `${endpoint}InProgress` ] = true;

        return next();
    };

    const runJob = ( req, res ) => {
        const {
            endpoint,
        } = req.params;

        ohip[ `${endpoint}Refresh` ](null, error => {
            ohip[ `${endpoint}InProgress` ] = false;

            if ( error ) {
                logger.e(`Failed to retrieve OHIP ${endpoint}`);
                logger.e(error);
                return res.send({
                    'successful': false,
                    'inProgress': false,
                });
            }
            return res.send({
                'successful': true,
                'inProgress': false,
            });
        });
    };

    router.get(`/cron/:endpoint`, restrictAccess, checkProgress, runJob);

    router.get('/sandbox', (req, res) => {
        ohip.sandbox(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });

    //TODO needs to be POST
    router.use('/submitClaims', (req, res) => {
        ohip.submitClaims(req.query, (submitErr, submitResponse) => {
            return res.send(submitResponse);
        });
    });

    // example API call:
    // http://localhost/exa_modules/billing/ohip/hcv?healthNumber=1234567890&versionCode=OK
    router.get('/validateHealthCard', (req, res) => {
        ohip.validateHealthCard(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });

    // OHIP File Management Screen
    router.get('/fileManagement', (req, res) => {
        ohip.fileManagement(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });


    router.get('/downloadRemittanceAdvice', (req, res) => {
        ohip.downloadRemittanceAdvice(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });

    router.post('/applyRemittanceAdvice', (req, res) => {
        const ohip = new OHIPModule(billingApi);
        ohip.applyRemittanceAdvice(req.body, (ohipResponse) => {
            return res.send(ohipResponse);
        });
    });

    return router;
};
