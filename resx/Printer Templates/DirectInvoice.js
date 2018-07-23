//Author:PSPriya
//INVOICE TEMPLATE
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
var invoiceNo = 'TEST-001';

if(typeof claimData !== 'undefined') {
    ClaimDetails = claimData.claim_details;
    chargeDetails = claimData.charge_details;
    invoiceNo = claimData.invoiceNo;
}

function Dateformat(data){
	data = data.substr(5,2)+'/'+data.substr(8,2)+'/'+data.substr(0,4);
	return data;
}
function header(data, columns, value){
	var body = [];
	for(i=0; i<1; i++){
		{           
		    var dataRow = [];
            for(var key in data[i][value])
            {
				if (key === 'name'||key ==='address'){
                    dataRow.push(data[i][value][key]? data[i][value][key]: '');
				} else if (key === 'city'){
				     dataRow.push(data[i][value][key]? data[i][value][key]+'  '+(data[i][value]['state']?data[i][value]['state']:"")+'  '+(data[i][value]['zip_code']?+data[i][value]['zip_code']:""): '');
				}
			}
			body.push(dataRow)
		}	}
	return body;
}
function bindInvoiceHead(data, columns) {
	var body = [];
	let i=0;
	if(data&&data.length){
		data.forEach(function(row) {
			var dataRow = [];
			if(columns&&columns.length){
				columns.forEach(function(column) {
					if(column === 'invoice_no'&&i==0){
						dataRow.push(invoiceNo? '**Invoice**\nInvoice Number: '+invoiceNo : '**Invoice**\nInvoice Number: ');
					}else if (column ==='invoice_date'&&i==0){
						dataRow.push(row[column]? 'Invoice Date: '+Dateformat(row[column]) : 'Invoice Date: ');
					}
				});
				body.push(dataRow);
				i++
			}else{
					body.push("");
			}
		});
	}
	return body;
}
function buildHeader() {
    data = ClaimDetails;
    if(typeof claimData !== 'undefined') {
        data = claimData.ClaimDetails;
        data=ClaimDetails;
    }
    return [
        {
            style: 'myTable',
            table: {
                heights: [50],
                widths: [305, 250],
                body: [
                    [
                        {
                            style: 'myTable',
                            fontSize:10,
                            table: {
                                heights: [50],
                                headerRows: 1,
                                body: [header(data, ["name", "address","address2", "city", "state", "zip_code", "phone_no"],'responsinble_party_address')],
                            },layout: 'noBorders'
                        },
                        {
                            style: 'myTable',
                            alignment:"center",
                            fontSize:12,
                            bold:"true",
                            table: {
                                body: [bindInvoiceHead(data, ["invoice_no", "invoice_date"])],
                            },layout: 'noBorders', rowSpan:2
                        }
                    ],
                    [
                        {
                            style: 'myTable',
                            fontSize:10,
                            table: {
                                heights: [50],
                                body: [header(data, ["name", "address","address2", "city", "state", "zip_code", "phone_no"],'billing_provider_details')]
                            },layout: 'noBorders'
                        }, {}
                    ]
                ]
            },layout: 'noBorders'
        }
    ];
}
function bindPatient(claimNo, data, columns) {
	var body = [];
	if(data&&data.length){
		data.forEach(function(row) {
			var dataRow = [];
			if(row['claim_no']===claimNo){
				if(columns&&columns.length){
					columns.forEach(function(column) {
						if(column === 'patient_name'){
							dataRow.push(column? 'Patient Name: '+row[column] : '');
						}else{
							dataRow.push(column? 'Birth Date: '+Dateformat(row[column]) : '');
						}
					});
					body.push(dataRow);
				}else{
					body.push("");
				}
			}
		});
	}
	return body;
}
function bindCharges(claimNo, data, columns) {
	var body = [];
	if(data&&data.length){
		data.forEach(function(row) { 
			var dataRow = [];
			if(row['claim_no']===claimNo){
				if(columns&&columns.length){
					columns.forEach(function(column) {
						if(column == 'get_charge_icds'){
							dataRow.push(row[column]? row[column]+',': '');
						}else if(column == 'claim_dt'){
							dataRow.push(row[column]? Dateformat(row[column]): '');
						}else if (column =="modifier1"){
							dataRow.push(row[column]? row[column]+(row["modifier2"]?", "+row["modifier2"]:"")+(row["modifier3"]?", "+row["modifier3"]:"")+(row["modifier4"]?", "+row["modifier4"]:""): '');
						}else {
							dataRow.push(row[column]? row[column]: '');
						}
					});
					body.push(dataRow);
				}else{
					body.push("");
				}
			}
		});
	}
	return body;
}
function bindTotal(claimNo, data, columns) {
	var body = [];
	var sum = "0.00";
	var dataRow = [];
	if(data&&data.length){
		data.forEach(function(row) { 
			var temp=[];
			if(row['claim_no']===claimNo){
				temp.push(row['bill_fee'])
				for(i=0; i<temp.length;i++){
					temp[i] = temp[i].substr(1);
					temp[i]= temp[i].replace(/\$|,/g, "");
					sum = parseFloat(sum)+parseFloat(temp[i]);
				}
			}
		});
		dataRow.push(sum?"$"+parseFloat(sum).toFixed('2'): '$0.00');
		body.push(dataRow);
	}else{
		body.push("$ 0.00");
	}
	return body;
}
function bindGrandTotal(data, columns) {
	var body = [];
	var sum = "0.00";
	var dataRow = [];
	if(data&&data.length){
		data.forEach(function(row) { 
			var temp=[];
				temp.push(row['bill_fee'])
				for(i=0; i<temp.length;i++){
					temp[i] = temp[i].substr(1);
					temp[i]= temp[i].replace(/\$|,/g, "");
					sum = parseFloat(sum)+parseFloat(temp[i]);
				}
		});
		dataRow.push(sum?"$"+parseFloat(sum).toFixed('2'): '$0.00');
		body.push(dataRow);
	}else{
		body.push("$ 0.00");
	}
	return body;
}
function bindClaim(data, columns) {
    if(typeof claimData !== 'undefined') {
        ClaimDetails = claimData.claim_details;
        chargeDetails = claimData.charge_details;
        data=ClaimDetails;
    }
	var body = [];
	if(data&&data.length){
		data.forEach(function(row) {
			var dataRow = [];
			if(columns&&columns.length){
				columns.forEach(function(column) {
					if(column === 'Temp') {
						dataRow.push('');
					}else {
						dataRow.push('');
					}
					if(column === 'Temp') {
						body.push(dataRow);
						body.push(
							[
								{
									style: 'myTable',
									fillColor: '#AAAAAA',
									bold:'true',
									table: {
										widths: [285, 275],
										body: bindPatient(row.claim_no, ClaimDetails , ['patient_name', 'birth_date'])
									},colSpan:2
								},
							],
						);
						body.push(
							[
								{
									style: 'myTable',
									bold:true,
									table: 
									{
										widths: [75, 90, 120, 257],
										body:bindCharges(row.claim_no, ClaimDetails, ['claim_no', 'claim_dt', 'referring_physician_name', 'reason_for_exam'])
									},layout: 'noBorders'
									, colSpan: 2
								}
							]
						);
						body.push(
							[
								{
									style: 'myTable',
									table: 
									{
										widths: [445,120],
										headerRows: 1,
										body: [
											[
												{
													style: 'myTable',
													table: 
													{
														widths: [48, 65, 95, 45, 220],
														body:bindCharges(row.claim_no, chargeDetails, ['display_code', 'modifier1','get_charge_icds', 'units', 'display_description'])
													},layout: 'noBorders'
												},
												{
													alignment: 'right',
													style: 'myTable',
													table: 
													{
														 widths: [120],
														body:bindCharges(row.claim_no, chargeDetails, ['bill_fee'])
													},layout: 'noBorders'
												}
											]
										]
									},layout: 'noBorders'
									, colSpan:2
								},{}
							],
						);
						body.push(
							[
								{},{text:'________________', alignment: 'right', bold:true}
							],
							[
								{text: "Claim Total:", alignment: 'right'},
								{
									alignment: 'right',
									style: 'myTable',
									table: 
									{
										widths: [180],
										body:bindTotal(row.claim_no, chargeDetails, ['bill_fee'])
									},layout: 'noBorders'
								},
								
							]
						);
					}
				});
			}
		});
	}
	return body;
}
var dd = {
    content: [
        buildHeader(),
        {
            style: 'myTable',
            bold:"true",
            fontSize:9,
            table: {
                widths: [75,90,120, 257],
                headerRows: 1,
                body: [
                    [
                        {text:"Claim #"}, {text:"Service Date"}, {text:"Refer. Phy."}, {text:"Reason For EXAM"}
                    ]
                ]
            },layout: 'noBorders',
        },
        {
            style: 'myTable',
            fontSize:10,
            table: {
                widths: [48, 65, 95, 45, 210, 75 ],
                headerRows: 1,
                body: [
                    [
                        {text:"CPT"}, {text:"Modifier"}, {text:"Diagnostic Code"}, {text:"Unit"}, {text: "CPT Description "}, {text:"Price", alignment:"center"}
                    ],
                    [
                        {text:"________________________________________________________________________________________________________________________________",bold:"true", colSpan:6}, {}, {}, {}, {}, {}
                    ],
                ]
            },layout: 'noBorders',
        },
        {
            style: 'myTable',
            table: {
                widths: [385, 185],
                headerRows: 1,
                body: bindClaim(ClaimDetails, ['','Temp'])
            },layout: 'noBorders',
        },
        {
            alignment: 'right',
            style: 'myTable',
            table: 
            {
                widths: [390, 180],
                headerRows: 1,
                body: [
                    [
                        {},{text:'________________', bold:true},
                    ],
                ]
            },layout: 'noBorders',
        },
        {
            alignment: 'right',
            style: 'myTable',
            table: 
            {
                widths: [385, 180],
                headerRows: 1,
                body: [
                    [
                        {text:'Total Invoice Amount:'},
                        {text: bindGrandTotal(chargeDetails, ['bill_fee']), alignment:"right"},
                    ],
                ]
            },layout: 'noBorders',
        },
    ],
    styles: {
		myTable: {
		    fontSize: 10,
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
    pageMargins: [ 15, 25, 0, 0 ]
}