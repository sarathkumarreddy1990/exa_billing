importScripts('/exa_modules/billing/static/node_modules/underscore/underscore.js');
importScripts('/exa_modules/billing/static/node_modules/moment/min/moment-with-locales.js');
importScripts('/exa_modules/billing/static/node_modules/moment-timezone/builds/moment-timezone-with-data.js');

const claimColumns = {

    "Claim No": "claim_id",
    "Claim Date": "created_dt",
    "AHS Claim Num": "can_ahs_claim_no",
    "Study Date": "claim_dt",
    "Patient Name": "patient_name",
    "Clearing House": "clearing_house",
    "Billing Method": "billing_method",
    "Billing Provider": "billing_provider",
    "Billing Fee": "billing_fee",
    "Account No": "account_no",
    "Alt Account No": "pid_alt_account",
    "Policy Number": "policy_number",
    "Claim Status": "claim_status",
    "Date Of Birth": "birth_date",
    "Invoice": "invoice_no",
    "Follow-up Date": "followup_date",
    "Place Of Service": "place_of_service",
    "Balance": "claim_balance",
    "Referring Providers": "referring_providers",
    "Rendering Providers": "rendering_provider",
    "SSN": "patient_ssn",
    "Group Number": "group_number",
    "Payer Type": "payer_type",
    "Billing Class": "billing_class",
    "Billing Code": "billing_code",
    "Notes": "billing_notes",
    "Responsible Party": "payer_name",
    "Submitted Date": "submitted_dt",
    "Date of Injury": "current_illness_date",
    "Charge Description": "charge_description",
    "Ins Provider Type": "ins_provider_type",
    "Insurance Providers": "insurance_providers",
    "ICD Description": "icd_description",
    "Ordering Facility": "ordering_facility_name",
    "Facility": "facility_name",
    "First Statement Date": "first_statement_dt",
    "AHS Claim Action": "claim_action",
    "Reason Code": "reason_code",
    "PHN": "phn_alt_account",
    "Sequence Numbers": "can_bc_claim_sequence_numbers",
    "Alt Account No": "pid_alt_account",
    "Modality": "modalities",
    "Billing type": 'billing_type'
};

const paymentsColumns = {
    "PAYMENT ID": "id",
    "REFERENCE PAYMENT ID": "alternate_payment_id",
    "PAYMENT DATE": "payment_dt",
    "ACCOUNTING DATE": "accounting_date",
    "PAYER TYPE": "payer_type",
    "PAYER NAME": "payer_name",
    "PATIENT MRN": "account_no",
    "PAYMENT AMOUNT": "amount",
    "PAYMENT APPLIED": "applied",
    "BALANCE": "available_balance",
    "ADJUSTMENTS": "adjustment_amount",
    "NOTES": "notes",
    "POSTED BY": "user_full_name",
    "PAYMENT MODE": "payment_mode",
    "FACILITY": "facility_name",
};

const dateColumnsWithTimeZoneConversion = [
    'Claim Date',
    'PAYMENT DATE',
    'Submitted Date',
    'Study Date'
];

const dateColumnsWithOutTimeZone = [
    'ACCOUNTING DATE',
    'Date Of Birth',
    'Follow-up Date',
    'Date of Injury',
    'First Statement Date'
];
const dateColumnsWithTimeZone = [
    'LOGGED DATE'
];

const auditColumns = {
    "LOGGED DATE": "created_dt",
    "SCREEN": "screen_name",
    "USER": "username",
    "LOG DESCRIPTION": "description"
};

const censusColumn = {
    'ORDERING FACILITY LOCATION':'location',
    'MRN':'account_no',
    'ACCESSION NUMBER' : 'accession_no',
    'PATIENT NAME':'full_name',
    'DATE OF SERVICE':'study_dt',
    'STUDY DESCRIPTION':'study_description'
};

