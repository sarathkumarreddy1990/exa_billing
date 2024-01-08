const js = require('@eslint/js');
const json = require('eslint-plugin-json');
const globals = require('globals');

module.exports = [
    js.configs.recommended,
    {
        files: [
            '**/*.js',
        ],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.commonjs,
                ...globals.jquery,
                ...globals.node,
                ...globals.amd,
                ...globals.worker,
                'commonjs': true,
                'app': true,
                'i18n': true,
                '_': true,
                'Immutable': true,
                'Backbone': true,
                'customGrid': true,
                'browserLocale': true,
                'get': true,
                'moment': true,
                'base64': true,
                'tinymce': true,
                'fastdom': true,
                'layout': true,
                'facilityModules': true,
                'siteLayouts': true,
                'exaInternalErrors': true,
                'sessionManager': true,

                // jqgrid vars defined in commonjs
                'jq_isWidthResize': true,
                'jq_isHeightResize': true,
                'jq_userWidth': true,
                'jq_userHeight': true,
                'jq_offsetWidth': true,
                'jq_offsetheight': true,

                // other commonjs vars
                '$window': true,
                'homeOpentab': true,
                '$document': true,
                'CreateCheckBox': true
            }
        },
        rules: {
            'one-var-declaration-per-line': ['error', 'initializations'],
            'no-tabs': 'error',
            'no-unneeded-ternary': 'error',
            'comma-spacing': ['error', { 'before': false, 'after': true }],
            'no-duplicate-imports': 'error',
            'no-else-return': 'error'
        },
    },
    {
        files: ['**.*.json'],
        plugins: {
            json,
        },
        languageOptions: {
            parser: json.configs.recommended.parser,
        },
        rules: {
            ...json.configs.recommended.rules,
        }
    },
    {
        ignores: [
            '**/.*',
            'node_modules/',
            'app/node_modules/**',
            'app/libs/**/*',
            'app/fonts/**/*',
            'app/images/**/*',
            'app/resx/**/*',
            'app/build/**/*',
            'dist/**',
            'build/**',
            'build2/**',
            'test/**',
            'modules/reporting/**',
            'modules/ohip/**',
            'gulpfile.js',
            'dbManager.js',

            // temporarily ignore files and directories that are not yet ready for linting
            'app/js/main.js',

            // lots of errors here, so saving it for later
            'app/js/shared/grid.js'
        ]
    }
];
