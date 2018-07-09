const logger = require('../../../logger')
    , responseHandler = require('../../../server/shared/http')
    , dataHelper = require('../data/postgres/dataHelper')
    , _ = require('lodash')
    , moment = require('moment-timezone')
    , DEBUG_ENABLED = false
    ;
    const jsReportClient = require("jsreport-client")('http://192.168.1.73:5488/', 'jsradmin', 'JSR1q2w3e4r5t');
let reqNum = 0;

const api = {

    process: function (req, res, next) {
        // report request id aids in identifying requests in logs using PID and simple incrementing counter
        const reqId = `reporting (${process.pid},${reqNum++})`;
        // ============================================================================================================
        // normalize & validate report parameters
        const reportParams = api.getReportParams(req, res);
        if (!reportParams.valid) {
            return responseHandler.sendHtml(req, res, null, '<h1>Invalid Report Parameters</h1><p><pre>' + JSON.stringify(reportParams, null, 2) + '</pre></p>');
        }
        const start = moment();
        const repInfo = `${reqId} | ${reportParams.reportCategory}/${reportParams.reportId}.${reportParams.reportFormat} |`;
        console.time(`${repInfo} total`);
        logger.logInfo(`${repInfo} started`);
        api.logReportParams(reportParams);
        // ============================================================================================================
        // 'Instantiate' report's data handler - convention over configuration based. Each report's data handler has:
        //  1) getReportData(initialReportData)
        //  2) transformReportData(rawReportData)
        //  3) getJsReportOptions(reportParams)
        // For a well documented report data handler see '../data/postgres/operations/unfinishedStudies.js''
        const dataHandler = require('../data/postgres/' + reportParams.reportCategory + '/' + reportParams.reportId);

        const reportDefinition = dataHelper.getReportDefinition(reportParams);
        if (!reportDefinition) {
            return responseHandler.sendHtml(req, res, null, '<h1>Invalid Report Definition</h1><p>Please verify report definition for: <pre>' + JSON.stringify(reportParams, null, 2) + '</pre></p>');
        }
        api.logReportDefinition(reportDefinition);

        // ============================================================================================================
        // Promise based report processing 'pipeline'
        dataHelper
            // ========================================================================================================
            // STAGE 1 - init report data and add any shared lookups which may be needed by later stages
            .initializeReportData(reportParams, reportDefinition)
            // ========================================================================================================
            // STAGE 2 - get report data (all data sets)
            .then((initialReportData) => {
                console.time(`${repInfo} s2___data`);
                return dataHandler.getReportData(initialReportData);
            })
            // ========================================================================================================
            // STAGE 3 - transform entire report
            .then((rawReportData) => {
                console.timeEnd(`${repInfo} s2___data`);
                console.time(`${repInfo} s3___transform`);
                return dataHandler.transformReportData(rawReportData);
            })
            // ========================================================================================================
            // STAGE 4 - any post processing
            .then((transformedReportData) => {
                console.timeEnd(`${repInfo} s3___transform`);
                console.time(`${repInfo} s4___postprocess`);
                delete transformedReportData.report.params; // no longer needed !
                transformedReportData.report.generated = {
                        'by': `${transformedReportData.lookups.user.firstName} ${transformedReportData.lookups.user.lastName} (${transformedReportData.lookups.user.username})`,
                        'on': moment().tz(transformedReportData.lookups.company.timeZone).format('L LTS z')
                };
                return transformedReportData;
            })
            // ========================================================================================================
            // STAGE 5 - rendering of report and jsreport mechanics
            .then((reportData) => {
                console.timeEnd(`${repInfo} s4___postprocess`);
                const defaultJsReportOptions = api.getDefaultJsReportOptions(reportParams);
                const reportJsReportOptions = dataHandler.getJsReportOptions(reportParams, reportDefinition);
                const jsReportOptions = _.merge({}, defaultJsReportOptions, reportJsReportOptions);  // report specific options can add or overwrite default ones
                jsReportOptions.data = reportData;

                // sanity checks
                if (jsReportOptions.template.name === null) {
                    throw new Error(`Report id: '${reportParams.reportId}', format: '${reportParams.reportFormat}' has no template id !`);
                }
                if (jsReportOptions.data === null) {
                    throw new Error(`Report id: '${reportParams.reportId}', format: '${reportParams.reportFormat}' has no data !`);
                }

                // return responseHandler.sendHtml(req, res, null,
                //     '<h1>reportParams</h1><p><pre>' + JSON.stringify(reportParams, null, 2) + '</pre></p>'
                //     //+ '<h1>jsReportOptions</h1><p><pre>' + JSON.stringify(jsReportOptions, null, 2) + '</pre></p>'
                //     + '<h1>reportData</h1><p><pre>' + (reportData ? JSON.stringify(reportData, null, 2) : 'no data') + '</pre></p>'
                // );

                api.logJsReportOptions(jsReportOptions);
                console.time(`${repInfo} s5___jsreport`);
                jsReportClient.render(jsReportOptions, { timeout: 600000 /* ms */, time: true }, (err, response) => {
                    console.timeEnd(`${repInfo} s5___jsreport`);
                    if (err) {
                        //return next(err);
                        //logger.logError(`${reqId}EXA Reporting - jsreport client error while rendering report!`, err);
                        return responseHandler.sendError(req, res);
                    }
                    // adjust response header for downloadable content
                    if (jsReportOptions.template.contentDisposition) {
                        res.setHeader('Content-Disposition', jsReportOptions.template.contentDisposition);
                    }
                    // pipe the js report output directly to Express response
                    console.time(`${repInfo} response`);
                    return response
                        .pipe(res)
                        .on('finish', () => {
                            console.timeEnd(`${repInfo} response`);
                            console.timeEnd(`${repInfo} total`);
                            const finish = moment();
                            const duration = finish.diff(start, 'seconds', true);
                            logger.logInfo(`${repInfo} finished in ${duration} seconds`);
                            dataHelper.addReportAuditRecord(reportData); // "fire and forget"
                        });
                });
            })
            .catch((err) => {
             //   logger.logError(`${reqId}EXA Reporting - error while processing report!`, err);
              //  console.trace();
                //res.writeHead(500, { 'content-type': 'text/plain' });
                //res.end('An error occurred');
                //return next(err);
                return responseHandler.sendError(req, res);
            });
    },

    /**
     * Normalizes report parameters passed from UI (via request).
     * Rules:
     *  - all report params shall use same names
     *  - all report params shall be normalized and converted to their types
     * Available parameters:
     *   reportId
     *   reportCategory
     *   reportFormat
     *   reportTitle
     *
     *   allFacilities
     *   facilityIds[]
     *   studyStatusCodes[]
     *   fromDate
     *   toDate
     *
     * @param {Object} req - Express JS Request object
     * @returns {Object} - normalizes report parameters
     */
    getReportParams: (req) => {
        const initialReportParams = {
            companyId: 1 ,    //req.query.company_id,      // there is also req.query.companyid ??? both are injected automatically into req...
            userId: 1 ,//req.query.user_id,            // there is also req.query.userid ??? both are injected automatically into req...
            userIpAddress: req.query.user_ip,     // injected automatically into req...
            valid: true                           // flag to toggle if any of minimum required params are not valid
        }
        const reportParams = _(initialReportParams)
            // merge all params from URL and query string...
            .assign(req.params, req.query)
            // remove duplicate/unnecessary params...
            .omit(['company_id', 'companyid', 'user_id', 'userid', 'session_provider_id'])
            .value();
        // convert string 'true/false' to boolean
        if (reportParams.allFacilities) {
            reportParams.allFacilities = reportParams.allFacilities === 'true';
        }
        if (reportParams.allModalities) {
            reportParams.allModalities = reportParams.allModalities === 'true';
        }
        // convert array of 'string numbers' to array of numbers
        if (reportParams.facilityIds) {
           // reportParams.facilityIds = reportParams.facilityIds.map(Number);
        }
        // convert string to a number
        if (reportParams.facilityId) {
            reportParams.facilityId = ~~reportParams.facilityId;
        }

        // sanity checking - minimum required params !
        if (_.isEmpty(reportParams.reportId)
            || _.isEmpty(reportParams.reportCategory)
            || _.isEmpty(reportParams.reportFormat)
            || (_.isNull(reportParams.companyId) || _.isUndefined(reportParams.companyId) || reportParams.companyId < 1)
            || (_.isNull(reportParams.userId) || _.isUndefined(reportParams.userId) || reportParams.userId < 1)) {
            reportParams.valid = false;
        }
        return reportParams;
    },

    /**
     * Generates 'starter' options for jsreport which includes some common settings based on report format.
     * @param {Object} reportParams - Normalized report parameters from UI.
     * @returns {Object} - jsreport initial options
     */
    getDefaultJsReportOptions: (reportParams) => {
        const jsReportClientOptions = {
            // 'template': { content: 'Hello World', recipe: 'phantom-pdf' }
            'template': {
                'shortid': null
            },
            'data': null,
            'options': {
                'debug': {
                    //'logsToResponse': true,
                    //'logsToResponseHeader': true
                }
            }
        }
        // set the name of the download file
        if (_.includes(['xlsx', 'csv', 'xml'], reportParams.reportFormat)) {
            const fname = `${reportParams.reportId}.${reportParams.reportFormat}`;
            jsReportClientOptions.template.contentDisposition = `attachment; filename=${fname}`;
            //jsReportClientOptions.template.contentType = 'text/csv';
        }
        return jsReportClientOptions;
    },

    logReportParams: (reportParams) => {
        if (DEBUG_ENABLED) {
            logger.logInfo('===== reportParams (start) ====================================================');
            logger.logInfo(JSON.stringify(reportParams, null, 2));
            logger.logInfo('===== reportParams (end)   ====================================================');
        }
    },

    logReportDefinition: (reportDefinition) => {
        if (DEBUG_ENABLED) {
            logger.logInfo('===== reportDefinition (start) ================================================');
            logger.logInfo(JSON.stringify(reportDefinition, null, 2));
            logger.logInfo('===== reportDefinition (end)   ================================================');
        }
    },

    logJsReportOptions: (jsReportOptions) => {
        if (DEBUG_ENABLED) {
            replacer = (key, value) => {
                //return (key == 'rows') ? undefined : value;
                return (key == 'rows') ? '[--- OMMITED FOR BREVITY ---]' : value;
                // if (key == 'rows') {
                //     // more than 5 rows? shorten it..
                //     if (value && value.length && value.length > 5) {
                //         const newVal = value.slice(0, 9);
                //         newVal.push(['--- OTHER ROWS OMMITED FOR BREVITY ---']);
                //         return newVal;
                //     }
                // } else {
                //     return value;
                // }
            }
            logger.logInfo('===== jsReportOptions (start) =================================================');
            //logger.logInfo(JSON.stringify(jsReportOptions, replacer, 0));
            //logger.logInfo(JSON.stringify(jsReportOptions, null, 2));
            logger.logInfo(JSON.stringify(jsReportOptions, null, 0));
            logger.logInfo('===== jsReportOptions (end)   =================================================');
        }
    }
}

module.exports = api;
