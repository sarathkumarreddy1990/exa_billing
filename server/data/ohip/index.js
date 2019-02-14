const { query, SQL } = require('./../index');
// const ediData = require('../../data/claim/claim-edi');
// const JSONExtractor = require('./jsonExtractor');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const _ = require('lodash')
const {
    encoding,
    resourceTypes,
    resourceDescriptions,
} = require('./../../../modules/ohip/constants');

const ohipUtil = require('./../../../modules/ohip/utils');
const era_parser = require('./ohip-era-parser');

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
 *                            file_id: Number,         // edi_files PK
 *                        }
 */
const storeFile =  async (args) => {

    const {
        filename,
        data,
    } = args;

    const filestore =  await getFileStore(args);
    const filePath = filestore.is_default ? 'OHIP' : '';
    const fullPath = path.join(filestore.root_directory, filePath, filename);
    fs.writeFileSync(fullPath, data, {encoding});

    const stats = fs.statSync(fullPath);
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
        fullPath,
    };
};

const getRelatedFile = async (claim_file_id, related_file_type) => {
    const t_sql = SQL`
    SELECT
        fs.id as file_store_id,
        fs.root_directory as root_directory,
        ef.file_path as file_path,
        ef.id as file_id,
        ef.uploaded_file_name as uploaded_file_name,
        fs.root_directory || '/' || file_path as full_path
    FROM
        billing.edi_files ef
        INNER JOIN file_stores fs ON ef.file_store_id = fs.id
        INNER JOIN billing.edi_related_files efr ON efr.response_file_id = ef.id AND ef.file_type = ${related_file_type}
    WHERE
        efr.submission_file_id = ${claim_file_id}
`;
    let result = await query(t_sql.text, t_sql.values)
    if (result && result.rows && result.rows.length) {
        let file_d = result.rows[0];
        const t_fullPath = path.join(file_d.full_path, file_d.uploaded_file_name);
        file_d.data = fs.readFileSync(t_fullPath, { encoding });
        return file_d;
    }

    return {
        data: null,
        err: `Could not find the file path of requested edi file - ${claim_file_id}`
    }

}



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
            ef.uploaded_file_name as uploaded_file_name,
            fs.root_directory || '/' || file_path as full_path
        FROM
            billing.edi_files ef INNER JOIN file_stores fs ON ef.file_store_id = fs.id
        WHERE
            ef.id = ${edi_files_id}
    `;
    let result = await query(sql.text, sql.values)
    if (result && result.rows && result.rows.length) {
        let file_d = result.rows[0];
        const t_fullPath = path.join(file_d.full_path, file_d.uploaded_file_name);
        file_d.data = fs.readFileSync(t_fullPath, { encoding });
        return file_d;
    }

    return {
        data: null,
        err: `Could not find the file path of requested edi file - ${claim_file_id}`
    }
}


const applyRejectMessage = async (args) => {
    const {
        filename,
    } = args;

    // TODO
    // 1 - set error codes on edi_file_claims (what do "pending ack" claims transition to, now?)
    // 2 - add entry to
};



/**
 * const applyBatchEditReport - description
 *
 * @param  {type} args description
 * @returns {type}      description
 */
const applyBatchEditReport = async (args) => {

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

    getClaimsData: async(args) => {
        // TODO, run a query to get the claim data
        // use synchronous call to query ('await query(...)')
        // const result = (await ediData.getClaimData({
        //     ...args
        // }));


        // let data = result.rows.map(function (obj) {
        //
        //     // claimDetails.push(
        //     //     {
        //     //         coverage_level: obj.coverage_level,
        //     //         claim_id: obj.claim_id,
        //     //         insuranceName: obj.insurance_name,
        //     //         note: 'Electronic claim to ' + obj.insurance_name + ' (' + obj.coverage_level + ' )'
        //     //     }
        //     // );
        //     //
        //     // if ((obj.subscriber_relationship).toUpperCase() != 'SELF') {
        //     //     obj.data[0].subscriber[0].patient[0].claim = obj.data[0].subscriber[0].claim;
        //     //     delete obj.data[0].subscriber[0].claim;
        //     // }
        //
        //     return obj.data[0];
        // });
        // return new JSONExtractor(data).getMappedData();
        // const dat = require('./data');
        // console.log(dat);
        // return new JSONExtractor(dat).getMappedData();
    },

    handlePayment: async (data, args) => {
       let processedClaims =  await era_parser.processOHIPEraFile(data, args)
       return processedClaims;
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
    applyBatchEditReport,
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
                    ef.id AS file_name,
                    ef.file_store_id,
                    ef.created_dt AS updated_date_time,
                    ef.status AS current_status,
                    ef.file_type,
                    ef.file_path,
                    ef.file_size AS size,
                    ef.file_md5,
                    ef.uploaded_file_name,
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
            .append('ef.created_dt')
            /* After implement jqgrid in Filemanagement screen need this code*/
            // .append(' ')
            // .append(sortOrder)
            // .append(SQL` LIMIT ${pageSize}`)
            // .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);
       return await query(sql);

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
    getRelatedFile
};

module.exports = OHIPDataAPI;
