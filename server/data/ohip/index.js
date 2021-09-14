const { query, SQL, audit, queryRows } = require('./../index');
const moment = require('moment');
const sprintf = require('sprintf');

const {
    promisify,
} = require('util');

const fs = require('fs');
const readDirAsync = promisify(fs.readdir);
const writeFileAsync = promisify(fs.writeFile);

const path = require('path');
const crypto = require('crypto');
const _ = require('lodash');
const mkdirp = require('mkdirp');
const logger = require('../../../logger');
const config = require('../../config');
const errorDescriptionsByCode = require('../../resx/ohip/errorReport/error');
const explanatoryDescriptionsByCode = require('../../resx/ohip/errorReport/explanatory');
const eraData = require('../../data/era');

const {
    encoding,
    resourceTypes,
    resourceDescriptions,

    CLAIM_STATUS_REJECTED_DEFAULT,
    CLAIM_STATUS_PENDING_PAYMENT_DEFAULT,
    CLAIM_STATUS_DENIED_DEFAULT,
    CLAIM_STATUS_BATCH_REJECTED_DEFAULT

} = require('./../../../modules/ohip/constants');

const ohipUtil = require('./../../../modules/ohip/utils');
const era_parser = require('./ohip-era-parser');

// corresponds to the file_type field of edi_files
const fileTypes = {
    [resourceTypes.CLAIMS]: 'can_ohip_h',
    [resourceTypes.BATCH_EDIT]: 'can_ohip_b',
    [resourceTypes.ERROR_REPORTS]: 'can_ohip_e',
    [resourceTypes.ERROR_REPORT_EXTRACT]: 'can_ohip_f',
    [resourceTypes.CLAIMS_MAIL_FILE_REJECT_MESSAGE]: 'can_ohip_x',
    [resourceTypes.REMITTANCE_ADVICE]: 'can_ohip_p',
    [resourceTypes.OBEC]: 'can_ohip_o',
    [resourceTypes.OBEC_RESPONSE]: 'can_ohip_r',
};

const getDatePath = () => {
    return path.join(...moment().format('YYYY/MM/DD').split('/'));
};

const queryMakers = require('./../query-maker-map');
const generator = queryMakers.get('datetime');
/**
 * const getFileType - determines a value for the file_type field of a
 * record in the edi_files table based on a filename or OHIP resource type.
 * If both parameters are specified, then the resourceType is used and the
 * filename is ignored.
 *
 * @param  {object} args    {
 *                              // optional
 *                              filename: String,
 *
 *                              // mandatory if filename isn't specified
 *                              resourceType: String,
 *                          }
 * @returns {string}        a valid value for the file_type field of
 *                          the edi_files table
 */
const getFileType = (args) => {
    let resourceType = args.resourceType;

    if (args.filename && !resourceType) {
        resourceType = ohipUtil.getResourceType(args.filename);
    }

    return fileTypes[resourceType];
};



/**
 * const getFileStore - returns an object with information about a record in
 * the 'public.file_stores' table. The appropriate filestore is determined by
 * the 'type' field of the filename (e.g. 'H', 'B', 'X', 'E', 'F', 'P', etc).
 * If there is no filestore mapped to the filetype, then the default filestore
 * is returned.
 *
 * @param  {object} args {
 *                           filename: String,  // eg 'HL0001.123'
 *                       }
 * @returns {object}     {
 *                           id: Number,                // file_stores PK
 *                           file_store_name: String,   // 'Claims'
 *                           root_directory: String,    // ''
 *                           is_default: boolean        // true if default
 *                       }
 */
const getFileStore = async (args) => {

    const {
        filename,
    } = args;


    const description = filename && ohipUtil.getResourceDescription(filename);

    let filestore = null;

    let sql = SQL`
        SELECT
            id,
            file_store_name,
            root_directory,
            is_default
        FROM public.file_stores
        WHERE company_id = 1
            AND is_default
    `;

    if (description) {
        sql = sql.append(`
            OR (file_store_name = '${description}' AND NOT has_deleted)
        `);
    }

    const dbResults = (await query(sql.text, sql.values)).rows;

    if (dbResults && dbResults.length) {

        filestore = dbResults[0];

        for (let i = 0; i < dbResults.length; i++) {
            // matches the resource description to the name of the filestore
            if (dbResults[i].file_store_name === description) {
                filestore = dbResults[i];
                break;
            }
        }
    }

    return filestore;
};

/**
 * const storeFile - creates an entry in the 'billing.edi_files' table with
 * information about the filename, filestore, and other file information. The
 * filestore is determined by filename (NOTE see getFileStore())
 *
 * @param  {object}  args {
 *                            filename: String, // 'BL0001.123'
 *                            data: String      // 'HX1...'
 *                        }
 * @returns {object}      {
 *                            file_store_id: Number,  // file_stores PK
 *                            file_id: Number,        // edi_files PK
 *                            absolutePath: String,   // full path including filename
 *                        }
 */
