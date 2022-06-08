'use strict';

const express = require('express');
const router = express.Router();

const ahs = require('./index');
const wcb = require('./wcb/index');
const httpHandler = require('../../server/shared/http');

module.exports = function () {

    //TODO needs to be POST
    router.use('/submitClaims', async (req, res) => {
        let response = await ahs.submitClaims(req.body);
        return httpHandler.send(req, res, response);
    });

    router.put('/can_ahs_reassess_claim', async (req, res) => {
        let response = await ahs.reassessClaim(req.body);
        return httpHandler.send(req, res, response);
    });

    router.put('/can_ahs_delete_claim', async (req, res) => {
        const response = await ahs.deleteAhsClaim(req.body);
        return httpHandler.send(req, res, response);
    });

    router.use('/submitWcbClaim', async (req, res) => {
        let response = await wcb.submitClaims(req.body);
        return httpHandler.send(req, res, response);
    });

    router.use('/process-file', async (req, res) => {
        let response = await ahsController.processWCBFile(req.body);
    });

    return router;
};
