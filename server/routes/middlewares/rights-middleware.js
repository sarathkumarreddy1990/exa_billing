const express = require('express');
//const shared = require('../../shared');

const app = express();

app.use(function (req, res, next) {

    /// TODO: Check rights

    next();
});

module.exports = app;
