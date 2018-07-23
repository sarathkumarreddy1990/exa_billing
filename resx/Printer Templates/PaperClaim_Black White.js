//Kassi
let totalBillFee = 0.00;
let pageBrk = 'none';
let start = 0, end = 6;

function getImage(needCheck) {
    return needCheck ? 'tickImage' : 'clearDot';
}
function getName(patientData, len) {
    return getSubstring((getKeyValue(patientData, 'lastName') + ', ' + getKeyValue(patientData, 'firstName')), len);
}
function parseDate(date) {
    if (date && typeof date === 'object' && date.constructor.name === 'Date') {
        return date;
    }
    return new Date();
}
function getDate(date) {
    if (date) {
        date = parseDate(date);
        return (date.getDate() > 9 ? date.getDate() : "0" + date.getDate());
    } else return '';
}
function getMonth(date) {
    if (date) {
        date = parseDate(date);
        return typeof date.getMonth() === 'number' ? ((date.getMonth() + 1) > 9 ? (date.getMonth() + 1) : '0' + (date.getMonth() + 1)) : '';
    } else return '';
}
function getYear(date, isTwoChar) {
    if (date) {
        date = parseDate(date);
        if (isTwoChar) return (date.getFullYear() ? date.getFullYear().toString().substring(2) : date.getFullYear());
        return date.getFullYear();
    } else return '';
}

function getTrimmedPhoneNo(data) {
	data = data.replace("(", "    ");
	data = data.replace(")", "    ");
	console.log("PH:"+data);
	return data;
}

function getCityStatePincode(data, city, state, zip, len) {
    return getSubstring(( (data && data[city] ? data[city] : '') + ' ' + (data && data[state] ? data[state] : '') + ' ' + (data && data[zip] ? data[zip] : '')), len);
    
   // return '';
}

function getSubstring(str, len) {
    str = str ? str.toString() : '';
    return (str.length > 0) ? str.substring(0, len) : '';
}

function getICDCodeType(data) {
   if (data.subscriber && data.subscriber[0].claim && data.subscriber[0].claim[0].code_type)
        return (data.subscriber[0].claim[0].code_type > 10) ? data.subscriber[0].claim[0].code_type : (data.subscriber[0].claim[0].code_type + '\t');
    return '\t\t';
}

function getICDCodes(data) {
    let icd = data.subscriber && data.subscriber[0].claim && data.subscriber[0].claim[0].icd;
    let icdvalues = [];
    for (let i = 0; i < 12; i++) {
        if (icd && icd[i] && icd[i].code) icdvalues.push(getSubstring(icd[i].code, 7));
        else icdvalues.push(' ');
    }
    return icdvalues;
}

function getICDBlock(claimData) {
    let icdvalues = getICDCodes(claimData); //icd array   
    return [
        [
            { text: icdvalues[0], margin:[0,0,-10,0]},
            { text: icdvalues[1], margin:[0,0,-10,0]},
            { text: icdvalues[2], margin:[0,0,-12,0]},
            { text: icdvalues[3], margin:[0,0,-18,0]}
        ],
        [
            { text: icdvalues[4], margin:[0,-1,-10,0]},
            { text: icdvalues[5], margin:[0,-1,-10,0]},
            { text: icdvalues[6], margin:[0,-1,-12,0]},
            { text: icdvalues[7], margin:[0,-1,-18,0]}
        ],
        [
            { text: icdvalues[8], margin:[0,-2,-10,0]},
            { text: icdvalues[9], margin:[0,-2,-10,0]},
            { text: icdvalues[10], margin:[0,-2,-12,0]},
            { text: icdvalues[11], margin:[0,-2,-18,0]}
        ],
    ];
}

function getDecimalNumericValue(data) {
    return getSubstring(data && data.toString().split(".")[0] ? parseInt(data.toString().split(".")[0], 10).toString() : '0', 8);
}

function getDecimalPointsValue(data) {
    return getSubstring((data && data.toString().split(".")[1] ? (data.toString().split(".")[1].length>1 ? data.toString().split(".")[1] : data.toString().split(".")[1] + '0') : '00'), 2);
}

function getCPTValues(data) {
    let cpt = [];
    let cptvalues = [];
    totalBillFee = 0.00;
    cptvalues = data.subscriber && data.subscriber[0].claim && data.subscriber[0].claim[0].serviceLine ? data.subscriber[0].claim[0].serviceLine : [];
    for (let pos = 0; pos < cptvalues.length; pos++) {
        console.log("CL-"+pos+": ",data);
         totalBillFee = (parseFloat(totalBillFee) + (data.subscriber && data.subscriber[0].claim && data.subscriber[0].claim[0].serviceLine ? parseFloat(getFeeValue(data.subscriber[0].claim[0].serviceLine[pos], 'totalBillFee')) : 0 ));
    }
    for (let pos = start; pos < end; pos++) {
        if (cptvalues && cptvalues[pos]) {
            cpt.push([
                { text: getMonth(new Date(cptvalues[pos].studyDt)), border: [true, false, true, true]},
                { text: getDate(new Date(cptvalues[pos].studyDt)), border: [true, false, true, true]},
                { text: getYear(new Date(cptvalues[pos].studyDt), true), border: [true, false, true, true]},
                { text: getMonth(new Date(cptvalues[pos].studyDt)), border: [true, false, true, true]},
                { text: getDate(new Date(cptvalues[pos].studyDt)), border: [true, false, true, true]},
                { text: getYear(new Date(cptvalues[pos].studyDt), true), border: [true, false, true, true]},
                { text: getKeyValue(data.subscriber[0].claim[0], 'POS'), border: [true, false, true, true]}, 
                {text:"", border: [true, false, true, true]},
                { text: getKeyValue(cptvalues[pos], 'examCpt'), border: [true, false, true, true]},
                { text: getKeyValue(cptvalues[pos], 'mod1'), border: [true, false, true, true]},
                { text: getKeyValue(cptvalues[pos], 'mod2'), border: [true, false, true, true]},
                { text: getKeyValue(cptvalues[pos], 'mod3'), border: [true, false, true, true]},
                { text: getKeyValue(cptvalues[pos], 'mod4'), border: [true, false, true, true]},
                { text: getPointerValue(cptvalues[pos]), border: [true, false, true, true]},
                { text: getDecimalNumericValue(getKeyValue(cptvalues[pos], 'totalBillFee')), border: [true, false, true, true], margin:[-3, 0,0,0]},
                { text: getDecimalPointsValue(getKeyValue(cptvalues[pos], 'totalBillFee')), border: [true, false, true, true]},
                { text: getKeyTrimValue(cptvalues[pos], 'unit', 3), border: [true, false, true, true]},
                {text:"",  border: [true, false, true, true]}, { text: 'NPI', alignment: 'center' , border: [true, false, true, true]},
                { text: data.subscriber[0].claim[0].renderingProvider ? getKeyTrimValue(data.subscriber[0].claim[0].renderingProvider[pos], 'NPINO', 12) : '' , border: [true, false, true, true]},
            ]);
        } else cpt.push([{text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]}, {text:"",  border: [true, false, true, true]},{text:"NPI", alignment:"center",  border: [true, false, true, true]},{text:"",  border: [true, false, true, true]}]);
    }
    return cpt;
}

