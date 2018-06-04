const express = require('express');

const app = express();

app.use(function (req, res, next) {
    if (req.query && req.query.filterCol) {

        let {
            filterCol,
            filterData
        } = req.query;

        let fields = JSON.parse(filterCol);
        let fieldValues = JSON.parse(filterData);

        fields.map(function (field, index) {
            req.query[field] = fieldValues[index];
        });

        return next();
    }

    next();
});

module.exports = app;
