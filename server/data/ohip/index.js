const { query, SQL, audit } = require('./../index');
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

const {
    encoding,
    resourceTypes,
    resourceDescriptions,

    CLAIM_STATUS_REJECTED_DEFAULT,
    CLAIM_STATUS_PENDING_PAYMENT_DEFAULT,
    CLAIM_STATUS_DENIED_DEFAULT,

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
        sql = sql.append(SQL`
            OR (file_store_name = ${description} AND NOT has_deleted)
        `); //file_stores.has_deleted
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

    const {
        createdDate,
        filename: originalFilename,
        data,
        isTransient,
        appendFileSequence,
        fileSequenceOffset,
        resource_id,
    } = args;

    const exaFileType = getFileType(args);


    // 20120331 - OHIP Conformance Testing Batch Edit sample batch date, seq: 0005
    // accounting number: "CST-PRIM" from Conformance Testing Error Report sample

    const filestore = await getFileStore(args);
    const filePath = path.join((filestore.is_default ? 'OHIP' : ''), getDatePath());
    const dirPath = path.join(filestore.root_directory, filePath);

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
        absolutePath: path.join(dirPath, filename),
    };

    await writeFileAsync(fileInfo.absolutePath, data, { encoding });

    if (isTransient || !exaFileType) {
        // if we don't care about storing the file or the database
        // will freak out if we try, then our work is done, here

        return fileInfo;
    }

    const stats = fs.statSync(fileInfo.absolutePath);
    const md5Hash = crypto.createHash('MD5').update(data, 'utf8').digest('hex');

    const sql = `
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
            resource_no
        )
        VALUES(
            1
            ,${filestore.id}
            ,'${moment(createdDate || new Date()).format("YYYY-MM-DD")}'::timestamptz
            ,'pending'
            ,'${exaFileType}'
            ,'${filePath}'
            ,${stats.size}
            ,'${md5Hash}'
            ,'${filename}'
            ,nullif('${resource_id}', 'undefined')
        )
        RETURNING id
    `;

    const dbResults = (await query(sql, [])).rows;

    fileInfo.edi_file_id = dbResults[0].id;

    return fileInfo;
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

    return (await query(sql.text, sql.values)).rows.map((edi_file) => {
        return edi_file.resource_no;
    });
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
    }
};


