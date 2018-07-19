importScripts('/exa_modules/billing/static/node_modules/underscore/underscore.js');
importScripts('/exa_modules/billing/static/node_modules/moment/min/moment-with-locales.js');
importScripts('/exa_modules/billing/static/node_modules/moment-timezone/builds/moment-timezone-with-data.js');

var reportTitle = 'Claims';

var columnMap = {
    "Claim Date": "claim_dt",
    "Patient Name": "patient_name",
    "Clearing House": "clearing_house",
    "Billing Method": "billing_method",
    "Billing Provider": "billing_provider",
    "Billing Fee": "billing_fee",
    "Account No": "account_no",
    "Policy Number": "policy_number",
    "Claim Status": "claim_status",
    "Date Of Birth": "birth_date",
    "Invoice": "invoice_no",
    "Follow-up Date": "followup_date",
    "Place OF Service": "place_of_service",
    "Balance": "claim_balance",
    "Referring Providers": "referring_providers",
    "Rendering Providers": "rendering_provider",
    "SSN": "patient_ssn",
    "Group Number": "group_number",
    "Payer Type": "payer_type",
    "Billing Class": "billing_class",
    "Billing Code": "billing_code"
}

onmessage = function (req) {
    console.log('Request received from client');

    new Promise(function (resolve, reject) {
        generateCsvData(req.data, function (err, result) {
            if (result) {
                return resolve(result);
            }

            reject(err);
        });
    }).then(function (data) {
        var fileName = reportTitle.replace(/ /g, "_");
        var csvData = data;
        postMessage({ fileName, csvData });
    });
};

function generateCsvData(dbResponse, callback) {
    if (!dbResponse) {
        throw new Error('Invalid data');
    }

    if (!callback) {
        throw new Error('generateCsvData is an async method and needs a callback');
    }

    var showLabel = true;
    var dbData = typeof dbResponse.data != 'object' ? JSON.parse(dbResponse.data) : dbResponse.data;

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

        return columns.map(function (colName, colIndex) {
            var csvText = showLabel && rowIndex == 0 ? colName : dbRow[columnMap[colName]];

            if (rowIndex && colName === 'Claim Date') {
                csvText = csvText ? moment(csvText).format('L') : '';
            }

            return csvText ? csvText.replace(/"/g, '""') : '';
        }).join(tmpColDelim);

    }).join(tmpRowDelim)
        .split(tmpRowDelim).join(rowDelim)
        .split(tmpColDelim).join(colDelim) + '"';

    callback(null, csvSimplified);
}

