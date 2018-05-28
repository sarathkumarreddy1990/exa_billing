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
        'grid': 'shared/grid',
        'grid-events': 'shared/events',
        'appserver_shared': 'shared/app.server',
        'select2': '../node_modules/select2/dist/js/select2'
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
        'grid': {
            'deps': [ 'appsettings_shared', 'commonscript']
        },
        'grid-events': {
            'deps': [ 'commonscript' ]
        },
        'select2': {
            deps: [ "jquery" ], exports: "select2"
        }
    }
});


require([
    'immutable',
    'moment-timezone', ], function (Immutable, MomentTimezone) {
    window.Immutable = Immutable;

    require([
        'jquery',
        'underscore',
        'bootstrap',
        'commonscript',
        'customgrid',
        'app',
        'appserver_shared',
        'select2'], function ($, _, Bootstrap, commonjs, customGrid, App, Appserver, select2) {
        new Appserver(function () {

        });
        App.initialize();
    });

});
