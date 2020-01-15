const express = require('express');//
const casGroupRouter = require('./cas-group-codes');
const adjustmentRouter = require('./adjustment-codes');
const casReasonRouter = require('./cas-reason-codes');
const billingProviderRouter = require('./billing-providers');
const billingClassRouter = require('./billing-classes');
const providerIdCodeQualifierRouter = require('./provider-id-code-qualifiers');
const providerIdCodeRouter = require('./provider-id-codes');
const billingCodeRouter = require('./billing-codes');
const claimStatusRouter = require('./claim-status');
const paperClaimPrinterSetupRouter = require('./paper-claim-printer-setup');
const providerLevelCodeRouter = require('./provider-level-codes');
const billingMessageRouter = require('./billing-messages');
const paymentReasonRouter = require('./payment-reasons');
const validationsRouter = require('./validations');
const ediClearinghouseRouter = require('./edi-clearinghouses');
const colorCode = require('./status-color-codes');
const supportingText = require('./supporting-text');
const userLog = require('./user-log');
const auditLog = require('./audit-log');
const ediTemplate = require('./edi-templates');
const insuranceX12Mapping = require('./insurance-x12-mapping');
const paperClaimTemplates = require('./printer-templates');

const app = module.exports = express();
app.use('/cas_group_codes', casGroupRouter);
app.use('/adjustment_codes', adjustmentRouter);
app.use('/cas_reason_codes', casReasonRouter);
app.use('/billing_providers', billingProviderRouter);
app.use('/billing_classes', billingClassRouter);
app.use('/provider_id_code_qualifiers', providerIdCodeQualifierRouter);
app.use('/provider_id_codes', providerIdCodeRouter);
app.use('/billing_codes', billingCodeRouter);
app.use('/paper_claim_printer_setup', paperClaimPrinterSetupRouter);
app.use('/provider_level_codes', providerLevelCodeRouter);
app.use('/claim_status', claimStatusRouter);
app.use('/billing_messages', billingMessageRouter);
app.use('/payment_reasons', paymentReasonRouter);
app.use('/validations', validationsRouter);
app.use('/edi_clearinghouses', ediClearinghouseRouter);
app.use('/status_color_codes', colorCode);
app.use('/supporting_text', supportingText);
app.use('/user_log', userLog);
app.use('/audit_log', auditLog);
app.use('/x12', ediTemplate);
app.use('/insurance_x12_mapping', insuranceX12Mapping);
app.use('/printer_templates', paperClaimTemplates);
