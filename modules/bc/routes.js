'use strict';

const Router = require('express-promise-router');
const router = new Router();
const bc = require('./index');
const httpHandler = require('../../server/shared/http');

router.use('/submitClaims', async (req, res) => {
    let response = await bc.submitClaims(req.body);
    return httpHandler.send(req, res, response);
});

module.exports = router;

