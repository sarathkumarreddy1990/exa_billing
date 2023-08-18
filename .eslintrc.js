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
        "app": true
    }
};
