var claimDetails = [
    { patient_name: 'Bartek', birth_date: '', claim_no: 1000 },
    { patient_name: 'John', birth_date: '' },
    { patient_name: 'Elizabeth', birth_date: '' },
];

var chargeDetails = [
    { display_code: '12011', display_description: 'test desc', bill_fee: '120.00' },
    { display_code: '1000', bill_fee: '' },
    { display_code: '10002', bill_fee: '100' },
];

function buildInvoiceCharges(claimID) {
    
    data = chargeDetails;
    
    if(typeof claimData !== 'undefined') {
        data = claimData.charge_details;
    }
    
    return {
        table: {
            headerRows: 1,
            body: buildChargesBody(data, ['display_code', 'display_description', 'bill_fee'])
        }
    };
}

function buildChargesBody(data, columns) {
    var body = [];
    body.push(columns);
    //return body;

    data.forEach(function(row) {
        var dataRow = [];

        columns.forEach(function(column) {
            dataRow.push(row[column] ? row[column].toString() : '');
        });
        
        body.push(dataRow);
    });

    return body;
}

function buildClaimBody(data, columns) {
    var body = [];
    body.push(columns);
    //body.push("C");
    //body.push('');
    
    if(typeof claimData !== 'undefined') {
        console.log('claimData');
        console.log(claimData);
        
        data = claimData.claim_details;
    }

    data.forEach(function(row) {
        var dataRow = [];

        columns.forEach(function(column) {
            if(column === 'Charges') {
                return;
            }
            
            dataRow.push(row[column].toString());
        })
        
        //dataRow.push("Charges");
        dataRow.push(buildInvoiceCharges(row.claim_no));
        body.push(dataRow);
    });

    return body;
}

function invoiceTable(data, columns) {
    return {
        table: {
            headerRows: 1,
            body: buildClaimBody(data, columns)
        }
    };
}

var dd = {
    content: [
        { text: 'Invoice', style: 'header', mergeField: 'claim_details[0].patient_name' },
        invoiceTable(claimDetails, ['patient_name', 'birth_date', 'Charges'])
    ]
}
