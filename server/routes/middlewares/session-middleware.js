const express = require('express');

const app = express();

app.use(function (req, res, next) {

    if(req.isAuthenticated()) {
        return next();
    }

    throw new Error('INVALID_SESSION');
});

module.exports = app;
