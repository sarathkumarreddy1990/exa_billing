const logger = require('../../../../logger')
    , db = require('.//db')
    , Promise = require('bluebird')
    , _ = require('lodash')
    , reportsRepository = require('../../resx/reports.json') // in a file for now, may move to DB later...
    , SQL = require('sql-template-strings')
    ;

const lookupInfoQuery = `
SELECT
    row_to_json(companyInfo) AS company
  , facilityInfo.facilities  AS facilities
  , row_to_json(userInfo)    AS user
FROM
-- company info
(
  SELECT c.id, c.company_code AS code, c.company_name AS name, c.time_zone AS "timeZone" FROM companies c WHERE c.id = $1
) AS companyInfo,
-- facilities info (must aggregate inside inner query)
(
  SELECT json_agg(row_to_json(facilityInfoAgg)) AS facilities
  FROM
  (
    SELECT f.id, f.facility_code AS code, f.facility_name AS name, f.time_zone AS "timeZone" FROM facilities AS f WHERE f.company_id = $1
  ) AS facilityInfoAgg
) AS facilityInfo,
-- current user info
(
  SELECT u.id, u.username, u.first_name AS "firstName", u.last_name AS "lastName", u.middle_initial AS "middleInitial" FROM users AS u WHERE u.id = $2 LIMIT 1
) AS userInfo
`;