onmessage = function (req) {
    console.log('Request received from client');

    moment.locale(req.data.browserLocale);

    new Promise(function (resolve, reject) {
        generateCsvData(req.data, function (err, result) {
            if (result) {
                return resolve(result);
            }

            reject(err);
        });
    }).then(function (data) {
        var csvData = data;
        postMessage({ csvData });
    });
};

function generateCsvData(dbResponse, callback) {
    if (!dbResponse) {
        throw new Error('Invalid data');
    }

    if (!callback) {
        throw new Error('generateCsvData is an async method and needs a callback');
    }

    var columnMap = '';

    var showLabel = true;
    var dbData = typeof dbResponse.data != 'object' ? JSON.parse(dbResponse.data) : dbResponse.data;
    var countryCode = dbResponse.countryCode || '';
    var columnHeader = dbResponse.columnHeader;
    var facilities = dbResponse.facilities;
    var companyTz = dbResponse.companyTz;

    _.each(columnHeader, function (data, index) {
        if (data == "Claim Created Dt") {
            columnHeader[index] = "Study Date";
        }
    });

    if (countryCode == 'can') {
        claimColumns["Payment ID"] = "payment_id";
        paymentsColumns["CHEQUE/CARD NUMBER"] = "card_number";
    } else {
        paymentsColumns["CHECK/CARD NUMBER"] = "card_number";
    }

    switch (dbResponse.reportName) {
        case 'CLAIMS':
            if (dbResponse.filter_order) {
                var finalList = {};
                columnHeader.reduce((result, col) => claimColumns[col] ? finalList[col] = claimColumns[col] : finalList, {})
                columnMap = finalList;
            } else {
                columnMap = claimColumns;
            }

            break;

        case 'PAYMENTS':
            columnMap = paymentsColumns;
            break
        case 'AUDITLOG':
            columnMap = auditColumns;
            break;
        case 'CENSUS':
            columnMap = censusColumn;
            break;
    }

    var tmpColDelim = String.fromCharCode(11); // vertical tab character
    var tmpRowDelim = String.fromCharCode(0); // null character

    // actual delimiter characters for CSV format
    var colDelim = '","';
    var rowDelim = '"\r\n"';

    var columns = Object.keys(columnMap);

    var headerRow = {};
    for (var key in dbData[0]) {
        headerRow[key] = key;
    }

    if (showLabel) {
        dbData.unshift(headerRow);
    }

    var csvSimplified = '"' + dbData.map(function (dbRow, rowIndex) {
        var facilityTimeZone = [];
        if (rowIndex) {
            facilityTimeZone = _.filter(facilities, { id: parseInt(dbRow.facility_id) });
        }
        return columns.map(function (colName, colIndex) {
            var csvText = showLabel && rowIndex == 0 ? colName : dbRow[columnMap[colName]];

            if (rowIndex && dateColumnsWithTimeZoneConversion.indexOf(colName) > -1 && csvText) {
                csvText = facilityTimeZone.length ? moment(csvText).tz(facilityTimeZone[0].value).format('L') : moment(csvText).tz(companyTz).format('L');
            }
            csvText = csvText || '';

            if (rowIndex && dateColumnsWithOutTimeZone.indexOf(colName) > -1) {
                csvText = csvText ? moment(csvText).format('L') : '';
            }

            if (rowIndex && dateColumnsWithTimeZone.indexOf(colName) > -1 && csvText) {
                csvText = facilityTimeZone.length ? moment(csvText).tz(facilityTimeZone[0].value).format('L LT z') : moment(csvText).tz(companyTz).format('L LT z');
            }
            if (csvText && _.isArray(csvText)) {
                csvText = csvText.join(', ');
            }

            return csvText ? csvText.replace(/"/g, '""') : '';
        }).join(tmpColDelim);

    }).join(tmpRowDelim)
        .split(tmpRowDelim).join(rowDelim)
        .split(tmpColDelim).join(colDelim) + '"';

    callback(null, csvSimplified);
}

