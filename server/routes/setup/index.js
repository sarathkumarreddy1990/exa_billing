const express = require('express');
const casGroupRouter = require('./cas-group-codes');
const adjustmentRouter = require('./adjustment-codes');
const casReasonRouter = require('./cas-reason-codes');
const billingProviderRouter = require('./billing-providers');
const billingClassRouter = require('./billing-classes');
const providerIdCodeQualifierRouter = require('./provider-id-code-qualifiers');
const providerIdCodeRouter = require('./provider-id-codes');

const app = module.exports = express();
app.use('/cas_group_codes',casGroupRouter);
app.use('/adjustment_codes',adjustmentRouter);
app.use('/cas_reason_codes', casReasonRouter);
app.use('/billing_providers',billingProviderRouter);
app.use('/billing_classes', billingClassRouter);
app.use('/provider_id_code_qualifiers',providerIdCodeQualifierRouter);
app.use('/provider_id_codes/',providerIdCodeRouter);
