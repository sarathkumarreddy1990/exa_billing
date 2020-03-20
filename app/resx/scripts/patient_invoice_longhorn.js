var invoiceData = [{
    "claim_details": [{
        "invoice_no": "Invoice1",
        "invoice_date": "YYYY-MM-DD",
        "referring_physician_name": "Test, Provider ref",
        "reason_for_exam": "TEST",
        "patient_adrress_details": {
            "patient_address1": "Test PAT Add1",
            "patient_address2": "Test PAT Add2",
            "patient_city": "Test PAT CITY",
            "patient_state": "TEST PAT STATE",
            "patient_zip": "11111",
            "patient_phone": "(522)222-5651"
        },
        "claim_balance": "$0.00",
        "claim_dt": "YYYY-MM-DDTHH:MM:SS-MS:00",
        "account_no": "TestAcc1",
        "payment_details": "",
        "facility_name": "Test Facility",
        "facility_adrress_details": {
            "facility_address1": "TEST FAC Add1",
            "facility_address2": "TEST FAC Add2",
            "facility_city": "TEST FAC CITY",
            "facility_state": "TEST FAC STATE",
            "facility_zip": "11111"
        },
        "company_tax_id": "5321489",
        "claim_no": "CLAIM01",
        "patient_name": "TEST, PAT1",
        "birth_date": "YYYY-MM-DD",
        "responsinble_party_address": {
            "name": "Test Responsible",
            "address": "Test Responsible Add1",
            "address2": "Test Responsible Add2",
            "city": "Test Responsible CITY",
            "state": "Test Responsible STATE",
            "zip_code": "11111",
            "phone_no": "(222)222-2222"
        },
        "billing_provider_details": {
            "name": "Test Billing Provider",
            "address": "Test Billing Add1",
            "address2": "Test Billing Add2",
            "city": "Test Billing CITY",
            "state": "Test Billing State",
            "zip_code": "11111",
            "phone_no": "(333)333-3333"
        }
    }],
    "charge_details": [{
        "claim_no": "CLAIM01",
        "display_code": "CPT01",
        "display_description": "Test CPT",
        "service_date": "YYYY-MM-DDTHH:MM:SS-MS:00",
        "get_charge_icds": null,
        "modifier1": null,
        "modifier2": null,
        "modifier3": null,
        "modifier4": null,
        "units": 1,
        "bill_fee": "$0.00"
    }],
    "payment_details": [{
        "payment_dt": "YYYY-MM-DDTHH:MM:SS.MS-00:00",
        "payer_type": "patient",
        "payer_name": "Test, Patient",
        "claim_id": "CLAIM01",
        "payment_id": "PAYMENT01",
        "payments_applied_total": "$0.00",
        "ajdustments_applied_total": "$0.00"
    }, {
        "payment_dt": "YYYY-MM-DDTHH:MM:SS.MS-00:00",
        "payer_type": "insurance",
        "payer_name": "Test Insurance",
        "claim_id": "CLAIM01",
        "payment_id": "PAYMENT02",
        "payments_applied_total": "$0.00",
        "ajdustments_applied_total": null
    }],
    "icd_details": [{
        "claim_no": "CLAIM01",
        "icd_id": "ICD01",
        "icd_code": "CODE01",
        "icd_description": "TEST ICD"
    }]
}]

var claimDetails = invoiceData[0].claim_details;
var chargeDetails = invoiceData[0].charge_details;
var paymentDetails = invoiceData[0].payment_details;
var icdDetails = invoiceData[0].icd_details;
let pageBrk = 'none', group;

function Dateformat(data) {
    data = data.substr(5, 2) + '/' + data.substr(8, 2) + '/' + data.substr(0, 4);
    return data;
}

function bindHead(claimNo, data, value) {
    var body = [];
    var dataRow = [];
    for (var key in data[value]) {
        if (key === 'facility_address1') {
            dataRow.push(
                (data[value][key] || " ") + (data[value]['facility_address2'] ? "\n" + data[value]['facility_address2'] : "")
            );
        } else if (key === 'facility_city') {
            dataRow.push(data[value][key] ? data[value][key] + '  ' + (data[value]['facility_state'] ? data[value]['facility_state'] : "") + '  ' + (data[value]['facility_zip'] ? +data[value]['facility_zip'] : "") : '');
        } else if (key === 'patient_address1') {
            dataRow.push(
                ': ' + (data[value][key] || ' ')
                + (data[value]['patient_address2'] ? " " + data[value]['patient_address2'] : "")
                + (data[value]['patient_city'] ? " " + data[value]['patient_city'] : "")
                + (data[value]['patient_state'] ? " " + data[value]['patient_state'] : "")
                + (data[value]['patient_zip'] ? " " + data[value]['patient_zip'] : "")
            );
        }
    }
    body.push(dataRow);
    return body;
}

