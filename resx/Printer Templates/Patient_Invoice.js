//Author:PSPriya
//Patient Invoice TEMPLATE
var invoiceData = [
  {
    "claim_details": [
      {
        "invoice_no": "1012",
        "invoice_date": "submitted_dt",
        "referring_physician_name": "El-Khal, Jamaal MD",
        "reason_for_exam": "",
        "patient_adrress_details": {
          "patient_address1": "JOHN DAVID HOME",
          "patient_address2": "1ST STREET",
          "patient_city": "RALEIGH",
          "patient_state": "NC",
          "patient_zip": "27601"
        },
        "claim_balance": "($210.00)",
        "claim_dt": "2018-06-27T11:30:00-07:00",
        "account_no": "MMD130431",
        "payment_details": "",
        "facility_name": "AMI POMONA",
        "facility_adrress_details": {
          "facility_address1": "1818 N. Orange Grove Ave",
          "facility_address2": "Suite 101",
          "facility_city": "Pomona",
          "facility_state": "CA",
          "facility_zip": "91767"
        },
        "claim_no": 5457,
        "patient_name": "David, John",
        "birth_date": "1999-12-27",
        "responsinble_party_address": {
          "name": "EAST VALLEY_LA PUENTE",
          "address": "17840 VILLACORTA",
          "address2": "",
          "city": "LA PUENTE",
          "state": "CA",
          "zip_code": "91744",
          "phone_no": "(626)919-5724"
        },
        "billing_provider_details": {
          "name": "MONISH LAXPATI MD INC",
          "address": "1818 N ORANGE GROVE AVE #101",
          "address2": "tt",
          "city": "POMONA",
          "state": "Alabama",
          "zip_code": "91767",
          "phone_no": "(747)542-4452"
        }
      }
    ],
    "charge_details": [
      {
        "claim_no": 5457,
        "display_code": "T1017",
        "display_description": "CASE MANAGEMENT",
        "service_date": "2018-06-28T13:40:00-07:00",
        "get_charge_icds": null,
        "modifier1": null,
        "modifier2": null,
        "modifier3": null,
        "modifier4": null,
        "units": 1,
        "bill_fee": "$0.00"
      }
    ],
    "payment_details": [
      {
        "payment_dt": "2018-07-18T03:56:48.217714-07:00",
        "payer_type": "patient",
        "payer_name": "manoj, manoj",
        "claim_id": 5457,
        "payment_id": 1624,
        "payments_applied_total": "$160.00",
        "ajdustments_applied_total": "$20.00"
      },
      {
        "payment_dt": "2018-07-19T01:15:56.125805-07:00",
        "payer_type": "insurance",
        "payer_name": "ATTYS APPEL & RIMBACH",
        "claim_id": 5457,
        "payment_id": 1626,
        "payments_applied_total": "$200.00",
        "ajdustments_applied_total": null
      }
    ]
  }
]
var ClaimDetails = invoiceData[0].claim_details;
var chargeDetails = invoiceData[0].charge_details;
var PaymentDetails = invoiceData[0].payment_details;
function Dateformat(data){
	data = data.substr(5,2)+'/'+data.substr(8,2)+'/'+data.substr(0,4);
	return data;
}
function bindHead(claimNo, data, columns, value) {
	var body = [];
	for(i=0; i<data.length; i++){
		if(data[i]['claim_no']===claimNo)
		{
            var dataRow = [];
            for(var key in data[i][value])
            {
				{
				if (key === 'name'||key ==='address'||key==='phone_no'){
                    dataRow.push(data[i][value][key]? data[i][value][key]: '');
				} else if (key === 'city'){
					dataRow.push(
					    (data[i][value]['address2']?data[i][value]['address2']:"")+"\n"+
					    (data[i][value][key]? data[i][value][key]: '')+'  '+
					    (data[i][value]['state']?data[i][value]['state']:"")+'  '+
					    (data[i][value]['zip_code']?+data[i][value]['zip_code']:"")
					    );
				}else if (key === 'facility_address1'){
                    dataRow.push(data[i]["facility_name"]? data[i]["facility_name"]+'\n'+data[i][value][key]+' \n'+(data[i][value]['facility_address2']?data[i][value]['facility_address2']:""): '');
				} else if (key === 'facility_city'){
				     dataRow.push(data[i][value][key]? data[i][value][key]+'  '+(data[i][value]['facility_state']?data[i][value]['facility_state']:"")+'  '+(data[i][value]['facility_zip']?+data[i][value]['facility_zip']:""): '');
				}else if (key === 'patient_address1'){
				     dataRow.push(data[i]["patient_name"]? data[i]["patient_name"]+'\n'+data[i][value][key]+' \n'+(data[i][value]['patient_address2']?data[i][value]['patient_address2']:""): '');
				}else if (key === 'patient_city'){
				     dataRow.push(data[i][value][key]? data[i][value][key]+'  '+(data[i][value]['patient_state']?data[i][value]['patient_state']:"")+'  '+(data[i][value]['patient_zip']?data[i][value]['patient_zip']:""): '');
				}
				}
		    }
			body.push(dataRow)
		}
	}
	return body;
}

