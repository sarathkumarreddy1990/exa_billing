const stream = require('stream');
const {
    moduleNames,
    screenNames,
    entityNames
} = require('./constants');
const config = require('../config');
const moment = require('moment');
const { query, SQL } = require('../../server/data/index');

const {
    networkInterfaces
} = require('os');

const nics = networkInterfaces();
const nicNames = Object.keys(nics);
const loIndex = nicNames.indexOf(`lo`);

nicNames.splice(loIndex, 1);

const macAddr = {
    'EMPTY_MAC_ADDR': `00:00:00:00:00:00`,
    'regMac': /(^[^A-Za-z1-9]|[^A-Za-z0-9])/g,
    'addr': ``,
    'setAddr': function () {
        const {
            EMPTY_MAC_ADDR,
            regMac
        } = this;

        const total = nicNames.length;
        let a = 0;

        for ( ; a < total; ++a ) {
            const name = nicNames[ a ];
            const nicArray = nics[ name ];
            const total = nicArray.length;
            let i = 0;

            for ( ; i < total; ++i ) {
                const {
                    mac
                } = nicArray[ i ];

                if ( mac && mac !== EMPTY_MAC_ADDR ) {
                    const newMAC = mac
                        .split(/:|-/)
                        .map(id => parseInt(id, 16)
                            .toString()
                            .replace(regMac, ``))
                        .join('');

                    if ( newMAC ) {
                        this.addr = newMAC;
                        return this;
                    }
                }
            }

        }

        this.addr = `1`;
        return this;
    },

    'getAddr': function () {
        return this.addr || this.setAddr().addr;
    }
};

process.nextTick(
    () => macAddr.setAddr()
);

