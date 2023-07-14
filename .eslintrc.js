module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true,
        "node": true
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
        "ecmaVersion": 2020,
    },
};
