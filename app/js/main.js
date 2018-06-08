require.config({
    waitSeconds: 0,
    paths: {
        'jquery': '../node_modules/jquery/dist/jquery',
        'jquery.validate': '../node_modules/jquery-validation/dist/jquery.validate',
        'jqueryvalidateadditional': '../node_modules/jquery-validation/dist/additional-methods',
        'underscore': '../node_modules/underscore/underscore',
        'text': '../node_modules/requirejs-text/text',
        'backbone': '../node_modules/backbone/backbone',
        'backbonesubroute': '../node_modules/backbone.subroute/backbone.subroute',
        'bootstrap': '../node_modules/bootstrap/dist/js/bootstrap.bundle',
        'bootstrap-notify': '../node_modules/bootstrap-notify/bootstrap-notify',
        'bootstrapmultiselect': '../node_modules/bootstrap-multiselect/dist/js/bootstrap-multiselect',
        'moment': '../node_modules/moment/min/moment-with-locales',
        'moment-timezone': '../node_modules/moment-timezone/builds/moment-timezone-with-data',
        'jqgrid': '../libs/jqgrid/js/jquery.jqGrid.src',
        'jqgridlocale': '../libs/jqgrid/js/i18n/grid.locale-en',
        'immutable': '../node_modules/immutable/dist/immutable',
        'jstorage': '../node_modules/jstorage/jstorage.min',
        'datetimepicker': '../node_modules/eonasdan-bootstrap-datetimepicker/src/js/bootstrap-datetimepicker',
        'daterangepicker': '../node_modules/bootstrap-daterangepicker/daterangepicker',
        'commonscript': 'shared/common',
        'layout': 'shared/layout',
        'debug': 'shared/debug',
        'appsettings_shared': 'shared/app-settings',
        'customgrid': 'shared/customgrid',
        'i18nscript': 'shared/i18n',
        'sessionhandler': 'shared/session-manager',
        'change-grid': 'shared/change-grid',
        'grid': 'shared/grid',
        'grid-events': 'shared/events',
        'appserver_shared': 'shared/app-server',
        'select2': '../node_modules/select2/dist/js/select2.full'
    },
    shim: {
        'jquery.validate': {
            deps: ['jquery']
        },
        'jqueryvalidateadditional': {
            deps: ['jquery', 'jquery.validate']
        },
        'bootstrap': {
            deps: ["jquery"]
        },
        'jqgrid': {
            deps: ["jquery"]
        },
        'jqgridlocale': {
            deps: ["jquery"]
        },
        'bootstrapmultiselect': {
            deps: ["jquery"]
        },
        'bootstrap-notify': {
            deps: ["bootstrap"]
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
        'jstorage': {
            deps: ['jquery']
        },
        'datetimepicker': {
            deps: ['jquery', 'moment', 'bootstrap']
        },
        'daterangepicker': {
            deps: ["jquery", "moment"]
        },
        'commonscript': {
            deps: ['jquery', 'immutable', 'underscore']
        },
        'i18nscript': {
            deps: ['jquery']
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
            'deps': ['appsettings_shared', 'commonscript']
        },
        'grid-events': {
            'deps': ['commonscript']
        },
        'select2': {
            deps: ["jquery"], exports: "select2"
        }
    }
});


require([
    'immutable',
    'moment-timezone',
    'jquery.validate',
], function (
    Immutable,
    MomentTimezone,
    jqueryvalidate,
    ) {
        window.browserLocale = typeof browserLocale == 'undefined' ? 'en-US' : browserLocale;
        window.Immutable = Immutable;

        require([
            'jquery',
            'underscore',
            'jqueryvalidateadditional',
            'jstorage',
            'bootstrap',
            'bootstrap-notify',
            'commonscript',
            'layout',
            'debug',
            'i18nscript',
            'sessionhandler',
            'customgrid',
            'app',
            'appserver_shared',
            'bootstrapmultiselect',
            'select2',
            'datetimepicker',
            'daterangepicker'
        ], function (
            $,
            _,
            jqueryvalidateadditional,
            jstorage,
            Bootstrap,
            bootstrapNotify,
            commonjs,
            layout,
            debug,
            i18n,
            sessionhandler,
            customGrid,
            App,
            Appserver,
            bootstrapmultiselect,
            select2,
            datetimepicker,
            daterangepicker
        ) {
                new Appserver(function () {
                    App.initialize();
                });

            });

    });