function getCPTBlock(claimData) {
    let cpt = getCPTValues(claimData);
    return [
        [
            {
                style: 'Ques',
                margin: [0, -3, 0, 0],
                table: {
                    widths: [13, 12, 15, 13, 12, 15],
                    body: [
                        [
                            {text:"24.  A.\t\t DATE(S) OF SERVICE", colSpan:6}, {}, {}, {}, {}, {}
                        ], 
                        [
                            {text: "From", alignment: "center", colSpan:3, margin: [0, -4, 0, 0],},{}, {},
                            {text: "To", alignment: "center", colSpan:3, margin: [0, -4, 0, 0],},{}, {}
                        ],
                        [
                            {text: "MM", alignment: "center", margin: [0, -5, 0, 0]},
                            {text: "DD", alignment: "center", margin: [0, -5, 0, 0]},
                            {text: "YY", alignment: "center", margin: [0, -5, 0, 0]},
                            {text: "MM", alignment: "center", margin: [0, -5, 0, 0]},
                            {text: "DD", alignment: "center", margin: [0, -5, 0, 0]},
                            {text: "YY", alignment: "center", margin: [0, -5, 0, 0]}
                        ]
                    ]
                }, layout: 'noBorders', colSpan:6
            },{},{},{},{},{},
            {
                style: 'Ques',
                margin: [-3, -4, 0, -2],
                alignment:"center",
                table: {
                    body: [
                        [
                            {text:"B.", alignment: "center"}
                        ],
                        [
                            {text:"PLACE OF",fontSize: 6, margin:[0, -5, 0,0]}
                        ],
                        [
                            {text:"SERVICE", margin:[0, -5, 0,0]}
                        ]
                        
                    ]
                }, layout: 'noBorders',
            },
            {
                style: 'Ques',
                margin:[0, -4, 0, -2],
                alignment:"center",
                table: {
                    body: [
                        [
                            {text:"C."}
                        ],
                        [
                            {text:"EMG", margin:[0,0,0,0]}
                        ],
                        
                    ]
                }, layout: 'noBorders',
            },
            {
                style: 'Ques',
                margin: [0, -4, 0, -2],
                alignment:"center",
                table: {
                    body: [
                        [
                            {text:"D.PROCEDURES,SERVICES,OR SUPPLIES", colSpan:2},{}
                        ],
                        [
                            {text:" (Explain Unusual Circumstances)", colSpan:2, margin:[0,-6, 0, 0]},{}
                        ],
                        [
                            {text:"CPT/HCPCS\t|", margin:[-5,-4, 0, 0]},
                            {text:"MODIFIER", margin:[5,-4, 0, 0]}
                        ],
                    ]
                }, layout: 'noBorders',colSpan:5
            },
            {},{},{},{},
            {
                style: 'Ques',
                margin: [0, -4, 0, -2],
                alignment:"center",
                table: {
                    body: [
                        [
                            {text:"E. "}
                        ],
                        [
                            {text:"DIAGNOSIS ", margin:[0,-4, 0, 0]}
                        ],
                        [
                            {text:"POINTER ", margin:[0,-4, 0, 0]}
                        ],
                    ]
                }, layout: 'noBorders',
            },
            {
                style: 'Ques',
                margin: [8, -4, 0, -2],
                alignment:"center",
                table: {
                    body: [
                        [
                            {text:"F. "}
                        ],
                        [
                            {text:"$ CHARGES ",  margin:[0,0, 0, 0]}
                        ],
                    ]
                }, layout: 'noBorders',colSpan:2
            },{},
            {
                style: 'Ques',
                margin: [0, -5, 0, -2],
                alignment:"center",
                table: {
                    body: [
                        [
                            {text:"G."}
                        ],
                        [
                            {text:"DAYS", margin:[0,-6, 0,0]}
                        ],
                        [
                            {text:"OR", margin:[0,-6, 0,0]}
                        ],
                        [
                            {text:"UNITS", margin:[0,-6, 0,0]}
                        ],
                    ]
                }, layout: 'noBorders',
            },
            {
                style: 'Ques',
                margin: [-3, -5, 0, -2],
                alignment:"center",
                table: {
                    body: [
                        [
                            {text:"H.", fontSize: 6}
                        ],
                        [
                            {text:"EPSDT", fontSize: 6, margin:[0,-6, 0,0]}
                        ],
                        [
                            {text:"Family", fontSize: 6, margin:[0,-6, 0,0]}
                        ],
                        [
                            {text:"Plan", fontSize: 6, margin:[0,-6, 0,0]}
                        ],
                    ]
                }, layout: 'noBorders',
            },
            {
                style: 'Ques',
                margin: [0, -4, 0, 0],
                alignment:"center",
                table: {
                    body: [
                        [
                            {text:"I."}
                        ],
                        [
                            {text:"ID.", margin:[0,-5, 0,0]}
                        ],
                        [
                            {text:"QUAL", margin:[0,-5, 0,0]}
                        ],
                    ]
                }, layout: 'noBorders',
            },
            {
                style: 'Ques',
                margin: [10, -4, 0, 0],
                alignment:"center",
                table: {
                    body: [
                        [
                            {text:"J."}
                        ],
                        [
                            {text:"RENDERING.", margin:[0,-5, 0,0]}
                        ],
                        [
                            {text:"PROVIDER ID #", margin:[0,-5, 0,0]}
                        ],
                    ]
                }, layout: 'noBorders',
            }
        ],
        // [{text:'1'}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}],
        [
            {text:'', fillColor: '#808080', border: [true, true, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            {text:'', fillColor: '#808080', border: [false, false, false, false]},
            { text: claimData.subscriber && claimData.subscriber[0] && claimData.subscriber[0].claimFilingCode ? (claimData.subscriber[0].claimFilingCode.toString().toUpperCase() === 'WC' ? 'OB' : '') : '' , fillColor: '#808080', border: [false, false, false, false]},
            {
                text: claimData.subscriber && claimData.subscriber[0] && claimData.subscriber[0].claimFilingCode && (claimData.subscriber[0].claimFilingCode.toString().toUpperCase() === 'WC') &&
                    claimData.subscriber[0].claim[0].renderingProvider && claimData.subscriber[0].claim[0].renderingProvider[0].licenseNo ? claimData.subscriber[0].claim[0].renderingProvider[0].licenseNo : ''
                    , fillColor: '#808080', border: [false, false, true, false]
            }
        ],
        cpt[0],
        [
            {text:'', fillColor: '#808080', border: [true, true, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, true, false]}
        ],
        cpt[1],
        [
            {text:'', fillColor: '#808080', border: [true, true, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, true, false]}
        ],
        cpt[2],
        [
            {text:'', fillColor: '#808080', border: [true, true, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, true, false]}
        ],
        cpt[3],
        [
            {text:'', fillColor: '#808080', border: [true, true, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, true, false]}
        ],
        cpt[4],
        [
            {text:'', fillColor: '#808080', border: [true, true, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, false, false]}, 
            {text:'', fillColor: '#808080', border: [false, false, true, false]}
        ],
        cpt[5],
    ];
}

function getClaimResponsible(claimData) {
    if (claimData && claimData.subscriber && claimData.subscriber[0].claimResponsibleParty) {
        if (claimData.subscriber[0].claimResponsibleParty.toString().toUpperCase() === 'P') {
            return '0.00';
        } else if (claimData.subscriber[0].claimResponsibleParty.toString().toUpperCase() === 'S') {
            return getPrimaryAmountPaid(claimData);
        } else if (claimData.subscriber[0].claimResponsibleParty.toString().toUpperCase() === 'T') {
            return getSecondaryAmountPaid(claimData);
        }
    }
}

function getPrimaryAmountPaid(claimData) {
    let primary = claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].payerpaidAmount ? 
    claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryPaidTotal ? parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryPaidTotal.substring(1)) : 0 : 0;
    let adj = claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].payerpaidAmount ? 
    claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryAdjTotal ? parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryAdjTotal.substring(1)) : 0 : 0;
    let total = primary + adj;
    return total;
}

function getSecondaryAmountPaid(claimData) {
    let primary = claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].payerpaidAmount ? 
    (claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryPaidTotal ? parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryPaidTotal.substring(1)) : 0) : 0;
    let adj = claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].payerpaidAmount ? 
    (claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryAdjTotal ? parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryAdjTotal.substring(1)) : 0) : 0;
    let secondary = claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].payerpaidAmount ? 
    (claimData.subscriber[0].claim[0].payerpaidAmount[0].secondaryPaidTotal ? parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].secondaryPaidTotal.substring(1)) : 0) : 0;
    let adj2 = claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].payerpaidAmount ? 
    (claimData.subscriber[0].claim[0].payerpaidAmount[0].secondaryAdjTotal ? parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].secondaryAdjTotal.substring(1)) : 0) : 0;
    let total = primary + adj + secondary + adj2;
    return total;
}

function getDateQual(data, value) {
    if (!data) value = '';
    return value;
}

function getOtherSubscriberValue(data, field, len) {
    if (data && data.otherSubscriber && data.otherSubscriber[0] && data.otherSubscriber[0][field]) return getSubstring(data.otherSubscriber[0][field] + '', len);
    return '';
}

function getOtherPayerValue(data, field, len) {
    if (data && data.OtherPayer && data.OtherPayer[0] && data.OtherPayer[0][field]) return getSubstring(data.OtherPayer[0][field] + '', len);
    return '';
}

function getResubmissionCode(data, field) {
    if (data && field && data[field]){
        switch (data[field].toLowerCase()) {
            case 'original': return '1';
            case 'corrected': return '7';
            case 'void': return '8';
        }
    }
    return '';    
}

function getKeyValue(data, field) {
    return (data && field && data[field]) ? data[field] : '';
}

function getKeyTrimValue(data, field, len) {
    return (data && field && data[field]) ? getSubstring(data[field], len) : '';
}

function getFeeValue(data, field) {
    return (data && field && data[field]) ? data[field] : 0;
}

function getPointer(value) {
    value = +value ? +value : 0;
    switch (value) {
        case 1:
            return 'A';
        case 2:
            return 'B';
        case 3:
            return 'C';
        case 4:
            return 'D';
        case 5:
            return 'E';
        case 6:
            return 'F';
        case 7:
            return 'G';
        case 8:
            return 'H';
        case 9:
            return 'I';
        case 10:
            return 'J';
        case 11:
            return 'K';
        case 12:
            return 'L';
        default:
            return '';
    }
}

function getPointerValue(data) {
    let pointervalue = '';
    if (data && data.pointer1) pointervalue = pointervalue + getPointer(data.pointer1);
    if (data && data.pointer2) pointervalue = pointervalue + getPointer(data.pointer2);
    if (data && data.pointer3) pointervalue = pointervalue + getPointer(data.pointer3);
    if (data && data.pointer4) pointervalue = pointervalue + getPointer(data.pointer4);
    return pointervalue;
}

//
function getPageBreak() {
    return {text: '', pageBreak: 'before'};
}

