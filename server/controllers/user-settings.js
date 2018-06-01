let Promise = require('bluebird');
let path = require('path');
let fs = Promise.promisifyAll(require('fs'));
const data = require('../data/user-settings');

module.exports = {

    userSettingColumn: function () {
        let file_path = path.join(__dirname, '../resx/billingFields.json');
        let gridFields = fs.readFileAsync(file_path, 'utf8');

        return gridFields;
    },

    save: function (args) {
        return data.save(args);
    }
};