module.exports = {

    'uidState': {
        'systemMac': macAddr.getAddr(),
        'lastUIDTime': '',
        'lastClock': 0,
    },

    'getUID': function () {
        const datestring = moment().format('YYYYMMDDHHmmss');
        let currentClock = 0;

        if ( datestring == this.uidState.lastUIDTime ) {
            currentClock = this.uidState.lastClock + 1;
        }

        this.uidState.lastUIDTime = datestring;
        this.uidState.lastClock = currentClock;

        let macNo = this.uidState.systemMac;
        let hrTime = process.hrtime();
        let uidFlag = ~~(Math.random() * 10);

        let uid = `${config.get(config.keys.dicomUID)}.${uidFlag}.${macNo}.${datestring}.${hrTime[ 0 ]}.${hrTime[ 1 ]}.${currentClock}`;

        if ( uid.length > 60 ) {
            uid = `${config.get(config.keys.dicomUID)}.${uidFlag}.${macNo}.${datestring}.${hrTime[ 1 ]}.${currentClock}`;
        }

        return uid.replace('..', '.');
    },

    base64Encode: function (unencoded) {
        return unencoded ? new Buffer(unencoded).toString('base64') : '';
    },

    base64Decode: function (encoded) {
        return encoded ? new Buffer(encoded, 'base64').toString('utf8') : '';
    },

    roundFee: function (value) {
        return this.round(value, 2);
    },

    roundUnits: function (value) {
        return this.round(value, 3);
    },

    round: function (value, exp) {

        if (typeof exp === 'undefined' || +exp === 0) {
            return '0.00';
        }

        value = +value;
        exp = +exp;

        if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
            return '0.00';
        }

        // Shift
        value = value.toString().split('e');
        value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp)));

        // Shift back
        value = value.toString().split('e');

        return (+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp))).toFixed(exp);
    },

    getScreenDetails: function (routeParams) {
        let moduleName = 'setup';
        let screenName = 'UI';
        let entityName = 'UI';

        let moduleNameInternal = null;
        let screenNameInternal = null;

        let apiPath = routeParams.split(/\/exa_modules\/billing\/|\/|\?/g).filter(routePrefix => !!routePrefix);

        moduleNameInternal = apiPath[0];

        moduleName = moduleNames[apiPath[0]] || apiPath[0] || moduleName;

        if (moduleName == 'reports') {
            const reportName = apiPath[3].replace(/\.[^.*]*$/, '');

            screenNameInternal = reportName;
            screenName = screenNames[reportName];
            entityName = entityNames[apiPath[1]] || entityNames[apiPath[0]] || apiPath[1] || screenName;
        } else {
            screenNameInternal = apiPath[1] ? apiPath[1] : apiPath[0];
            screenName = screenNames[apiPath[1]] || screenNames[apiPath[0]] || apiPath[1] || screenName;
            entityName = entityNames[apiPath[1]] || entityNames[apiPath[0]] || apiPath[1] || screenName;
        }

        return {
            moduleName,
            screenName,
            entityName,
            moduleNameInternal,
            screenNameInternal,
        };
    },

    isStream: function (obj) {
        return obj instanceof stream.Stream;
    },

    isReadableStream: function (obj) {
        return this.isStream(obj) && typeof obj._read === 'function' && typeof obj._readableState === 'object';
    },
    /* Query for Insurance Provider in Study Filter */
    insuranceStudyProviderName: () => {
        return ` (
            SELECT
               array_agg(insp.insurance_name) AS insurance_name
            FROM order_patient_insurances opi
            INNER JOIN patient_insurances AS pat_ins ON pat_ins.id = opi.patient_insurance_id
            LEFT JOIN insurance_providers AS insp ON pat_ins.insurance_provider_id = insp.id
            WHERE opi.order_id = orders.id
            AND insp.insurance_name IS NOT NULL) `;
    },
    /* Query For Insurance Provider In Claim Filter */
    insuranceClaimProviderName: () => {
        return `(
            SELECT
               ARRAY_AGG(insp.insurance_name) AS insurance_name
            FROM billing.claim_patient_insurances cpi
            LEFT JOIN patient_insurances AS pat_ins ON pat_ins.id = cpi.patient_insurance_id
            LEFT JOIN insurance_providers AS insp ON pat_ins.insurance_provider_id = insp.id
            WHERE cpi.claim_id = claims.id
               AND insp.insurance_name IS NOT NULL) `;
    },
    /* Query For Insurance Group Drop Down in Claim Filter */
    insuranceProviderClaimGroup: () => {
        return `ARRAY[insurance_provider_payer_types.description]`;
    },

    getClaimPatientInsuranceId: (tableName, payerType) => {
        let table_name = tableName || 'bc';
        return `
        LEFT JOIN LATERAL (
            SELECT
                CASE COALESCE(${payerType || null}, ${table_name}.payer_type)
                    WHEN 'primary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'primary')
                    WHEN 'secondary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'secondary')
                    WHEN 'tertiary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'tertiary')
                END AS patient_insurance
            FROM billing.claim_patient_insurances
            WHERE claim_id = ${table_name}.id
        ) AS pat_claim_ins ON TRUE `;
    },

    getClaimPatientInsurances: (tableName, columnName) => {
        let table_name = tableName || 'bc';
        let column_name = columnName || 'id';

        return `
            LEFT JOIN LATERAL (
                SELECT
                    MAX(bcpi.patient_insurance_id) FILTER (WHERE bcpi.coverage_level = 'primary') AS primary_patient_insurance_id,
                    MAX(bcpi.patient_insurance_id) FILTER (WHERE bcpi.coverage_level = 'secondary') AS secondary_patient_insurance_id,
                    MAX(bcpi.patient_insurance_id) FILTER (WHERE bcpi.coverage_level = 'tertiary') AS tertiary_patient_insurance_id
                FROM billing.claim_patient_insurances bcpi
                WHERE bcpi.claim_id = ${table_name}.${column_name || 'id'}
            ) AS claim_ins ON TRUE `;
    },

    getLocaleDate: function (date, locale) {
        if (!date) {
            return null;
        }

        let localeFomat = this.getLocaleFormat(locale);
        return moment(date).locale(locale).format(localeFomat);
    },

    getLocaleFormat(locale) {
        return moment(new Date('December 31, 2017'))
            .locale(locale).format('L')
            .replace(/12/, 'MM')
            .replace(/31/, 'DD')
            .replace(/2017/, 'YYYY');
    },

    getCookieOption: function (cookieObj, index) {
        const {
            user_options = ''
        } = cookieObj;

        if (typeof cookieObj == 'undefined' || typeof user_options == 'undefined') {
            return '';
        }

        return user_options.split('~')[index] ||  '';
    },

    getProviderNumbers: async (companyId) => {
        const sql = SQL`
            SELECT
                DISTINCT(
                    COALESCE(TRIM(prov_rad.provider_info -> 'NPI'), '')
                ) AS "providerNumber"
            FROM public.providers prov_rad
            WHERE prov_rad.provider_type = 'PR'
            AND NULLIF(TRIM(prov_rad.provider_info -> 'NPI'), '') IS NOT NULL
            AND company_id = ${companyId}
            AND prov_rad.deleted_dt IS NULL
            AND prov_rad.is_active
            UNION
            SELECT
                DISTINCT(
                    COALESCE(TRIM(f.facility_info -> 'npino'), '')
                ) AS "providerNumber"
            FROM public.facilities f
            WHERE NULLIF(TRIM(f.facility_info -> 'npino'), '') IS NOT NULL
            AND company_id = ${companyId}
            AND f.deleted_dt IS NULL
            AND f.is_active
            UNION
            SELECT
                DISTINCT(
                    COALESCE(TRIM(f.facility_info -> 'professionalGroupNumber'), '')
                ) AS "providerNumber"
            FROM public.facilities f
            WHERE NULLIF(TRIM(f.facility_info -> 'professionalGroupNumber'), '') IS NOT NULL
            AND company_id = ${companyId}
            AND f.deleted_dt IS NULL
            AND f.is_active`;

        let { rows = [] } = await query(sql.text, sql.values);

        return rows;
    },

    getRemittanceFiles: async (companyId) => {
        const sql = SQL`
            SELECT
                bef.id AS edi_file_id
            FROM billing.edi_files bef
            WHERE bef.file_type = 'can_ohip_p'
            AND company_id = ${companyId}
            AND status = 'pending'
            ORDER BY id ASC
        `;

        let {
            rows = []
        } = await query(sql.text, sql.values);

        return rows;
    },

    getCompanyId: async () => {

        const sql = SQL`
            SELECT
                id
            FROM
                companies
            WHERE
                companies.deleted_dt IS NULL
        `;

        const redisConfig = config.get(config.keys.RedisStore);

        if (redisConfig.companyCode) {
            sql.append(SQL` AND trim(lower(company_code)) = ${redisConfig.companyCode.toLowerCase().trim()} `);
        }

        let { rows: [{ id } = {}] } = await query(sql.text, sql.values);

        return id;
    }
};