function getBalanceAmount(claims) {
    let total = 0, balanceAmt = 0;
    claims.forEach(function (row) {
        balanceAmt = (row.claim_balance).toString().replace(/\$|,/g, "");
        if (balanceAmt.includes('(')) {
            balanceAmt = balanceAmt.toString().replace(/\(|,/g, "");
            balanceAmt = balanceAmt.toString().replace(/\)|,/g, "");
            total = (parseFloat(total)) - (parseFloat(balanceAmt));
            total = parseFloat(total).toFixed('2');
        } else {
            total = (parseFloat(total)) + (parseFloat(balanceAmt));
            total = parseFloat(total).toFixed('2');
        }
    });
    return total;
}

function getAppliedAmount(claims, paymentData, payer) {
    let total = 0;
    if (paymentData && paymentData.length) {
        paymentData.forEach(function (row) {
            if (row && _isContains(claims, row['claim_id'])) {
                if (payer != null && row.payer_type && row.payer_type === payer) {
                    total = (parseFloat(total)) + (parseFloat(getPaymentTotal(row)));
                    total = parseFloat(total).toFixed('2');
                } else if (payer === 'others' && row.payer_type !== 'patient') {
                    total = (parseFloat(total)) + (parseFloat(getPaymentTotal(row)));
                    total = parseFloat(total).toFixed('2');
                } else if (payer == null) {
                    total = (parseFloat(total)) + (parseFloat(getPaymentTotal(row)));
                    total = parseFloat(total).toFixed('2');
                }
            }
        });
    }
    return total;
}

function getPaymentTotal(paymentData) {
    let total = 0, payment = 0;
    if (paymentData) {
        payment = paymentData && paymentData.payments_applied_total || 0;
        payment = payment.toString().replace(/\$|,/g, "");
        total = (parseFloat(total)) + (parseFloat(payment));
        total = parseFloat(total).toFixed('2');
    }
    return total;
}

function bindCharge(claims, data, values) {
    var body = [];
    if (data && data.length) {
        data.forEach(function (row) {
            var dataRow = [];
            if (row && row['claim_no'] && _isContains(claims, row['claim_no'])) {
                if (values && values.length) {
                    values.forEach(function (column) {
                        if (column === 'service_date') {
                            dataRow.push(Dateformat(row[column]));
                        } else if (column === 'bill_fee') {
                            dataRow.push(row[column] ? ((row[column]).toString().replace(/\$|,/g, "")) : '');
                        } else {
                            dataRow.push(row[column] || '');
                        }
                    });
                    body.push(dataRow)
                }
            }
        });
    }
    if (!body.length) body.push("");
    return body;
}

function filter(claims, data, values) {
    var body = [];
    if (data && data.length) {
        data.forEach(function (row) {
            if (row && row['claim_no'] && _isContains(claims, row['claim_no'])) {
                body.push(row);
            }
        });
    }
    if (!body.length) body.push("");
    return body;
}

function bindIcd(claims, data, values) {
    var icd = [], dataRes = [];
    if (data && data.length) {
        dataRes = filter(claims, data, values);
        icd = Array.from(new Set(dataRes.map(s => s.icd_id))).map(icd_id => {
            return {
                icd_id: icd_id,
                icd_code: dataRes.find(s => s.icd_id === icd_id).icd_code,
                icd_description: dataRes.find(s => s.icd_id === icd_id).icd_description,
                claim_no: dataRes.find(s => s.icd_id === icd_id).claim_no,
            };
        });
    }
    if (!icd.length) icd.push("");
    return bindCharge(claims, icd, values);
}

function _isContains(data, value) {
    var hasMatch = false;
    data.forEach(function (row) {
        if (row['claim_no'] == value) { hasMatch = true; }
    });
    return hasMatch;
}