function bindBalance(claimNo, data, columns) {
	var body = [];
	data.forEach(function(row) {
        var dataRow = [];
        if(row['claim_no']===claimNo){
            columns.forEach(function(column) {
                if(column === 'claim_balance'){
                    dataRow.push(column? 'Pay this amount: '+row[column] : '');
                }else if (column === 'claim_dt'){
                    dataRow.push(column? 'Date: '+Dateformat(row[column]) : '');
                }else if (column === 'account_no'){
                    dataRow.push(column? 'Patient: '+row[column]+"\n"+(row['patient_name']?row['patient_name']:"") : '');
                }
            });
            body.push(dataRow);
		}
	});
	return body;
}

function bindClaim(claimNo, data, columns) {
	var body = [];
	if(data&&data.length){
		data.forEach(function(row) { 
			var dataRow = [];
			if(row['claim_no']===claimNo){
				if(columns&&columns.length){
					columns.forEach(function(column) {
						if(column == 'get_charge_icds'){
							dataRow.push(row[column]? row[column]+',': '');
						}else if(column == 'service_date'){
							dataRow.push(row[column]? Dateformat(row[column])+',': '');
						}else if (column == "patient_name"){
							dataRow.push(row[column]? "Patient Address:\n"+row[column]: '');
						}else {
							dataRow.push(row[column]? row[column]: '');
						}
					});
					body.push(dataRow);
				}
			}
		});
	}
	return body;
}

function bindpayment(claimNo,data, columns) {
	var body = [];
	if(data&&data.length){
		data.forEach(function(row) { 
			var dataRow = [];
			console.log(row['claim_id'])
			if(row['claim_id']===claimNo){
				if(columns&&columns.length){
					columns.forEach(function(column) {
						if(column == 'payment_dt'){
							dataRow.push(row[column]? Dateformat(row[column]): '');
						}else if(column == 'payments_applied_total'||column == 'ajdustments_applied_total'){
							dataRow.push(row[column]? row[column]: '$0.00');
						}else{
							dataRow.push(row[column]? row[column]: '');
						}
					});
					body.push(dataRow?dataRow:"");
				}else{
					body.push("");
				}
			}
		});
	}else{
		body.push("");
	}
	return body;
}