function formatSingleClaim(claimData) {
    let totalPaid = getClaimResponsible(claimData);
    return [
        {
            style: 'TableHead',
			table: {
			    widths: [15, 300, 200, 20, 15],
			    heights: [0,0,0,11],
				body: [
					[//Ans
					    {text: 'Corrected Claim', fontSize:12, bold: true, colSpan:3, normal: false, margin:[60, -10, 0, 0]}, {},{},{},{}
					],
					[
					    {text: 'HEALTH INSURANCE CLAIM FORM', fontSize:12, bold: true, colSpan:2},{},
					    { text: claimData.subscriber && claimData.subscriber[0].payer ? getKeyTrimValue(claimData.subscriber[0].payer, 'payerName', 30) : '' , fontSize: 8, colSpan:3},{},{}
					 ],
					 [
					    {text: 'APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC)02/12', colSpan:2},{},
					    { text: claimData.subscriber && claimData.subscriber[0].payer ? getKeyTrimValue(claimData.subscriber[0].payer, 'insuranceprovideraddressline1', 30) : '' , fontSize: 8, colSpan:3},{},{}
					 ],
					 [
					    {image: 'PICAImage', fit: [20, 20], margin: [0, 0, 0, 0]},
					    {text:"PICA"},
					    {
                            text: (claimData.subscriber && claimData.subscriber[0].payer ? (getSubstring((getKeyValue(claimData.subscriber[0].payer, 'payerCity') + ' ' +
                                getKeyValue(claimData.subscriber[0].payer, 'payerState') + ' ' + getKeyValue(claimData.subscriber[0].payer, 'payerZIPCode')), 30)) : ' ')
                                ,fontSize: 8
                        },{text:"PICA", alignment:"right"},
                        {image: 'PICAImage', fit: [20, 20], margin: [0, 0, 0, 0]}
					 ],
                ],
			},layout: 'noBorders',
		},
		{
            style: 'Ques',
			table: {
                widths: [88, 80, 20, 141, 89, 80, 30],
                heights: [0, 0, 0, 18, 20, 18, 17, 19, 17, 0, 32],
				body: [
                    [
                        {
                            style: 'Ques',
                            table: {
                                widths: [0, 45, 0, 37, 0, 50, 0, 35, 0, 45, 0, 30, 0, 15],
                                body: [
                                    [
                                        {text:'1.  MEDICARE', colSpan:2},{},
                                        {text:'MEDICAID', colSpan:2},{},
                                        {text:'TRICARE', colSpan:2},{},
                                        {text:'CHAMPVA', colSpan:2},{},
                                        {text:'GROUP\nHEALTH PLAN', colSpan:2},{},
                                        {text:'FECA\nBLK LUNG', colSpan:2},{},
                                        {text:'OTHER', colSpan:2},{}
                                    ],
                                    [
                                        { image: 'checkboxImage', fit: [10, 10], margin: [-4, -9, 0, 0]},
                                        {text:'(Medicare#)', margin: [0, -6, 0, 0], fontSize: 6.5, italics: true},
                                        { image: 'checkboxImage', fit: [10, 10], margin: [-12, -9, 0, 0]},
                                        {text:'(Medicaid)', margin: [-7, -6, 0, 0], fontSize: 6.5, italics: true},
                                        { image: 'checkboxImage', fit: [10, 10], margin: [-14, -9, 0, 0]},
                                        {text:'(ID#DOD#)', margin: [-9, -6, 0, 0], fontSize: 6.5, italics: true},
                                        { image: 'checkboxImage', fit: [10, 10], margin: [-14, -9, 0, 0]},
                                        {text:'(Member ID#)', margin: [-8, -6, 0, 0], fontSize: 6, italics: true},
                                        { image: 'checkboxImage', fit: [10, 10], margin: [-12, -9, 0, 0]},
                                        {text:'(ID#)', margin: [-8, -6, 0, 0], fontSize: 6.5, italics: true},
                                        { image: 'checkboxImage', fit: [10, 10], margin: [-12, -9, 0, 0]},
                                        {text:'(ID#)', margin: [-8, -6, 0, 0], fontSize: 6.5, italics: true},
                                        { image: 'checkboxImage', fit: [10, 10], margin: [-12, -9, 0, 0]},
                                        {text:'(ID#)', margin: [-8, -6, 0, 0], fontSize: 6.5, italics: true}
                                    ],
                                ],
                            },layout: 'noBorders', colSpan:4
                        },
                        {},{},{},
                        {
                            text:"1a. INSURED'S I.D. NUMBER\t\t\t\t\t\t\t(For Program in item 1)", colSpan:3
                        }, {}, {}
                    ],
                    [
                        {text:"2.PATIENT'S NAME(Last Name, First Name, Middel Initial)", colSpan:3},{},{},
                        {
                            style: 'Ques',
                            table: {
                                body: [
                                    [
                                        {text:"3.PATIENT'S BIRTH DATE\t\t\t\t\tSEX"},
                                        
                                    ],
                                    [
                                        {
                                            style: 'Ques',
                                            margin: [-10, -8, 0, 0],
                                            table: {
                                                widths: [80, 10, 8, 8, 10],
                                                body: [
                                                    [
                                                        {text: "MM\t|\tDD\t|\t\tYY", margin: [15, 0, 0, 0]},
                                                        {text:"M", alignment:'right', margin: [0, 3, 0, 0]},
                                                        {image: 'checkboxImage', fit: [10, 10], margin: [-5, 0, 0, 0]},
                                                        {text:"F", alignment:'right'},
                                                        {image: 'checkboxImage', fit: [10, 10], margin: [-5, 0, 0, 0]}
                                                    ],
                                                ],
                                            },layout: 'noBorders'
                                        },
                                    ]
                                ],
                            },layout: 'noBorders'
                        },
                        {text:"4.INSURED'S NAME (Last Name, First Name, Middle Initial)", colSpan:3}, {}, {}
                    ],
                    [
                        {text:"5.PATIENT'S ADDRESS(No., Street)", colSpan:3},{},{},
                        {
                            style: 'Ques',
                            table: {
                                body: [
                                    [
                                        {text:"6.PATIENT'S RELATIONSHIP TO INSURED"},
                                        
                                    ],
                                    [
                                        {
                                            style: 'Ques',
                                            margin: [-2, -2, 0, 0],
                                            table: {
                                                widths: [12, 0, 25, 0, 18, 0, 18, 0],
                                                body: [
                                                    [
                                                        {text:"Self", alignment: 'right'},
                                                        {image: 'checkboxImage', fit: [10, 10], margin: [-5, -2, 0, 0]},
                                                        {text:"Spouse", alignment:'right'},
                                                        {image: 'checkboxImage', fit: [10, 10], margin: [-5, -2, 0, 0]},
                                                        {text:"Child", alignment: 'right'},
                                                        {image: 'checkboxImage', fit: [10, 10], margin: [-5, -2, 0, 0]},
                                                        {text:"Other", alignment: 'right'},
                                                        {image: 'checkboxImage', fit: [10, 10], margin: [-5, -2, 0, 0]},
                                                    ],
                                                ],
                                            },layout: 'noBorders'
                                        },
                                    ]
                                ],
                            },layout: 'noBorders'
                        },
                        {text:"7.INSURED'S ADDRESS(No., Street)", colSpan:3}, {}, {}
                    ],
                    [
                        {text:"CITY", colSpan:2}, {},
                        {text: "STATE"},
                        {text: "8.RESERVED FOR NUCC USE", rowSpan:2},
                        {text:"CITY", colSpan:2}, {},
                        {text: "STATE"}
                    ],
                    [
                        {text:"ZIP CODE"},
                        {
                            style: 'Ques',
                            margin: [-2, -2, 0, 0],
                            table: {
                                body: [
                                    [
                                        {text: "TELEPHONE (Include Area Code)"}
                                    ],
                                    [
                                        {text: "(\t\t\t)", bold:'true', margin:[8, -4, 0 ,0]}
                                    ],
                                ]
                            },layout: 'noBorders', colSpan:2
                        },{},{},
                        {text:"ZIP CODE"}, 
                        {
                            style: 'Ques',
                            margin: [-2, -2, 0, 0],
                            table: {
                                body: [
                                    [
                                        {text: "TELEPHONE (Include Area Code)"}
                                    ],
                                    [
                                        {text: "(\t\t\t)", bold:'true', margin:[8, -4, 0 ,0]}
                                    ],
                                ]
                            },layout: 'noBorders', colSpan:2
                        },{}
                    ],
                    [
                        {text:"9.OTHER INSURED'S NAME(Last Name, First Name, Middel Initial)", colSpan:3}, {}, {},
                        {
                            text:"10.IS PATIENT'S CONDITION RELATED TO:", rowSpan:4
                        },
                        {text:"11.INSURED'S POLICY GROUP OR FECA NUMBER", colSpan:3}, {}, {},
                    ],
                    [
                        {text:"a.OTHER INSURED'S POLICY OR GROUP NUMBER", colSpan:3}, {}, {},{},
                        {
                            style: 'Ques',
                            table: {
                                body: [
                                    [
                                        {text:"a.INSURED'S DATE OF BIRTH\t\t\t\t\t\t\t\t\t\tSEX"},
                                        
                                    ],
                                    [
                                        {
                                            style: 'Ques',
                                            margin: [8, -5, 0, 0],
                                            table: {
                                                widths: [100, 10, 35, 8, 10],
                                                body: [
                                                    [
                                                        {text: "MM\t|\tDD\t|\tYY", margin: [15, -3, 0, 0]},
                                                        {text:"M", alignment:'right'},
                                                        {image: 'checkboxImage', fit: [10, 10], margin: [-5, 0, 0, 0]},
                                                        {text:"F", alignment:'right'},
                                                        {image: 'checkboxImage', fit: [10, 10], margin: [-5, 0, 0, 0]}
                                                    ],
                                                ],
                                            },layout: 'noBorders'
                                        },
                                    ]
                                ],
                            },layout: 'noBorders', colSpan: 3
                        }, {}, {}
                    ],
                    [
                        {text:"b.RESERVED FOR NUCC USE", colSpan:3},{}, {},{},
                        {text:"b.OTHER CLAIM ID (Designated by NUCC)", colSpan:3}, {}, {},
                    ],
                    [
                        {text:"c.RESERVED FOR NUCC USE", colSpan:3}, {}, {},{},
                        {text:"c.INSURANCE PLAN NAME OR PROGRAM NAME", colSpan:3}, {}, {},
                    ],
                    [
                        {text:"d.INSURANCE PLAN NAME OR PROGRAM NAME", colSpan:3}, {},{},
                        {text:"10d.CLAIM CODES(Designated by NUCC)"},
                        {
                            style: 'Ques',
                            margin: [0, -3, 0, 0],
                            table: {
                                widths: [10, 18, 12, 14, 20, 90],
                                body: [
                                    [
                                        {text:"d.IS THERE ANOTHER HEALTH BENEFIT PLAN?", colSpan:6},{},{},{},{},{}
                                    ],
                                    [
                                        {image: 'checkboxImage', fit: [10, 10], margin: [11, 0, 0, 0]}, 
                                        {text: "YES", margin: [5, 0, 0, 0]}, 
                                        {image: 'checkboxImage', fit: [10, 10], margin: [0, 0, 0, 0]}, 
                                        {text: "No", margin: [-5, 0, 0, 0]}, 
                                        {text: "If yes,", bold:'true', italics: true },
                                        {text: "complete items 9,9a,and 9d.", margin: [-10, 0, 0, 0]}
                                    ]
                                ]
                            },layout: 'noBorders', colSpan:3
                        }, {}, {}
                    ],
                    [
                        {
                            style: 'Ques',
                            margin: [-3, -3, 0, 0],
                            table: {
                                heights: [0, 20, 0],
                                body: [
                                    [
                                        {text:"READ BACK FORM COMPLETING & SIGNING THIS FORM.", bold:true, alignment: 'center'},
                                    ],
                                    [
                                        {text:"12.PATIENTS OR AUTHORIZED PERSON'S SIGNATURE I authorize the release of any medical or other information necessary to process this claim. I also request payment of government benefits either to myself or to the party who accepts assignment below.", margin: [0, -5, 0, 0]},
                                    ],
                                    [
                                        {
                                            style: 'Ques',
                                            table: {
                                                widths: [220, 130],
                                                body: [
                                                    [
                                                        {text:"SIGNED________________________________________________"},
                                                        {text:"DATE_______________________________________"}
                                                    ]
                                                ]
                                            },layout: 'noBorders'
                                        }
                                    ]
                                ]
                            },layout: 'noBorders',  colSpan:4
                        },{},{},{},
                        {
                            style: 'Ques',
                            table: {
                                heights: [30, 0],
                                body: [
                                    [
                                        {text:"13.INSURED'S OR AUTHORIZED PERSON'S SIGNATURE I authorize payment of medical benefits to the undesigned physician or supplier for services described below."},
                                    ],
                                    [
                                        {text:" SIGNED___________________________________________________________________ "},
                                    ],
                                    ]
                            },layout: 'noBorders', colSpan:3
                        }, {},{}
                    ],
                ],
			}
		},
		{
            style: 'Ques',
            margin: [0, -2, 0, 0],
			table: {
			    widths: [190, 11, 8, 120, 80, 128],
			    heights: [18, 0, 0, 0,20, 16],
                body: [
                    [
                        {
                            style: 'Ques',
                            margin: [0, -2, 0, 0],
                            table: {
                                widths:[23, 18, 8, 110],
                                body: [
                                    [
                                        {text: "14.DATE OF CURRENT ILLNESS,INJURY, or PREGNANCY (LMP)", colSpan:4}, {}, {}, {}
                                    ],
                                    [
                                        {text: "MM  |", alignment: "center", margin: [6, -5, 0, 0]},
                                        {text: "DD  |", alignment: "center", margin: [0, -5, 0, 0]},
                                        {text: "YY", alignment: "center", margin: [0, -5, 0, 0]},
                                        {text: "QUAL.|", margin:[10,0,0,0]}
                                    ]
                                ]
                            },layout: 'noBorders'
                        },
                        {
                            style: 'Ques',
                            margin: [0, -2, 0, 0],
                            table: {
                                widths:[72, 18, 15, 20],
                                body: [
                                    [
                                        {text: "15.OTHER DATE", colSpan:4}, {}, {}, {}
                                    ],
                                    [
                                        {text: "QUAL.|\t\t\t |"},
                                        {text: "MM   |", alignment: "center", margin: [-2, -7, 0, 0]},
                                        {text: "DD   |", alignment: "center", margin: [-2, -7, 0, 0]},
                                        {text: "YY", alignment: "center", margin: [-7, -7, 0, 0]}
                                    ]
                                ]
                            },layout: 'noBorders', colSpan:3
                        },{}, {},
                        {
                            style: 'Ques',
                            margin: [0, -2, 0, 0],
                            table: {
                                widths:[25, 20, 12, 20, 11, 25, 25, 15],
                                body: [
                                    [
                                        {text: "16.DATES PATIENT UNABLE TO WORK IN CURRENT OCCUPATION", colSpan:8}, {},{},{},{},{},{},{}
                                    ],
                                    [
                                        {text: "FROM", alignment: "right", margin:[3, 0, 0, 0]},
                                        {text: "MM  |", alignment: "center", margin: [-10, -5, 0, 0]},
                                        {text: "DD    |", alignment: "center", margin: [-13, -5, 0, 0]},
                                        {text: "YY", alignment: "center", margin: [-5, -5, 0, 0]},
                                        {text: "To", alignment: "right", margin: [3, -5, 0, 0]},
                                        {text: "MM  |", alignment: "center", margin: [-5, -5, 0, 0]},
                                        {text: "DD   |", alignment: "center", margin: [-28, -5, 0, 0]},
                                        {text: "YY", alignment: "center", margin: [-32, -5, 0, 0]},
                                    ]
                                ]
                            },layout: 'noBorders', colSpan:2
                        }, {}
                        
                    ],
                    [
                        {text: "17.NAME OF REFERRING PROVIDER OR OTHER SOURCE", rowSpan:2},
                        {text: "17a",fillColor: '#808080'},{text:"", fillColor: '#808080'},{text:"", fillColor: '#808080'},
                        {text: "18.HOSPITALIZATION DATES RELATED TO CURRENT SERVICES", colSpan:2, rowSpan:2}, {}
                    ],
                    [
                        {text: ""},
                        {text: "17b"},{},{},{},{},
                    ],
                    [
                        {text: "19.ADDITIONAL CLAIM INFORMATION(Designated by NUCC) ", colSpan: 4},
                        {},{},{},
                        {
                            style: 'Ques',
                            margin: [0, -2, 0, 0],
                            table: {
                                body: [
                                    [
                                    {text: "20.OUTSIDE LAB?", colSpan:4},{},{}, {}    
                                    ],
                                    [
                                        {image: 'checkboxImage', fit: [10, 10], margin:[8,-2,0,0]},  
                                        {text:"YES", margin:[-3,-2,0,0]},
                                        {image: 'checkboxImage', fit: [10, 10], margin:[3,-2,0,0]},
                                        {text:"NO", margin:[-5,-2,0,0]}  
                                    ]
                                ]
                            },layout: 'noBorders'
                        }, 
                        {
                            style: 'Ques',
                            margin: [0, -2, 0, 0],
                            table: {
                                widths:[75, 35],
                                body: [
                                    [
                                        {text: "$ CHARGES", colSpan:2, alignment: "center"}, {}    
                                    ],
                                    [
                                        {text: "|", alignment:"right"}, {}    
                                    ]
                                ]
                            },layout: 'noBorders'
                            
                        },
                    ],
                    [
                        {text: "21.DIAGNOSIS OR NATURE OF ILLNESS OR INJURY Relate A-L to service line below(24E)\tICD Ind.|\t\t|", colSpan: 4, rowSpan:2}, {},{},{},
                        {text: "22.RESUBMISSION\n.\tCODE", heights: 20},
                        {text: "ORIGINAL REF.NO.", heights: 20, margin:[15,0,0,0]},
                    ],
                    [
                        {},{}, {}, {},
                        {text: "23.PRIOR AUTHORIZATION NUMBER", colSpan:2},
                        {},
                    ],
                ],
			}
		},
		{
            style: 'Ques',
            margin: [0, -1, 0, 0],
			table: {
			    widths: [12, 12, 15, 12, 12, 15, 25, 11, 41, 13 ,13 ,13 ,13 , 32, 28, 14, 20, 12, 14, 84],
			    heights: [0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
                body: getCPTBlock(claimData)
			}
		},
		{
            style: 'Ques',
            margin: [0, -1, 0, 0],
			table: {
			    widths:[155,95, 88, 68, 68, 63],
			    heights: [0, 40],
                body: [
                    [
                        {
                            style: 'Ques',
                            margin: [0, -3, 0, 0],
                            table: {
                                widths:[99, 13, 11],
                                body: [
                                    [
                                        {text:"25.FEDERAL TAX I.D. NUMBER", rowSpan:2}, 
                                        {text:"SSN"},
                                        {text:"EIN"}
                                    ],
                                    [
                                        {}, 
                                        {image: 'checkboxImage', fit: [10, 10], margin:[0,-2,0,0]},
                                        {image: 'checkboxImage', fit: [10, 10], margin:[0,-2,0,0]}
                                    ]
                                ]
                            }, layout: 'noBorders',
                        },
                        {text:"26.PATIENT'S ACCOUNT NO"},
                        {
                            style: 'Ques',
                            margin: [0, -2, 0, 0],
                            table: {
                                widths:[20,20, 13, 11],
                                body: [
                                    [
                                        {text:"27.ACCEPT ASSIGNMENT?", colSpan:4}, 
                                        {},{}, {}
                                    ],
                                    [
                                        {text:"(For govt, claims, see back)", colSpan:4, alignment:"center", margin:[0,-7,0,0]}, 
                                        {},{}, {}
                                    ],
                                    [
                                        {image: 'checkboxImage', fit: [10, 10], margin:[0,-4,0,0]}, 
                                        {text:"YES", margin:[-15,-2,0,0]},
                                        {image: 'checkboxImage', fit: [10, 10], margin:[-8,-4,0,0]},
                                        {text:"NO", margin:[-15,-2,0,0]}
                                    ]
                                ]
                            }, layout: 'noBorders',
                        },
                        {
                            style: 'Ques',
                            margin: [0, -2, 0, 0],
                            table: {
                                widths:[45, 10],
                                body: [
                                    [
                                        {text:"28.TOTAL CHARGE ", colSpan:2}, 
                                        {}
                                    ],
                                    [
                                        {text:"$", margin:[5,0,0,0]},
                                        {text:"|"}
                                    ]
                                ]
                            }, layout: 'noBorders',
                        },
                        {
                            style: 'Ques',
                            margin: [0, -2, 0, 0],
                            table: {
                                widths:[45, 10],
                                body: [
                                    [
                                        {text:"29.AMOUNT PAID", colSpan:2}, 
                                        {}
                                    ],
                                    [
                                        {text:"$", margin:[5,0,0,0]},
                                        {text:"|"}
                                    ]
                                ]
                            }, layout: 'noBorders',
                        },
                        {
                            style: 'Ques',
                            margin: [0, -2, 0, 0],
                            table: {
                                widths:[40, 25],
                                body: [
                                    [
                                        {text:"30.Rsvd for NUCC Use", colSpan:2}, 
                                        {}
                                    ],
                                    [
                                        {text:"$", margin:[5,0,0,0]},
                                        {text:"|"}
                                    ]
                                ]
                            }, layout: 'noBorders',
                        }
                    ],
                    [
                        {
                            style: 'Ques',
                            margin: [0, -2, 0, 0],
                            table: {
                                widths:[110, 21],
                                body: [
                                    [
                                        {text:"31. SIGNATURE OF PHYSICIAN OR SUPPLIER", colSpan:2}, 
                                        {}
                                    ],
                                    [
                                        {text:"INCLUDING DEGRESS OR CblackENTIALS", colSpan:2, margin:[10, -5,0,0]}, 
                                        {}
                                    ],
                                    [
                                        {text:"(I certify that the statements on the reverse\napply to this bill and are made a part thereof.)", fontSize:6, colSpan:2, margin:[10, -5,0,0]}, 
                                        {}
                                    ]
                                ]
                            }, layout: 'noBorders', border: [true, true, true, false]
                        }, 
                        {text:"32. SERVICE FACILITY LOCATION INFORMATION", colSpan:2},{},
                        {text: "33. BILLING PROVIDER INFO & PH #\t\t (\t\t\t)", colSpan:3},{},{},
                    ],
                    [
                        {
                            style: 'Ques',
                            margin: [0, -2, 0, 0],
                            table: {
                                widths:[100, 21],
                                body: [
                                    [
                                        {text:"SIGNED"}, 
                                        {text:"DATE"}
                                    ],
                                ]
                            }, layout: 'noBorders', border: [true, true, false, true]
                        }, 
                        {text:"a."},{text:"b.", fillColor: '#808080'},
                        {text:"a."},{text:"b.", fillColor: '#808080', colSpan:2},{}
                    ]
                ],
			}
		},
		{
            style: 'Ques',
            table: {
                widths:[220, 105, 45, 200],
                body: [
                    [
						{text:"NUCC Instruction Manual available at www.nucc.org",fontSize: 9},
                        {text:"PLEASE PRINT OR TYPE",fontSize: 9, bold:"true", italics: true},
                        {text:"CR061653",fontSize: 9},
                        {text:"APPROVED OMB-0938-1197 FORM 1500 (02-12)",fontSize: 9}
					]
				]
			}, layout: 'noBorders'
		},
		{
            style: 'Ques',
            margin: [5, -303, 0, 0],
            table: {
                widths:[90, 90, 90, 90],
                body: [
                    [
                        {text:"A. |__________________"},  
                        {text:"B. |__________________"},
                        {text:"C. |__________________"},
                        {text:"D. |__________________"}
                    ],
                    [
                        {text:"E. |__________________", margin:[0, -1, 0, 0]},
                        {text:"F. |__________________", margin:[0, -1, 0, 0]},
                        {text:"G. |__________________", margin:[0, -1, 0, 0]},
                        {text:"H. |__________________", margin:[0, -1, 0, 0]}
                    ],
                    [
                        {text:"I.  |__________________", margin:[0, -1, 0, 0]},  
                        {text:"J. |__________________", margin:[0, -1, 0, 0]},
                        {text:"K. |__________________", margin:[0, -1, 0, 0]},
                        {text:"L. |__________________", margin:[0, -1, 0, 0]}
                    ],
                ]
            },layout: 'noBorders', colSpan:4
        },
        {
            style: 'Ques',
            margin: [370, -86, 0, 0],
            table: {
                widths:[25, 20, 12, 20, 11, 25, 25, 15],
                body: [
                    [
                        {text: "FROM", alignment: "right", margin:[3, 0, 0, 0]},
                        {text: "MM  |", alignment: "center", margin: [-10, -5, 0, 0]},
                        {text: "DD    |", alignment: "center", margin: [-13, -5, 0, 0]},
                        {text: "YY", alignment: "center", margin: [-5, -5, 0, 0]},
                        {text: "To", alignment: "right", margin: [3, -5, 0, 0]},
                        {text: "MM  |", alignment: "center", margin: [-5, -5, 0, 0]},
                        {text: "DD   |", alignment: "center", margin: [-28, -5, 0, 0]},
                        {text: "YY", alignment: "center", margin: [-32, -5, 0, 0]},
                        ]
                                
                ]
            },layout: 'noBorders'
        },
        {
            style: 'Ques',
            margin: [220, -203, 0, 0],
            table: {
                widths:[40, 15, 25, 55],
                body: [
                    [
                        {text:"a.EMPLOYEMENT? (Current or Previous)",colSpan:4},  
                        {},{},{}
                    ],
                    [
                        {image: 'checkboxImage', fit: [10, 10], alignmnet:"right", margin:[35,0,0,0]},
                        {text:"YES", alignmnet:"center"},
                        {image: 'checkboxImage', fit: [10, 10], alignmnet:"right", margin:[10,0,0,0]},
                        {text:"NO", alignmnet:"center", margin:[-10,0,0,0]}
                    ],
                    [
                        {text:"b.AUTO ACCIDENT?",colSpan:3},  
                        {},{},{text:"PLACE(State)", margin:[-5,0,0,0]}
                    ],
                    [
                        {image: 'checkboxImage', fit: [10, 10], alignmnet:"right", margin:[35,0,0,0]},
                        {text:"YES", alignmnet:"center"},
                        {image: 'checkboxImage', fit: [10, 10], alignmnet:"right", margin:[10,0,0,0]},
                        {text:"NO\t|______|", alignmnet:"center", margin:[-10,0,0,0]}
                    ],
                    [
                        {text:"c. OTHER ACCIDENT",colSpan:4},  
                        {},{},{}
                    ],
                    [
                        {image: 'checkboxImage', fit: [10, 10], alignmnet:"right", margin:[35,0,0,0]},
                        {text:"YES", alignmnet:"center"},
                        {image: 'checkboxImage', fit: [10, 10], alignmnet:"right", margin:[10,0,0,0]},
                        {text:"NO", alignmnet:"center", margin:[-10,0,0,0]}
                    ],
                ]
            },layout: 'noBorders', colSpan:4
        },
		{//Ans
            style: 'Ans',
			table: {
			    widths: [98, 70, 20, 150, 109, 70, 20],
			    heights:[0, 6, 20, 20, 20, 24, 21, 22, 20, 38, 31, 21, 18, 21, 100],
				body: [
                    [
                        {
                            style: 'Ans',
                            margin: [-15, -40, 0, 0],
                            table: {
                                widths: [45, 43, 58, 45, 53, 39, 40],
                                body: [
                                    [
                                        { image: getImage(claimData.subscriber && claimData.subscriber[0].claimFilingCode && claimData.subscriber[0].claimFilingCode.toString().toUpperCase() === 'MB'), fit: [8, 8]},
                                        { image: getImage(claimData.subscriber && claimData.subscriber[0].claimFilingCode && claimData.subscriber[0].claimFilingCode.toString().toUpperCase() === 'MC'), fit: [8, 8]},
                                        { image: getImage(claimData.subscriber && claimData.subscriber[0].claimFilingCode !== 'MB' && claimData.subscriber[0].claimFilingCode !== 'MC' && claimData.subscriber[0].claimFilingCode !== 'CH' && claimData.subscriber[0].claimFilingCode === ""), fit: [8, 8]},
                                        { image: getImage(claimData.subscriber && claimData.subscriber[0].claimFilingCode && claimData.subscriber[0].claimFilingCode.toString().toUpperCase() === 'CH'), fit: [8, 8]},
                                        { image: getImage(''), fit: [8, 8]},
                                        { image: getImage(''), fit: [8, 8]},
                                        { image: getImage(claimData.subscriber && claimData.subscriber[0].claimFilingCode !== 'MB' && claimData.subscriber[0].claimFilingCode !== 'MC' && claimData.subscriber[0].claimFilingCode !== 'CH' && claimData.subscriber[0].claimFilingCode !== ""), fit: [8, 8]},
                                    ],
                                ],
                            },layout: 'noBorders',colSpan:4,
                        },{},{},{},
                        {
                            text: claimData.subscriber ? getKeyTrimValue(claimData.subscriber[0], 'policyNo', 30) : '', margin:[40, -40, 0, 0], colSpan:3
                        }, {},{}
                    ],
                    [//Patient
                        {text: claimData.subscriber ? getName(claimData.subscriber[0], 28) : '', margin:[0, -15, 0, 0],colSpan:3},
                        {},{},
                        {
                            style: 'Ques',
                            margin:[-4, -5, 0, 0],
                            table: {
                                widths:[80, 40],
                                body: [
                                    [
                                        {text: claimData.subscriber && claimData.subscriber[0].patient ? (getMonth(claimData.subscriber[0].patient[0].dob) + '\t\t' + getDate(claimData.subscriber[0].patient[0].dob) + '\t' + getYear(claimData.subscriber[0].patient[0].dob, false)) : '', margin:[0, -9, 0, 0], fontSize: 9},
                                        {
                                            style: 'Ques',
                                            margin:[0, -18, 0, 0],
                                            table: {
                                                widths:[23, 25],
                                                body: [
                                                    [
                                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].gender && claimData.subscriber[0].patient[0].gender === 'M'), fit: [8, 8]},
                                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].gender && claimData.subscriber[0].patient[0].gender === 'F'), fit: [8, 8]},
                                                    ],
                                                ],
                                            },layout: 'noBorders'
                                        }
                                    ]
                                ]
                            },layout: 'noBorders'
                        },
                        {text: claimData.subscriber ? getSubstring(claimData.subscriber[0].firstName, 30) : '', margin:[0, -15, 0, 0], colSpan:3},
                        {},{}
                    ],
                    [//Patient Address
                        {text: claimData.subscriber && claimData.subscriber[0].patient ? getSubstring(claimData.subscriber[0].patient[0].addressLine1, 28) : '', margin:[0, -4, 0, 0], colSpan:3},
                        {},{},
                        {
                            style: 'Ques',
                            table: {
                                body: [
                                    [
                                        {
                                            style: 'Ques',
                                            margin: [5, -2, 0, 0],
                                            table: {
                                                widths: [33, 26, 26, 0],
                                                body: [
                                                    [
                                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].relationship === 18), fit: [8, 8]},
                                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].relationship === 01), fit: [8, 8]},
                                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].relationship === 19), fit: [8, 8]},
                                                        {image: getImage(claimData.subscriber && (claimData.subscriber[0].relationship !== 18 && claimData.subscriber[0].relationship !== 01 && claimData.subscriber[0].relationship !== 19)), fit: [8, 8]},
                                                    ],
                                                ],
                                            },layout: 'noBorders'
                                        }
                                    ]
                                ]
                            },layout: 'noBorders'
                        },
                        {text: claimData.subscriber && claimData.subscriber[0].payer ? getKeyTrimValue(claimData.subscriber[0].payer, 'insuranceprovideraddressline1', 30) : '', margin:[0, -4, 0, 0], colSpan:3},
                        {},{}
                    ],
                    [//CITY
                        {text: claimData.subscriber && claimData.subscriber[0].patient ? getKeyTrimValue(claimData.subscriber[0].patient[0], 'city', 25) : '', colSpan:2},
                        {},
                        {text: claimData.subscriber && claimData.subscriber[0].patient ? getKeyTrimValue(claimData.subscriber[0].patient[0], 'state', 3) : '',  margin:[-5, 0, 0, 0]},
                        {},
                        {text: claimData.subscriber && claimData.subscriber[0].payer ? getKeyTrimValue(claimData.subscriber[0].payer, 'payerCity', 23) : '', colSpan:2},
                        {},
                        {text: claimData.subscriber && claimData.subscriber[0].payer ? getKeyTrimValue(claimData.subscriber[0].payer, 'payerState', 6)  : '',  margin:[-18, 0, 0, 0]}
                    ],
                    [//Telephone
                        {text: claimData.subscriber && claimData.subscriber[0].patient ? getKeyTrimValue(claimData.subscriber[0].patient[0], 'zipCode', 13) : ''},
                        {text: claimData.subscriber && claimData.subscriber[0].patient ? getTrimmedPhoneNo(getKeyTrimValue(claimData.subscriber[0].patient[0], 'homePhone', 13)) : '', colSpan:2},
                        {},{}, 
                        {text: claimData.subscriber && claimData.subscriber[0].payer ? getKeyTrimValue(claimData.subscriber[0].payer, 'payerZIPCode', 12) : ''},
                        {text: claimData.subscriber && claimData.subscriber[0].payer ? getTrimmedPhoneNo(getKeyTrimValue(claimData.subscriber[0].payer, 'phoneNo', 13)) : '', colSpan:2, margin:[-28, 0,0,0]},
                        {}
                    ],
                    [//Other Insurance
                        {text: claimData.subscriber && claimData.subscriber[0].claim  && claimData.subscriber[0].claim[0].otherSubscriber ? getName(claimData.subscriber[0].claim[0].otherSubscriber[0], 28) : '',colSpan:3},
                        {},{},{},
                        {text: claimData.subscriber && claimData.subscriber[0].claim ? getOtherSubscriberValue(claimData.subscriber[0].claim[0], 'planType', 28) : '', colSpan:3},
                        {},{}
                    ],
                    [//Group Number
                        {text: claimData.subscriber && claimData.subscriber[0].claim ? getOtherSubscriberValue(claimData.subscriber[0].claim[0], 'policyNo', 28) : '', colSpan:3},
                        {},{},
                        {
                            style: 'Ans',
                            margin: [28,-4,0,0],
                            table: {
                                widths:[38, 25],
                                body: [
                                    [
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode1.toString() && claimData.subscriber[0].claim[0].relatedCauseCode1.toString().toUpperCase() === "TRUE"), fit: [8, 8]},
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode1.toString() && claimData.subscriber[0].claim[0].relatedCauseCode1.toString().toUpperCase() === "FALSE"), fit: [8, 8]}
                                    ]
                                ]
                            },layout: 'noBorders'
                        },
                        {
                           style: 'Ans',
                            margin: [8,-2,0,0],
                            table: {
                                widths:[12, 12, 68, 50, 25],
                                body: [
                                    [
                                        {text: claimData.subscriber && claimData.subscriber[0].dob ? getMonth(claimData.subscriber[0].dob) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].dob ? getDate(claimData.subscriber[0].dob) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].dob ? getYear(claimData.subscriber[0].dob, false) : ''},
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].gender === 'M'), fit: [8, 8], margin: [-11,-3,0,0]},
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].gender === 'F'), fit: [8, 8], margin: [-10,-3,0,0]}
                                    ]
                                ]
                            },layout: 'noBorders'
                            , colSpan:3
                            
                        }, {},{}
                    ],
                    [//Auto Accident
                        {text:"", colSpan:3},{},{},
                        {
                            style: 'Ans',
                            margin: [28,-4,0,0],
                            table: {
                                widths:[38, 25],
                                body: [
                                    [
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode3.toString() && claimData.subscriber[0].claim[0].relatedCauseCode3.toString().toUpperCase() === 'TRUE'), fit: [8, 8]},
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode3.toString() && claimData.subscriber[0].claim[0].relatedCauseCode3.toString().toUpperCase() === 'FALSE'), fit: [8, 8]}
                                    ]
                                ]
                            },layout: 'noBorders'
                        },
                        {text:"", colSpan:3}, {},{}
                    ], 
                    [//Other Accident
                        {text:"", colSpan:3},{},{},
                        {
                            style: 'Ans',
                            margin: [28,-4,0,0],
                            table: {
                                widths:[38, 25],
                                body: [
                                    [
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode2.toString() && claimData.subscriber[0].claim[0].relatedCauseCode2.toString().toUpperCase() === 'TRUE'), fit: [8, 8]},
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode2.toString() && claimData.subscriber[0].claim[0].relatedCauseCode2.toString().toUpperCase() === 'FALSE'), fit: [8, 8]}
                                    ]
                                ]
                            },layout: 'noBorders'
                        },
                        {text: claimData.subscriber ? getKeyTrimValue(claimData.subscriber[0], 'planName', 30) : '', colSpan:3},
                        {},{}
                    ], 
                    [//PLAN & ICD
                        { text: claimData.subscriber && claimData.subscriber[0].claim ? getOtherPayerValue(claimData.subscriber[0].claim[0], 'name', 28) : '', colSpan:3},
                        {},{},
                        {text:""},
                        {
                            style: 'Ans',
                            margin: [-5,0,0,0],
                            table: {
                                widths:[25, 25],
                                body: [
                                    [
                                        { image: getImage(claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].OtherPayer && claimData.subscriber[0].claim[0].OtherPayer[0].name && claimData.subscriber[0].claim[0].OtherPayer[0].name.toString().length > 0), fit: [8, 8]},
                                        { image: getImage(claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].OtherPayer && claimData.subscriber[0].claim[0].OtherPayer[0].name && claimData.subscriber[0].claim[0].OtherPayer[0].name.toString().length === 0), fit: [8, 8]}
                                    ]
                                ]
                            },layout: 'noBorders', colSpan:3
                        }, {},{}
                    ],
                    [
                        {text:"SIGNATURE ON FILE", colSpan:3, margin:[10, 0, 0, 0]},{},{},
                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].claimDt ? (getMonth(new Date(claimData.subscriber[0].claim[0].claimDt)) + " " + getDate(new Date(claimData.subscriber[0].claim[0].claimDt)) + " " + getYear(new Date(claimData.subscriber[0].claim[0].claimDt), false) ) : '', margin:[20, 0, 0, 0]},
                        {text:"SIGNATURE ON FILE", colSpan:3, margin:[20, 0, 0, 0]}, {},{}
                    ],
                    [//REF
                        {
                           style: 'Ans',
                            margin: [-5,-2,0,0],
                            table: {
                                widths:[18, 12, 55, 40],
                                body: [
                                    [
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].illnessDate ? getMonth(new Date(claimData.subscriber[0].claim[0].illnessDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].illnessDate ? getDate(new Date(claimData.subscriber[0].claim[0].illnessDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].illnessDate ? getYear(new Date(claimData.subscriber[0].claim[0].illnessDate), false) : ''},
                                        { text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].illnessDate ? getDateQual(claimData.subscriber[0].claim[0].illnessDate, 431) : '', margin:[0,-5,0,0]},
                                    ]
                                ]
                            },layout: 'noBorders', colSpan:3 
                        },{},{},
                        {
                           style: 'Ans',
                            margin: [-13,-2,0,0],
                            table: {
                                widths:[55, 18, 15, 55],
                                body: [
                                    [
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].sameIllnessFirstDate ? getDateQual(claimData.subscriber[0].claim[0].sameIllnessFirstDate, 454) : '', margin:[10, -4,0,0]},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].sameIllnessFirstDate ? getMonth(new Date(claimData.subscriber[0].claim[0].sameIllnessFirstDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].sameIllnessFirstDate ? getDate(new Date(claimData.subscriber[0].claim[0].sameIllnessFirstDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].sameIllnessFirstDate ? getYear(new Date(claimData.subscriber[0].claim[0].sameIllnessFirstDate), false) : ''},
                                    ]
                                ]
                            },layout: 'noBorders' 
                        },
                        {
                            style: 'Ans',
                            margin: [15,-2,0,0],
                            table: {
                                widths:[12, 20, 45, 12, 15, 35 ],
                                body: [
                                    [
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkFromDate ? getMonth(new Date(claimData.subscriber[0].claim[0].unableToWorkFromDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkFromDate ? getDate(new Date(claimData.subscriber[0].claim[0].unableToWorkFromDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkFromDate ? getYear(new Date(claimData.subscriber[0].claim[0].unableToWorkFromDate), false) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkToDate ? getMonth(new Date(claimData.subscriber[0].claim[0].unableToWorkToDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkToDate ? getDate(new Date(claimData.subscriber[0].claim[0].unableToWorkToDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkToDate ? getYear(new Date(claimData.subscriber[0].claim[0].unableToWorkToDate), false) : ''},
                                    ]
                                ]
                            },layout: 'noBorders' , colSpan:3
                        }, {},{}
                    ],
                    [//ADDitional
                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].referringProvider ? getName(claimData.subscriber[0].claim[0].referringProvider[0], 26) : '', colSpan:3},
                        {},{},
                        {
                           style: 'Ans',
                            margin: [-13,-2,0,0],
                            table: {
                                widths:[40, 70 ],
                                body: [
                                    [
                                        {text:"NPI", margin:[4,0,0,0]},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].referringProvider ? getKeyTrimValue(claimData.subscriber[0].claim[0].referringProvider[0], 'NPINO', 17) : ''},
                                    ]
                                ]
                            },layout: 'noBorders' 
                        },
                        {
                            style: 'Ans',
                            margin: [15,-2,0,0],
                            table: {
                                widths:[12, 20, 45, 12, 15, 35],
                                body: [
                                    [
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationFromDate ? getMonth(new Date(claimData.subscriber[0].claim[0].hospitailizationFromDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationFromDate ? getDate(new Date(claimData.subscriber[0].claim[0].hospitailizationFromDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationFromDate ? getYear(new Date(claimData.subscriber[0].claim[0].hospitailizationFromDate), false) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationToDate ? getMonth(new Date(claimData.subscriber[0].claim[0].hospitailizationToDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationToDate ? getDate(new Date(claimData.subscriber[0].claim[0].hospitailizationToDate)) : ''},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationToDate ? getYear(new Date(claimData.subscriber[0].claim[0].hospitailizationToDate), false) : ''},
                                    ]
                                ]
                            },layout: 'noBorders' , colSpan:3
                        }, {},{}
                    ],
                    [
                        {text:"", colSpan:4},{},{},{},
                        {
                            style: 'Ans',
                            margin: [-8,0,0,0],
                            table: {
                                widths:[ 30, 35, 60, 45 ],
                                body: [
                                    [
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].outSideLab.toString() && claimData.subscriber[0].claim[0].outSideLab.toString().toUpperCase() === "TRUE"), fit: [8, 8]},
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].outSideLab.toString() && claimData.subscriber[0].claim[0].outSideLab.toString().toUpperCase() === "FALSE"), fit: [8, 8]},
                                        { text:"", alignment:"center"},
                                        { text:"" , alignment:"center"}
                                    ]
                                ]
                            },layout: 'noBorders' , colSpan:3
                        }, {},{}
                    ],
                    [
                        {
                            style: 'Ans',
                            margin: [-35,-1,0,0],
                            alignment:"center",
                            table: {
                                widths:[ 110, 78, 95, 70 ],
                                body: getICDBlock(claimData)
                            },layout: 'noBorders' , colSpan:4
                        },{},{},{},
                        {
                            style: 'Ans',
                            margin: [-4,3,0,0],
                            table: {
                                widths:[ 85, 75 ],
                                body: [
                                    [
                                        {text: claimData.subscriber && claimData.subscriber[0].claim ? getResubmissionCode(claimData.subscriber[0].claim[0], 'claimFrequencyCode') : '', alignment:"center"},
                                        {text: claimData.subscriber && claimData.subscriber[0].claim ? getKeyTrimValue(claimData.subscriber[0].claim[0], 'originalReference', 18) : '', alignment:"center"}
                                    ],
                                    [
                                        {text: claimData.subscriber && claimData.subscriber[0].claim ? getKeyTrimValue(claimData.subscriber[0].claim[0], 'authorizationNo', 30) : '', alignment:"center", colSpan:2, margin:[0, 7, 0, 0]},
                                        {}
                                    ]
                                ]
                            },layout: 'noBorders' , colSpan:3
                        }, {},{}
                    ],
                    [
                        {
                            style: 'Ans',
                            margin: [-62,-113,0,0],
                            alignment:"center",
                            table: {
                                widths:[ 110, 78, 95, 70 ],
                                body: [
                                    [//ICD 10/9
                                        {},{},{},{text: getICDCodeType(claimData), margin:[0,0,0,0]}
                                    ],
                                ]
                            },layout: 'noBorders' , colSpan:7
                            
                        },{},{},{},{}, {},{}
                    ],
                ],
			},layout: 'noBorders',
		},
		{
            style: 'Ans',
            margin: [15,113,0,0],
            table: {
                widths:[ 160, 85, 85, 85, 85, 85 ],
                heights:[18],
                body: [
                    [
                        {
                            style: 'Ans',
                            margin: [0,-6,0,0],
                            table: {
                                widths:[ 90, 14, 14],
                                body: [
                                    [
                                        {text: claimData.billingProvider ? getKeyTrimValue(claimData.billingProvider, 'federalTaxID', 16) : '' },
                                        {image: getImage(''), fit: [8, 8]},
                                        {image: getImage('tickImage'), fit: [8, 8]},
                                        
                                    ]
                                ]
                            },layout: 'noBorders'
                        }, 
                        {text: claimData.subscriber && claimData.subscriber[0].claim ? getKeyTrimValue(claimData.subscriber[0].claim[0], 'claimNumber', 14) : '' },
                        {
                            style: 'Ans',
                            margin: [-2,-2,0,0],
                            table: {
                                widths:[ 40, 14],
                                body: [
                                    [
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].acceptAssignment && claimData.subscriber[0].acceptAssignment.toString().toUpperCase() === 'TRUE'), fit: [8, 8]},
                                        {image: getImage(claimData.subscriber && claimData.subscriber[0].acceptAssignment.toString() && claimData.subscriber[0].acceptAssignment.toString().toUpperCase() === 'FALSE'), fit: [8, 8]}
                                    ]
                                ]
                            },layout: 'noBorders'
                        },
                        {
                            style: 'Ans',
                            margin: [12,-5,0,0],
                            table: {
                                widths:[ 37, 14],
                                body: [
                                    [
                                        { text: getDecimalNumericValue(totalBillFee) },
                                        { text: getDecimalPointsValue(totalBillFee) },
                                    ]
                                ]
                            },layout: 'noBorders'
                        },
                        {
                            style: 'Ans',
                            margin: [0,-5,0,0],
                            table: {
                                widths:[ 33, 14],
                                body: [
                                    [
                                        { text: getDecimalNumericValue(totalPaid) },
                                        { text: getDecimalPointsValue(totalPaid) },
                                    ]
                                ]
                            },layout: 'noBorders'
                        }, {}
                    ],
                    [
                        {text:  (claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].renderingProvider ? getName(claimData.subscriber[0].claim[0].renderingProvider[0], 17) : '.') + '\t\t\t\t\t' +
                                (claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].claimDt ? (getMonth(new Date(claimData.subscriber[0].claim[0].claimDt)) + " " + 
                                getDate(new Date(claimData.subscriber[0].claim[0].claimDt)) + " " + getYear(new Date(claimData.subscriber[0].claim[0].claimDt), false) ) : '') , margin:[0, 26, 0, 0]},
                        {
                            style: 'Ans',
                            margin: [0,0,0,0],
                            table: {
                                widths:[ 130],
                                body: [
                                    [
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].servicefacility ? getKeyTrimValue(claimData.subscriber[0].claim[0].servicefacility[0], 'lastName', 26) : ' '}
                                    ],
                                    [
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].servicefacility ? getKeyTrimValue(claimData.subscriber[0].claim[0].servicefacility[0], 'addressLine1', 26) : ' ', margin: [0,-5, 0, 0]}
                                    ], 
                                    [
                                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].servicefacility ? getCityStatePincode(claimData.subscriber[0].claim[0].servicefacility[0], "city", "state", "zip", 26) : ' ', margin: [0,-5, 0, 0]}
                                    ], 
                                    [
                                        {text: ' ', margin: [0,-5, 0, 0]}
                                    ], 
                                ]
                            },layout: 'noBorders'
                            , colSpan:2
                        },{},
                        {
                            style: 'Ans',
                            margin: [15,0,0,0],
                            table: {
                                widths:[ 130],
                                body: [
                                    [
                                        {text: (claimData.billingProvider ? getKeyTrimValue(claimData.billingProvider, 'lastName', 30)  : ' ')}
                                    ],
                                    [
                                        {text: claimData.billingProvider ? getKeyTrimValue(claimData.billingProvider, 'addressLine1', 30) : ' ', margin: [0,-5, 0, 0]}
                                    ], 
                                    [
                                        {text: claimData.billingProvider ? getCityStatePincode(claimData.billingProvider, "city", "state", "zipCode", 30) : ' ', margin: [0,-5, 0, 0]}
                                    ], 
                                    [
                                        {text: ' ', margin: [0,-5, 0, 0]}
                                    ], 
                                ]
                            },layout: 'noBorders'
                        },
                        { text: claimData.billingProvider ? getTrimmedPhoneNo(getKeyTrimValue(claimData.billingProvider, 'phoneNo', 13)) : '', margin:[31,-6, 0 ,0], colSpan:2},
                        {}
                    ],
                    [//a. & b. NPI
                        {
                            style: 'Ans',
                            margin: [20,-2,0,0],
                            table: {
                                widths:[87, 50],
                                body: [
                                    [
                                        {text: ""},  
                                        {text: ""},
                                    ],
                                ]
                            },layout: 'noBorders'
                        },
                        {text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].servicefacility ? getKeyTrimValue(claimData.subscriber[0].claim[0].servicefacility[0], 'NPINO', 10) : '', margin:[0,-2, 0 ,0]},
                        {text:"", margin:[5, -2,0,0]},
                        {text: claimData.billingProvider && claimData.billingProvider.npiNo ? getKeyTrimValue(claimData.billingProvider, 'npiNo', 10) : '', margin:[10,-2, 0 ,0]},
                        { text: claimData.billingProvider && claimData.billingProvider.legacyID ? getKeyTrimValue(claimData.billingProvider, 'legacyID', 14) : '', margin:[7,-2, 0 ,0], colSpan:2},
                        {}

                    ]
                ]
                
            },layout: 'noBorders'
		},
		{
            style: 'Ques',
            margin: [-8, -228, 0, 0],
            fontSize: 12,
            bold:"true",
            table: {
                heights:[20, 20, 20, 20, 20,20],
                body:[
                    [{text:"1"}],
                    [{text:"2"}],
                    [{text:"3"}],
                    [{text:"4"}],
                    [{text:"5"}],
                    [{text:"6"}],
                ]
            },layout: 'noBorders'
		},
    ]
}