const api = {

    /**
     * STAGE 1
     * This method is called by controller pipline to initialize report data.
     * Initializing data includes adding common lookups, that ***all*** reports will benefit from.
     * Note:
     *  Set a high bar as to what lookup data is to be included here, as those queries will be executed on each report.
     */
    initializeReportData: (reportParams, reportDefinition) => {
        const initialReportData = {
            report: {
                params: reportParams,                   // this object will be deleted after processing
                id: reportParams.reportId,
                category: reportParams.reportCategory,
                format: reportParams.reportFormat,
                title: reportDefinition.title,
                description: reportDefinition.description,
                generated: {}                         // set it at the very last moment to get accurate timing
            },
            filters: [],
            lookups: {
                user: {
                    clientIpAddress: reportParams.client_ip
                }
            },
            dataSetCount: 0,
            dataSets: []
        }

        initialReportData.report.flags = reportDefinition.flags || {};   // can be used in templates to conditionally render items
        initialReportData.report.styles = reportDefinition.styles || {}; // set CSS styles to be used in templates
        initialReportData.report.vars = reportDefinition.vars || {}; // set any variables to be used in templates

        return Promise.join(
            // single query that aggregates JSON...
            api.getLookupInfo(reportParams.companyId, reportParams.userId),
            // others could be added here...
            (lookupInfo) => {
                initialReportData.lookups = _.merge({}, initialReportData.lookups, lookupInfo)
                return initialReportData;
            });
    },

    getReportDefinition: (reportParams) => {
        return _.find(reportsRepository, { 'id': reportParams.reportId, 'category': reportParams.reportCategory });
    },

    getLookupInfo: (companyId, userId) => {
        return db.query(lookupInfoQuery, [companyId, userId])
            .then((pgResult) => {
                let lookupInfo = {};
                if (pgResult.rows && pgResult.rows.length > 0) {
                    lookupInfo = pgResult.rows[0];
                }
                return lookupInfo;
            });
    },

    addReportAuditRecord: (reportData) => {
        const auditInfo = `"username"=>"${reportData.lookups.user.lastName}, ${reportData.lookups.user.firstName}", "user_level"=>"user"`; //hstore
        const logMessage = `Query: Report ${reportData.report.title} generated (id: ${reportData.report.id}, category: ${reportData.report.category}, format: ${reportData.report.format})`;

        // audit log viewer displays flat list of 'old values' when report is viewed...
        // in order to keep the entry compatible, detailed_info has to be in a certain 'flattened' format...
        const detailedInfo = {
            old_values: {
                Report_Id: reportData.report.id,
                Report_Category: reportData.report.category,
                Report_Format: reportData.report.format,
                Report_Title: reportData.report.title
            },
            new_values: {}
        }
        // _.forEach(reportData.filters, (filter) => {
        //     detailedInfo.oldValues[`Filters_${filter.name}`] = _.isArray(filter.value) ? filter.value.join(',') : filter.value;
        // })
        const params = {
            companyId: reportData.lookups.company.id,
            entityName :'reports',
            entitykey: 1,
            screenName:  reportData.report.title,
            moduleName: 'reports',
            clientIp: reportData.lookups.user.clientIpAddress || '127.0.0.1',
            logDescriptions: logMessage,
            detailedInfo: JSON.stringify(detailedInfo),
            userId: reportData.lookups.user.id
        }

        let sql = SQL`
        SELECT billing.create_audit(
            ${params.companyId}
          , ${params.entityName}
          , ${params.entitykey}
          , ${params.screenName}
          , ${params.moduleName}
          , ${params.logDescriptions}
          , ${params.clientIp}
          , ${JSON.stringify(detailedInfo)}::jsonb
          , ${params.userId}
          )
        `

        return db.query(sql.text, sql.values)
            .then((pgResult) => {
                return true;
            })
            .catch((err) => {
                logger.error('EXA Reporting - error while adding auditing record!', err);
                return false;
            });
    },

    /**
     * Helper method that uses lodash to count unique items in collection.
     * Used for summaries tables.
     *
     * @param collection - array or object to iterate over
     * @param {string|number} countBy - array index or object key to count by
     * @param {boolean} [countNulls = false] - weather or not to count 'null' items (default is false)
     * @returns - count of uniqe countBy items in collection
     */
    getUniqueCount: (collection, countBy, countNulls = false) => {
        const uniq = countNulls
            ? _(collection).uniqBy(countBy).value()
            : _(collection).uniqBy(countBy).reject([countBy, null]).value();
        return uniq ? uniq.length : 0;
    },

    getProviderGroupInfo: (companyId, groupIds) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, group_code, group_name
                FROM provider_groups
                WHERE
                    company_id = $1
                AND id = any ($2)
                ORDER BY group_name
            `;
            const params = [
                companyId,
                groupIds
            ];
            db.query(sql, params)
                .then((pgResult) => {
                    const providerGroupInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            providerGroupInfo.push({
                                id: val.id,
                                code: val.group_code,
                                name: val.group_name,
                            });
                        });
                    }
                    return resolve(providerGroupInfo);
                })
                .catch(error => logger.error('EXA Reporting - Error on selecting provider group info!', error));
        });
    },

    getCptCodesInfo: (companyId, cptCodeIds) => {
        return new Promise((resolve, reject) => {
            const sql = `
                        SELECT id, display_code, short_description
                        FROM cpt_codes
                        WHERE
                        company_id = $1
                        AND id = any ($2)
                        AND NOT has_deleted
                        ORDER BY short_description
                        `;
            const params = [
                companyId,
                cptCodeIds
            ];
            db.query(sql, params)
                .then((pgResult) => {
                    const cptInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            cptInfo.push({
                                id: val.id,
                                code: val.display_code,
                                name: val.short_description
                            });
                        });
                    }
                    return resolve(cptInfo);
                })
                .catch(error => logger.error('EXA Reporting - Error on selecting cpt codes info!', error));
        });
    },

    getInsuranceProvidersInfo: (companyId, insuranceProviderIds) => {
        return new Promise((resolve, reject) => {
            const sql = `
                        SELECT insurance_code, insurance_name
                        FROM insurance_providers
                        WHERE
                        company_id = $1
                        AND id = any ($2)
                        ORDER BY insurance_name
                       `;
            const params = [
                companyId,
                insuranceProviderIds
            ];
            db.query(sql, params)
                .then((pgResult) => {
                    const insuranceProvidersInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            insuranceProvidersInfo.push({
                                id: val.id,
                                code: val.insurance_code,
                                name: val.insurance_name
                            });
                        });
                    }
                    return resolve(insuranceProvidersInfo);
                })
                .catch(error => logger.error('EXA Reporting - Error on selecting insurance providers info!', error));
        });
    },

    getStudyStatusInfo: (statusCodes, facilityIds, allFacilities) => {
        return new Promise((resolve, reject) => {
            const selectQuery = SQL`
                SELECT DISTINCT status_code, status_desc
                FROM study_status
                WHERE
                    status_code = any (${statusCodes})
            `;

            selectQuery.append(allFacilities ? `` : SQL`AND facility_id = any(${facilityIds}) `);
            selectQuery.append(`ORDER BY status_desc`);

            db.query(selectQuery.text, selectQuery.values)
                .then((pgResult) => {
                    const statusInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            statusInfo.push({
                                code: val.status_code,
                                desc: val.status_desc,
                            });
                        });
                    }
                    return resolve(statusInfo);
                })
                .catch(error => logger.error('EXA Reporting - Error on selecting study statuses info!', error));
        });
    },

    getStudyFlagInfo: (studyFlagIds) => {
        return new Promise((resolve, reject) => {
            const selectQuery = SQL`
                SELECT DISTINCT id, description
                FROM study_flags
                WHERE
                    id = any (${studyFlagIds})
            `;

            selectQuery.append(`ORDER BY description`);

            db.query(selectQuery.text, selectQuery.values).then(
                (pgResult) => {
                    const flagInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            flagInfo.push({
                                id: val.id,
                                desc: val.description
                            });
                        });
                    }
                    return resolve(flagInfo);
                }).catch(error => logger.error('EXA Reporting - Error on selecting study flag info!', error));
        });
    },

    getInsuranceLevelInfo: (levels) => {
        return new Promise((resolve, reject) => {
            const getLevel = type => {
                const Types = {
                    'P': { name: 'Primary' },
                    'S': { name: 'Secondary' },
                    'T': { name: 'Tertiary' }
                };
                return Types[type];
            };

            const levelInfo = [];
            _.forEach(levels, (val) => {
                var level = getLevel(val);
                levelInfo.push(level);
            });
            return resolve(levelInfo);
        });
    },
    /**
     * Helper method that get all Referring Physicians from providers table with provider_type RF
     * Used in Referring Physician Study Count
     *
     * @param {integer} company ID - current company id
     * @param {integer[]} referringPhysicianIds - array of referring physician ids
     * @returns {Object[]} - array of referring physician info, which includes ids, provider codes and provider full name
     */
    getReferringPhysicianInfo: (companyId, referringPhysicianIds) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, provider_code, get_full_name(last_name, first_name, middle_initial, null, suffix) AS name
                FROM providers
                WHERE
                    company_id = $1
                AND id = any ($2)
                AND provider_type = 'RF'
                ORDER BY name
            `;
            const params = [
                companyId,
                referringPhysicianIds
            ];
            db.query(sql, params)
                .then((pgResult) => {
                    const referringPhysicianInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            referringPhysicianInfo.push({
                                id: val.id,
                                code: val.provider_code,
                                name: val.name,
                            });
                        });
                    }
                    return resolve(referringPhysicianInfo);
                })
                .catch(error => logger.error('EXA Reporting - Error on selecting referring physicians info!', error));
        });
    },

    /**
     * Helper method that get patient's information
     * Used in Patient Statement
     *
     * @param {integer} company ID - current company id
     * @param {integer[]} patientIds - array of patient ids
     * @returns {Object[]} - array of patient info, which includes ids, account no and patient full name
     */
    getPatientInfo: (companyId, patientIds) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, account_no, get_full_name(last_name, first_name, middle_name, prefix_name, suffix_name) AS name
                FROM patients
                WHERE
                    company_id = $1
                AND id = any ($2)
                ORDER BY name
            `;
            const params = [
                companyId,
                patientIds
            ];
            db.query(sql, params)
                .then((pgResult) => {
                    const patientInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            patientInfo.push({
                                id: val.id,
                                code: val.account_no,
                                name: val.name,
                            });
                        });
                    }
                    return resolve(patientInfo);
                })
                .catch(error => logger.error('EXA Reporting - Error on selecting patients info!', error));
        });
    },

    /**
     * Helper method that get patient's information
     * Used in Patient Statement
     *
     * @param {integer} company ID - current company id
     * @param {integer[]} billingProviderIds - array of billing provider ids
     * @returns {Object[]} - array of billing provider info, which includes ids, code and full name
     */
    getBillingProviderInfo: (companyId, billingProviderIds) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, code, name as full_name
                FROM billing.providers
                WHERE
                    company_id = $1
                AND id = any($2)
                ORDER BY full_name
            `;
            const params = [
                companyId,
                billingProviderIds
            ];
            db.query(sql, params)
                .then((pgResult) => {
                    const providerInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            providerInfo.push({
                                id: val.id,
                                code: val.code,
                                name: val.full_name,
                            });
                        });
                    }
                    return resolve(providerInfo);
                })
                .catch(error => logger.error('EXA Reporting - Error on selecting billing providers info!', error));
        });
    },

    getFacilityForCrossTab: (companyId) => {
        return new Promise((resolve, reject) => {
            const selectQuery = SQL`
            WITH common_table(facility_id) AS (
                SELECT
                    distinct s.facility_id
                FROM studies              AS s
                LEFT JOIN facilities      AS f ON f.id = s.facility_id
                WHERE
                    ( s.company_id = ${companyId} )
                AND NOT s.has_deleted
                AND ((timezone(f.time_zone, s.study_dt))::date = current_date)
                )

                SELECT
                    ',' || string_agg('"' || f.facility_name || '" int', ',') AS cross_tab,
                    ',' || string_agg('"' || f.facility_name || '"', ',') AS sel_col,
                    ',' || string_agg('sum("' || f.facility_name || '")', ',') AS sel_sum,
                    ',' || string_agg('coalesce("' || f.facility_name || '",0) AS "' || f.facility_name || '"', ',') AS sel_coalesce
                FROM common_table AS fc
                LEFT JOIN facilities AS f ON f.id = fc.facility_id
            `;

            db.query(selectQuery.text, selectQuery.values)
                .then((pgResult) => {
                    const crossTab = pgResult.rows[0].cross_tab || '';
                    const selCol = pgResult.rows[0].sel_col || '';
                    const selSum = pgResult.rows[0].sel_sum || '';
                    const selCoalesce = pgResult.rows[0].sel_coalesce || '';
                    return resolve({
                        "crossTab": crossTab,
                        "selCol": selCol,
                        "selSum": selSum,
                        "selCoalesce": selCoalesce
                    });
                })
                .catch(error => logger.error('EXA Reporting - Error on facilities info!', error));
        });
    },

    /**
     * Helper method that gets info from providers table
     * Used in Referring Physician Study Count
     *
     * @param {integer} company ID - current company id
     * @param {integer[]} providerIds - array of referring physician ids
     * @returns {Object[]} - array of providers info, which includes ids, provider codes and provider full name
     */
    getProviderInfo: (companyId, providerIds) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, provider_code, get_full_name(last_name, first_name, middle_initial, null, suffix) AS name
                FROM providers
                WHERE
                    company_id = $1
                AND id = any ($2)
                ORDER BY name
            `;
            const params = [
                companyId,
                providerIds
            ];
            db.query(sql, params)
                .then((pgResult) => {
                    const providerInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            providerInfo.push({
                                id: val.id,
                                code: val.provider_code,
                                name: val.name,
                            });
                        });
                    }
                    return resolve(providerInfo);
                })
                .catch(error => logger.error('EXA Reporting - Error on selecting providers info!', error));
        });
    },

    getAdjustmentCodeInfo: (companyId, adjustmentCodeIds) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, code, description AS name
                FROM billing.adjustment_codes
                WHERE
                    company_id = $1
                AND id = any ($2)
                ORDER BY name
            `;
            const params = [
                companyId,
                adjustmentCodeIds
            ];
            db.query(sql, params)
                .then((pgResult) => {
                    const adjustmentCodeInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            adjustmentCodeInfo.push({
                                id: val.id,
                                code: val.code,
                                name: val.name,
                            });
                        });
                    }
                    return resolve(adjustmentCodeInfo);
                })
                .catch(error => logger.error('EXA Reporting - Error on selecting adjustment_code info!', error));
        });
    },

    /**
     * Helper method that get report's information
     * Used in variety of reports
     *
     * @param {integer} company ID - current company id
     * @param {integer[]} ids - array of ids
     * @returns {Object[]} - array of info, which includes ids, code and name
     */
    getReportInfo: (args) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, ${args.codeName} AS code, ${args.columnName} AS name
                FROM ${args.tableName}
                WHERE id = any ($1)
                ORDER BY name
            `;

            db.query(sql, [args.ids])
                .then((pgResult) => {
                    const reportInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            reportInfo.push({
                                id: val.id,
                                code: val.code,
                                name: val.name,
                            });
                        });
                    }
                    return resolve(reportInfo);
                })
                .catch(error => logger.error(`EXA Reporting - Error on selecting ${args.tableName} info!`, error));
        });
    },

    /**
     * Helper method that converts amount to US dollar format, with negative value enclosed in parentheses.
     * Used for any report that has money.
     *
     * @param {string|number} amount - string amount
     * @returns - formatted string amount
     */
    getUSDFormat: amount => {
        const nf = new Intl.NumberFormat(["en-US"], {
            style: "currency",
            currency: "USD",
            currencyDisplay: "symbol",
            maximumFractionDigit: 1
        });
        var retAmount = nf.format(Math.abs(amount));

        if (amount < 0)
            retAmount = `(${retAmount})`;

        return retAmount;
    },

    getStudyInfo: (companyId, studyIds) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT
                    id
                  , accession_no
                  , study_description
                FROM
                    public.studies
                WHERE
                    company_id = $1
                AND id = any ($2)
                ORDER BY accession_no
            `;
            const params = [
                companyId,
                studyIds
            ];
            db.query(sql, params)
                .then((pgResult) => {
                    const studyInfo = [];
                    if (pgResult.rows && pgResult.rows.length > 0) {
                        _.forEach(pgResult.rows, (val) => {
                            studyInfo.push({
                                id: val.id,
                                accession_no: val.accession_no,
                                study_description: val.study_description,
                            });
                        });
                    }
                    return resolve(studyInfo);
                })
                .catch(error => logger.logError('EXA Reporting - Error on selecting studey info!', error));
        });
    },

   getInsuranceGroupInfo: (companyId, insuranceGroupIds) => {
       return new Promise((resolve, reject) => {
           const sql = `
               SELECT
                   id
                 , code
                 , description
               FROM
                   insurance_provider_payer_types
               WHERE
                   company_id = $1
               AND id = any ($2)
               ORDER BY code
           `;
           const params = [
               companyId,
               insuranceGroupIds
           ];
           db.query(sql, params)
               .then((pgResult) => {
                   const insuranceGroupInfo = [];
                   if (pgResult.rows && pgResult.rows.length > 0) {
                       _.forEach(pgResult.rows, (val) => {
                           insuranceGroupInfo.push({
                               id: val.id,
                               code: val.code,
                               description: val.description,
                           });
                       });
                   }
                   return resolve(insuranceGroupInfo);
               })
               .catch(error => logger.logError('EXA Reporting - Error on selecting Insurance Group Info!', error));
       });
    }
};

module.exports = api;
