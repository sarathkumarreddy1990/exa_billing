const { query, SQL } = require('./../index');
// const ediData = require('../../data/claim/claim-edi');
// const JSONExtractor = require('./jsonExtractor');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
    encoding,
    resourceTypes,
    resourceDescriptions,
} = require('./../../../modules/ohip/constants');

const ohipUtil = require('./../../../modules/ohip/utils');

// corresponds to the file_type field of edi_files
const exaFileTypes = {
    [resourceTypes.CLAIMS]: 'can_ohip_h',
    [resourceTypes.BATCH_EDIT]: 'can_ohip_b',
    [resourceTypes.ERROR_REPORT]: 'can_ohip_e',
    [resourceTypes.ERROR_REPORT_EXTRACT]: 'can_ohip_f',
    [resourceTypes.CLAIMS_MAIL_FILE_REJECT_MESSAGE]: 'can_ohip_x',
    [resourceTypes.REMITTANCE_ADVICE]: 'can_ohip_p', // would it be easier to remember this as "PAYMENT?"
    [resourceTypes.OBEC]: 'can_ohip_o',
    [resourceTypes.OBEC_RESPONSE]: 'can_ohip_r',
};



/**
 * const getExaFileType - determines a value for the file_type field of a
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
const getExaFileType = (args) => {
    let resourceType = args.resourceType

    if (args.filename && !resourceType) {
        resourceType = ohipUtil.getResourceType(args.filename);
    }

    return exaFileTypes[resourceType];
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
        filename
    } = args;
    const description = ohipUtil.getResourceDescription(filename);

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
const storeFile =  async (args) => {

    const {
        filename,
        data,
    } = args;

    // 20120331 - OHIP Conformance Testing Batch Edit sample batch date, seq: 0005
    // accounting number: "CST-PRIM" from Conformance Testing Error Report sample

    const filestore =  await getFileStore(args);
    const filePath = filestore.is_default ? 'OHIP' : '';
    const absolutePath = path.join(filestore.root_directory, filePath, filename);
    fs.writeFileSync(absolutePath, data, {encoding});

    const stats = fs.statSync(absolutePath);
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
            uploaded_file_name
        )
        VALUES(
            1
            ,${filestore.id}
            ,now()
            ,'pending'

            --,${getExaFileType(filename)}
            ,'835'  -- not good; should be the commented-out line above

            ,'${filePath}'
            ,${stats.size}
            ,'${md5Hash}'
            ,'${filename}'
        )
        RETURNING id
    `;

    const  dbResults = (await query(sql, [])).rows[0];

    return {
        file_store_id: filestore.id,
        edi_file_id: dbResults.id,
        absolutePath,
    };
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
            ef.uploaded_file_name as uploaded_file_name
        FROM
            billing.edi_files ef INNER JOIN file_stores fs ON ef.file_store_id = fs.id
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

    return {
        data: fs.readFileSync(absolutePath, {encoding}),
        file_store_id,
        root_directory,
        file_path,
        uploaded_file_name
    }
};


const updateFileStatus = async (args) => {
    const {
        edi_file_id,
        status,
    } = args;

    const sql = SQL`
        UPDATE billing.edi_files
        SET
            status=${status}
        WHERE
            id = ${edi_file_id}
    `;

    await query(sql.text, sql.values);
};

const updateClaimStatus = async (args) => {
    const {
        claimIds,
        accountingNumber,
        claimStatusCode,
    } = args;

    const sql = SQL`
        UPDATE billing.claims
        SET
            claim_status_id = (
                SELECT id
                FROM billing.claim_status
                WHERE code=${claimStatusCode}
                LIMIT 1
            )
        WHERE
            id = ANY(ARRAY[${claimIds}::int[]])
    `;
    // console.log(sql.text, sql.values);

    return (await query(sql.text, sql.values));
};

/**
 * const applyClaimSubmission - description
 *
 * @param  {type} args description
 * @returns {type}      description
 */
