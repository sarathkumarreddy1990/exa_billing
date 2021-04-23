// module globals and imports

const request = require('request-promise-native');

/**
 * A generic API request that is used by all specific endpoints functions like `pokitdok.activities(...)` and
 * `pokitdok.CashPrices(...)`.
 *  You must enter your client ID and client secret
 * or all requests made with your connection will return errors.
 * @param {object} options - keys: `path`, `method`, `qs`, `json`. The path is the desired API endpoint, such as `/activities` or `/tradingpartners`. Method is the desired `HTTP` request method. qs is the query string containing request paramaters, and json is a json object containing request options.
 * @param {function} callback - a callback function that accepts an error and response parameter
 * @param {string} clientId - The client id of your PokitDok App
 * @param {string} clientSecret - The client secret of your PokitDok App
 * @param {string} version - the version of the API the connection should use
 * @example
 *  ```js
 *     // Get a access token using the generic pokitdok.getAccessToken(...) function.
 *     // This has the same result as the first pokidtdok.getAccessToken(...) example. *
 *  ```
 */


const getPokitdokAccessToken = async (args) => {
    const secretDetails = "client_id=" + args.clientId + "&client_secret=" + args.clientSecret + "&grant_type=client_credentials";
    const url = args.accessUrl;
    let options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: secretDetails
    };

    return await request(url, options)
        .then((result) => {
            result = typeof result === `string` ?
                JSON.parse(result) :
                result || {};

            return {
                res: result,
                err: null
            };
        })
        .catch(function (err) {
            return {
                res: null,
                err: err
            };
        });

};

const apiRequest = async (options) => {
    options.url = options.baseUrl + options.path;

    // apply the auth magic
    options.headers = {
        'Authorization': 'Bearer ' + options.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    try {
        let res = await request(options.url, {
            method: 'POST',
            headers: options.headers,
            json: options.json
        });


        // all other error codes get sent to the caller
        if (res.statusCode != 200 || res.statusCode == 401 || (res.statusCode == 400)) {
            return {
                err: null,
                res: res
            };
        }

        res = typeof res === `string` ?
            JSON.parse(res) :
            res || {};

        return {
            res: res,
            err: null
        };
    } catch (err) {
        return {
            res: null,
            err: err
        };

    }
};

const eligibility = async (userId, configValues, options) => {
    const result = await apiRequest({
        path: '/eligibility/v1/eligibility',
        method: 'POST',
        json: options,
        userId: userId,
        baseUrl: configValues.baseUrl,
        accessToken: configValues.accessToken,
    });
    return {
        err: result.err,
        res: result.res
    };
};

// expose the constructor
module.exports = {
    eligibility,
    getPokitdokAccessToken,
    apiRequest
};
