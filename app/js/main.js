require(['main.config'], function (RConfig) {
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
                'fastdom',
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
                'app-server',
                'bootstrapmultiselect',
                'select2',
                'datetimepicker',
                'daterangepicker',
                'jquerysortable'
            ], function (
                $,
                _,
                fastdom,
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
                daterangepicker,
                jquerysortable
            ) {
                    Backbone.emulateHTTP = false;

                    new Appserver(function () {
                        App.initialize();
                    });

                });
        });
});
