'use strict';

const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const helmet = require('helmet');
const createError = require('http-errors');
const cookieParser = require('cookie-parser');
const responseTime = require('response-time');
const csurf = require('csurf');

const csrfMiddleware = csurf({
    cookie: true
});

const logger = require('../../logger');

module.exports = function (app, express, companyId) {

    // view engine setup
    app.set('views', path.join(__dirname, '../views'));
    app.set('view engine', 'pug');

    app.use(responseTime());

    app.use(bodyParser.json({
        limit: '500mb',
        parameterLimit: 100000
    }));

    app.use(bodyParser.urlencoded({
        limit: '500mb',
        extended: true
    }));

    app.use((req, res, next) => {
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.locals.cspNonce = crypto.randomBytes(16).toString('hex');
        next();
    });

    app.use(helmet.contentSecurityPolicy({
        directives: {
            imgSrc: [
                "'self'",
                "data:",
                "blob:"
            ],
            defaultSrc: [
                "'self'",
                "'unsafe-inline'",
                "'self' blob:",
            ],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                //(req, res) => `nonce-${res.locals.cspNonce}'`
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://exalocal.viztek.net:33355",
                "https://fonts.googleapis.com",
            ],
            scriptSrcAttr: [
                "'self'",
                "'unsafe-inline'",
            ],
        }
    }));

    app.use(helmet.noSniff());

    app.use(helmet.frameguard({
        action: 'sameorigin'
    }));

    if (process.env.NODE_ENV != 'production') {
        //app.use(logger(':date[iso] :remote-addr :method :url', {immediate: true}));
        logger.info('Starting LESS middleware');

        const lessMiddleware = require('less-middleware');

        app.use('/exa_modules/billing/static', lessMiddleware(path.join(__dirname, '/../../app'), {
            debug: true,
            render: { compress: true }
        }));
    }

    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(csrfMiddleware);
    app.use('/exa_modules/billing/static', express.static(path.join(__dirname, '../../app')));

    require('./session')(app, companyId);
    require('./routes')(app);

    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
        next(createError(404));
    });

    // error handler
    app.use(function (err, req, res) {
        // set locals, only providing error in development
        res.locals.message = err.message;
        res.locals.error = req.app.get('env') === 'development' ? err : {};

        // render the error page
        res.status(err.status || 500);
        res.render('error');
    });
};
