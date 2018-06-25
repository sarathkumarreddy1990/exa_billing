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

    getScreenDetails: function (routeParams) {
        let moduleName = 'setup';
        let screenName = 'UI';
        let entityName = 'UI';

        let moduleNameInternal = null;
        let screenNameInternal = null;

        let apiPath = routeParams.split(/\/exa_modules\/billing\/|\/|\?/g).filter(routePrefix => !!routePrefix);

        moduleNameInternal = apiPath[0];
        screenNameInternal = apiPath[1] ? apiPath[1] : apiPath[0];

        moduleName = moduleNames[apiPath[0]] || apiPath[0] || moduleName;
        screenName = screenNames[apiPath[1]] || screenNames[apiPath[0]] || apiPath[1] || screenName;
        entityName = entityNames[apiPath[1]] || entityNames[apiPath[0]] || apiPath[1] || screenName;

        return {
            moduleName,
            screenName,
            entityName,
            moduleNameInternal,
            screenNameInternal,
        };
    }
};
