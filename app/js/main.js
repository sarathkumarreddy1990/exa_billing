
require.config({
    waitSeconds: 0,
    paths: {
        'jquery': '../node_modules/jquery/dist/jquery',
        'underscore': '../node_modules/underscore/underscore',
        'text': '../node_modules/requirejs-text/text',
        'backbone': '../node_modules/backbone/backbone',
        'backbonesubroute': '../node_modules/backbone.subroute/backbone.subroute',
        'bootstrap': '../node_modules/bootstrap/dist/js/bootstrap.bundle',
        'moment': '../node_modules/moment/min/moment-with-locales',
        'moment-timezone': '../node_modules/moment-timezone/builds/moment-timezone-with-data',
        'jqgrid': '../libs/jqgrid/js/jquery.jqGrid.src',
        'jqgridlocale': '../libs/jqgrid/js/i18n/grid.locale-en',
        'immutable': '../node_modules/immutable/dist/immutable',
        'commonscript': 'shared/common',
        'appsettings_shared': 'shared/app.settings',
        'customgrid': 'shared/customgrid',
        'change-grid': 'shared/change-grid',
    },
    shim: {
        'bootstrap': {
            deps: ["jquery"]
        },
        'jqgrid': {
            deps: ["jquery"]
        },
        'jqgridlocale': {
            deps: ["jquery"]
        },
        'moment-timezone': {
            deps: ['moment']
        },
        'immutable': {
            exports: 'immutable'
        },
        'backbone': {
            deps: ['underscore', 'jquery']
        },
        'backbonesubroute': {
            deps: ['backbone']
        },
        'commonscript': {
            deps: ['jquery', 'immutable', 'underscore']
        },
        'appsettings_shared': {
            'deps': ['immutable']
        },
        'change-grid': {
            deps: ['jquery', 'commonscript', 'appsettings_shared']
        },
        'customgrid': {
            deps: ['change-grid'],
            exports: 'customgrid'
        },
    }
});


require([
    'immutable',
    'moment-timezone',], function (
        Immutable,
        MomentTimezone) {
        window.Immutable = Immutable;

        require([
            'jquery',
            'underscore',
            'bootstrap',
            'commonscript',
            'customgrid',
            'app'], function (
                $,
                _,
                Bootstrap,
                commonjs,
                customGrid,
                App) {
                App.initialize();
            });

    });