function getTotal(claims, data, fee) {
    var total = 0, amount = 0;
    if (data && data.length) {
        data.forEach(function (row) {
            var dataRow = [];
            if (row && (_isContains(claims, row.claim_id) || (_isContains(claims, row.claim_no)))) {
                amount = row && row[fee] || 0;
                amount = amount.toString().replace(/\$|,/g, "");
                amount = amount.toString().replace(/\(|,/g, "");
                amount = amount.toString().replace(/\)|,/g, "");
                total = (parseFloat(total)) + (parseFloat(amount));
                total = parseFloat(total).toFixed('2');
            }
        });
    }
    return total;
}

function getAdjustment(claims, data, fee) {
    var total = 0, amount = 0;
    if (data && data.length) {
        data.forEach(function (row) {
            var dataRow = [];
            if (row && fee && (_isContains(claims, row.claim_id) || (_isContains(claims, row.claim_no)))) {
                if (row.adjustment_type !== "refund_debit") {
                    amount = row && row[fee] || 0;
                    amount = amount.toString().replace(/\$|,/g, "");
                    amount = amount.toString().replace(/\(|,/g, "");
                    amount = amount.toString().replace(/\)|,/g, "");
                    total = (parseFloat(total)) + (parseFloat(amount));
                    total = parseFloat(total).toFixed('2');
                }
            }
        });
    }
    return total;
}

function getRefund(claims, paymentData) {
    let total = 0, refund = 0;
    if (paymentData && paymentData.length) {
        paymentData.forEach(function (row) {
            if (row.claim_id === claims && row.adjustment_type === "refund_debit") {
                refund = row && row.ajdustments_applied_total || 0;
                refund = refund.toString().replace(/\$|,/g, "");
                refund = refund.toString().replace(/\(|,/g, "");
                refund = refund.toString().replace(/\)|,/g, "");
                total = (parseFloat(total)) + (parseFloat(refund));
                total = parseFloat(total).toFixed('2');
                total = '-' + total;
            }
        });
    }
    return total
}

function bindInvoice(data, columns, pageBrk, group) {
    var body = [];
    if (data) {
        var dataRow = [];
        if (columns && columns.length) {
            columns.forEach(function (column) {
                if (column === 'Temp') {
                    body.push(
                        {
                            style: 'myTable',
                            alignment: "center",
                            table: {
                                widths: [500],
                                body: [
                                    [{ text: "Longhorn Imaging of Austin", bold: true }],
                                    [{ text: "South Austin Health Imaging " + data[0].facility_name }],
                                    bindHead(data.claim_no, data[0], 'facility_adrress_details'),
                                    [{ text: "Tax ID: " + data[0].company_tax_id }],
                                ]
                            }, layout: 'noBorders'
                        },
                        { text: "____________________________________________________________________________________________________" },
                        {
                            style: 'myTable',
                            margin: [10, 20, 0, 0],
                            table: {
                                widths: [100, 190, 80, 160],
                                body: [
                                    [
                                        { text: 'Patient', bold: true },
                                        { text: ': ' + data[0].patient_name, bold: true }, {}, {}
                                    ],
                                    [
                                        { text: 'Address ', bold: true },
                                        {
                                            style: 'myTable',
                                            table: {
                                                body: [
                                                    bindHead(
                                                        data.claim_no,
                                                        data[0], 'patient_adrress_details'),
                                                ]
                                            }, layout: 'noBorders'
                                        }, {}, {}
                                    ],
                                    [
                                        { text: 'Phone', bold: true },
                                        { text: ': ' + (data[0].patient_adrress_details['patient_phone']) }, {}, {}
                                    ]
                                ]
                            }, layout: 'noBorders'
                        },
                        { text: "_____________________________________________________________________________________________________" },
                        [{
                            style: 'myTable',
                            margin: [10, 5, 0, 0, 0],
                            bold: "true",
                            fontSize: 10,
                            table: {
                                widths: [70, 70, 60, 160, 200],
                                body: [
                                    [
                                        { text: "Encounter" },
                                        { text: "DATE" },
                                        { text: "CPT" },
                                        { text: "CPT Descr" },
                                        { text: "Total Bill" }
                                    ]
                                ]
                            }, layout: 'noBorders'
                        }],
                        [{
                            style: 'myTable',
                            margin: [10, 5, 0, 0, 0],
                            table: {
                                widths: [70, 70, 60, 160, 200],
                                body:
                                    bindCharge(
                                        data, chargeDetails, ['claim_no', 'service_date', 'display_code', 'display_description', 'bill_fee']),
                            }, layout: 'noBorders'
                        }],
                        { text: "_____________________________________________________________________________________________________" },
                        [{
                            style: 'myTable',
                            margin: [10, 5, 0, 0, 0],
                            bold: "true",
                            fontSize: 10,
                            table: {
                                widths: [50, 90, 500],
                                body: [
                                    [
                                        { text: "Encounter" },
                                        { text: "ICD Code" },
                                        { text: "ICD Description" },
                                    ],
                                ]
                            }, layout: 'noBorders'
                        }],
                        [{
                            style: 'myTable',
                            margin: [10, 5, 0, 0, 0],
                            table: {
                                widths: [50, 90, 500],
                                body:
                                    bindIcd(
                                        data, icdDetails, ['claim_no', 'icd_code', 'icd_description']),
                            }, layout: 'noBorders'
                        }],
                        { text: "____________________________________________________________________________________________________" },
                        {
                            style: 'myTable',
                            bold: true,
                            margin: [10, 20, 0, 0],
                            table: {
                                widths: [150, 140, 80, 200],
                                body: [
                                    [
                                        { text: "Bill Fee" },
                                        { text: ": " + getTotal(data, chargeDetails, 'bill_fee') },
                                        { text: 'Allowed:' },
                                        { text: ": " + getTotal(data, chargeDetails, 'allowed_fee') }
                                    ],
                                    [
                                        { text: 'Patient Paid' },
                                        { text: ": " + getAppliedAmount(data, paymentDetails, 'patient') },
                                        { text: 'Others Paid:' },
                                        { text: ": " + getAppliedAmount(data, paymentDetails, 'others') }
                                    ],
                                    [
                                        { text: 'Adjustment:' },
                                        { text: ": " + getAdjustment(data, paymentDetails, 'ajdustments_applied_total') },
                                        { text: 'Refund' },
                                        { text: ": " + getRefund(data[0].claim_no, paymentDetails) }
                                    ],
                                    [
                                        { text: 'Balance:' }, { text: ': ' + getBalanceAmount(data) }, {}, {}
                                    ],
                                ]
                            }, layout: 'noBorders', pageBreak: pageBrk,
                        },
                    );
                }
            });
        } else {
            body.push("");
        }
    } else {
        body.push("");
    }
    if (!body.length) body.push("");
    return body;
}