function mergeData(claim) {
    var blocks = formatSingleClaim(claim);
    
    if(typeof mailMerge === 'undefined') {
        return blocks;
    }
    
    for(var i = 0; i< blocks.length; i++) {
        blocks[i] = mailMerge.mergeData(blocks[i], claim);
    }
    
    
    return blocks;
}

function claimTable(claims) {
    var blocks = [];

    claims.forEach(function (claim, index) {
        totalBillFee = 0;
        start = 0;
        if (claim && claim.data[0].subscriber && claim.data[0].subscriber[0].claim && claim.data[0].subscriber[0].claim[0].serviceLine &&
            claim.data[0].subscriber[0].claim[0].serviceLine.length > 6 && claim.data[0].subscriber[0].claim[0].serviceLine.length < 13) {
            for (let i = 0; i < 2; i++) {
                pageBrk = 'after';
                if (i === 1) {
                    pageBrk = 'none';
                    start = 6;
                    end = 12;
                }
                blocks = blocks.concat(mergeData(claim.data[0]));
                if (index < claims.length - 1) {
                    blocks.push({ text: '', pageBreak: 'after' });
                }
            }

        } else if (claim && claim.data[0].subscriber && claim.data[0].subscriber[0].claim && claim.data[0].subscriber[0].claim[0].serviceLine &&
            claim.data[0].subscriber[0].claim[0].serviceLine.length > 12 && claim.data[0].subscriber[0].claim[0].serviceLine.length < 16) {
            for (let i = 0; i <= 2; i++) {
                pageBrk = 'after';
                if (i === 1) {
                    start = 6;
                    end = 12;
                }
                if (i === 2) {
                    pageBrk = 'none';
                    start = 12;
                    end = 18;
                }
                blocks = blocks.concat(mergeData(claim.data[0]));
                if (index < claims.length - 1) {
                    blocks.push({ text: '', pageBreak: 'after' });
                }
            }

        } else {
            blocks = blocks.concat(mergeData(claim.data[0]));
            if (index < claims.length - 1) {
                blocks.push({ text: '', pageBreak: 'after' });
            }
        }
    });
    
    return blocks;
}

