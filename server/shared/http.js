const logger = require('../../logger');

module.exports = {
    sendRows: function (req, res, responseData) {
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

    sendError: function (req, res, err, meta) {
        try {
            logger.error('Error', err);

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
    },
};
