'use strict';

const SQL = require('sql-template-strings');
const express = require('express');
const app = express();

const logger = require('../logger');
const config = require('./config');
const ediConnect = require('../modules/edi');

const initializeWeb = async function () {
    logger.info('Initializing web..');

    await config.initialize();
    ediConnect.init(config.get('ediServerUrl') || 'http://localhost:5581/edi/api');

    const {
        query,
    } = require('./data');

    async function getCompanyId ( companyCode ) {
        const sql = SQL`
            SELECT
                id
            FROM
                companies
            WHERE
                deleted_dt IS NULL    
        `;

        if ( companyCode ) {
            sql.append(SQL` AND trim(lower(company_code)) = ${companyCode.toLowerCase().trim()} `);
        }

        try {
            const response = await query(sql.text, sql.values);
            const row = response.rows[ 0 ];
            const { id } = row;
            return `${id}`;
        }
        catch ( e ) {
            logger.error(`No company ID for this installation.  Quitting.`);
            process.exit(1);
        }
    }

    const {
        companyCode,
    } = config.get(config.keys.RedisStore);

    const companyId = await getCompanyId(companyCode);

    require('./config/express')(app, express, companyId);

    return app;
};

module.exports = initializeWeb;
