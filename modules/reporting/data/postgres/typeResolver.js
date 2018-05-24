const _ = require('lodash')
    ;

// some common PG types
// see https://www.postgresql.org/docs/current/static/catalog-pg-type.html
const pgTypeMap = [
    { 'oid': 16, 'name': 'bool', 'category': 'boolean' },
    { 'oid': 17, 'name': 'bytea', 'category': 'user_defined' },
    { 'oid': 18, 'name': 'char', 'category': 'string' },
    { 'oid': 20, 'name': 'int8', 'category': 'numeric' },
    { 'oid': 21, 'name': 'int2', 'category': 'numeric' },
    { 'oid': 23, 'name': 'int4', 'category': 'numeric' },
    { 'oid': 24, 'name': 'regproc', 'category': 'numeric' },
    { 'oid': 25, 'name': 'text', 'category': 'string' },
    { 'oid': 26, 'name': 'oid', 'category': 'numeric' },
    { 'oid': 27, 'name': 'tid', 'category': 'user_defined' },
    { 'oid': 28, 'name': 'xid', 'category': 'user_defined' },
    { 'oid': 29, 'name': 'cid', 'category': 'user_defined' },
    { 'oid': 114, 'name': 'json', 'category': 'user_defined' },
    { 'oid': 142, 'name': 'xml', 'category': 'user_defined' },
    { 'oid': 194, 'name': 'pg_node_tree', 'category': 'string' },
    { 'oid': 210, 'name': 'smgr', 'category': 'user_defined' },
    { 'oid': 602, 'name': 'path', 'category': 'geometric' },
    { 'oid': 604, 'name': 'polygon', 'category': 'geometric' },
    { 'oid': 650, 'name': 'cidr', 'category': 'net_address' },
    { 'oid': 700, 'name': 'float4', 'category': 'numeric' },
    { 'oid': 701, 'name': 'float8', 'category': 'numeric' },
    { 'oid': 702, 'name': 'abstime', 'category': 'datetime' },
    { 'oid': 703, 'name': 'reltime', 'category': 'timespan' },
    { 'oid': 704, 'name': 'tinterval', 'category': 'timespan' },
    { 'oid': 705, 'name': 'unknown', 'category': 'unkonwn' },
    { 'oid': 718, 'name': 'circle', 'category': 'geometric' },
    { 'oid': 790, 'name': 'money', 'category': 'numeric' },
    { 'oid': 829, 'name': 'macaddr', 'category': 'user_defined' },
    { 'oid': 869, 'name': 'inet', 'category': 'net_address' },
    { 'oid': 1033, 'name': 'aclitem', 'category': 'user_defined' },
    { 'oid': 1042, 'name': 'bpchar', 'category': 'string' },
    { 'oid': 1043, 'name': 'varchar', 'category': 'string' },
    { 'oid': 1082, 'name': 'date', 'category': 'datetime' },
    { 'oid': 1083, 'name': 'time', 'category': 'datetime' },
    { 'oid': 1114, 'name': 'timestamp', 'category': 'datetime' },
    { 'oid': 1184, 'name': 'timestamptz', 'category': 'datetime' },
    { 'oid': 1186, 'name': 'interval', 'category': 'timespan' },
    { 'oid': 1266, 'name': 'timetz', 'category': 'datetime' },
    { 'oid': 1560, 'name': 'bit', 'category': 'bit_string' },
    { 'oid': 1562, 'name': 'varbit', 'category': 'bit_string' },
    { 'oid': 1700, 'name': 'numeric', 'category': 'numeric' },
    { 'oid': 1790, 'name': 'refcursor', 'category': 'user_defined' },
    { 'oid': 2202, 'name': 'regprocedure', 'category': 'numeric' },
    { 'oid': 2203, 'name': 'regoper', 'category': 'numeric' },
    { 'oid': 2204, 'name': 'regoperator', 'category': 'numeric' },
    { 'oid': 2205, 'name': 'regclass', 'category': 'numeric' },
    { 'oid': 2206, 'name': 'regtype', 'category': 'numeric' },
    { 'oid': 2950, 'name': 'uuid', 'category': 'user_defined' },
    { 'oid': 2970, 'name': 'txid_snapshot', 'category': 'user_defined' },
    { 'oid': 3220, 'name': 'pg_lsn', 'category': 'user_defined' },
    { 'oid': 3614, 'name': 'tsvector', 'category': 'user_defined' },
    { 'oid': 3615, 'name': 'tsquery', 'category': 'user_defined' },
    { 'oid': 3642, 'name': 'gtsvector', 'category': 'user_defined' },
    { 'oid': 3734, 'name': 'regconfig', 'category': 'numeric' },
    { 'oid': 3769, 'name': 'regdictionary', 'category': 'numeric' },
    { 'oid': 3802, 'name': 'jsonb', 'category': 'user_defined' },
    { 'oid': 3904, 'name': 'int4range', 'category': 'range' },
    { 'oid': 3906, 'name': 'numrange', 'category': 'range' },
    { 'oid': 3908, 'name': 'tsrange', 'category': 'range' },
    { 'oid': 3910, 'name': 'tstzrange', 'category': 'range' },
    { 'oid': 3912, 'name': 'daterange', 'category': 'range' },
    { 'oid': 3926, 'name': 'int8range', 'category': 'range' },
    { 'oid': 4089, 'name': 'regnamespace', 'category': 'numeric' },
    { 'oid': 4096, 'name': 'regrole', 'category': 'numeric' },
    { 'oid': 16457614, 'name': 'hstore', 'category': 'user_defined' },
    { 'oid': 16457698, 'name': 'ghstore', 'category': 'user_defined' },
    { 'oid': 16457745, 'name': 'gtrgm', 'category': 'user_defined' }
];

const api = {

    /**
     * Normalizes report parameters passed from UI (via request).
     *
     * @param {Object} column - node-postgres column definition from result.fields array
     * @returns {Object} - new, enriched column definition
     */
    getPgColumnDefinition: (column) => {
        const pgt = api.getPgTypeByOid(column.dataTypeID);
        return {
            'name': column.name,
            'dataTypeID': column.dataTypeID,
            'dataTypeName': pgt.name,
            'dataTypeCategory': pgt.category
        }
    },

    getPgTypeByOid: (oid) => {
        //console.time('reporting::typeResolver.getPgTypeByOid');
        const found = _.find(pgTypeMap, { 'oid': oid });
        //console.timeEnd('reporting::typeResolver.getPgTypeByOid');
        if (found === undefined || found === null) {
            return { 'oid': oid, 'name': 'unknown', 'category': 'unknown' }
        }
        return found;
    }

}

module.exports = api;
