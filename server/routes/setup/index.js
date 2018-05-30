const express = require('express');
const casGroupRouter = require('./cas-group-codes');

const app = module.exports = express();
app.use('/cas_group_codes',casGroupRouter);
