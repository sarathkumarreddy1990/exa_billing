var rjsConfig = {
    waitSeconds: 0,
    paths: {
        'fastdom': '../node_modules/fastdom/fastdom.min',
        'jquery': '../node_modules/jquery/dist/jquery',
        'jquery.validate': '../node_modules/jquery-validation/dist/jquery.validate',
        'jqueryvalidateadditional': '../node_modules/jquery-validation/dist/additional-methods',
        'underscore': '../node_modules/underscore/underscore',
        'hotkeys': '../node_modules/jquery.hotkeys/jquery.hotkeys',
        '_get': '../libs/_get/index',
        'text': '../node_modules/requirejs-text/text',
        'backbone': '../node_modules/backbone/backbone',
        'backbonesubroute': '../node_modules/backbone.subroute/backbone.subroute',
        'bootstrap': '../node_modules/bootstrap/dist/js/bootstrap.bundle',
        'bootstrap-notify': '../node_modules/bootstrap-notify/bootstrap-notify',
        'bootstrapmultiselect': '../node_modules/bootstrap-multiselect/dist/js/bootstrap-multiselect',
        'moment': '../node_modules/moment/min/moment-with-locales',
        'moment-timezone': '../node_modules/moment-timezone/builds/moment-timezone-with-data',
        'maskjs': '../node_modules/inputmask/dist/min/jquery.inputmask.bundle.min',
        'jqgrid': '../libs/jqgrid/js/jquery.jqGrid.src',
        'jqgridlocale': '../libs/jqgrid/js/i18n/grid.locale-en',
        'immutable': '../node_modules/immutable/dist/immutable',
        'jstorage': '../node_modules/jstorage/jstorage.min',
        'datetimepicker': '../libs/datetimepicker/js/bootstrap-datetimepicker',
        'daterangepicker': '../node_modules/bootstrap-daterangepicker/daterangepicker',
        'commonjs': 'shared/common',
        'permissionsjs': 'shared/permissions',
        'mail-merge': 'shared/mail-merge',
        'layout': 'shared/layout',
        'constants': 'shared/constants',
        'debug': 'shared/debug',
        'app-settings': 'shared/app-settings',
        'customgrid': 'shared/customgrid',
        'i18nscript': 'shared/i18n',
        'sessionhandler': 'shared/session-manager',
        'change-grid': 'shared/change-grid',
        'grid': 'shared/grid',
        'grid-events': 'shared/events',
        'app-server': 'shared/app-server',
        'select2': '../node_modules/select2/dist/js/select2.full',
        'jquerysortable': '../node_modules/jquery-sortable/source/js/jquery-sortable',
        'ace': '../node_modules/ace-code-editor/lib/ace',
        'beautify': '../node_modules/js-beautify/js/lib/beautify',
    },
    shim: {
        'jquery.validate': {
            deps: ['jquery']
        },
        'jqueryvalidateadditional': {
            deps: ['jquery', 'jquery.validate']
        },
        'bootstrap': {
            deps: ['jquery']
        },
        'hotkeys': {
            deps: ['jquery']
        },
        'jqgrid': {
            deps: ['jquery']
        },
        'jqgridlocale': {
            deps: ['jquery']
        },
        'bootstrapmultiselect': {
            deps: ['jquery']
        },
        'bootstrap-notify': {
            deps: ['bootstrap']
        },
        'moment-timezone': {
            deps: ['moment']
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
        'maskjs': {
            deps: ['jquery']
        },
        'datetimepicker': {
            deps: ['jquery', 'moment', 'bootstrap']
        },
        'daterangepicker': {
            deps: ['jquery', 'moment']
        },
        'commonjs': {
            deps: ['jquery', 'immutable', 'underscore'],
            exports: 'commonjs'
        },
        'permissionsjs': {
            deps: ['jquery', 'underscore']
        },
        'i18nscript': {
            deps: ['jquery']
        },
        'app-settings': {
            'deps': ['immutable', 'underscore', 'commonjs']
        },
        'app-server': {
            'deps': ['app-settings', 'commonjs']
        },
        'change-grid': {
            deps: ['jquery', 'commonjs', 'app-settings']
        },
        'customgrid': {
            deps: ['change-grid']
        },
        'grid': {
            'deps': ['app-settings', 'commonjs']
        },
        'grid-events': {
            'deps': ['commonjs']
        },
        'select2': {
            deps: ['jquery']
        },
        'jquerysortable': {
            deps: ['jquery']
        },
        'mail-merge': {
            deps: ['_get']
        },
    },
};

if (require && require.config) {

    require.config(rjsConfig);

    require([
        'moment-timezone',
        'jquery.validate',
        'jquery',
        'underscore',
        'hotkeys',
        'fastdom',
        'jqueryvalidateadditional',
        'jstorage',
        'bootstrap',
        'bootstrap-notify',
        'commonjs',
        'layout',
        'constants',
        'debug',
        'i18nscript',
        'sessionhandler',
        'customgrid',
        'app',
        'app-server',
        'bootstrapmultiselect',
        'select2',
        'datetimepicker',
        'daterangepicker',
        'jquerysortable',
        'maskjs',
        'beautify',
        '_get',
        'mail-merge',
        'permissionsjs'
    ], function (
        MomentTimezone,
        jqueryvalidate,
        $,
        _,
        hotkeys,
        fastdom,
        jqueryvalidateadditional,
        jstorage,
        Bootstrap,
        bootstrapNotify,
        commonjs_,
        layout_,
        constants,
        debug,
        i18n,
        sessionhandler,
        customGrid,
        App,
        Appserver,
        bootstrapmultiselect,
        select2,
        datetimepicker,
        daterangepicker,
        jquerysortable,
        maskjs,
        beautify,
        _get,
        mailMerge,
        permissionsjs
        ) {
            window.browserLocale = typeof browserLocale == 'undefined' ? 'en-US' : browserLocale;
            window.Immutable = Immutable;
            window.commonjs = commonjs;
            window.appLayout = layout;
            window.appRights = permissions;
            window._get = _get;

            window.AppServer = Appserver;

            Backbone.emulateHTTP = false;

            new Appserver(function () {
                App.initialize();
            });

        });
}

if (typeof module != 'undefined' && module.exports) {
    module.exports = {
        rjsConfig: rjsConfig
    };
}
