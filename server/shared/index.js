const {
    moduleNames,
    screenNames,
    entityNames
} = require('./constants');

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
    }
};
