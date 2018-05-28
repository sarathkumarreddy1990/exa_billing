const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

const languages = {};

module.exports = {

    getI18nData: async function (culture) {

        let dir = culture.replace('.json', '');

        if (languages && languages[dir]) {
            return languages[dir];
        } else {
            let jsonI18nData = {};
            let i18nPath = path.join(__dirname, '../i18n/', dir);

            try {
                let names = await readdir(i18nPath);

                for (let i = 0; i < names.length; i++) {
                    let jsonFilePath = path.join(i18nPath, names[i]);
                    let data = await readFile(jsonFilePath);

                    jsonI18nData = Object.assign(jsonI18nData, JSON.parse(data));
                }

                return jsonI18nData;
            } catch (err) {
                throw err;
            }
        }
    }
};
