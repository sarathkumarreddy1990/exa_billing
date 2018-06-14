const path = require('path');

const createError = require('http-errors');
const cookieParser = require('cookie-parser');
const responseTime = require('response-time');
const logger = require('../../logger');

module.exports = function (app, express) {

    // view engine setup
    app.set('views', path.join(__dirname, '../views'));
    app.set('view engine', 'pug');

    app.use(responseTime());

    if (process.env.NODE_ENV != 'production') {
        //app.use(logger(':date[iso] :remote-addr :method :url', {immediate: true}));
        logger.info('Starting LESS middleware');

        const lessMiddleware = require('less-middleware');

        app.use('/exa_modules/billing/static', lessMiddleware(path.join(__dirname, '/../../app'), {
            debug: true,
            render: { compress: true }
        }));
    }

    //app.use(logger('dev')); 
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use('/exa_modules/billing/static', express.static(path.join(__dirname, '../../app')));

    require('./session')(app);
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
