'use strict';

const express = require('express');
const router = express.Router();
const logger = require('../../logger');

const ohip = require('../../modules/ohip');
const ahs = require('../../modules/ahs/sftp');
const acr = require('../controllers/setup/collection-process');
const edi = require('../../modules/edi/sftp');
const httpHandler = require('../shared/http');
const bc = require('../../modules/bc/cron');

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

router.get('/ohip/:endpoint', restrictAccess, checkProgress, runJob);

const handleEvents = async (req, res) => {
    let {
        ip,
        session: {
            company_id
        } = {},
        params,
        query,
    } = req;

    let companyId = 0;
    let response;

    companyId = company_id || query && query.company_id;

    if (params.province === 'bc') {
        response = await bc.events({
            ...params,
            ...query,
            companyId,
            ip,
            isCron: true
        });
    } else if (params.province === 'ahs') {
        response = await ahs.events({
            ...params,
            ...query,
            company_id,
            ip,
        });
    }

    return httpHandler.send(req, res, response);
};

router.get('/:province/files/:action', restrictAccess, handleEvents);

const autoCollectionsProcess = async (req, res) => {
    let {
        ip,
        session,
        params,
        query,
    } = req;

    let companyId = 0;

    if (session && session.company_id > 0) {
        companyId = session.company_id;
    }
    else if (query && query.company_id > 0) {
        companyId = query.company_id;
    }

    let response = await acr.autoCollectionsProcess({
        ...params,
        ...query,
        companyId,
        ip,
    });
    return httpHandler.send(req, res, response);
};

const clearingHouse = async (req, res) => {
    let {
        ip,
        session,
        params,
        query,
    } = req;

    let companyId = 0;

    if (session && session.company_id > 0) {
        companyId = session.company_id;
    }
    else if (query && query.company_id > 0) {
        companyId = query.company_id;
    }

    let response = await edi.events({
        ...params,
        ...query,
        companyId,
        ip,
    });
    return httpHandler.send(req, res, response);
};

router.get('/acr/process', restrictAccess, autoCollectionsProcess);

router.get('/edi/files/:action', restrictAccess, clearingHouse);

module.exports = router;
