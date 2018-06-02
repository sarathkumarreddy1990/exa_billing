const express = require('express');
const casGroupRouter = require('./cas-group-codes');
const adjustmentRouter = require('./adjustment-codes');
const casReasonRouter = require('./cas-reason-codes');
const billingProviderRouter = require('./billing-providers');
const billingClassRouter = require('./billing-classes');
const providerIdCodeQualifierRouter = require('./provider-id-code-qualifiers');
const providerIdCodeRouter = require('./provider-id-codes');
const billingCodeRouter = require('./billing-codes');
const claimStatusRouter = require('./claim-status');
const billingMessageRouter = require('./billing-messages');
const paymentReasonRouter = require('./payment-reasons');

const app = module.exports = express();
app.use('/cas_group_codes', casGroupRouter);
app.use('/adjustment_codes', adjustmentRouter);
app.use('/cas_reason_codes', casReasonRouter);
app.use('/billing_providers', billingProviderRouter);
app.use('/billing_classes', billingClassRouter);
app.use('/provider_id_code_qualifiers', providerIdCodeQualifierRouter);
app.use('/provider_id_codes/', providerIdCodeRouter);
app.use('/billing_codes', billingCodeRouter);
app.use('/claim_status', claimStatusRouter);
app.use('/billing_messages', billingMessageRouter);
app.use('/payment_reasons', paymentReasonRouter);