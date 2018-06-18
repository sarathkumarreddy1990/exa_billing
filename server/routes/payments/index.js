const express = require('express');
const paymentsRouter = require('./payments');
const editPaymentsRouter = require('./edit-payments');
const app = module.exports = express();

app.use('/list', paymentsRouter);
app.use('/', paymentsRouter);
app.use('/all', editPaymentsRouter);
app.use('/', editPaymentsRouter);
