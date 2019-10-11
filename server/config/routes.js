const studiesRouter = require('../routes/studies');
const indexRouter = require('../routes/index');
const middlewares = require('../routes/middlewares');
//const authRouter = require('../routes/auth');
const reportingRoutes = require('../../modules/reporting/routes');
const OHIPRoutes = require('../../modules/ohip/routes');
const AHSRoutes = require('../../modules/ahs/routes');
const studyFiltersRouter = require('../routes/study-filters');
const appSettingsRouter = require('../routes/app-settings');
const claimFiltersRouter = require('../routes/claim/claim-filters');
const autoCompleteRouter = require('../routes/auto-complete');
const reportSettingsRouter = require('../routes/report-settings');
const setupRouters = require('../routes/setup/');
const paymentsRouter = require('../routes/payments');
const claimsRouters = require('../routes/claim/index');
const userSettingRouter = require('../routes/user-settings');
const claimsWorkbenchRouters = require('../routes/claim/claim-workbench');
const claimInquiry = require('../routes/claim/claim-inquiry');
const patientRouter = require('../routes/patients');
const studyFilterRouter = require('../routes/setup/study-filter');
const eraRouter = require('../routes/era');
const splitClaimRouter = require('../routes/claim/split-claim');
const cronRoutes = require('../routes/cron-handlers');
const router = function (app) {

    app.use('/exa_modules/billing/cron', cronRoutes);
    app.use('/exa_modules/billing', indexRouter);

    //app.use(authRouter);
    app.use(middlewares);

    app.use('/exa_modules/billing/studies', studiesRouter);
    app.use('/exa_modules/billing/reports', reportingRoutes);
    app.use('/exa_modules/billing/ohip', new OHIPRoutes());
    app.use('/exa_modules/billing/ash', new AHSRoutes());
    app.use('/exa_modules/billing/study_filters', studyFiltersRouter);
    app.use('/exa_modules/billing/app_settings', appSettingsRouter);
    app.use('/exa_modules/billing/claim_filters', claimFiltersRouter);
    app.use('/exa_modules/billing/autoCompleteRouter', autoCompleteRouter);
    app.use('/exa_modules/billing/reportSettingsRouter', reportSettingsRouter);
    app.use('/exa_modules/billing/setup', setupRouters);
    app.use('/exa_modules/billing/payments', paymentsRouter);
    app.use('/exa_modules/billing/pending_payments', paymentsRouter);
    app.use('/exa_modules/billing/claims/split_claim', splitClaimRouter);
    app.use('/exa_modules/billing/claims/claim', claimsRouters);
    app.use('/exa_modules/billing/user_settings', userSettingRouter);
    app.use('/exa_modules/billing/claim_workbench', claimsWorkbenchRouters);
    app.use('/exa_modules/billing/claims/claim_inquiry', claimInquiry);
    app.use('/exa_modules/billing/patient', patientRouter);
    app.use('/exa_modules/billing/setup/study_filters', studyFilterRouter);
    app.use('/exa_modules/billing/era', eraRouter);
};

module.exports = router;
