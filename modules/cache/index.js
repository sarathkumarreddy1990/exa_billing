let cache = {};

let debug = false;
let hitCount = 0;
let missCount = 0;

function now() { return (new Date).getTime(); }
const sessionCache = {

    put: function (key, value, time, timeoutCallback) {
        let oldRecord = cache[key];
        if (oldRecord) {
            clearTimeout(oldRecord.timeout);
        }

        let expire = time + now();
        let record = { value: value, expire: expire };

        if (!isNaN(expire)) {
            let timeout = setTimeout(function () {
                sessionCache.del(key);
                if (typeof timeoutCallback === 'function') {
                    timeoutCallback(key);
                }
            }, time);
            record.timeout = timeout;
        }

        cache[key] = record;
    },

    del: function (key) {
        delete cache[key];
    },

    clear: function () {
        cache = {};
    },

    get: function (key) {
        let data = cache[key];
        if (typeof data != 'undefined') {
            if (isNaN(data.expire) || data.expire >= now()) {
                if (debug) { hitCount++; }
                return data.value;
            } else {
                // free some space
                if (debug) { missCount++; }
                sessionCache.del(key);
            }
        } else if (debug) {
            missCount++;
        }
        return null;
    },

    size: function () {
        let size = 0, key;
        for (key in cache) {
            if (cache.hasOwnProperty(key)) {
                if (sessionCache.get(key) !== null) {
                    size++;
                }
            }
        }
        return size;
    },

    memsize: function () {
        let size = 0, key;
        for (key in cache) {
            if (cache.hasOwnProperty(key)) {
                size++;
            }
        }
        return size;
    },

    debug: function (bool) {
        debug = bool;
    },

    hits: function () {
        return hitCount;
    },

    misses: function () {
        return missCount;
    },

    keys: function () {
        return Object.keys(cache);
    },
};

module.exports = sessionCache;
