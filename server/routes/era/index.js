const express = require('express');
const eraRouter = require('./era');
const app = module.exports = express();

app.use('/', eraRouter);
