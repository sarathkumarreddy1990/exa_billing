const studiesRouter = require('../routes/studies');
const indexRouter = require('../routes/index');
//const authRouter = require('../routes/auth');
const reportingRoutes = require('../../modules/reporting/routes');
const studyFiltersRouter = require('../routes/study-filters');
const appSettingsRouter = require('../routes/app-settings');
const claimFiltersRouter = require('../routes/claim-filters');
const autoCompleteRouter = require('../routes/autoCompleteDropDown');
const paymentsRouter = require('../routes/payments');
const editPaymentsRouter = require('../routes/edit-payments');

const router = function (app) {

    app.use('/exa_modules/billing', indexRouter);

    //app.use(authRouter);

    app.use('/exa_modules/billing/studies', studiesRouter);
    app.use('/exa_modules/billing/reports', reportingRoutes);
    app.use('/exa_modules/billing/studyFilters', studyFiltersRouter);
    app.use('/exa_modules/billing/appSettings', appSettingsRouter);
    app.use('/exa_modules/billing/claimFilters', claimFiltersRouter);
    app.use('/exa_modules/billing/autoCompleteRouter', autoCompleteRouter);
    app.use('/exa_modules/billing/payments', paymentsRouter);
    app.use('/exa_modules/billing/pending_payments', editPaymentsRouter);
};

module.exports = router;
