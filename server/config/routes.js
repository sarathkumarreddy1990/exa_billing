const studiesRouter = require('../routes/studies');
const indexRouter = require('../routes/index');
const reportingRoutes = require('../../modules/reporting/routes');

const router = function (app) {

    app.use('/exa_modules/billing', indexRouter);
    app.use('/exa_modules/billing/studies', studiesRouter);
    app.use('/exa_modules/billing/reports', reportingRoutes);
};

module.exports = router;