function mergeData(claim, pageBrk, group) {
    var blocks = bindInvoice(claim, ["Temp"], pageBrk, group);
    return blocks;
}

function groupClaimByPatient(claimDet) {
    result = claimDet.reduce(function (r, a) {
        r[a.account_no] = r[a.account_no] || [];
        r[a.account_no].push(a);
        return r;
    }, Object.create(null));
    return result;
}

function filterUniquePatient(patientDetails) {
    var _filterPatient = patientDetails.reduceRight(function (r, a) {
        r.some(function (b) {
            return a.account_no === b.account_no;
        }) || r.push(a);
        return r;
    }, []);
    return _filterPatient;
}

function invoiceTable(claims) {
    var blocks = [];
    if (typeof claimData !== 'undefined') {
        claimDetails = claimData.claim_details;
        chargeDetails = claimData.charge_details;
        paymentDetails = claimData.payment_details;
        icdDetails = claimData.icd_details;
        data = claimDetails;
        var payment = "payment";
        var adjustment = "adjustment";
    }
    var uniquePatient = filterUniquePatient(claimDetails);
    var groupPatient = groupClaimByPatient(claimDetails);
    for (i = 0; i < uniquePatient.length; i++) {
        var isLastClaim = (i == (uniquePatient.length - 1)) ? true : false;
        pageBrk = (isLastClaim === false) ? 'after' : 'none';
        group = uniquePatient[i].account_no;
        blocks = blocks.concat(mergeData(groupPatient[uniquePatient[i].account_no], pageBrk, group));
    }
    return blocks;
}

if (typeof invoiceData !== 'undefined') {
    allBlocks = invoiceTable(invoiceData[0].claim_details, ["Temp"]);
} else {
    allBlocks = invoiceTable([
        { data: [{}] },
        { data: [{}] }
    ], ["temp"]);
}

var dd = {
    content: [
        allBlocks
    ],
    styles: {
        myTable: {
            fontSize: 9.5,
            margin: [0, 0, 0, 0],
        },
    },
    defaultStyle: {
        //alignment: 'justify'
    },
    pageSize: {
        width: 612,
        height: 792
    },
    pageOrientation: 'portrait',
    pageMargins: [40, 30, 0, 0]
}