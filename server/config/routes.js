const studiesRouter = require('../routes/studies');
const indexRouter = require('../routes/index');
//const authRouter = require('../routes/auth');
const reportingRoutes = require('../../modules/reporting/routes');
const studyFiltersRouter = require('../routes/studyFilters');
const appSettingsRouter = require('../routes/app-settings');

const router = function (app) {

    app.use('/exa_modules/billing', indexRouter);

    //app.use(authRouter);

    app.use('/exa_modules/billing/studies', studiesRouter);
    app.use('/exa_modules/billing/reports', reportingRoutes);
    app.use('/exa_modules/billing/studyFilters', studyFiltersRouter);
    app.use('/exa_modules/billing/appSettings', appSettingsRouter);
};

module.exports = router;
