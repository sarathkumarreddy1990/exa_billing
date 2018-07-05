const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

const languages = {};

module.exports = {

    /// TODO: use languages {}
    getI18nData: async function (culture) {

        let dir = culture.replace('.json', '');

        if (languages && languages[dir]) {
            return languages[dir];
        }

        let jsonI18nData = {};
        let i18nPath = path.join(__dirname, '../i18n/', dir);

        try {
            let dirExists = fs.existsSync(i18nPath);

            if (!dirExists) {
                i18nPath = path.join(__dirname, '../i18n/default');
            }

            let names = await readdir(i18nPath);

            if (names.length === 0) {
                return this.getI18nData('default');
            }

            for (const fileName of names) {
                const jsonFilePath = path.join(i18nPath, fileName);
                const data = await readFile(jsonFilePath);

                jsonI18nData = Object.assign(jsonI18nData, JSON.parse(data));
            }

            languages[dir] = jsonI18nData;
            return jsonI18nData;
        } catch (err) {
            throw err;
        }
    }
};
