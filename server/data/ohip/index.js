const { query, SQL } = require('./../index');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
    encoding,
    resourceTypes,
    resourceDescriptions,
} = require('./../../../modules/ohip/constants');

const ohipUtil = require('./../../../modules/ohip/utils');


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

            --,${ohipUtil.getFileType(filename)}
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
        file_id: dbResults.id,
    };
};


//
// const loadFile = async (args) => {
//     const {
//         edi_file_id,
//
//     } = args;
//     const file = await getFileInfo({edi_file_id});
//
//     return {
//         filename:
//
//     }
// }

// const handleBatchEdit = (msg) => {
//
//     console.log(msg);
//
// };

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

    getClaimData: (claimIds) => {
        // TODO, run a query to get the claim data
        // use synchronous call to query ('await query(...)')
        return [];
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

    //
    // handleDownload: async (args, callback) => {
    //     const {
    //         filename,
    //     } = args;
    //     const {
    //         id,
    //     } =  await storeFile(args);
    //
    //     const handlersByResourceType = {
    //         [resourceTypes.BATCH_EDIT]: handleBatchEdit
    //     };
    //
    //     const rType = ohipUtil.getResourceType(filename);
    //     const handler = handlersByResourceType[rType];
    //
    //
    //     handler();
    //
    //
    //     return id;
    // },
    //

    getFileStore,

    storeFile,
};

module.exports = OHIPDataAPI;
