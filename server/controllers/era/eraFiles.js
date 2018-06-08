const data = require('../../data/era/eraFiles');
const fs = require('fs');
const moment = require('moment');
const filesize = require('file-size');
const md5 = require('md5');

module.exports = {

    getEraFiles: function (params) {
        return data.getEraFiles(params);
    },

    checkERA: function (req, callback) {
        let newPath = req.body.filename;

        fs.readFile(newPath, function (err, data) {
            let tempString = data.toString();

            let bufferString = tempString.replace(/(?:\r\n|\r|\n)/g, '');

            fs.stat(newPath, function (err, stats) {
                let last_modified_date = '';
                let date_modified = '';
                let file_size = '';
                let file_size_in_kb;

                if (stats) {
                    last_modified_date = stats.mtime;
                    date_modified = moment(last_modified_date).format();//('MM/DD/YYYY hh:mm A');
                    file_size = stats['size'];
                    file_size_in_kb = Math.round(filesize(file_size).to('KB')) + ' KB';
                }

                req.file_md5 = md5(bufferString);
                req.date_modified = date_modified;
                req.file_size_in_kb = file_size_in_kb;
                req.response_type = 'EOB';
                req.era_file_content = bufferString;
                return callback('', 'Done');
            });
        });
    }
};