var allBlocks = [];

if(typeof claimData !== 'undefined'){
    allBlocks = claimTable(claimData);
} else {
    allBlocks = claimTable([
        {data: [{}]},
        {data: [{}]}
        ]);
}

var dd = {
	content: allBlocks,
	styles: {
        TableHead: {
		    fontSize: 7,
		},
		Ques: {
		    fontSize: 6.5,
		    margin: [0, -3, 0, 0]
		},
		Ans: {
		    fontSize: 8,
		    bold: true,
		    margin: [17, -175, 0, 0]
		}
		
	},
	images: {
	    clearDot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
        tickImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAAMNJREFUOI3VzjEOgjAYhuGvH4mJE57A5C/pqIscQXad3byBq7fSSeMRXOAA3KGOLuDSEkWlMBn/pWnT92mBvxut9VREZn7PgXGqlCpI5iKyGQS4+AJgAoAkd72BVoyqqu5KqT0ARP5SkiSLOI5H1tpbKCa5Ksvy3PxARLYArlEU5VrrtEd88neUe70AMHdntq7rDABCcQOIyJLkEcDYI27tjBvAIRnJwxOCUPwCfEJC8RvQQhSAdVf8dYwx2hijB4c/mQeKAVWWFc2OCAAAAABJRU5ErkJggg==',
        checkboxImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhsAAABBdEVYdENvbW1lbnQAQ1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2ODApLCBxdWFsaXR5ID0gOTAKfVTa3QAAAENJREFUOE9jYGZm/m9gYPBfXV2dKAxSC9LDAGKQCkB6GECmkApAesjXqKGhAeUSD0B6RjXiAJRpJDseyU5y5CVy5v8A6/aIwdZjSaUAAAAASUVORK5CYII=",
        PICAImage:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAaCAYAAADMp76xAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhsAAABsSURBVFhH7ZjBCcAwDAPtjpUROl2m6TIZRk3A5O+HDAYdiLwEh/Arjo014om3D8DCHHZWTqW6N9e5BaDdwld4yyfyRau+13fhLkiYjYTZSJiNhNlImI2E2UiYzRV290TeaNX3dBJs9C/BxewHetywTTA4kc0AAAAASUVORK5CYII="
    },
	defaultStyle: {
		// alignment: 'justify'
	},
	pageSize: {
        width: 612,
        height: 792
    },
    pageOrientation: 'portrait',
    pageMargins: [ 12, 30, 0, 0 ]
	
}