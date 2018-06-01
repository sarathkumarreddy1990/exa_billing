let path = require('path');
const fs = require('fs');
const  {promisify}  = require('util');
const readFileAsync = promisify(fs.readFile);
const data = require('../data/user-settings');

module.exports = {

    getGridFields: function () {
        let file_path = path.join(__dirname, '../resx/grid-fields.json');
        let gridFields = readFileAsync(file_path, 'utf8');

        return gridFields;
    },

    save: function (args) {
        return data.save(args);
    }
};
