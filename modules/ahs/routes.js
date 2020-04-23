'use strict';

const express = require('express');
const router = express.Router();

const ahs = require('./index');
const httpHandler = require('../../server/shared/http');
const sftp = require('./sftp');

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

    return router;
};
