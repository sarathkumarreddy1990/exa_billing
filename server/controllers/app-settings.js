const data = require('../data/app-settings');
const hotkeys = require('../shared/hotkeys');
const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const readFileAsync = promisify(fs.readFile);

module.exports = {
    getData: async function (params) {
        const response = await data.getData(params);

        if (!response.rows || !response.rows.length) {
            return response;
        }

        let file_path = path.join(__dirname, '../../app/resx/countries.json');
        let countries = await readFileAsync(file_path, 'utf8');
        countries = JSON.parse(countries);
        let usaInfo = countries.find(country => country.alpha_3_code === 'usa');

        if (usaInfo) {
            usaInfo.provinces = (response.rows[0].states && response.rows[0].states.length && response.rows[0].states[0].app_states).sort();
        }

        response.rows[0].hotkeys = hotkeys;
        response.rows[0].countries = countries || [];
        return response;
    }
};
