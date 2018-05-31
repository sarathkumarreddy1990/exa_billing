const express = require('express');
const casGroupRouter = require('./cas-group-codes');
const adj = require('./adjustment_codes');

const app = module.exports = express();
app.use('/cas_group_codes',casGroupRouter);
app.use('/adjustment_codes',adj);
