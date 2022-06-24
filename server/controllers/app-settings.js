const data = require('../data/app-settings');
const hotkeys = require('../shared/hotkeys');
const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const readFileAsync = promisify(fs.readFile);
const config = require('./../config');
const { body_parts } = require('../../app/resx/body_parts.json');
const { orientation } = require('../../app/resx/orientation.json');

const getOHIPConfiguration = () => {

    const relevantParamDescriptors = {
        'showConformanceTesting': 'boolean',
    };
    const relevantParamKeys = Object.keys(relevantParamDescriptors);

    return (config.get('ohipModuleParams') || '').split(';').reduce((ohipConfig, param) => {
        if (param) {    // could be an empty string

            const paramParts = param.split('=');
            const paramKey = paramParts[0].trim();
            const paramValue = paramParts[1].trim();

            if (relevantParamKeys.includes(paramKey)) {
                if (relevantParamDescriptors[paramKey] === 'boolean') {
                    ohipConfig[paramKey] = (paramValue === 'true');    // string in, boolean out
                }
                else if (relevantParamDescriptors[paramKey] === 'number') {
                    ohipConfig[paramKey] = ~~paramValue;    // string in, number out
                }
                else {
                    ohipConfig[paramKey] = paramValue;
                }
            }
        }
        return ohipConfig;
    }, {
        isProduction: config.get('ebsProduction'),
    });
};

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

        const app_settings = response.rows[0];

        const {
            country_alpha_3_code,
            province_alpha_2_code,
        } = app_settings;

        if (country_alpha_3_code === 'can' && province_alpha_2_code === 'ON') {
            app_settings.ohipConfig = getOHIPConfiguration();
        }

        app_settings.modules = {};
        app_settings.modules.chat = config.get('chatGlobalAvailability');
        app_settings.modules.multipanel = config.get('multipanel_transcription_editor');
        app_settings.isMobileBillingEnabled = config.get('enableMobileBilling');

        app_settings.hotkeys = hotkeys;
        app_settings.countries = countries || [];
        app_settings.bodyPartsList = body_parts || [];
        app_settings.orientationsList = orientation || [];

        return response;
    }
};
