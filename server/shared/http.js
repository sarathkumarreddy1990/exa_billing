const logger = require('../../logger');
const shared = require('../shared/index');

module.exports = {

    send: function (req, res, responseData) {

        if (responseData && ['error', 'RequestError'].indexOf(responseData.name) > -1) {
            return this.sendError(req, res, responseData);
        }

        /// Handled Error
        if (responseData && responseData instanceof Error) {
            responseData.status = 'HANDLED_EXCEPTION';
            return this.sendError(req, res, responseData);
        }

        try {
            return res.send(responseData);
        } catch (err) {
            return res.send(err);
        }
    },

    sendRows: function (req, res, responseData) {

        if (responseData && ['error', 'RequestError'].indexOf(responseData.name) > -1) {
            return this.sendError(req, res, responseData);
        }

        /// Handled Error
        if (responseData && responseData instanceof Error) {
            responseData.status = 'HANDLED_EXCEPTION';
            return this.sendError(req, res, responseData);
        }

        try {
            return res.send(responseData.rows);
        } catch (err) {
            return res.send(err);
        }
    },

    sendHtml: function (req, res, err, response) {
        if (err) {
            return this.sendError(req, res, err);
        }

        try {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(response);
        } catch (err) {
            return res.send(err);
        }
    },

    sendPdf: function (req, res, responseData) {
        if (responseData && ['error', 'RequestError'].indexOf(responseData.name) > -1) {
            return this.sendError(req, res, responseData);
        }

        res.writeHead(200, { 'Content-Type': 'application/pdf' });

        if (shared.isReadableStream(responseData)) {
            res.setTimeout(5 * 60 * 1000);
            responseData.pipe(res);
        } else {
            res.end(responseData);
        }
    },

    sendError: function (req, res, err, meta) {
        try {
            logger.error('Error', err);

            meta = meta || {
                errorCode: err.code || '',
                errorDesc: err.message
            };

            const stack = new Error().stack;
            const callstack = stack.toString();

            res.status(500).send({
                err,
                callstack,
                errorCode: meta.errorCode || '',
                errorDesc: meta.errorDesc || '',
                userData: meta
            });
        } catch (err) {
            logger.error('When sending error response', err);
        }
    }
};