const storeFile = async (args) => {

    let {
        filename: originalFilename,
        file_data = [],
        data,
        isTransient,
        appendFileSequence,
        fileSequenceOffset,
        resource_id = null,
        groupNumber,
        providerNumber,
        providerSpeciality,
        batchSequenceNumber,
        derivedGroupNumber,
        derivedMOHId
    } = args;

    data = data || (file_data.length && file_data[0].data) || '';
    const exaFileType = getFileType(args);


    // 20120331 - OHIP Conformance Testing Batch Edit sample batch date, seq: 0005
    // accounting number: "CST-PRIM" from Conformance Testing Error Report sample

    const filestore = await getFileStore(args) || {};
    const filePath = path.join((filestore.is_default ? 'OHIP' : ''), getDatePath());
    const dirPath = path.join(filestore.root_directory || '', filePath);

    // Create dir if missing
    mkdirp.sync(dirPath);

    let filename = originalFilename;

    if (appendFileSequence) {
        try {
            const filenames = await readDirAsync(dirPath);

            const index = String(filenames.length + fileSequenceOffset);

            // Use index as the final 4 chars (. + 3 numbers) in the filename
            filename += `.${index.padStart(3, '0')}`;
        }
        catch (e) {
            logger.error(`Could not get file count for directory ${dirPath}`, e);
        }

    }

    const fileInfo = {
        file_store_id: filestore.id,
        absolutePath: path.join(dirPath || '', filename || ''),
    };

    if (isTransient || !exaFileType) {
        // if we don't care about storing the file or the database
        // will freak out if we try, then our work is done, here
        fileInfo.edi_file_id = 0;
        return fileInfo;
    }

    try {

        const md5Hash = crypto.createHash('MD5').update(data, 'utf8').digest('hex');

        const { rows = [] } = await eraData.isProcessed(md5Hash, 1);

        if (rows.length && rows[0] && rows[0].file_exists && rows[0].file_exists[0]) {
            logger.debug(`File name ${filename} already downloaded into EXA`);
            fileInfo.edi_file_id = 0;
            return fileInfo;
        }

        logger.debug(`Writing file ${filename} into filestore...`);
        await writeFileAsync(fileInfo.absolutePath, data, { encoding });

        const stats = fs.statSync(fileInfo.absolutePath);

        logger.debug(`Storing file ${filename} into database...`);

        // inserting the data into edi files table
        const sql = SQL`
                        WITH files AS (
                            INSERT INTO billing.edi_files (
                                company_id,
                                file_store_id,
                                created_dt,
                                status,
                                file_type,
                                file_path,
                                file_size,
                                file_md5,
                                uploaded_file_name,
                                resource_no,
                                can_ohip_moh_id
                            )
                            VALUES(
                                1
                                ,${filestore.id}
                                ,now()
                                ,'pending'
                                ,${exaFileType}::TEXT
                                ,${filePath}::TEXT
                                ,${stats.size}::BIGINT
                                ,${md5Hash}::TEXT
                                ,${filename}::TEXT
                                ,nullif(${resource_id}, 'undefined')
                                ,${derivedMOHId}
                            )
                            ON CONFLICT (resource_no) WHERE resource_no IS NOT NULL
                            DO NOTHING
                            RETURNING id
                        ), insert_batch_files_cte AS (
                            INSERT INTO billing.edi_file_batches  (
                                edi_file_id,
                                provider_number,
                                group_number,
                                sequence_number,
                                speciality_code,
                                error_data
                            ) SELECT
                                id
                                , ${providerNumber}
                                , ${derivedGroupNumber}
                                , ${batchSequenceNumber}
                                , ${providerSpeciality}
                                , '{}'::JSONB
                            FROM files
                            WHERE ${exaFileType}::TEXT = 'can_ohip_h'
                            RETURNING id
                        )
                        SELECT
                            files.id AS edi_file_id
                            , insert_batch_files_cte.id
                        FROM files
                        LEFT JOIN insert_batch_files_cte ON TRUE
                    `;

        const dbResults = (await query(sql.text, sql.values)).rows || [];

        fileInfo.edi_file_id = dbResults.length && dbResults[0].edi_file_id || null;
        fileInfo.edi_file_batch_id = dbResults.length && dbResults[0].id || null;

        return fileInfo;
    }
    catch (e) {
        logger.error(`Error storing file ${filename} into database.. ${e}`);
    }
};

const getResourceIDs = async (args) => {
    const {
        resourceType,
    } = args;

    const sql = SQL`
        SELECT resource_no
        FROM billing.edi_files
        WHERE file_type=${getFileType(args)}
    `;

    let resourceIDs = (await query(sql.text, sql.values)).rows || [];
    return resourceIDs.map((edi_file) => {
        return edi_file.resource_no;
    }) || [];
};



/**
 * const loadFile - description
 *
 * @param  {object} args    {
 *                              edi_files_id: Number,   // billing.edi_files PK (id)
 *                          }
 * @returns {object}        {
 *                              data: String,                 // ASCII-encoded contents of file
 *                              file_store_id: Number,        // public.file_stores PK (id)
 *                              root_directory: String,       // root directory as defined by filestore
 *                              file_path: String,            // path relative to root_directory
 *                              uploaded_file_name: String,   // actual filename
 *                          }
 */
const loadFile = async (args) => {
    const {
        edi_files_id,
    } = args;

    const sql = SQL`
        SELECT
            fs.id as file_store_id,
            fs.root_directory as root_directory,
            fs.company_id,
            ef.file_path as file_path,
            ef.id as file_id,
            ef.resource_no as resource_id,
            ef.uploaded_file_name as uploaded_file_name,
            fs.root_directory || '/' || file_path as full_path
        FROM
            billing.edi_files ef
        INNER JOIN file_stores fs ON ef.file_store_id = fs.id
        WHERE
            ef.id = ${edi_files_id}
    `;

    const {
        file_store_id,
        root_directory,
        file_path,
        uploaded_file_name,
    } = (await query(sql.text, sql.values)).rows[0];

    const absolutePath = path.join(root_directory, file_path, uploaded_file_name);
    const data = fs.existsSync(absolutePath) && fs.readFileSync(absolutePath, { encoding });

    return {
        data,
        file_store_id,
        root_directory,
        file_path,
        uploaded_file_name
    };
};


const updateFileStatus = async (args) => {
    const {
        files,
        status,
        errors = []
    } = args;

    const fileIds = files.map((file) => {
        return file.edi_file_id;
    });

    const sql = SQL`

        WITH tempTbl as (
            SELECT
                *
            FROM json_populate_recordset(null::record, ${JSON.stringify(files)}) AS (
                edi_file_id int
                , resource_id text
            )
        )
        UPDATE
            billing.edi_files ef
        SET
            status=${status}
            , resource_no=(select coalesce (ef.resource_no, tempTbl.resource_id))  -- we never update resourceIDs
            , error_data = ${JSON.stringify(errors)}::JSONB
        FROM
            tempTbl
        WHERE
            ef.id = tempTbl.edi_file_id
    `;

    await query(sql.text, sql.values);
};

const updateClaimStatus = async (args) => {
    const {
        claimIds,
        accountingNumber,
        claimStatusCode,
        userId,
        claimNote,
        clientIp,
        companyId,
        screenName,
        entityName,
        moduleName,
        auditDesc
    } = args;

    const sql = SQL`
        WITH
        submissionDate AS (
        	SELECT timezone(get_facility_tz(1::int), now()::timestamp) LIMIT 1
        )
        , addClaimComment AS (
            INSERT INTO billing.claim_comments (
                  note
                , type
                , claim_id
                , created_by
                , created_dt
            )
            SELECT
                  ${claimNote}
                , 'auto'
                , claims.id
                , ${userId}
                , now()
            FROM billing.claims
            WHERE claims.id = ANY(${claimIds}::int[])
            RETURNING *
            ),
            update_status AS (
                UPDATE billing.claims claims
                SET
                    claim_status_id = (
                        SELECT id
                        FROM billing.claim_status
                        WHERE code=${claimStatusCode}
                        LIMIT 1
                    )`
    
        .append(
            claimStatusCode === 'PA'
                ? SQL` , submitted_dt = (SELECT timezone FROM submissionDate) `
                : SQL``
        )
        .append(SQL`
                    WHERE
                        id = ANY(${claimIds}::int[])
                    RETURNING *
                    , (SELECT row_to_json(old_row) FROM (
                        SELECT * FROM billing.claims i_bc
                        WHERE i_bc.id = claims.id) old_row
                    ) old_values
                )
                SELECT 
                    us.id AS claim_id
                    , us.claim_status_id
                    , billing.create_audit (
                        ${companyId},
                        lower(${entityName}),
                        us.id,
                        ${screenName},
                        ${moduleName},
                        ${auditDesc},
                        ${clientIp},
                        json_build_object(
                            'old_values', COALESCE(us.old_values, '{}'),
                            'new_values', ( 
                                    SELECT 
                                        row_to_json(temp_row)::jsonb - 'old_values'::text 
                                    FROM 
                                        ( SELECT * FROM update_status i_us where i_us.id = us.id) temp_row)
                        )::jsonb,
                        ${userId}
                    ) id
                    FROM update_status us
        `);

    return (await query(sql.text, sql.values));
};

