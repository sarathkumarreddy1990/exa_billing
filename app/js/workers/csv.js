importScripts('/exa_modules/billing/static/node_modules/underscore/underscore.js');
importScripts('/exa_modules/billing/static/node_modules/moment/min/moment-with-locales.js');
importScripts('/exa_modules/billing/static/node_modules/moment-timezone/builds/moment-timezone-with-data.js');

var reportTitle = 'Claims';

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
        var csvData = 'data:text/csv;charset=utf-8,' + escape(data);
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

    var CSV = '';
    var showLabel = 'Claim List';
    var dbData = typeof dbResponse.data != 'object' ? JSON.parse(dbResponse.data) : dbResponse.data;
    var colHeader = dbResponse.colHeader;
    var searchFilterFlag = dbResponse.searchFilterFlag;

    CSV += reportTitle + '\r';

    if (showLabel) {
        var row = "";

        _.each(colHeader, function (result, index) {
            row += result == "Claim Date" ? 'Claim Date' + ',' : '';
            row += result == "Patient Name" ? '"' + 'Patient Name' + '",' : '';
            row += result == "Clearing House" ? 'Clearing House' + ',' : '';
            row += result == "Billing Method" ? 'Billing Method' + ',' : '';
            row += result == "Billing Provider" ? 'Billing Provider' + ',' : '';
            row += result == "Billing Fee" ? 'Billing Fee' + ',' : '';
            row += result == "Account No" ? 'Account No' + ',' : '';
            row += result == "Policy Number" ? 'Policy Number' + ',' : '';
            row += result == "Claim Status" ? 'Claim Status' + ',' : '';
            row += result == "Date Of Birth" ? 'Date Of Birth' + ',' : '';
            row += result == "Invoice" ? 'Invoice' + ',' : '';
            row += result == "Follow-up Date" ? 'Follow-up Date' + ',' : '';
            row += result == "Place OF Service" ? 'Place OF Service' + ',' : '';
            row += result == "Balance" ? 'Balance' + ',' : '';
            row += result == "Referring Providers" ? 'Referring Providers' + ',' : '';
            row += result == "Rendering Providers" ? 'Rendering Providers' + ',' : '';
            row += result == "SSN" ? '"' + 'SSN' + '",' : '';
            row += result == "Group Number" ? 'Group Number' + ',' : '';
            row += result == "Payer Type" ? 'Payer Type' + ',' : '';
            row += result == "Billing Class" ? 'Billing Class' + ',' : '';
            row += result == "Billing Code" ? 'Billing Code' + ',' : '';

        });
    }

    row = row.slice(0, -1);
    CSV += row + '\r\n';

    for (var i = 0; i < dbData.length; i++) {
        var row = "";
        var paymentResult = searchFilterFlag ? dbData.models[i].attributes : dbData[i];
        var claimDate = moment(paymentResult.claim_dt).format('L');
        var patientName = paymentResult.patient_name || " ";
        var clearingHouse = paymentResult.clearing_house || " ";
        var billingClass = paymentResult.billing_class || " ";
        var billingCode = paymentResult.billing_code || " ";
        var balanceAmount = paymentResult.claim_balance || "$0.00";
        var policyNumber = paymentResult.policy_number || " ";
        var groupNumber = paymentResult.group_number || " ";
        var renderingProviders = paymentResult.rendering_provider || " ";
        var referingProviders = paymentResult.referring_providers || " ";
        var placeOfService = paymentResult.place_of_service || " ";
        var followUpDate = paymentResult.followup_date || " ";
        var invoiceNumber = paymentResult.invoice_no || " ";

        _.each(colHeader, function (result, index) {
            row += result == "Claim Date" ? claimDate + ',' : '',
                row += result == "Patient Name" ? '"' + patientName + '",' : '',
                row += result == "Clearing House" ? '"' + clearingHouse + '",' : '',
                row += result == "Billing Method" ? '"' + paymentResult.billing_method + '",' : '',
                row += result == "Billing Provider" ? '"' + paymentResult.billing_provider + '",' : '',
                row += result == "Billing Fee" ? '"' + paymentResult.billing_fee + '",' : '',
                row += result == "Account No" ? '"' + paymentResult.account_no + '",' : '',
                row += result == "Policy Number" ? '"' + policyNumber + '",' : '',
                row += result == "Claim Status" ? '"' + paymentResult.claim_status + '",' : '',
                row += result == "Date Of Birth" ? '"' + paymentResult.birth_date + '",' : '',
                row += result == "Invoice" ? '"' + invoiceNumber + '",' : '',
                row += result == "Follow-up Date" ? followUpDate + ',' : '',
                row += result == "Place OF Service" ? '"' + placeOfService + '",' : '',
                row += result == "Balance" ? '"' + balanceAmount + '",' : '',
                row += result == "Referring Providers" ? '"' + referingProviders + '",' : '',
                row += result == "Rendering Providers" ? '"' + renderingProviders + '",' : '',
                row += result == "SSN" ? '"' + paymentResult.patient_ssn + '",' : '',
                row += result == "Group Number" ? '"' + groupNumber + '",' : '',
                row += result == "Payer Type" ? '"' + paymentResult.payer_type + '",' : '',
                row += result == "Billing Class" ? '"' + billingClass + '",' : '',
                row += result == "Billing Code" ? '"' + billingCode + '",' : ''

        });

        CSV += row + '\r\n';
    }

    callback(null, CSV);
}

