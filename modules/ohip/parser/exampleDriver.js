
const fs = require('fs');
const path = require('path');
const constants = require('../constants');

const Parser = require('.');
const filename = process.argv[2];

fs.readFile(path.join('..','Data', filename) , constants.encoding, (err, data) => {
    if (err) throw err;

    let parser = new Parser(filename, {});

    if (parser) {
        console.log(JSON.stringify(
            parser.parse(data)
        ));
    }
});
