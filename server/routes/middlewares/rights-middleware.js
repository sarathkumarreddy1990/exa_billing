const express = require('express');
const rights = require('../../controllers/rights');

const app = express();

app.use(function (req, res, next) {

    let hasRights = rights.checkRights({
        screens: req.session.screens,
        userType: req.session.user_type,
        route: req.path,
    });
console.log('hasRights ', hasRights);

    if (hasRights) {
        return next();
    }

    res.send({
        error: {
            code: '03',
            description: 'Access Denied'
        }
    });
});

module.exports = app;
