module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 2017
    },
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "windows"
        ],
        "quotes": [
            "warn",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],
        "lines-between-class-members": [
            "error",
            "always"
        ],
        "one-var-declaration-per-line": [
            "error",
            "always"
        ],
        "padding-line-between-statements": [
            "error",
            { blankLine: "always", prev: "*", next: ["block-like", "function", "multiline-expression"] },
            { blankLine: "always", prev: ["block-like", "function", "multiline-expression", "switch", "with"], next: "*" }
        ],
        "object-property-newline": ["error"],
        "no-var": ["error"],
        "no-console": ["error"],
        "curly": ["error"]
    }
};