const applyClaimSubmission =  async (args) => {

    const {
        edi_file_id,
        batches,    // an array of objects: {claimIds:[Number], batchSequenceNumber:Number}
    } = args;
    // console.log('args: ', args);
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
                ${batchSequenceNumber}
            RETURNING id
        `;

        return (await query(sql.text, sql.values)).rows;
    });

    // TODO
    // 1 - insert record into edi_file_claims table
    //      a. need to know claim ID
    //      b. need to know file ID
    //      c. need to know batch number
    // 2 - update claim status to pending acknowledgement
    //      a.


};

const applyRejectMessage = async (args) => {
    const {
        filename,
    } = args;

    // TODO
    // 1 - set error codes on edi_file_claims (what do "pending ack" claims transition to, now?)
    // 2 - add entry to


    console.log(args);
};



/**
 * const applyBatchEditReport - description
 *
 * @param  {type} args description
 * @returns {type}      description
 */
const applyBatchEditReport = async (args) => {

    // NOTE
    // need to already have EDI CLaim Files entry with correct batch sequence number for OHIP CT Batch Edit
    const {
        batchCreateDate,
        batchSequenceNumber,
        responseFileId,
        comment,
    } = args;

    const sql = SQL `
        WITH claim_file_cte AS (
            SELECT
                ef.id AS edi_file_id
            FROM billing.edi_files ef
            INNER JOIN billing.edi_file_claims efc ON ef.id = efc.edi_file_id
            WHERE
                ef.file_type = 'can_ohip_h'
                --AND ef.status = 'pending'
                AND ef.created_dt = ${batchCreateDate}
                AND efc.batch_number = ${batchSequenceNumber}
        )
        INSERT INTO billing.edi_related_files(
            submission_file_id,
            response_file_id,
            comment
        )
        (
            SELECT
                claim_file_cte.edi_file_id,
                ${responseFileId},
                ${comment}
            FROM
                claim_file_cte
        )
    `;

    // 1 - SELECT corresponding claim submission file
    //      a. edi_files.file_type = 'can_ohip_h'
    //      b. edi_files.created_dt = batchCreateDate
    //      c. edi_files.status = 'pending'
    //      d. edi_file_claims.batch_number = batchSequenceNumber
    //      e. edi_file_claims.edi_file_id = edi_files.id
    //      f. preserve edi_files.id

    // 2 - INSERT record into edi_related_files
    //      a. edi_related_files.ubmission_file_id = #1f
    //      b. what could be used for edi_related_files.comment?

    // 3 - UPDATE claim statuses (transition from "pending ack" to "pending payment")
    //      a. edi_file_claims.edi_file_id = edi_files.id
    //      b. fine claims from edi_file_claims and set status?
    //      c. what should be status for claims in rejected batch?
    //
    // 4 - UPDATE claim file status
    //      a. edi_file_claims.edi_file_id = edi_files.id
    //      b. set status to 'accepted' or 'rejected'
    //      c. set error messages/codes
    //
    return {};

};

const applyErrorReport = async (args) => {
    const {
        accountingNumber,
    } = args;

    // TODO
    // 1 - set error codes on edi_file_claims
    //
    console.log(args);
};


const setClaimSubmissionFile = (args) => {
    const {
        claimIds,
        edi_file_id,
    } = args;

    const sql = SQL`
        UPDATE billing.
    `;
};

const OHIPDataAPI = {

    auditTransaction: (info) => {
        console.log(`audit log: ${info}`);
        /* Sample input info object:
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
    },

    getClaimsData: async (args) => {

        const {
            claimIds,
        } = args;

        const sql = SQL`
            SELECT
                bc.id AS claim_id,
                npi_no AS "groupNumber",    -- this sucks
                rend_pr.provider_info -> 'NPI' AS "providerNumber",

                rend_pr.specialities AS "specialtyCode",
                (SELECT JSON_agg(Row_to_json(claim_details)) FROM (
                WITH cte_insurance_details AS (
                SELECT
                (Row_to_json(insuranceDetails)) AS "insuranceDetails"
                FROM (SELECT
                ppi.policy_number AS "healthNumber",
                ppi.group_number AS "versionCode",
                pp.birth_date AS "dateOfBirth",
                bc.id AS "accountingNumber",
                CASE WHEN nullif (pc.company_info -> 'company_state','') = subscriber_state THEN
                'HCP'
                ELSE
                'RMB'
                END AS "paymentProgram",
                'P' AS "payee",
                'HOP' AS "masterNumber",
                reff_pr.provider_info -> 'NPI' AS "referringProviderNumber",
                'HOP' AS "serviceLocationIndicator",
                ppi.policy_number AS "registrationNumber",
                pp.last_name AS "patientLastName",
                pp.first_name AS "patientFirstName",
                pp.gender AS "patientSex",
                pp.patient_info -> 'c1Statepp' AS "provinceCode"
                FROM public.patient_insurances ppi
                WHERE ppi.id = bc.primary_patient_insurance_id) AS insuranceDetails)
                , charge_details AS (
                SELECT JSON_agg(Row_to_json(items)) "items" FROM (
                SELECT
                pcc.display_code AS "serviceCode",
                (bch.bill_fee * bch.units) AS "feeSubmitted",
                1 AS "numberOfServices",
                charge_dt AS "serviceDate",
                billing.get_charge_icds (bch.id) AS diagnosticCodes
                FROM billing.charges bch
                INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
                WHERE bch.claim_id = bc.id) AS items )
                SELECT * FROM cte_insurance_details, charge_details) AS claim_details ) AS "claims"
                FROM billing.claims bc
                INNER JOIN public.companies pc ON pc.id = bc.company_id
                INNER JOIN public.patients pp ON pp.id = bc.patient_id
                INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
                LEFT JOIN public.provider_contacts rend_ppc ON rend_ppc.id = bc.rendering_provider_contact_id
                LEFT JOIN public.providers rend_pr ON rend_pr.id = rend_ppc.provider_id
                LEFT JOIN public.provider_contacts reff_ppc ON reff_ppc.id = bc.referring_provider_contact_id
                LEFT JOIN public.providers reff_pr ON reff_pr.id = reff_ppc.provider_id
                WHERE bc.id = ANY (${claimIds})
                ORDER BY bc.id DESC
            `;

        return (await query(sql.text, sql.values)).rows;
    },

    handlePayment: (payment) => {
        /* Sample input payment object:
        {
            paymentDate: Date,
            totalAmountPayable: Number,
            chequeNumber: String,
        }

        Sample return value:
        {
            paymentId: Number
        }
        */
    },

    handleBalanceForward: (balanceForward) => {
        /* Sample input balanceForward object
        {
            claimsAdjustment: Number,
            advances: Number,
            reductions: Number,
            deductions: Number,
        }
        */
    },



    handleAccountingTransaction: (accountingTransaction) => {
        /* Sample input accountingTransaction object
        {
            transactionCode: String,
            chequeNumber: String,
            transactionDate: Date
            transactionAmount: Number,
            transactionMessage: String
        }

        */
    },

    handleMessage: (message) => {
        // message is just a String
    },


    getFileStore,

    storeFile,
    loadFile,

    updateFileStatus,
    updateClaimStatus,

    applyClaimSubmission,
    applyRejectMessage,
    applyBatchEditReport,
    applyErrorReport,

    getFileManagementData: async (args) => {

        // const sql = SQL`
        //
        // `;
        //
        // return (await query(sql.text, sql.values)).rows;

        return JSON.stringify([
            {
                id: 1,
                fileName: "001.720",            // edi_files.uploaded_file_name
                fileType: "Type",               // getExaFileType(edi_files.file_type)
                submittedDate: "28/01/2019",    //
                isAcknowledgementReceived: true,
                isPaymentReceived: true
            },
            {
                id: 2,
                fileName: "002.424",
                fileType: "Claim",
                submittedDate: "02/02/2019",
                isAcknowledgementReceived: true,
                isPaymentReceived: true
            },
            {
                id: 3,
                fileName: "003.509",
                fileType: "Ack",
                submittedDate: "11/02/2019",
                isAcknowledgementReceived: true,
                isPaymentReceived: false
            }
        ]);
    },

    getExaFileType,

    getOHIPConfiguration: async (args) => {
        return {
            // TODO: EXA-12674
            softwareConformanceKey: 'b5dc648e-581a-4886-ac39-c18832d12e06',
            auditID:124355467675,
            serviceUserMUID: 614200,
            username: "confsu+355@gmail.com",
            password: "Password1!",
        };
    },

};

module.exports = OHIPDataAPI;