/**
 * const applyClaimSubmission - description
 *
 * @param  {type} args description
 * @returns {type}      description
 */
const applyClaimSubmission = async (args) => {

    const {
        edi_file_id,
        edi_file_batch_id,
        file_data,    // an array of objects: {claimIds:[Number], batchSequenceNumber:Number}
    } = args;

    let batches = file_data[0].batches || [];

    batches.forEach(async (batch) => {
        const {
            batchSequenceNumber,
            claimIds,
        } = batch;

        const sql = SQL`
            INSERT INTO billing.edi_file_claims (
                edi_file_id,
                claim_id,
                batch_number,
                edi_file_batch_id
            )
            SELECT
                ${edi_file_id},
                UNNEST(${claimIds}::int[]),
                ${sprintf(`%'04s`, batchSequenceNumber)},
                ${edi_file_batch_id}
            RETURNING id
        `;

        (await query(sql.text, sql.values)).rows;
    });
};

const applyRejectMessage = async (args) => {
    const {
        responseFileId,
        parsedResponseFile,
    } = args;

    let {
        rejectMessageRecord1: {
            messageType,
            messageReason,
            invalidRecordLength,
        },
        rejectMessageRecord2: {
            mailFileDate,
            providerFileName,
            processDate,
        },
    } = parsedResponseFile;

    const comment = [
        `messageType=${messageType}`,
        `messageReason=${messageReason}`,
        `invalidRecordLength=${invalidRecordLength}`,
    ].join(`;`);

    const rejectStatus = CLAIM_STATUS_REJECTED_DEFAULT;

    mailFileDate = moment(mailFileDate, 'YYYYMMDD').format('YYYY-MM-DD');
    processDate = moment(processDate, 'YYYYMMDD').format('YYYY-MM-DD');

    const sql = SQL`
        WITH original_file AS (

            -- Should only be one matching file with uploaded_file_name on the same date

            SELECT
                id
            FROM
                billing.edi_files
            WHERE
                file_type = 'can_ohip_h'
                AND status = 'success'
                AND created_dt::date = NULLIF(${mailFileDate}, 'Invalid date')::DATE
                AND uploaded_file_name = ${providerFileName}
        ), reject_file AS (

            -- status of 'success' just means file was obtained

            UPDATE
                billing.edi_files
            SET
                status = 'success',
                processed_dt = NULLIF(${processDate}, 'Invalid date')::DATE
            WHERE
                id = ${responseFileId}
            RETURNING
                id
        ), related_file AS (
            INSERT INTO billing.edi_related_files (
                submission_file_id,
                response_file_id,
                comment
            )
            SELECT
                ( SELECT original_file.id FROM original_file ),
                ( SELECT reject_file.id FROM reject_file ),
                ${comment}
            RETURNING
                *
        ), claim_ids AS (
            SELECT DISTINCT
                efc.claim_id
            FROM
                billing.edi_file_claims efc
            INNER JOIN related_file rf
                ON rf.submission_file_id = efc.edi_file_id
        ), reject_status AS (
            SELECT
                id
            FROM
                billing.claim_status
            WHERE
                code = ${rejectStatus}
                AND inactivated_dt IS NULL
                AND is_system_status
        )
        UPDATE
            billing.claims
        SET
            claim_status_id = ( SELECT id FROM reject_status )
        FROM
            claim_ids
        WHERE
            id = claim_ids.claim_id
        RETURNING
            id;
    `;

    return responseFileId && await query(sql.text, sql.values) || { rows: [] };
};



/**
 * const applyBatchEditReport - description
 *
 * @param  {type} args description
 * @returns {type}      description
 */
const applyBatchEditReport = async (args) => {

    const {
        responseFileId,
        parsedResponseFile,
    } = args;

    const {
        batchCreateDate,
        batchStatus,
        batchSequenceNumber,
        providerNumber,
        groupNumber
    } = parsedResponseFile[0] || {};

    const createdDate = moment(batchCreateDate, 'YYYYMMDD').format('YYYY-MM-DD');
    const claimStatus = (batchStatus === 'R') ? CLAIM_STATUS_BATCH_REJECTED_DEFAULT : CLAIM_STATUS_PENDING_PAYMENT_DEFAULT;

    const sql = SQL`
        WITH related_submission_files AS (
            SELECT
                ef.id AS submission_file_id,
                efc.claim_id AS claim_id
            FROM billing.edi_files ef
            INNER JOIN billing.edi_file_claims efc ON ef.id = efc.edi_file_id
            INNER JOIN billing.edi_file_batches efb ON efb.edi_file_id = ef.id
            WHERE
                ef.file_type = 'can_ohip_h'
                AND ef.status <> 'pending'
                AND ef.created_dt::date = NULLIF(${createdDate}, 'Invalid date')::DATE
                AND efb.sequence_number = ${batchSequenceNumber}
                AND efb.provider_number = ${providerNumber}
                AND efb.group_number = ${groupNumber}
                AND NOT did_not_process
                ORDER BY ef.id DESC
        ),
        insert_related_file_cte AS (
            INSERT INTO billing.edi_related_files (
                submission_file_id,
                response_file_id
            )
            SELECT
                ( SELECT submission_file_id FROM related_submission_files LIMIT 1 ),
                ${responseFileId}
            WHERE EXISTS (SELECT 1 FROM related_submission_files)
            LIMIT 1
            RETURNING
                submission_file_id
        ),
        update_status AS (
            -- status of 'success' just means file was obtained
            UPDATE
                billing.edi_files
            SET
                status = (
                    CASE
                        WHEN EXISTS (
                            SELECT
                                1
                            FROM related_submission_files
                        )
                        THEN
                            'success'
                        ELSE
                            'nomatch'
                    END
                ),
                processed_dt = now()
            WHERE
                id = ${responseFileId}
            RETURNING
                *
        )
        SELECT *
        FROM insert_related_file_cte
        INNER JOIN billing.edi_file_claims efc ON efc.edi_file_id = insert_related_file_cte.submission_file_id
    `;

    const dbResults = responseFileId && (await query(sql.text, sql.values)).rows || { rows: [] };

    if (dbResults && dbResults.length) {
        await updateClaimStatus({
            claimStatusCode: claimStatus,  // Batch Rejected or Pending Payment
            claimIds: dbResults.map((claim_file) => {
                return claim_file.claim_id;
            }),
            claimNote: 'Electronically acknowledged via MCEDT-EBS',
            userId: 1,
        });
    }

    return {};
};

const toBillingNotes = (obj) => {
    return obj.errorCodes.map((errorCode) => {
        return `${errorCode} - ${errorDescriptionsByCode[errorCode]}`;
    });
};

const applyErrorReport = async (args) => {

    const {
        accountingNumber,
        responseFileId,
        comment,
        parsedResponseFile,
    } = args;


    const deniedStatus = CLAIM_STATUS_REJECTED_DEFAULT;
    const processDate = new Date();

    const claimIds = parsedResponseFile.reduce((prfResults, prf) => {
        return prf.claims.reduce((claimResults, claim) => {
            if (!isNaN(claim.accountingNumber)) {
                claimResults.push(claim.accountingNumber);
            }

            return claimResults;
        }, prfResults);
    }, []);

    const billingNotesByClaimId = parsedResponseFile.reduce((prfResults, prf) => {
        return prf.claims.reduce((claimResults, claim) => {
            if (!isNaN(claim.accountingNumber)) {
                claimResults[claim.accountingNumber] = claim.items.reduce((billingNotes, item) => {
                    if (item.explanatoryCode) {
                        billingNotes.push(`${item.explanatoryCode} - ${explanatoryDescriptionsByCode[item.explanatoryCode]}`);
                    }

                    return billingNotes.concat(toBillingNotes(item));
                }, toBillingNotes(claim)).join('\n');
            }

            return claimResults;
        }, prfResults);
    }, {});

    const fileStatus = (parsedResponseFile[0].claims.length === claimIds.length) ? 'success' : 'partial';
    const processedDate = moment(processDate, 'YYYYMMDD').format('YYYY-MM-DD');

    const sql = SQL`
        WITH claim AS (
            UPDATE
                billing.claims
            SET
                claim_status_id = (
                    SELECT
                        id
                    FROM
                        billing.claim_status
                    WHERE
                        code = ${deniedStatus}
                        AND inactivated_dt IS NULL
                        AND is_system_status
                ),
                billing_notes = correction.value
            FROM json_each_text(${JSON.stringify(billingNotesByClaimId)}) AS correction
            WHERE
                -- TODO extract affected claimIDs/accountingNumbers from parsedFile and pass as array (dont cast)
                id = correction.key::bigint
            RETURNING
                 id
        )
        , original_file AS (

            SELECT
                ef.id
                , ef.uploaded_file_name
            FROM
                billing.edi_files ef
                INNER JOIN (
                    SELECT
                        id
                        , edi_file_id
                    FROM
                        billing.edi_file_claims efc
                    WHERE
                        efc.claim_id = ANY((SELECT id FROM claim))
                ) efc ON efc.edi_file_id = ef.id
            WHERE
                file_type = 'can_ohip_h'
                AND status = 'success'
            LIMIT 1
        )
        , error_file AS (

            -- status of 'success' just means file was obtained

            UPDATE
                billing.edi_files
            SET
                status = ${fileStatus},
                processed_dt = NULLIF(${processedDate}, 'Invalid date')::DATE
            WHERE
                id = ${responseFileId}
            RETURNING
                *
        )
        , related_file AS (
            INSERT INTO billing.edi_related_files (
                submission_file_id,
                response_file_id,
                comment
            )
            SELECT
                ( SELECT original_file.id FROM original_file ),
                id,
                null
            FROM
                error_file
            WHERE
                error_file.status = 'success'
            ON CONFLICT ON CONSTRAINT edi_related_files_submission_file_id_response_file_id_uc
            DO NOTHING
			RETURNING
                *
        ), update_process AS (
            -- update process status to check whether the claim processed or not
            UPDATE
                billing.edi_file_claims efc
            SET
                did_not_process = true
            WHERE
                efc.claim_id = ANY(SELECT id FROM claim)
            AND
                NOT efc.did_not_process
            AND
                efc.id = (
                    SELECT
                        MAX(id)
                    FROM
                        billing.edi_file_claims
                    WHERE claim_id = efc.claim_id
                    GROUP BY claim_id
                )
            RETURNING
                id
        )
        SELECT
            original_file.id as submission_file_id
            , original_file.uploaded_file_name as submission_file_name
            , error_file.id as error_file_id
            , error_file.uploaded_file_name as error_file_name
            FROM original_file, error_file
    `;


    const dbResults = responseFileId && (await query(sql.text, sql.values)) || { rows: [] };

    if (dbResults.rows && dbResults.rows.length) {
        logger.info('updating claim status for IDs: ', claimIds);

        await updateClaimStatus({
            claimStatusCode: deniedStatus,  // Pending Payment
            claimIds,
            claimNote: 'Electronically corrected via MCEDT-EBS',
            userId: 1,
        });
    }
};


const OHIPDataAPI = {

    getFileType,

    getFileStore,
    storeFile,
    loadFile,
    updateFileStatus,

    updateClaimStatus,

    applyClaimSubmission,
    applyRejectMessage,
    applyBatchEditReport,
    applyErrorReport,

    getResourceIDs,

    getOHIPConfiguration: async (args) => {
        const {
            muid,
        } = args || {};

        // convert a semicolon delimited list of key=value pairs into a configuration object
        // e.g. "foo=1;bar=A;baz=true"
        return (config.get('ohipModuleParams') || '').split(';').reduce((ohipConfig, param) => {
            if (param) {    // could be an empty string
                const paramParts = param.split('=');
                ohipConfig[paramParts[0].trim()] = paramParts[1].trim();
            }

            return ohipConfig;
        }, {
            //
            // this is the 'seed' object for the reduce function
            //

            // EBS specific ...
            ebsConfig: {
                isProduction: config.get('ebsProduction'),
                ebsCertPath: config.get('ebsCertPath'),
                serviceUserMUID: (typeof muid !== 'undefined') ? muid : config.get('serviceUserMUID'),
                username: config.get('ebsUsername'),
                password: config.get('ebsPassword'),

                // EDT specific ...
                edtSoftwareConformanceKey: config.get('edtSoftwareConformanceKey'),
                edtServiceEndpoint: config.get('edtServiceEndpoint'),

                // HCV specific ...
                hcvSoftwareConformanceKey: config.get('hcvSoftwareConformanceKey'),
                hcvServiceEndpoint: config.get('hcvServiceEndpoint'),
            }
        });
    },

    auditTransaction: async (args) => {

        /* Sample input args.info object, also args.oldInfo which usually be {}:
        {
            transactionID:              // TODO need clarification from MoH
            serviceUser:                // MoH User ID
            endUserID:                  // TODO need clarification from MoH
            dateTime: Date,             // date and time of the transaction
            duration: Number,           // milliseconds
            action: String              // "upload"/"download" etc
            eventDetail: String,        // TODO need clarification from MoH
            Simple success or failure   // "success" or "failure"
            exitStatus: Number,         // STD001
            messages: Array             // array of strings
            errorMessages: Array        // array of strings
        }
        */
        /*  All these arguments are needed, default value for entityName, entityId and clientIP
            are processed in audit.createAudit
        */
        // let {
        //     userId = 1,
        //     entityName = null,
        //     entityKey = null,
        //     screenName = 'Billing',
        //     moduleName = 'OHIP',
        //     logDescription = 'OHIP audit log',
        //     clientIp = null,
        //     companyId = 1,
        //     oldInfo = {},
        //     info = {}
        // } = args;
        //
        // args.newData = info;

        // return await audit.createAudit(args);
        return;
    },

    getSequenceNumber: async (providerNumber, groupNumber, specialityCode) => {
        const sql = SQL`
            (
                SELECT
                    COALESCE((NULLIF(befb.sequence_number, '')::BIGINT + 1), '0') AS sequence_number
                FROM billing.edi_files bef
                LEFT JOIN billing.edi_file_batches befb ON befb.edi_file_id = bef.id
                WHERE befb.provider_number = ${providerNumber}
                AND befb.group_number = ${groupNumber}
                AND befb.speciality_code = ${specialityCode}
                AND bef.created_dt::DATE = CURRENT_DATE
                ORDER BY befb.id DESC
            )
            UNION ALL
            SELECT '0'::BIGINT AS sequence_number
            LIMIT 1
        `;

        let rows = (await query(sql.text, sql.values)).rows || [];
        return rows.length && rows[0] || {'sequence_number': 0};

    },

    getClaimsData: async (args) => {
        const {
            claimIds = [],
            submissionLimit,
        } = args;

        let file_path = path.join(__dirname, '../../resx/speciality_codes.json');
        let speciality_codes = fs.readFileSync(file_path, 'utf8');
        let whereQuery = '';
        let limitQuery = '';

        if (claimIds.length) {
            whereQuery = SQL` bc.id = ANY (${claimIds}) `;
        } else {
            whereQuery = SQL` bc.rendering_provider_contact_id IS NOT NULL
                   AND bc.billing_method = 'electronic_billing'
                   AND claim_types.charge_type IS NOT NULL
                   AND bcs.code = 'CQ' `;

            limitQuery = SQL`LIMIT ${submissionLimit || 100}`;
        }

        const sql = SQL`
            WITH speciality_codes AS (
                SELECT * FROM json_each_text(${JSON.parse(speciality_codes)})
            )
            SELECT
                bc.id AS claim_id,
                bc.facility_id AS claim_facility_id,
                bc.billing_method,
                bc.can_ohip_manual_review_indicator AS "manualReviewIndicator",
                bc.id AS "accountingNumber",
                bc.can_ohip_manual_review_indicator AS "manualReviewIndicator",
                claim_notes AS "claimNotes",
                bc.rendering_provider_contact_id,
                NULLIF((pf.facility_info->'npino'), '') AS "groupNumber",
                NULLIF((pf.facility_info->'professionalGroupNumber'), '') AS "professionalGroupNumber",
                NULLIF((rend_pr.provider_info -> 'NPI'), '') AS "providerNumber",
                rend_pr.specialities AS rendering_provider_specialities,
                (
                    SELECT json_agg(item)
                    FROM (
                        SELECT
                        key AS speciality_code,
                        value AS speciality_desc
                    FROM speciality_codes
                    WHERE value = ANY(rend_pr.specialities)
                    ) item
                ) AS "specialtyCodes",
                33 AS "defaultSpecialtyCode",  -- NOTE this is only meant to be a temporary workaround
                (
                    SELECT row_to_json(insurance_details) FROM (
                    SELECT
                        ppi.policy_number AS "healthNumber",
                        ppi.policy_number AS "rmbRegistrationNumber",
                        ppi.group_number AS "versionCode",
                        pip.insurance_name AS "payerName",
                        pip.insurance_code AS "paymentProgram"
                    FROM public.patient_insurances ppi
                    INNER JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
                    WHERE ppi.id = bc.primary_patient_insurance_id) insurance_details
                ) insurance_details,
                (
                    SELECT json_agg(row_to_json(charge_items))
                    FROM (
                        SELECT
                            pcc.display_code AS "serviceCode",
                            (bch.bill_fee * bch.units) AS "feeSubmitted",
                            bch.units AS "numberOfServices",
                            charge_dt AS "serviceDate",
                            billing.get_charge_icds (bch.id) AS diagnosticCodes,
                            pcc.charge_type
                        FROM billing.charges bch
                        INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
                        WHERE bch.claim_id = bc.id AND NOT bch.is_excluded
                    ) charge_items
                ) items,
                claim_types.charge_type AS claim_type,
                pp.full_name AS "patientName",
                pp.patient_info -> 'c1State' AS "provinceCode",               -- TODO this should be coming from the patient_insurances table
                pp.patient_info->'c1AddressLine1' AS "patientAddress",
                bp.address_line1 AS "billing_pro_addressLine1",
                bp.city AS billing_pro_city,
                bp.name AS "billing_pro_firstName",
                bp.state AS "billing_pro_state",
                bp.zip_code AS "billing_pro_zip",
                NULLIF(bgct.charges_bill_fee_total, 0::MONEY) AS "claim_totalCharge",
                pp.patient_info->'c1AddressLine1' AS "patient_address1",
                pp.patient_info->'c1City' AS "patient_city",
                pp.birth_date::text AS "patient_dob",
                COALESCE (NULLIF(pp.first_name, ''), '') AS "patient_firstName",
                COALESCE (NULLIF(pp.last_name, ''), '') AS "patient_lastName",
                COALESCE (NULLIF(pp.gender, ''), '') AS "patient_gender",
                pp.patient_info->'c1State' AS "patient_province",
                pp.patient_info->'c1Zip' AS "patient_zipCode",
                rend_pr.first_name AS "reading_physician_full_name",
                reff_pr.first_name AS "ref_full_name",
                pof.address_line_1 AS "service_facility_addressLine1",
                pof.city AS "service_facility_city",
                pof.name AS "service_facility_firstName",
                pof.state AS "service_facility_state",
                pof.zip_code AS "service_facility_zip",
                'HOP' AS "serviceLocationIndicator",
                reff_pr.provider_info -> 'NPI' AS "referringProviderNumber",
                'P' AS "payee",
                '' AS "masterNumber",
                get_full_name(pp.last_name,pp.first_name) AS "patientName",
                'IHF' AS "serviceLocationIndicator",
                pspos.code AS "professional_sli",
                ppos.code AS place_of_service
            FROM billing.claims bc
            INNER JOIN billing.claim_status bcs ON bcs.id = bc.claim_status_id
            INNER JOIN public.companies pc ON pc.id = bc.company_id
            INNER JOIN public.patients pp ON pp.id = bc.patient_id
            INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
            INNER JOIN public.facilities pf ON pf.id = bc.facility_id
            INNER JOIN billing.get_claim_totals(bc.id) bgct ON TRUE
            LEFT JOIN public.ordering_facility_contacts pofc ON pofc.id = bc.ordering_facility_contact_id
            LEFT JOIN public.ordering_facilities pof ON pof.id = pofc.ordering_facility_id
            LEFT JOIN public.places_of_service ppos ON ppos.id = pf.place_of_service_id
            LEFT JOIN public.provider_contacts rend_ppc ON rend_ppc.id = bc.rendering_provider_contact_id
            LEFT JOIN public.providers rend_pr ON rend_pr.id = rend_ppc.provider_id
            LEFT JOIN public.provider_contacts reff_ppc ON reff_ppc.id = bc.referring_provider_contact_id
            LEFT JOIN public.providers reff_pr ON reff_pr.id = reff_ppc.provider_id
            LEFT JOIN LATERAL(
                SELECT
                    pcc.charge_type
                FROM billing.charges bch
                INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
                WHERE bch.claim_id = bc.id AND NOT bch.is_excluded
                ORDER BY bch.id DESC LIMIT 1
            ) claim_types ON TRUE
            LEFT JOIN public.places_of_service pspos ON pspos.id = NULLIF((pf.facility_info->'ohipProfSLI'), '')::BIGINT
            WHERE`.append(whereQuery)
            .append(SQL` ORDER BY bc.id DESC `)
            .append(limitQuery);

        return (await query(sql.text, sql.values)).rows;
    },

    handlePayment: async (data, args) => {

        let processedClaims = await era_parser.processOHIPEraFile(data, args);

        return processedClaims;
    },

    getFileManagementData: async (params) => {
        let whereQuery = [];
        let filterCondition = '';
        let paymentIds = [];
        let dateArgs = { options: { isCompanyBase: true} };
        params.sortOrder = params.sortOrder || ' ASC';
        params.sortField = params.sortField == 'id' ? ' ef.id ' : params.sortField;
        let {
            id,
            size,
            updated_date_time,
            current_status,
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            uploaded_file_name,
            payment_id,
            file_name,
            file_type
        } = params;

        whereQuery.push(` ef.file_type != 'EOB' `);

        if (id) {
            whereQuery.push(` ef.id = ${id} `);
        }

        if (file_name) {
            whereQuery.push(` ef.uploaded_file_name ILIKE '%${file_name}%' `);
        }

        if (file_type) {
            whereQuery.push(` ef.file_type ILIKE '%${file_type}%' `);
        }

        if (size) {
            whereQuery.push(` ef.file_size = ${size}`);
        }

        if (updated_date_time) {
            const statusDateFilter = generator('ef.created_dt', updated_date_time, dateArgs);

            if (statusDateFilter) {
                whereQuery.push(statusDateFilter);
            }
        }

        if (current_status) {
            whereQuery.push(` ef.status = replace('${current_status}', '\\', '')`);
        }

        paymentIds = payment_id && payment_id.split(`,`) || [];
        paymentIds = _.filter(paymentIds, e => e !== '');

        if (paymentIds.length) {
            filterCondition = ` AND efp.payment_id = ANY(ARRAY[${paymentIds}]) `;
            whereQuery.push(' file_payments.payment_id IS NOT NULL ');
        }

        const sql = SQL`
                SELECT
                    ef.id,
                    ef.uploaded_file_name AS file_name,
                    ef.file_store_id,
                    ef.created_dt AS updated_date_time,
                    ef.status AS current_status,
                    ef.file_type,
                    ef.file_path,
                    ef.file_size AS size,
                    ef.file_md5,
                    file_payments.payment_id,
                    eob.eob_file_id,
                    'true' as is_payment_received,
                    'true' as is_acknowledgement_received,
                    COUNT(1) OVER (range unbounded preceding) AS total_records
                FROM
                    billing.edi_files ef
                    LEFT JOIN companies ON companies.id = ef.company_id
                    LEFT JOIN LATERAL (
                        SELECT
                            array_agg(efp.payment_id) as payment_id
                        FROM
                            billing.edi_file_payments efp
                        WHERE
                            efp.edi_file_id = ef.id `;

        if (paymentIds.length) {
            sql.append(filterCondition);
        }

        sql.append(SQL`) AS file_payments ON TRUE
                                LEFT JOIN LATERAL (
                                                SELECT
                                                   DISTINCT efp.edi_file_id AS eob_file_id
                                                FROM
                                                    billing.edi_file_payments efp
                                                WHERE
                                                    efp.payment_id = ANY(file_payments.payment_id)
                                                    AND efp.edi_file_id != ef.id
                                                ) AS eob ON TRUE
                                WHERE
                                company_id =  ${params.companyId} `);

        if (whereQuery.length) {
            sql.append(SQL` AND `);
        }

        if (whereQuery.length) {
            sql.append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY  `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);
    },

    saveEligibilityLog: async (params) => {
        const {
            patient_id,
            patient_insurance_id,
            eligibility_response
        } = params;

        const sql = SQL`
            INSERT INTO eligibility_log
                    ( patient_id
                    , patient_insurance_id
                    , eligibility_response
                    , eligibility_dt)
            VALUES
                    ( ${patient_id}
                    , ${patient_insurance_id}
                    , ${eligibility_response}
                    , now()
                    )
        `;

        return await query(sql);
    },

    updatePatientInsDetails: async (args) => {
        const {
            patient_id,
            patient_insurance_id,
            firstName = null,
            secondName = null,
            lastName = null,
            gender = null,
            dateOfBirth = null,
            expiryDate = null,
            userId = 1,
            companyId = 1
        } = args;

        const sql = SQL`
        WITH update_patient_details AS (
            UPDATE patients p
            SET
                first_name = COALESCE(NULLIF(${firstName}, ''), p.first_name)
                , middle_name = COALESCE(NULLIF(${secondName}, ''), p.middle_name)
                , last_name = COALESCE(NULLIF(${lastName}, ''), p.last_name)
                , gender = COALESCE(NULLIF(${gender}, ''), p.gender)
                , birth_date = COALESCE(NULLIF(${dateOfBirth}, '')::DATE, p.birth_date)
                , full_name = get_full_name(
                                COALESCE(NULLIF(${lastName}, ''), p.last_name)
                                , COALESCE(NULLIF(${firstName}, ''), p.first_name)
                                , COALESCE(NULLIF(${secondName}, ''), p.middle_name)
                                , p.prefix_name
                                , p.suffix_name
                              )

            WHERE id = ${patient_id}
            RETURNING
                id
                , row_to_json(p.*) AS new_values
                , ( SELECT row_to_json(old_row)
                    FROM ( SELECT
                                first_name
                                , middle_name
                                , last_name
                                , gender
                                , birth_date
                                , full_name
                              FROM public.patients
                              WHERE id = ${patient_id}) AS old_row) AS old_values

        )
        , update_patient_insurance_details AS (
            UPDATE patient_insurances pi
            SET valid_to_date = COALESCE(NULLIF(${expiryDate}, '')::DATE, pi.valid_to_date)
            WHERE patient_id = ${patient_id}
            AND id = ${patient_insurance_id}
            RETURNING pi.* AS old_values
        )
        SELECT create_audit (
            ${userId}
            , ${patient_id}
            , null
            , null
            , 'Health Card Validation'
            , 'Patient'
            , 'Update: Patient Information Updated by MOHLTC for patient id: ' || ${patient_id}
            , null
            , jsonb_build_object(
                'old_values', upd.old_values,
                'new_values', upd.new_values
            )::JSON
            , null
            , null
            , ${companyId}
        ) AS id
        FROM update_patient_details upd
        WHERE upd.id IS NOT NULL
        `;

        return await query(sql.text, sql.values);
    },

    createLegacyClaimCharge: async (params, paymentDetails) => {
        const {
            lineItems,
        } = params;

        const sql = SQL` WITH
                        get_charge_items AS (
                            SELECT
                                *
                            FROM json_to_recordset(${JSON.stringify(lineItems)}) AS (
                                claim_number text
                                , charge_id bigint
                                , payment money
                                , adjustment money
                                , cpt_code text
                                , patient_fname text
                                , patient_lname text
                                , patient_mname text
                                , patient_prefix text
                                , patient_suffix text
                                , original_reference text
                                , cas_details jsonb
                                , claim_status_code bigint
                                , service_date date
                                , index integer
                                , duplicate boolean
                                , code text
                                , is_debit boolean
                                , claim_index bigint
                                , claim_status text
                                , is_exa_claim boolean
                            )
                        )
                        , get_claim_data AS (
                            SELECT
                                bc.id,
                                bc.invoice_no
                            FROM billing.claims bc
                            INNER JOIN get_charge_items ON (LPAD(bc.invoice_no, 8, '0') = LPAD(TRIM(get_charge_items.claim_number), 8, '0'))
                            ORDER BY bc.id DESC LIMIT 1
                        )
                        INSERT INTO billing.charges
                        (
                            claim_id
                            , cpt_id
                            , bill_fee
                            , units
                            , created_by
                            , charge_dt
                            , is_excluded
                            , is_custom_bill_fee
                        )
                        SELECT
                            bc.id
                            , cpt.cpt_id
                            , get_charge_items.payment
                            , 1
                            , ${paymentDetails.created_by}
                            , now()
                            , FALSE
                            , TRUE
                        FROM get_charge_items
                        INNER JOIN get_claim_data AS bc ON TRUE
                        INNER JOIN LATERAL (
                            SELECT cc.id AS cpt_id
                            FROM public.cpt_codes cc
                            WHERE cc.display_code = get_charge_items.cpt_code
                            ORDER BY cc.id ASC LIMIT 1
                        ) cpt ON TRUE
                        WHERE NOT get_charge_items.is_exa_claim
                            AND bc.invoice_no IS NOT NULL
                            AND get_charge_items.cpt_code NOT IN (
                                SELECT
                                    cc.display_code
                                FROM billing.charges bch
                                INNER JOIN get_claim_data AS claims ON claims.id = bch.claim_id
                                INNER JOIN public.cpt_codes cc ON cc.id = bch.cpt_id
                                WHERE cc.display_code = get_charge_items.cpt_code
                            )
                        RETURNING id AS charge_id `;

        return await queryRows(sql);
    },

    createPaymentApplication: async function (params, paymentDetails) {

        let {
            lineItems
            , claimComments
            , audit_details
        } = params;

        const sql = SQL` WITH
                        application_details AS (
                            SELECT
                                *
                            FROM json_to_recordset(${JSON.stringify(lineItems)}) AS (
                                claim_number text
                                ,charge_id bigint
                                ,payment money
                                ,adjustment money
                                ,cpt_code text
                                ,patient_fname text
                                ,patient_lname text
                                ,patient_mname text
                                ,patient_prefix text
                                ,patient_suffix text
                                ,original_reference text
                                ,cas_details jsonb
                                ,claim_status_code bigint
                                ,service_date date
                                ,index integer
                                ,duplicate boolean
                                ,code text
                                ,is_debit boolean
                                ,claim_index bigint
                                ,claim_status text
                                , is_exa_claim boolean
                            )
                        )
                        , final_claim_charges AS (
                            SELECT
                                bc.id AS claim_id,
                                application_details.cpt_code,
                                application_details.duplicate,
                                application_details.index,
                                application_details.claim_status_code,
                                application_details.original_reference,
                                application_details.service_date,
                                application_details.code,
                                application_details.payment,
                                application_details.adjustment,
                                application_details.cas_details,
                                application_details.is_debit,
                                application_details.patient_fname,
                                application_details.patient_lname,
                                application_details.patient_mname,
                                application_details.patient_prefix,
                                application_details.patient_suffix,
                                application_details.claim_index,
                                application_details.claim_status,
                                bc.claim_status_id,
                                bc.patient_id,
                                cs.code AS claim_payment_status,
                                charges.charge_id
                            FROM application_details
                            INNER JOIN LATERAL (
                                SELECT
                                    bc.id,
                                    bc.claim_status_id,
                                    bc.patient_id,
                                    bc.invoice_no
                                FROM billing.claims bc
                                WHERE (
                                    LPAD(bc.id::TEXT, 8, '0') = LPAD(TRIM(application_details.claim_number), 8, '0') OR
                                    (NOT application_details.is_exa_claim AND LPAD(bc.invoice_no, 8, '0') = LPAD(TRIM(application_details.claim_number), 8, '0'))
                                )
                                ORDER BY bc.id DESC LIMIT 1
                            ) bc ON TRUE
                            INNER JOIN billing.claim_status cs ON cs.id = bc.claim_status_id
                            LEFT JOIN LATERAL (
								SELECT
                                    bch.id AS charge_id
                                FROM billing.charges bch
                                INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
                                LEFT JOIN billing.payment_applications bpa ON bpa.charge_id = bch.id
                                WHERE bch.claim_id = bc.id
                                    AND NOT bch.is_excluded
                                    AND pcc.display_code = application_details.cpt_code
                                ORDER BY bpa.id DESC NULLS FIRST LIMIT 1
                            ) charges ON TRUE
                            WHERE charges.charge_id IS NOT NULL
                        )
                        ,matched_claims AS (
                            SELECT
                                fcc.claim_id,
                                fcc.claim_status_code,
                                fcc.payment,
                                fcc.original_reference,
                                fcc.service_date,
                                fcc.code,
                                fcc.claim_status,
                                fcc.claim_status_id,
                                json_build_object(
                                    'payment'       ,fcc.payment,
                                    'charge_id'     ,fcc.charge_id,
                                    'adjustment'    ,fcc.adjustment,
                                    'cas_details'   ,fcc.cas_details,
                                    'applied_dt'    ,CASE WHEN fcc.is_debit
                                    THEN now() + INTERVAL '0.02' SECOND * fcc.index
                                    ELSE now() + INTERVAL '0.01' SECOND * fcc.index
                                    END
                                )
                            FROM
                                final_claim_charges fcc
                        ),
                        insert_payment_adjustment AS (
                            SELECT
                                matched_claims.claim_id
                                ,matched_claims.claim_status_code
                                ,billing.create_payment_applications(
                                    ${paymentDetails.payment_id || paymentDetails.id}
                                    ,( SELECT id FROM billing.adjustment_codes WHERE code = matched_claims.code ORDER BY id ASC LIMIT 1 )
                                    ,${paymentDetails.created_by}
                                    ,json_build_array(matched_claims.json_build_object)::jsonb
                                    ,(${JSON.stringify(audit_details)})::jsonb
                                )
                            FROM
                                matched_claims
                        )
                        ,update_payment AS (
                           UPDATE billing.payments
                            SET
                                amount = ( SELECT COALESCE(sum(payment),'0')::numeric FROM matched_claims ),
                                notes =  notes || E'\n' || 'Amount received for matching orders : ' || ( SELECT COALESCE(sum(payment),'0')::numeric FROM matched_claims ) || E'\n\n' || ${paymentDetails.messageText.replace(/'/g, "''")}
                            WHERE id = ${paymentDetails.payment_id || paymentDetails.id}
                        )
                        ,insert_claim_comments AS (
                            INSERT INTO billing.claim_comments
                            (
                                claim_id
                                ,note
                                ,type
                                ,created_by
                                ,created_dt
                            )
                            SELECT
                                claim_number
                                ,note
                                ,type
                                ,${paymentDetails.created_by}
                                ,'now()'
                            FROM
                                json_to_recordset(${JSON.stringify(claimComments)}) AS claim_notes
                                (
                                    claim_number bigint
                                    ,note text
                                    ,type text
                                )
                            WHERE EXISTS ( SELECT claim_id FROM matched_claims WHERE claim_id = claim_notes.claim_number LIMIT 1 )
                            RETURNING id AS claim_comment_id
                        )
                        ------------------------------------------------------------
                        -- This query triggred only for OHIP process
                        ------------------------------------------------------------
                        ,update_claim_status AS (
                            UPDATE billing.claims
                                SET
                                claim_status_id =
                                (
                                    CASE
                                        WHEN claim_details.claim_balance_total = 0::money
                                            THEN ( SELECT COALESCE(id, mc.claim_status_id ) FROM billing.claim_status WHERE company_id = ${paymentDetails.company_id} AND code = 'PIF' AND inactivated_dt IS NULL )
                                        WHEN claim_details.claim_balance_total < 0::money
                                            THEN ( SELECT COALESCE(id, mc.claim_status_id ) FROM billing.claim_status WHERE company_id = ${paymentDetails.company_id} AND code = 'OP' AND inactivated_dt IS NULL )
                                        WHEN '0'::MONEY IN (SELECT payment FROM matched_claims mc WHERE mc.claim_id = billing.claims.id)
                                            THEN (SELECT COALESCE(id, mc.claim_status_id) FROM billing.claim_status WHERE company_id = ${paymentDetails.company_id} AND code = 'D' AND inactivated_dt IS NULL)
                                        WHEN (claim_details.claim_balance_total > 0::money AND claim_details.claim_balance_total > claim_details.charges_bill_fee_total)
                                            THEN (SELECT COALESCE(id, mc.claim_status_id) FROM billing.claim_status WHERE company_id = ${paymentDetails.company_id} AND code = 'CA' AND inactivated_dt IS NULL)
                                        WHEN claim_details.claim_balance_total > 0::money
                                            THEN ( SELECT COALESCE(id, mc.claim_status_id ) FROM billing.claim_status WHERE company_id = ${paymentDetails.company_id} AND code = 'PAP' AND inactivated_dt IS NULL )
                                        ELSE
				                        mc.claim_status_id
                                    END
                                )
                            FROM matched_claims mc
                            INNER JOIN billing.get_claim_totals(mc.claim_id) claim_details ON TRUE
                            WHERE billing.claims.id = mc.claim_id
                            RETURNING id as claim_id
                        )
                        SELECT
                        ( SELECT json_agg(row_to_json(insert_payment_adjustment)) insert_payment_adjustment
                                    FROM (
                                            SELECT
                                                    *
                                            FROM
                                                insert_payment_adjustment

                                        ) AS insert_payment_adjustment
                        ) AS insert_payment_adjustment
                        ,(
                            SELECT
                                array_agg(claim_id)
                            FROM
                                update_claim_status
                        )  AS update_claim_status
                        `;
        return await query(sql);
    },

    applyPaymentApplication: async function (audit_details, params) {
        let {
            file_id,
            created_by,
            code
        } = params;

        const sql = SQL`
                    WITH claim_payment AS (
                            SELECT
                                 ch.claim_id
                                ,efp.payment_id
                                ,pa.applied_dt
                            FROM
                                billing.charges AS ch
                            INNER JOIN billing.payment_applications AS pa ON pa.charge_id = ch.id
                            INNER JOIN billing.payments AS p ON pa.payment_id  = p.id
                            INNER JOIN billing.edi_file_payments AS efp ON pa.payment_id = efp.payment_id
                            WHERE efp.edi_file_id = ${file_id}  AND mode = 'eft'
                            GROUP BY ch.claim_id, efp.payment_id, pa.applied_dt
                            ORDER BY pa.applied_dt DESC
                    )
                    ,unapplied_charges AS (
                        SELECT cp.payment_id,
                            json_build_object('charge_id',ch.id,'payment',0,'adjustment',0,'cas_details','[]'::jsonb,'applied_dt',cp.applied_dt)
                        FROM
                            billing.charges ch
                        INNER JOIN billing.claims AS c ON ch.claim_id = c.id
                        INNER JOIN claim_payment AS cp ON cp.claim_id = c.id
                        WHERE ch.id NOT IN ( SELECT charge_id FROM  billing.payment_applications pa WHERE pa.charge_id = ch.id AND pa.payment_id = cp.payment_id AND pa.applied_dt = cp.applied_dt )
                    ),insert_payment_adjustment AS (
                        SELECT
                            billing.create_payment_applications(
                                uc.payment_id
                                ,( SELECT id FROM billing.adjustment_codes WHERE code = ${code} ORDER BY id ASC LIMIT 1 )
                                ,${created_by}
                                ,json_build_array(uc.json_build_object)::jsonb
                                ,('{"screen_name":"applyRemittanceAdvice","module_name":"ohip","entity_name":"applyRemittanceAdvice","client_ip":"127.0.0.1","company_id":1,"user_id":1}')::jsonb
                            )
                        FROM
                            unapplied_charges uc
                    )
                    SELECT * FROM insert_payment_adjustment `;

        return await query(sql);
    },

    updateERAFileStatus: async function (params) {

        const sql = SQL` UPDATE billing.edi_files
                        SET
                            status = (
                                CASE
                                    WHEN EXISTS ( SELECT 1 FROM billing.edi_file_payments WHERE edi_file_id = ${params.file_id} ) THEN 'success'
                                    WHEN NOT EXISTS ( SELECT 1 FROM billing.edi_file_payments WHERE edi_file_id = ${params.file_id} ) THEN 'failure'
                                    ELSE
                                        'in_progress'
                                END
                            )
                        WHERE id = ${params.file_id} `;

        return await query(sql);

    },


};

module.exports = OHIPDataAPI;
