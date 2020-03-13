const stream = require('stream');
const {
    moduleNames,
    screenNames,
    entityNames
} = require('./constants');
const moment = require('moment');

module.exports = {

    base64Encode: function (unencoded) {
        return unencoded ? new Buffer(unencoded).toString('base64') : '';
    },

    base64Decode: function (encoded) {
        return encoded ? new Buffer(encoded, 'base64').toString('utf8') : '';
    },

    roundFee: function (value) {
        return this.round(value, 2);
    },

    roundUnits: function (value) {
        return this.round(value, 3);
    },

    round: function (value, exp) {

        if (typeof exp === 'undefined' || +exp === 0) {
            return '0.00';
        }

        value = +value;
        exp = +exp;

        if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
            return '0.00';
        }

        // Shift
        value = value.toString().split('e');
        value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp)));

        // Shift back
        value = value.toString().split('e');

        return (+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp))).toFixed(exp);
    },

    getScreenDetails: function (routeParams) {
        let moduleName = 'setup';
        let screenName = 'UI';
        let entityName = 'UI';

        let moduleNameInternal = null;
        let screenNameInternal = null;

        let apiPath = routeParams.split(/\/exa_modules\/billing\/|\/|\?/g).filter(routePrefix => !!routePrefix);

        moduleNameInternal = apiPath[0];

        moduleName = moduleNames[apiPath[0]] || apiPath[0] || moduleName;

        if (moduleName == 'reports') {
            const reportName = apiPath[3].replace(/\.[^.*]*$/, '');

            screenNameInternal = reportName;
            screenName = screenNames[reportName];
            entityName = entityNames[apiPath[1]] || entityNames[apiPath[0]] || apiPath[1] || screenName;
        } else {
            screenNameInternal = apiPath[1] ? apiPath[1] : apiPath[0];
            screenName = screenNames[apiPath[1]] || screenNames[apiPath[0]] || apiPath[1] || screenName;
            entityName = entityNames[apiPath[1]] || entityNames[apiPath[0]] || apiPath[1] || screenName;
        }

        return {
            moduleName,
            screenName,
            entityName,
            moduleNameInternal,
            screenNameInternal,
        };
    },

    isStream: function (obj) {
        return obj instanceof stream.Stream;
    },

    isReadableStream: function (obj) {
        return this.isStream(obj) && typeof obj._read === 'function' && typeof obj._readableState === 'object';
    },
    /* Query for Insurance Provider in Study Filter */
    insuranceStudyProviderName: () => {
        return ` array_remove((
            SELECT
               array_agg(insp.insurance_name) AS insurance_name 
            FROM
               patient_insurances AS pat_ins 
               LEFT JOIN
                  insurance_providers AS insp 
                  ON pat_ins.insurance_provider_id = insp.id 
            WHERE
               pat_ins.id = orders.primary_patient_insurance_id 
               OR pat_ins.id = orders.secondary_patient_insurance_id 
               OR pat_ins.id = orders.tertiary_patient_insurance_id
               AND insp.insurance_name IS NOT NULL LIMIT 1 ), null) `;
    },
    /* Query For Insurance Provider In Claim Filter */
    insuranceClaimProviderName: () => {
        return ` array_remove((
            SELECT
               array_agg(insp.insurance_name) AS insurance_name 
            FROM
               patient_insurances AS pat_ins 
               LEFT JOIN
                  insurance_providers AS insp 
                  ON pat_ins.insurance_provider_id = insp.id 
            WHERE
               pat_ins.id = primary_patient_insurance_id 
               OR pat_ins.id = secondary_patient_insurance_id 
               OR pat_ins.id = tertiary_patient_insurance_id
               AND insp.insurance_name IS NOT NULL LIMIT 1 ), null) `;
    },
    /* Query For Insurance Group Drop Down in Claim Filter */
    insuranceProviderClaimGroup: () => {
        return `ARRAY[insurance_provider_payer_types.description]`;
    },

    getLocaleDate: function (date, locale) {
        if (!date)
            return null;
        let localeFomat = this.getLocaleFormat(locale)
        return moment(date).locale(locale).format(localeFomat);
    },

    getLocaleFormat(locale) {
        return moment(new Date('December 31, 2017'))
            .locale(locale).format('L')
            .replace(/12/, 'MM')
            .replace(/31/, 'DD')
            .replace(/2017/, 'YYYY');
    },

    getCookieOption: function (cookieObj, index) {
        const {
            user_options = ''
        } = cookieObj;

        if (typeof cookieObj == 'undefined' || typeof user_options == 'undefined') {
            return '';
        }

        return user_options.split('~')[index] ||  '';
    }
};
