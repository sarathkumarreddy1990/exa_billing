const express = require('express');
const eraRouter = require('./era');
const app = module.exports = express();

app.use('/list', eraRouter);
app.use('/eobSelectIframe', eraRouter);
app.use('/uploadEOBFile', eraRouter);