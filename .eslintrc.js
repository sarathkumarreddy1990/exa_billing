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
        "ecmaVersion": 8,
        "ecmaFeatures": {
            "experimentalObjectRestSpread": true
        }
    },
    "rules": {
        "indent": [
            "error",
            4, { 
                //"SwitchCase": 1 
            }
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
        "eol-last": [
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
        "valid-typeof": [
            "error",
            { "requireStringLiterals": true }
        ],
        "comma-spacing": [
            "error",
            { "before": false, "after": true }
        ],
        "object-property-newline": ["error"],
        "no-var": ["error"],
        "no-console": ["error"],
        "curly": ["error"],
        "for-direction": "error",
        //"no-await-in-loop": "error",
        "no-empty": "error",
        "no-ex-assign": "error",
        "no-extra-boolean-cast": "error",
        //"no-extra-parens": "error",
        "no-extra-semi": "error",
        "no-func-assign": "error",
        "no-inner-declarations": "error",
        "no-irregular-whitespace": "error",
        "no-obj-calls": "error",
        "no-prototype-builtins": "error",
        "no-template-curly-in-string": "error",
        "no-unexpected-multiline": "error",
        "no-unreachable": "error",
        "no-unsafe-finally": "error",
        "no-unsafe-negation": "error",
        "use-isnan": "error",
        "no-case-declarations": "error",
        "no-else-return": "error",
        "rest-spread-spacing": ["error", "never"]
,
    }
};