const updateFileStatus = async (args) => {
    const {
        files,
        status,
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
            VALUES (
                  ${claimNote}
                , 'auto'
                , UNNEST(${claimIds}::int[])
                , ${userId}
                , now()
            ) RETURNING *
        )

        UPDATE billing.claims claims
        SET
            claim_status_id = (
                SELECT id
                FROM billing.claim_status
                WHERE code=${claimStatusCode}
                LIMIT 1
            ),
            submitted_dt = (SELECT * FROM submissionDate)
        WHERE
            id = ANY(ARRAY[${claimIds}::int[]])
    `;

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
        batches,    // an array of objects: {claimIds:[Number], batchSequenceNumber:Number}
    } = args;

    batches.forEach(async (batch) => {
        const {
            batchSequenceNumber,
            claimIds,
        } = batch;

        const sql = SQL`
            INSERT INTO billing.edi_file_claims (
                edi_file_id,
                claim_id,
                batch_number
            )
            SELECT
                ${edi_file_id},
                UNNEST(${claimIds}::int[]),
                ${sprintf(`%'04s`, batchSequenceNumber)}
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

    const {
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
                AND created_dt::date = ${moment(mailFileDate, 'YYYYMMDD').format('YYYY-MM-DD')}::date
                AND uploaded_file_name = ${providerFileName}
        ), reject_file AS (

            -- status of 'success' just means file was obtained

            UPDATE
                billing.edi_files
            SET
                status = 'success',
                processed_dt = ${moment(processDate, 'YYYYMMDD').format('YYYY-MM-DD')}
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

    await query(sql.text, sql.values);
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

    const batchCreateDate = moment(parsedResponseFile[0].batchCreateDate, 'YYYYMMDD').format('YYYY-MM-DD');

    const sql = SQL`
        WITH related_submission_files AS (
            SELECT
                ef.id AS submission_file_id,
                efc.claim_id AS claim_id
            FROM billing.edi_files ef
            INNER JOIN billing.edi_file_claims efc ON ef.id = efc.edi_file_id
            WHERE
                ef.file_type = 'can_ohip_h'
                AND ef.status = 'success'
                AND ef.created_dt::date = ${batchCreateDate}
                AND efc.batch_number = ${parsedResponseFile[0].batchSequenceNumber}
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
        )
        SELECT *
        FROM insert_related_file_cte
        INNER JOIN billing.edi_file_claims efc ON efc.edi_file_id = insert_related_file_cte.submission_file_id
    `;

    const dbResults = (await query(sql.text, sql.values)).rows;

    if (dbResults && dbResults.length) {
        await updateClaimStatus({
            claimStatusCode: CLAIM_STATUS_PENDING_PAYMENT_DEFAULT,  // Pending Payment
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


    const deniedStatus = CLAIM_STATUS_DENIED_DEFAULT;
    const processDate = new Date();

    const claimIds = parsedResponseFile.reduce((prfResults, prf) => {
        return prf.claims.reduce((claimResults, claim) => {
            claimResults.push(claim.accountingNumber);
            return claimResults;
        }, prfResults);
    }, []);

    const billingNotesByClaimId = parsedResponseFile.reduce((prfResults, prf) => {
        return prf.claims.reduce((claimResults, claim) => {
            claimResults[claim.accountingNumber] = claim.items.reduce((billingNotes, item) => {
                if (item.explanatoryCode) {
                    billingNotes.push(`${item.explanatoryCode} - ${explanatoryDescriptionsByCode[item.explanatoryCode]}`);
                }
                return billingNotes.concat(toBillingNotes(item));
            }, toBillingNotes(claim)).join('\n');
            return claimResults;
        }, prfResults);
    }, {});

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
                status = 'success',
                processed_dt = ${moment(processDate, 'YYYYMMDD').format('YYYY-MM-DD')}
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
                ( SELECT id FROM error_file ),
                null
            RETURNING
                *
        )
        SELECT
            original_file.id as submission_file_id
            , original_file.uploaded_file_name as submission_file_name
            , error_file.id as error_file_id
            , error_file.uploaded_file_name as error_file_name
            FROM original_file, error_file
    `;


    const dbResults = (await query(sql.text, sql.values));

    if (dbResults.rows && dbResults.rows.length) {
        console.log('updating claim status for IDs: ', claimIds);
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

    getClaimsData: async (args) => {

        const {
            claimIds,
        } = args;
        let file_path = path.join(__dirname, '../../resx/speciality_codes.json');
        let speciality_codes = fs.readFileSync(file_path, 'utf8');
        const sql = SQL`
            WITH speciality_codes AS (
                SELECT * FROM json_each_text(${JSON.parse(speciality_codes)})
            )
            SELECT
                bc.id AS claim_id,
                bc.billing_method,
                bc.id AS "accountingNumber",
                bc.can_ohip_manual_review_indicator AS "manualReviewIndicator",
                claim_notes AS "claimNotes",
                npi_no AS "groupNumber",    -- this sucks
                rend_pr.provider_info -> 'NPI' AS "providerNumber",
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
                33 AS "specialtyCode",  -- NOTE this is only meant to be a temporary workaround
                (
                    SELECT row_to_json(insurance_details) FROM (
                    SELECT
                        ppi.policy_number AS "healthNumber",
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
                            1 AS "numberOfServices",
                            charge_dt AS "serviceDate",
                            billing.get_charge_icds (bch.id) AS diagnosticCodes
                        FROM billing.charges bch
                        INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
                        WHERE bch.claim_id = bc.id AND NOT bch.is_excluded
                    ) charge_items
                ) items,
                pp.full_name AS "patientName",
                pp.patient_info -> 'c1State' AS "provinceCode",               -- TODO this should be coming from the patient_insurances table
                pp.patient_info->'c1AddressLine1' AS "patientAddress",
                bp.address_line1 AS "billing_pro_addressLine1",
                bp.city AS billing_pro_city,
                bp.name AS "billing_pro_firstName",
                bp.state AS "billing_pro_state",
                bp.zip_code AS "billing_pro_zip",
                CASE WHEN (SELECT charges_bill_fee_total FROM billing.get_claim_totals(bc.id)) > 0::money
                    THEN (SELECT charges_bill_fee_total FROM billing.get_claim_totals(bc.id)) ELSE null END AS "claim_totalCharge",
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
                pg.group_info->'AddressLine1' AS "service_facility_addressLine1",
                pg.group_info->'City' AS "service_facility_city",
                pg.group_name AS "service_facility_firstName",
                pg.group_info->'State' AS "service_facility_state",
                pg.group_info->'Zip' AS "service_facility_zip",
                'HOP' AS "serviceLocationIndicator",
                reff_pr.provider_info -> 'NPI' AS "referringProviderNumber",
                'P' AS "payee",
                'HOP' AS "masterNumber",  
                get_full_name(pp.last_name,pp.first_name) AS "patientName",   
                'IHF' AS "serviceLocationIndicator"
            FROM billing.claims bc
            LEFT JOIN public.provider_groups pg ON pg.id = bc.ordering_facility_id
            INNER JOIN public.companies pc ON pc.id = bc.company_id
            INNER JOIN public.patients pp ON pp.id = bc.patient_id
            INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
            LEFT JOIN public.provider_contacts rend_ppc ON rend_ppc.id = bc.rendering_provider_contact_id
            LEFT JOIN public.providers rend_pr ON rend_pr.id = rend_ppc.provider_id
            LEFT JOIN public.provider_contacts reff_ppc ON reff_ppc.id = bc.referring_provider_contact_id
            LEFT JOIN public.providers reff_pr ON reff_pr.id = reff_ppc.provider_id
            WHERE bc.id = ANY (${claimIds})
            ORDER BY bc.id DESC`;

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
            payment_id
        } = params;

        whereQuery.push(` ef.file_type != 'EOB' `);

        if (id) {
            whereQuery.push(` ef.id = ${id} `);
        }

        if (uploaded_file_name) {
            whereQuery.push(` ef.uploaded_file_name ILIKE '%${uploaded_file_name}%' `);
        }

        if (size) {
            whereQuery.push(` ef.file_size = ${size}`);
        }

        if (updated_date_time) {
            whereQuery.push(` ef.created_dt::date = '${updated_date_time}'::date`);
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
    }

};

module.exports = OHIPDataAPI;
