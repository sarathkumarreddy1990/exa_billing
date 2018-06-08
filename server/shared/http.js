const logger = require('../../logger');

module.exports = {

    views: {},

    initializeViews: function () { 
        const jade = require('jade');
        this.views.eob = this.loadJade(jade, 'eobSelect.jade');
    },

    loadJade: function (jade, template) {
        return jade.compileFile(require.resolve('../views/' + template));
    },

    send: function (req, res, responseData) {
        try {
            return res.send(responseData);
        } catch (err) {
            return res.send(err);
        }
    },

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

    sendView: function (viewId, viewModel = {}, req, res) {
        res.header('Expires', new Date('1/1/1900').toUTCString());

        const modelWithLocale = Object.assign(viewModel, {
            'browserLocale': (req.headers['accept-language'] || 'en-US').split(/;/)[0].split(/,/)[0]
        });

        res.write(this.views[viewId](modelWithLocale), modelWithLocale);
        return res.end();
    }
};