function bindInvoice(data, columns) {
    if(typeof claimData !== 'undefined') {
        ClaimDetails = claimData.claim_details;
        chargeDetails = claimData.charge_details;
        PaymentDetails = claimData.payment_details
        data=ClaimDetails;
    }
	var body = [];
	data.forEach(function(row) {
        var dataRow = [];
        columns.forEach(function(column) {
            if(column === 'Temp') {
                dataRow.push('');
            }else {
                dataRow.push('');
            }
            if(column === 'Temp') {
                body.push(dataRow);
                body.push(
                    {
                        style: 'myTable',
                        table:
                        {
                            widths: [255, 280],
                            body:[
                                [
                                    {text:"Billing Provider Address", bold:'true'},{}
                                ],
                                [
                                    {
                                        style: 'myTable',
                                        table:
                                        {
                                            heights: [50],
                                            body:[
                                                bindHead(
                                                    row.claim_no, 
                                                    ClaimDetails, 
                                                    ["name", "address", "city", "state", "phone_no"], 
                                                    'responsinble_party_address'
                                                )
                                            ]
                                        },layout: 'noBorders'
                                    },
                                    {
                                        style: 'myTable',
                                        alignment:"right",
                                        table:
                                        {
                                            widths: [280],
                                            body:[
                                                bindBalance(
                                                    row.claim_no, 
                                                    ClaimDetails, 
                                                    ["claim_balance", "claim_dt", "account_no"]
                                                )
                                            ]
                                        },layout: 'noBorders', rowSpan:3
                                    }
                                ],
                                [
                                    {text:"Patient Name", bold:'true'},{}
                                ],
                                [
                                    {
                                        style: 'myTable',
                                        table:
                                        {
                                            heights: [50],
                                            body:[
                                                bindHead(
                                                    row.claim_no, 
                                                    ClaimDetails, 
                                                    ["patient_address1", "patient_address2", "patient_city"], 
                                                    'patient_adrress_details'
                                                )
                                            ]
                                        },layout: 'noBorders'
                                    },{}
                            	],
                            ]
                        },layout: 'noBorders'
                    }
                );
                body.push( 
                    {
                        style: 'myTable',
                        table: 
                        {
                            widths: [400, 90],
                            body:
                            [
                                [
                                    {
                                        style: 'myTable',
                                        bold:"true",
                                        fontSize: 10,
                                        table: 
                                        {
                                        widths: [55, 75, 65, 130, 135],
                                        body:[
                                            [
                                                {text:"PLEASE DETACH AND RETURN TOP PORTION WITH YOUR PAYMENT", colSpan:5, alignment:"center", bold:"", fontSize: 10.5}, {},{},{},{}
                                            ],
                                            [
                                                {text:"Encounter"}, 
                                                {text:"Date"},
                                                {text:"Code"},
                                                {text:"Description"},
                                                {text:"Amount", alignment:"right"}
                                            ]
                                        ]
                                        },layout: 'noBorders', colSpan:2
                                    },{}
                                ],
                                [
                                    {
                                        style: 'myTable',
                                        table: 
                                        {
                                            widths: [55, 75, 65, 150],
                                            body:bindClaim(row.claim_no, chargeDetails, ['claim_no', 'service_date','display_code', 'display_description'])
                                        },layout: 'noBorders'
                                    },
                                    {
                                        style: 'myTable',
                                        alignment:"right",
                                        table: 
                                        {
                                            widths: [85],
                                            body:bindClaim(row.claim_no, chargeDetails, [ "bill_fee"])
                                        },layout: 'noBorders'
                                    }
                                ],
                                
                            ]
                        },layout: 'noBorders',
                        
                    }
                );
                body.push(
                    {
                        style: 'myTable',
                        table: 
                        {
                            widths: [400, 90],
                            body:
                            [
                                [
                                    {
                                        style: 'myTable',
                                        table: 
                                        {
                                            widths: [55, 75, 65, 150],
                                            body:bindpayment(row.claim_no,PaymentDetails, ["claim_id",'payment_dt', "payer_type","payer_name"])
                                        },layout: 'noBorders'
                                    },
                                    {
                                        style: 'myTable',
                                        alignment:"right",
                                        table: 
                                        {
                                            widths: [85],
                                            body:bindpayment(row.claim_no,PaymentDetails, ["payments_applied_total"])
                                        },layout: 'noBorders'
                                    },
                                ],
                                [
                                    {
                                        style: 'myTable',
                                        table: 
                                        {
                                            widths: [55, 75, 65, 150],
                                            body:bindpayment(row.claim_no,PaymentDetails, ["claim_id",'payment_dt', "payer_type","payer_name"])
                                        },layout: 'noBorders'
                                    },
                                    {
                                        style: 'myTable',
                                        alignment:"right",
                                        table: 
                                        {
                                            widths: [85],
                                            body:bindpayment(row.claim_no,PaymentDetails, ["ajdustments_applied_total"])
                                        },layout: 'noBorders'
                                    },
                                ],
                                [
                                    {
                                        style: 'myTable',
                                        table: 
                                        {
                                            widths: [55, 75, 65, 150],
                                            body:[
                                                [
                                                    {},{},{},{text:"Total", alignment:"right"}
                                                ]
                                            ]
                                        },layout: 'noBorders'
                                    },
                                    {
                                        style: 'myTable',
                                        alignment:"right",
                                        table: 
                                        {
                                            widths: [85],
                                            body:bindClaim(row.claim_no, ClaimDetails, [ "claim_balance"])
                                        },layout: 'noBorders'
                                    }
                                ],
                            ]
                        },layout: 'noBorders'
                    }
                    
                );
                body.push(
                    {
                        style: 'myTable',
                        table: 
                        {
                            widths: [300, 200],
                            body:
                            [
                                [
                                    {
                                        text:"Balance is due in full. We accept major credit cards.", fontSize: 11
                                    },
                                    {
                                        text:"MAKE CHECKS PAYABLE TO:", fontSize: 11, bold:"true"
                                    }
                                ],
                                [
                                    {},
                                    {
                                        style: 'myTable',
                                        table: 
                                        {
                                            body:
                                            [
                                                bindHead(
                                                row.claim_no, 
                                                    ClaimDetails, 
                                                    ["facility_address1", "facility_address2", "facility_city"], 
                                                    'facility_adrress_details' 
                                                )
                                            ],
                                        },layout: 'noBorders'
                                    }
                                ],
                            ]
                        },layout: 'noBorders'
                    }
                    
                );
            }
        });
	});
	return body;
}

var dd = {
    content: [
        bindInvoice(ClaimDetails, ["Temp"]),
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
    pageMargins: [ 40, 30, 0, 0 ]
}