const express = require('express');
const eraRouter = require('./era');
const app = module.exports = express();

app.use('/list', eraRouter);
app.use('/upload-era-file', eraRouter);
app.use('/iframe-era-src', eraRouter);
app.use('/', eraRouter);