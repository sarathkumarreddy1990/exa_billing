const studiesRouter = require('../routes/studies');
const indexRouter = require('../routes/index');
const middlewares = require('../routes/middlewares');
//const authRouter = require('../routes/auth');
const reportingRoutes = require('../../modules/reporting/routes');
const studyFiltersRouter = require('../routes/study-filters');
const appSettingsRouter = require('../routes/app-settings');
const claimFiltersRouter = require('../routes/claim-filters');
const autoCompleteRouter = require('../routes/auto-complete');
const setupRouters = require('../routes/setup/');
const paymentsRouter = require('../routes/payments');
const editPaymentsRouter = require('../routes/edit-payments');
const claimsRouters = require('../routes/claims');
const userSettingRouter = require('../routes/user-settings');
const claimsWorkbenchRouters = require('../routes/claim-workbench');

const router = function (app) {

    app.use('/exa_modules/billing', indexRouter);

    //app.use(authRouter);
    app.use(middlewares);

    app.use('/exa_modules/billing/studies', studiesRouter);
    app.use('/exa_modules/billing/reports', reportingRoutes);
    app.use('/exa_modules/billing/studyFilters', studyFiltersRouter);
    app.use('/exa_modules/billing/appSettings', appSettingsRouter);
    app.use('/exa_modules/billing/claimFilters', claimFiltersRouter);
    app.use('/exa_modules/billing/autoCompleteRouter', autoCompleteRouter);
    app.use('/exa_modules/billing/setup', setupRouters);
    app.use('/exa_modules/billing/payments', paymentsRouter);
    app.use('/exa_modules/billing/pending_payments', editPaymentsRouter);
    app.use('/exa_modules/billing/claims', claimsRouters);
    app.use('/exa_modules/billing/user_settings', userSettingRouter);
    app.use('/exa_modules/billing/claimWorkbench', claimsWorkbenchRouters);
};

module.exports = router;
