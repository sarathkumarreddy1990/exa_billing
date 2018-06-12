const studiesRouter = require('../routes/studies');
const indexRouter = require('../routes/index');
const middlewares = require('../routes/middlewares');
//const authRouter = require('../routes/auth');
const reportingRoutes = require('../../modules/reporting/routes');
const studyFiltersRouter = require('../routes/study-filters');
const appSettingsRouter = require('../routes/app-settings');
const claimFiltersRouter = require('../routes/claim/claim-filters');
const autoCompleteRouter = require('../routes/auto-complete');
const setupRouters = require('../routes/setup/');
const paymentsRouter = require('../routes/payments');
const claimsRouters = require('../routes/claims');
const userSettingRouter = require('../routes/user-settings');
const claimsWorkbenchRouters = require('../routes/claim/claim-workbench');
const claimInquiry = require('../routes/claim/claim-inquiry');
const patientRouter = require('../routes/patients');
const studyFilterRouter = require('../routes/setup/study-filter');
const eraRouter = require('../routes/era');

const router = function (app) {

    app.use('/exa_modules/billing', indexRouter);

    //app.use(authRouter);
    app.use(middlewares);

    app.use('/exa_modules/billing/studies', studiesRouter);
    app.use('/exa_modules/billing/reports', reportingRoutes);
    app.use('/exa_modules/billing/studyFilters', studyFiltersRouter);
    app.use('/exa_modules/billing/app_settings', appSettingsRouter);
    app.use('/exa_modules/billing/claimFilters', claimFiltersRouter);
    app.use('/exa_modules/billing/autoCompleteRouter', autoCompleteRouter);
    app.use('/exa_modules/billing/setup', setupRouters);
    app.use('/exa_modules/billing/payments', paymentsRouter);
    app.use('/exa_modules/billing/pending_payments', paymentsRouter);
    app.use('/exa_modules/billing/claims', claimsRouters);
    app.use('/exa_modules/billing/user_settings', userSettingRouter);
    app.use('/exa_modules/billing/claimWorkbench', claimsWorkbenchRouters);
    app.use('/exa_modules/billing/claim_inquiry', claimInquiry);
    app.use('/exa_modules/billing/patient', patientRouter);
    app.use('/exa_modules/billing/setup/study_filters', studyFilterRouter);
    app.use('/exa_modules/billing/era', eraRouter);
};

module.exports = router;
