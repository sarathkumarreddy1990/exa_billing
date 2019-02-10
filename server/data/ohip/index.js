const { query, SQL } = require('./../index');
const fs = require('fs');
const path = require('path');

const {
    encoding,
    resourceTypes,
    resourceDescriptions,
} = require('./../../../modules/ohip/constants');

const ohipUtil = require('./../../../modules/ohip/utils');

const getFileStore = async (args) => {

    const {
        filename
    } = args;

    let sql = SQL`
        SELECT
            id,
            file_store_name,
            root_directory,
            is_default
        FROM public.file_stores
        WHERE company_id = 1
            AND NOT has_deleted
            AND is_default
    `;

    const description = ohipUtil.getResourceDescription(filename);
    console.log(`getFileStore(${description})`);

    // if (description) {
    //     sql = sql.append(SQL`
    //         AND resource_name = ${description}
    //     `);
    // }

    let root_directory = '.';
    let id = 0;
    const dbResults = (await query(sql.query)).rows;

    if (dbResults.length) {

        root_directory = dbResults[0].root_directory;
        id = dbResults[0].id;

        if (dbResults[0].is_default) {
            // NOTE this could be considered "sneaky" and might be undesirable
            root_directory = path.join(root_directory, 'OHIP');
        }
    }
    return {
        root_directory,
        id,
    };
};



/**
 * const storeFile - description
 *
 * @param  {object}  args {
 *                          filename: String,
 *                          data: String
 *                        }
 * @returns {object}      {
 *                          file_store_id,
 *                          edi_file_claims
 *                        }
 */
const storeFile =  async (args) => {
    const {
        filename,
        data,
    } = args;

    const filestore =  await getFileStore(args);
    const fullPath = path.join(filestore.root_directory, filename);
    fs.writeFileSync(fullPath, data, {encoding});

    return {
        id: filestore.id
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

const OHIPDataAPI = {

    auditTransaction: (info) => {
        console.log(info);
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


    handleInputClaimSubmissionFile: (fileDescriptor) => {

    },

    handleRemittanceAdviceFile: (fileDescriptor) => {

    },
    handleGovernanceReportFile: (fileDescriptor) => {

    },
    handleClaimFileRejectMessageFile: (fileDescriptor) => {

    },
    handleBatchEditReportFile: async (args, callback) => {
        /*
        {
            filename: 'BAAU73.287',
            content:
        }

        */
        const {
            filename,
        } = args;

        const {
            id,
        } =  await storeFile(args);


        return id;
    },

    handleClaimsErrorReportFile: (fileDescriptor) => {

    },

    storeFile,
};

module.exports = OHIPDataAPI;
