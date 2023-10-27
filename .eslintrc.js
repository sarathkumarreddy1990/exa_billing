module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true,
        "node": true,
        "amd": true,
        "jquery": true
    },
    "plugins": [
        "json"
    ],
    "extends": [
        "eslint:recommended",
        "plugin:json/recommended"
    ],
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 2020
    },
    "rules": {
        'one-var-declaration-per-line': ['error', 'initializations'],
        'no-tabs': 'error',
        'no-unneeded-ternary': 'error',
        'comma-spacing': ['error', { 'before': false, 'after': true }],
        'no-duplicate-imports': 'error',
        'no-else-return': 'error'
    },
    "globals": {
        "commonjs": true,
        "app": true,
        "i18n": true,
        "_": true,
        "Immutable": true,
        "Backbone": true,
        "customGrid": true,
        "browserLocale": true,
        "get": true,
        "moment": true,
        "base64": true,
        "tinymce": true,
        "fastdom": true,
        "layout": true,


        // jqgrid vars defined in commonjs
        "jq_isWidthResize": true,
        "jq_isHeightResize": true,
        "jq_userWidth": true,
        "jq_userHeight": true,
        "jq_offsetWidth": true,
        "jq_offsetheight": true,

        // other commonjs vars
        "$window": true,
        "homeOpentab": true,
        "$document": true,
        "CreateCheckBox": true,
    }
};
