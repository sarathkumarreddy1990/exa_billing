let totalBill = 0;
let pageBrk = 'none';
let cpt = [];
let start = 0, end = 6;
let payerDets = [];
function getTick(data, code, fromOthers) {
    if (fromOthers && data && data.subscriber && data.subscriber[0].claimFilingCode !== 'MB' && data.subscriber[0].claimFilingCode !== 'MC' &&
        data.subscriber[0].claimFilingCode !== 'CH' && data.subscriber[0].claimFilingCode !== "") {
        return '√';
    } else return '';
}

function getName(patientData) {
    if (patientData) return patientData.lastName + ', ' + patientData.firstName;
}

function getTableContents(claimData) {
    let cptRows = [];

    for (let i = start; i < end; i++) {
        if (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].serviceLine &&
            claimData.subscriber[0].claim[0].serviceLine[i] && claimData.subscriber[0].claim[0].serviceLine[i].examCpt) {
            totalBill += claimData.subscriber[0].claim[0].serviceLine[i].totalBillFee ? parseFloat(claimData.subscriber[0].claim[0].serviceLine[i].totalBillFee).toFixed(2) : 0.00;
            let claimDt = claimData.subscriber[0].claim[0].claimDt ? claimData.subscriber[0].claim[0].claimDt.toString() : '';
            cptRows.push([
                {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
                { text: claimData.subscriber[0].claimFilingCode ? (claimData.subscriber[0].claimFilingCode.toString().toUpperCase() === 'WC' ? 'OB' : '') : '' },
                {
                    text: claimData.subscriber[0].claimFilingCode && (claimData.subscriber[0].claimFilingCode.toString().toUpperCase() === 'WC') &&
                        claimData.subscriber[0].claim[0].renderingProvider && claimData.subscriber[0].claim[0].renderingProvider[0].licenseNo ? claimData.subscriber[0].claim[0].renderingProvider[0].licenseNo : ''
                }
            ],
                [
                    {
                        text: claimDt && new Date(claimDt) ?
                            (new Date(claimDt).getMonth() + 1).toString().substring(0, 2) : ''
                    },
                    {
                        text: claimDt && new Date(claimDt) ?
                            (new Date(claimDt).getDate()).toString().substring(0, 2) : ''
                    },
                    {
                        text: claimDt && new Date(claimDt) ?
                            (new Date(claimDt).getFullYear()).toString().substring(0, 2) : ''
                    },
                    {
                        text: claimDt && new Date(claimDt) ?
                            (new Date(claimDt).getMonth() + 1).toString().substring(0, 2) : ''
                    },
                    {
                        text: claimDt && new Date(claimDt) ?
                            (new Date(claimDt).getDate()).toString().substring(0, 2) : ''
                    },
                    {
                        text: claimDt && new Date(claimDt) ?
                            (new Date(claimDt).getFullYear()).toString().substring(0, 2) : ''
                    },
                    { text: claimData.subscriber[0].claim[0].POS ? claimData.subscriber[0].claim[0].POS.toString().substring(0, 3) : '' }, { text: '' },
                    { text: claimData.subscriber[0].claim[0].serviceLine[i].examCpt ? claimData.subscriber[0].claim[0].serviceLine[i].examCpt.toString().substring(0, 5) : '' },
                    { text: claimData.subscriber[0].claim[0].serviceLine[i].mod1 ? claimData.subscriber[0].claim[0].serviceLine[i].mod1.toString().substring(0, 2) : '' },
                    { text: claimData.subscriber[0].claim[0].serviceLine[i].mod2 ? claimData.subscriber[0].claim[0].serviceLine[i].mod2.toString().substring(0, 2) : '' },
                    { text: claimData.subscriber[0].claim[0].serviceLine[i].mod3 ? claimData.subscriber[0].claim[0].serviceLine[i].mod3.toString().substring(0, 2) : '' },
                    { text: claimData.subscriber[0].claim[0].serviceLine[i].mod4 ? claimData.subscriber[0].claim[0].serviceLine[i].mod4.toString().substring(0, 2) : '' },
                    // { text: '' },
                    // { text: '' },
                    // { text: '' },
                    // { text: '' },
                    {
                        text: ((claimData.subscriber[0].claim[0].serviceLine[i].pointer1 ? numToAlphabet(claimData.subscriber[0].claim[0].serviceLine[i].pointer1) : '') +
                            (claimData.subscriber[0].claim[0].serviceLine[i].pointer2 ? numToAlphabet(claimData.subscriber[0].claim[0].serviceLine[i].pointer2) : '') +
                            (claimData.subscriber[0].claim[0].serviceLine[i].pointer3 ? numToAlphabet(claimData.subscriber[0].claim[0].serviceLine[i].pointer3) : '') +
                            (claimData.subscriber[0].claim[0].serviceLine[i].pointer4 ? numToAlphabet(claimData.subscriber[0].claim[0].serviceLine[i].pointer4) : '')) ?
                            ((claimData.subscriber[0].claim[0].serviceLine[i].pointer1 ? numToAlphabet(claimData.subscriber[0].claim[0].serviceLine[i].pointer1) : '') +
                                (claimData.subscriber[0].claim[0].serviceLine[i].pointer2 ? numToAlphabet(claimData.subscriber[0].claim[0].serviceLine[i].pointer2) : '') +
                                (claimData.subscriber[0].claim[0].serviceLine[i].pointer3 ? numToAlphabet(claimData.subscriber[0].claim[0].serviceLine[i].pointer3) : '') +
                                (claimData.subscriber[0].claim[0].serviceLine[i].pointer4 ? numToAlphabet(claimData.subscriber[0].claim[0].serviceLine[i].pointer4) : '')).toString().substring(0, 4) : ''
                    },
                    {
                        text: claimData.subscriber[0].claim[0].serviceLine[i].totalBillFee && claimData.subscriber[0].claim[0].serviceLine[i].totalBillFee.split(".") &&
                            claimData.subscriber[0].claim[0].serviceLine[i].totalBillFee.split(".")[0] ? claimData.subscriber[0].claim[0].serviceLine[i].totalBillFee.split(".")[0].toString().substring(0, 8) : ''
                    },
                    {
                        text: claimData.subscriber[0].claim[0].serviceLine[i].totalBillFee && claimData.subscriber[0].claim[0].serviceLine[i].totalBillFee.split(".") &&
                            claimData.subscriber[0].claim[0].serviceLine[i].totalBillFee.split(".")[1] ? claimData.subscriber[0].claim[0].serviceLine[i].totalBillFee.split(".")[1].toString().substring(0, 2) : ''
                    },
                    { text: claimData.subscriber[0].claim[0].serviceLine[i].unit ? claimData.subscriber[0].claim[0].serviceLine[i].unit.toString().substring(0, 3) : '' }, {}, {},
                    {
                        text: claimData.subscriber[0].claim[0].renderingProvider && claimData.subscriber[0].claim[0].renderingProvider[0].NPINO ?
                            claimData.subscriber[0].claim[0].renderingProvider[0].NPINO.toString().substring(0, 12) : ''
                    }
                ]
            );
        } else {
            cptRows.push([
                {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
                { text: '' },
                { text: '' }
            ],
                [

                    { text: '' },
                    { text: '' },
                    { text: '' },
                    { text: '' },
                    { text: '' },
                    { text: '' },
                    { text: '' }, { text: '' },
                    { text: '' },
                    { text: '' },
                    { text: '' },
                    { text: '' },
                    { text: '' },
                    { text: '' },
                    { text: '' },
                    { text: '' },
                    { text: '' }, {}, {},
                    { text: '' }
                ]
            );
        }
    }

    return cptRows;

}

function numToAlphabet(index){    
    let char = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(parseInt(index)-1);
    return char;
}

function checkAndReturn(data, key) {
    if (data && key) return data.key ? data.key : '';
    else return '';
}

function getPayerDetails(claimData) {
    let details = [];
    if (claimData && claimData.subscriber && claimData.subscriber[0].payer && claimData.subscriber[0].payer.payerName) {
        console.log(claimData.subscriber[0].claimFilingCode + '' + claimData.subscriber[0].payer.payerName);
        if (claimData.subscriber[0].claimFilingCode && claimData.subscriber[0].claimFilingCode.toString().toUpperCase() !== 'AT') {
            details.push(
                [
                    { text: '', colSpan: 7 },
                    {}, {}, {}, {}, {}, {}, { text: claimData.subscriber[0].payer.payerName }
                ],
                [
                    { text: '', colSpan: 7 },
                    {}, {}, {}, {}, {}, {}, { text: claimData.subscriber[0].payer.insuranceprovideraddressline1 }
                ],
                [
                    { text: '', colSpan: 7 },
                    {}, {}, {}, {}, {}, {}, { text: claimData.subscriber[0].payer.payerCity + ' ' + claimData.subscriber[0].payer.payerState + ' ' + claimData.subscriber[0].payer.payerZIPCode + claimData.subscriber[0].payer.zipPlus }
                ]
            );
        } else {
            details.push(
                [
                    { text: '', colSpan: 7 },
                    {}, {}, {}, {}, {}, {}, { text: '' }
                ],
                [
                    { text: '', colSpan: 7 },
                    {}, {}, {}, {}, {}, {}, { text: '' }
                ],
                [
                    { text: '', colSpan: 7 },
                    {}, {}, {}, {}, {}, {}, { text: '' }
                ]
            );
        }

    } else {
        details.push(
            [
                { text: '', colSpan: 7 },
                {}, {}, {}, {}, {}, {}, { text: '' }
            ],
            [
                { text: '', colSpan: 7 },
                {}, {}, {}, {}, {}, {}, { text: '' }
            ],
            [
                { text: '', colSpan: 7 },
                {}, {}, {}, {}, {}, {}, { text: '' }
            ]
        );
    }
    return details;
}


function formatRedForm(claimData) {
    cpt = getTableContents(claimData);
    payerDets = getPayerDetails(claimData);
    return ([
        {
            style: 'myTable',
            margin: [0, 0, 0, 0],
            table: {
                widths: [44, 44, 58, 45, 52, 36, 41, 160],
                heights: [20, 0, 0, 21, 0],
                body: [
                    [
                        { text: (claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].originalReference) ? 'Corrected Claim' : '', fontSize: 12, colSpan: 8 },
                        {}, {}, {}, {}, {}, {}, {}
                    ],

                    payerDets[0],
                    payerDets[1],
                    payerDets[2],

                    [//Ans
                        { text: claimData.subscriber && claimData.subscriber[0].claimFilingCode && claimData.subscriber[0].claimFilingCode.toString().toUpperCase() === 'MB' ? '√' : '' },
                        { text: claimData.subscriber && claimData.subscriber[0].claimFilingCode && claimData.subscriber[0].claimFilingCode.toString().toUpperCase() === 'MC' ? '√' : '' },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claimFilingCode !== 'MB' && claimData.subscriber[0].claimFilingCode !== 'MC' &&
                                claimData.subscriber[0].claimFilingCode !== 'CH' && claimData.subscriber[0].claimFilingCode === "" ? '√' : ''
                        },
                        { text: claimData.subscriber && claimData.subscriber[0].claimFilingCode && claimData.subscriber[0].claimFilingCode.toString().toUpperCase() === 'CH' ? '√' : '' },
                        { text: '' },
                        { text: '' },
                        { text: getTick(claimData, '', true) },
                        { text: (claimData.subscriber && claimData.subscriber[0].policyNo) ? (claimData.subscriber[0].policyNo).toString().substring(0, 30) : '' }
                    ],
                ],
            }, layout: 'noBorders',
        },
        {
            style: 'myTable',
            margin: [5, 8, 0, 0],
            table: {
                widths: [157, 43, 90, 50, 170, 32],
                heights: [18, 22, 22, 22, 22, 22, 22, 20, 40, 28],
                body: [
                    [//Ans
                        { text: claimData.subscriber && claimData.subscriber[0].patient ? getName(claimData.subscriber[0].patient[0]).substring(0, 28) : '', colSpan: 2 },
                        {},
                        [
                            {
                                style: 'myTable',
                                margin: [5, 0, 0, 0],
                                table: {
                                    widths: [15, 15, 25],
                                    heights: [10],
                                    body: [
                                        [
                                            {
                                                text: claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].dob &&
                                                    new Date(claimData.subscriber[0].patient[0].dob) ? (new Date(claimData.subscriber[0].patient[0].dob.toString()).getMonth() + 1).toString().substring(0, 2) : ''
                                            },
                                            {
                                                text: claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].dob &&
                                                    new Date(claimData.subscriber[0].patient[0].dob) ? (new Date(claimData.subscriber[0].patient[0].dob.toString()).getDate()).toString().substring(0, 2) : ''
                                            },
                                            {
                                                text: claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].dob &&
                                                    new Date(claimData.subscriber[0].patient[0].dob) ? (new Date(claimData.subscriber[0].patient[0].dob.toString()).getFullYear()).toString().substring(0, 2) : ''
                                            },
                                        ],
                                    ],
                                }, layout: 'noBorders',
                            }
                        ],
                        [
                            {
                                style: 'myTable',
                                margin: [-12, 0, 0, 0],
                                table: {
                                    widths: [30, 30],
                                    heights: [10],
                                    body: [
                                        [
                                            { text: claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].gender === 'M' ? '√' : '' },
                                            { text: claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].gender === 'F' ? '√' : '' },
                                        ],
                                    ],
                                }, layout: 'noBorders',
                            }
                        ],
                        { text: claimData.subscriber && claimData.subscriber[0] ? getName(claimData.subscriber[0]).toString().substring(0, 30) : '' },
                        {}
                    ],
                    [//Ans-------#############
                        {
                            text: claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].addressLine1 ?
                                (claimData.subscriber[0].patient[0].addressLine1).toString().substring(0, 28) : '', colSpan: 2
                        },
                        {},
                        [
                            {
                                style: 'myTable',
                                margin: [15, 5, 0, 0],
                                table: {
                                    widths: [30, 26, 30, 27],
                                    heights: [10],
                                    body: [
                                        [
                                            { text: claimData.subscriber && claimData.subscriber[0].relationship === 18 ? '√' : '' },
                                            { text: claimData.subscriber && claimData.subscriber[0].relationship === 01 ? '√' : '' },
                                            { text: claimData.subscriber && claimData.subscriber[0].relationship === 19 ? '√' : '' },
                                            {
                                                text: (claimData.subscriber && (claimData.subscriber[0].relationship !== 18 && claimData.subscriber[0].relationship !== 01
                                                    && claimData.subscriber[0].relationship !== 19)) ? '√' : ''
                                            },
                                        ],
                                    ],
                                }, layout: 'noBorders',
                            }
                        ],
                        {},
                        { text: claimData.subscriber && claimData.subscriber[0].addressLine1 ? (claimData.subscriber[0].addressLine1).toString().substring(0, 30) : '' },
                        {}
                    ],
                    [
                        {
                            text: claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].city ?
                                (claimData.subscriber[0].patient[0].city).toString().substring(0, 25) : ''
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].state ?
                                (claimData.subscriber[0].patient[0].state).toString().substring(0, 3) : '', alignment: 'center'
                        },
                        {},
                        {},
                        { text: claimData.subscriber && claimData.subscriber[0].city ? (claimData.subscriber[0].city).toString().substring(0, 23) : '' },
                        { text: claimData.subscriber && claimData.subscriber[0].state ? (claimData.subscriber[0].state).toString().substring(0, 6) : '' }
                    ],
                    [//Ans
                        {
                            text: claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].zipCode ?
                                (claimData.subscriber[0].patient[0].zipCode).toString().substring(0, 13) : ''
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].patient && claimData.subscriber[0].patient[0].homePhone ?
                                (claimData.subscriber[0].patient[0].homePhone).toString().substring(0, 13) : '', margin: [-60, 5, 0, 0]
                        },
                        {},
                        {},
                        { text: claimData.subscriber && claimData.subscriber[0].zipCode ? (claimData.subscriber[0].zipCode).toString().substring(0, 12) : '' },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].payer && claimData.subscriber[0].payer.phoneNo ?
                                (claimData.subscriber[0].payer.phoneNo).toString().substring(0, 13) : '', margin: [-75, 5, 0, 0]
                        }
                    ],
                    [
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].otherSubscriber && claimData.subscriber[0].claim[0].otherSubscriber[0] ?
                                getName(claimData.subscriber[0].claim[0].otherSubscriber[0]).toString().substring(0, 28) : '', colSpan: 2
                        },
                        {},
                        { text: "", colSpan: 2 },
                        {},
                        { text: claimData.subscriber && claimData.subscriber[0].planType ? claimData.subscriber[0].planType.toString().substring(0, 30) : '' }, //.toString().substring(0, 30)
                        {}
                    ],
                    [//ANS
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].otherSubscriber &&
                                claimData.subscriber[0].claim[0].otherSubscriber[0].policyNo ?
                                (claimData.subscriber[0].claim[0].otherSubscriber[0].policyNo).toString().substring(0, 28) : '', colSpan: 2
                        }, {},
                        {
                            text: (claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode1.toString() &&
                                claimData.subscriber[0].claim[0].relatedCauseCode1.toString().toUpperCase() === "TRUE") ? '√' : '', alignment: 'center', margin: [-20, 0, 0, 0]
                        },
                        {
                            text: (claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode1.toString() &&
                                claimData.subscriber[0].claim[0].relatedCauseCode1.toString().toUpperCase() === "FALSE") ? '√' : '', margin: [-20, 0, 0, 0]
                        },
                        [
                            {
                                style: 'myTable',
                                margin: [15, 0, 0, 0],
                                table: {
                                    widths: [15, 15, 25],
                                    heights: [10],
                                    body: [
                                        [
                                            {
                                                text: claimData && claimData.subscriber && claimData.subscriber[0].dob && new Date(claimData.subscriber[0].dob) ?
                                                    (new Date(claimData.subscriber[0].dob.toString()).getMonth() + 1).toString().substring(0, 2) : ''
                                            },
                                            {
                                                text: claimData && claimData.subscriber && claimData.subscriber[0].dob && new Date(claimData.subscriber[0].dob) ?
                                                    (new Date(claimData.subscriber[0].dob.toString()).getDate()).toString().substring(0, 2) : ''
                                            },
                                            {
                                                text: claimData && claimData.subscriber && claimData.subscriber[0].dob && new Date(claimData.subscriber[0].dob) ?
                                                    (new Date(claimData.subscriber[0].dob.toString()).getFullYear()).toString().substring(0, 4) : ''
                                            },
                                        ],
                                    ],
                                }, layout: 'noBorders',
                            }
                        ],
                        [
                            {
                                style: 'myTable',
                                margin: [-50, 0, 0, 0],
                                table: {
                                    widths: [42, 20],
                                    heights: [10],
                                    body: [
                                        [
                                            { text: claimData.subscriber && claimData.subscriber[0].gender === 'M' ? '√' : '' },
                                            { text: claimData.subscriber && claimData.subscriber[0].gender === 'F' ? '√' : '' },
                                        ],
                                    ],
                                }, layout: 'noBorders',
                            }
                        ],
                    ],
                    [//ANS
                        { text: "NUCC1", colSpan: 2 }, {},
                        {
                            text: (claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode2.toString() &&
                                claimData.subscriber[0].claim[0].relatedCauseCode2.toString().toUpperCase() === 'TRUE') ? '√' : '', alignment: 'center', margin: [-20, 0, 0, 0]
                        },
                        {
                            text: (claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode2.toString() &&
                                claimData.subscriber[0].claim[0].relatedCauseCode2.toString().toUpperCase() === 'FALSE') ? '√' : '', margin: [-20, 0, 0, 0]
                        },
                        { text: "", colSpan: 2 }, {}
                    ],
                    [//ANS
                        { text: "NUCC2", colSpan: 2 }, {},
                        {
                            text: (claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode3.toString() &&
                                claimData.subscriber[0].claim[0].relatedCauseCode3.toString().toUpperCase() === 'TRUE') ? '√' : '', alignment: 'center', margin: [-20, 0, 0, 0]
                        },
                        {
                            text: (claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].relatedCauseCode3.toString() &&
                                claimData.subscriber[0].claim[0].relatedCauseCode3.toString().toUpperCase() === 'FALSE') ? '√' : '', margin: [-20, 0, 0, 0]
                        },
                        { text: claimData.subscriber && claimData.subscriber[0].planName ? (claimData.subscriber[0].planName).toString().substring(0, 30) : '', margin: [0, 0, 0, 0] },
                        {}
                    ],
                    [//ANS
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].OtherPayer && claimData.subscriber[0].claim[0].OtherPayer[0].name ?
                                (claimData.subscriber[0].claim[0].OtherPayer[0].name).toString().substring(0, 28) : '', colSpan: 2
                        }, {},
                        { text: "", colSpan: 2, margin: [5, 0, 0, 0] }, {},
                        [
                            {
                                style: 'myTable',
                                margin: [3, 0, 0, 0],
                                table: {
                                    widths: [23, 24],
                                    heights: [10],
                                    body: [
                                        [
                                            {
                                                text: (claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].OtherPayer &&
                                                    claimData.subscriber[0].claim[0].OtherPayer[0].name && claimData.subscriber[0].claim[0].OtherPayer[0].name.toString().length > 0) ? '√' : ''
                                            },
                                            {
                                                text: (claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].OtherPayer &&
                                                    claimData.subscriber[0].claim[0].OtherPayer[0].name && claimData.subscriber[0].claim[0].OtherPayer[0].name.toString().length === 0) ? '√' : ''
                                            },
                                        ],
                                    ],
                                }, layout: 'noBorders',
                            }
                        ], {}
                    ],
                    [//ANS
                        { text: "SIGNATURE ON FILE", colSpan: 2, margin: [35, 0, 0, 0] }, {},
                        [
                            {
                                style: 'myTable',
                                margin: [35, 0, 0, 0],
                                table: {
                                    widths: [15, 15, 25],
                                    heights: [10],
                                    body: [
                                        [
                                            {
                                                text: claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].claimDt ?
                                                ((new Date(claimData.subscriber[0].claim[0].claimDt).getMonth() + 1).toString() + '-' + 
                                                new Date(claimData.subscriber[0].claim[0].claimDt).getDate().toString() + '-' + 
                                                new Date(claimData.subscriber[0].claim[0].claimDt).getFullYear().toString()  ): '', colSpan: 2
                                            }
                                        ],
                                    ],
                                }, layout: 'noBorders',
                            }
                        ], {}, { text: "SIGNATURE ON FILE", colSpan: 2, margin: [35, 0, 0, 0] },
                        {},
                    ],
                ],

            }, layout: 'noBorders',
        },
        {
            style: 'myTable',
            margin: [0, -3, 0, 0],
            table: {
                widths: [25, 20, 50, 80, 0, 45, 13, 13, 62, 10, 15, 15, 30, 11, 15, 15, 35],
                heights: [13, 0, 18, 22, 0],
                body: [
                    [
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].illnessDate ?
                                (new Date(claimData.subscriber[0].claim[0].illnessDate).getMonth() + 1).toString().substring(0, 2) : '', margin: [0, 3, 0, 0]
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].illnessDate ?
                                (new Date(claimData.subscriber[0].claim[0].illnessDate).getDate()).toString().substring(0, 2) : '', margin: [0, 3, 0, 0]
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].illnessDate ?
                                (new Date(claimData.subscriber[0].claim[0].illnessDate).getFullYear()).toString().substring(0, 4) : '', margin: [0, 3, 0, 0]
                        },
                        { text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].illnessDate ? '431' : '', margin: [0, 3, 0, 0] }, {},
                        { text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].sameIllnessFirstDate ? '454.' : '', margin: [5, 3, 0, 0] },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].sameIllnessFirstDate ?
                                (new Date(claimData.subscriber[0].claim[0].sameIllnessFirstDate).getMonth() + 1).toString().substring(0, 2) : '', margin: [0, 3, 0, 0]
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].sameIllnessFirstDate ?
                                (new Date(claimData.subscriber[0].claim[0].sameIllnessFirstDate).getDate()).toString().substring(0, 2) : '', margin: [0, 3, 0, 0]
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].sameIllnessFirstDate ?
                                (new Date(claimData.subscriber[0].claim[0].sameIllnessFirstDate).getFullYear()).toString().substring(0, 4) : '', margin: [0, 3, 0, 0]
                        }, {},
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkFromDate ?
                                (new Date(claimData.subscriber[0].claim[0].unableToWorkFromDate).getMonth() + 1).toString().substring(0, 2) : '', margin: [0, 3, 0, 0]
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkFromDate ?
                                (new Date(claimData.subscriber[0].claim[0].unableToWorkFromDate).getDate()).toString().substring(0, 2) : '', margin: [0, 3, 0, 0]
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkFromDate ?
                                (new Date(claimData.subscriber[0].claim[0].unableToWorkFromDate).getFullYear()).toString().substring(0, 4) : '', margin: [0, 3, 0, 0]
                        }, {},
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkToDate ?
                                (new Date(claimData.subscriber[0].claim[0].unableToWorkToDate).getMonth() + 1).toString().substring(0, 2) : '', margin: [0, 3, 0, 0]
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkToDate ?
                                (new Date(claimData.subscriber[0].claim[0].unableToWorkToDate).getDate()).toString().substring(0, 2) : '', margin: [0, 3, 0, 0]
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].unableToWorkToDate ?
                                (new Date(claimData.subscriber[0].claim[0].unableToWorkToDate).getFullYear()).toString().substring(0, 4) : '', margin: [0, 3, 0, 0]
                        }

                    ],
                    [
                        {}, {}, {}, {}, {},
                        { text: '' },
                        { text: '2850380358', colSpan: 3 }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}
                    ],
                    [
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].referringProvider ?
                                getName(claimData.subscriber[0].claim[0].referringProvider[0]).toString().substring(0, 26) : '', colSpan: 4
                        },
                        {}, {}, {}, {},
                        { text: 'NPI' },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].referringProvider &&
                                claimData.subscriber[0].claim[0].referringProvider[0].NPINO ?
                                claimData.subscriber[0].claim[0].referringProvider[0].NPINO.toString().substring(0, 17) : '', colSpan: 3
                        }, {}, {}, {},
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationFromDate ?
                                (new Date(claimData.subscriber[0].claim[0].hospitailizationFromDate).getMonth() + 1).toString().substring(0, 2) : ''
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationFromDate ?
                                (new Date(claimData.subscriber[0].claim[0].hospitailizationFromDate).getDate()).toString().substring(0, 2) : ''
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationFromDate ?
                                (new Date(claimData.subscriber[0].claim[0].hospitailizationFromDate).getFullYear()).toString().substring(0, 4) : ''
                        }, {},

                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationToDate ?
                                (new Date(claimData.subscriber[0].claim[0].hospitailizationToDate).getMonth() + 1).toString().substring(0, 2) : ''
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationToDate ?
                                (new Date(claimData.subscriber[0].claim[0].hospitailizationToDate).getDate()).toString().substring(0, 2) : ''
                        },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].hospitailizationToDate ?
                                (new Date(claimData.subscriber[0].claim[0].hospitailizationToDate).getFullYear()).toString().substring(0, 4) : ''
                        }
                    ],
                    [
                        { text: 'DSADSADSADSADSAD', colSpan: 9 },
                        {}, {}, {}, {}, {}, {}, {}, {},
                        { text: '√', alignment: 'center' }, {},
                        { text: '√', alignment: 'center' },
                        { text: '784596', colSpan: 3, alignment: 'right' }, {}, {},
                        { text: '00', alignment: 'left', colSpan: 2 }, {}
                    ],
                ],

            }, layout: 'noBorders'
        },
        {
            style: 'myTable',
            margin: [20, 0, 0, 0],
            table: {
                widths: [90, 90, 90, 90, 70, 120],
                heights: [0, 10, 10, 10],
                body: [
                    [
                        { text: '' },
                        { text: '' },
                        { text: '' },
                        { text: '0', margin: [-8, -10, 0, 0] },
                        { text: '' },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0] && claimData.subscriber[0].claim[0].originalReference ?
                                claimData.subscriber[0].claim[0].originalReference.toString().substring(0, 18) : ''
                        }

                    ],
                    // getICDCodes(claimData),
                    [
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[0]
                                && claimData.subscriber[0].claim[0].icd[0].code) ? claimData.subscriber[0].claim[0].icd[0].code.toString().substring(0, 7) : '', margin: [0, -10, 0, 0]
                        },
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[1]
                                && claimData.subscriber[0].claim[0].icd[1].code) ? claimData.subscriber[0].claim[0].icd[1].code.toString().substring(0, 7) : '', margin: [0, -10, 0, 0]
                        },
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[2]
                                && claimData.subscriber[0].claim[0].icd[2].code) ? claimData.subscriber[0].claim[0].icd[2].code.toString().substring(0, 7) : '', margin: [0, -10, 0, 0]
                        },
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[3]
                                && claimData.subscriber[0].claim[0].icd[3].code) ? claimData.subscriber[0].claim[0].icd[3].code.toString().substring(0, 7) : '', margin: [0, -10, 0, 0]
                        },
                        {},
                        {},

                    ],
                    [
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[4]
                                && claimData.subscriber[0].claim[0].icd[4].code) ? claimData.subscriber[0].claim[0].icd[4].code.toString().substring(0, 7) : '', margin: [0, -12, 0, 0]
                        },
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[5]
                                && claimData.subscriber[0].claim[0].icd[5].code) ? claimData.subscriber[0].claim[0].icd[5].code.toString().substring(0, 7) : '', margin: [0, -12, 0, 0]
                        },
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[6]
                                && claimData.subscriber[0].claim[0].icd[6].code) ? claimData.subscriber[0].claim[0].icd[6].code.toString().substring(0, 7) : '', margin: [0, -12, 0, 0]
                        },
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[7]
                                && claimData.subscriber[0].claim[0].icd[7].code) ? claimData.subscriber[0].claim[0].icd[7].code.toString().substring(0, 7) : '', margin: [0, -12, 0, 0], colspan: 3
                        },
                        {}, {}

                    ],
                    [
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[8]
                                && claimData.subscriber[0].claim[0].icd[8].code) ? claimData.subscriber[0].claim[0].icd[8].code.toString().substring(0, 7) : '', margin: [0, -14, 0, 0]
                        },
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[9]
                                && claimData.subscriber[0].claim[0].icd[9].code) ? claimData.subscriber[0].claim[0].icd[9].code.toString().substring(0, 7) : '', margin: [0, -14, 0, 0]
                        },
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[10]
                                && claimData.subscriber[0].claim[0].icd[10].code) ? claimData.subscriber[0].claim[0].icd[10].code.toString().substring(0, 7) : '', margin: [0, -14, 0, 0]
                        },
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].icd && claimData.subscriber[0].claim[0].icd[11]
                                && claimData.subscriber[0].claim[0].icd[11].code) ? claimData.subscriber[0].claim[0].icd[11].code.toString().substring(0, 7) : '', margin: [0, -14, 0, 0]
                        },
                        {
                            text: (claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0] && claimData.subscriber[0].claim[0].authorizationNo)
                                ? claimData.subscriber[0].claim[0].authorizationNo.toString().substring(0, 30) : '', colspan: 2, margin: [0, -17, 0, 0]
                        },
                        {}

                    ]
                ],

            }, layout: 'noBorders'
        },
        {
            style: 'myTable',
            alignment: 'center',
            margin: [2, 7, 0, 0],
            table: {
                widths: [10, 10, 25, 10, 10, 25, 15, 15, 35, 18, 18, 18, 18, 30, 30, 15, 20, 10, 15, 75],
                heights: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
                body: [

                    // getTableContents(claimData),
                    cpt[0],
                    cpt[1],
                    cpt[2],
                    cpt[3],
                    cpt[4],
                    cpt[5],
                    cpt[6],
                    cpt[7],
                    cpt[8],
                    cpt[9],
                    cpt[10],
                    cpt[11],
                ],

            }, layout: 'noBorders'
        },
        {
            style: 'myTable',
            margin: [10, 18, 0, 0],
            table: {
                widths: [106, 7, 22, 102, 30, 45, 0, 45, 15, 0, 35, 10, 55, 10],
                heights: [17, 10, 10],
                body: [
                    [
                        { text: claimData.billingProvider && claimData.billingProvider.federalTaxID ? claimData.billingProvider.federalTaxID.toString().substring(0, 16) : '' },
                        { text: '' },
                        { text: '' },
                        { text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].claimNumber ? claimData.subscriber[0].claim[0].claimNumber.toString().substring(0, 14) : '' },
                        { text: '√' },
                        { text: '' },
                        { text: '$' },
                        { text: totalBill && totalBill.toString().split(".")[0] ? parseInt(totalBill.toString().split(".")[0], 10).toString().substring(0, 8) : '0.' },
                        { text: totalBill && totalBill.toString().split(".")[1] ? totalBill.toString().split(".")[1].substring(0, 2) : '00' },
                        { text: '$' },
                        { text: getClaimResponsible(claimData) },
                        { text: '00' },
                        {}, {}
                    ],
                    [
                        { text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].renderingProvider ? getName(claimData.subscriber[0].claim[0].renderingProvider[0]).toString().substring(0, 17) : '', colSpan: 2, margin: [0, 17, 0, 0] },
                        {}, {},
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].servicefacility ? (getName(claimData.subscriber[0].claim[0].servicefacility[0]).toString().substring(0, 26) + '\n' +
                                claimData.subscriber[0].claim[0].servicefacility[0].addressLine1.substring(0, 26) + '\n' +
                                (claimData.subscriber[0].claim[0].servicefacility[0].city + ' ' +
                                    claimData.subscriber[0].claim[0].servicefacility[0].state +
                                    ' ' + claimData.subscriber[0].claim[0].servicefacility[0].zip).substring(0, 26)) : '', colSpan: 4
                        },
                        {}, {}, {},
                        {
                            text: (claimData.billingProvider ? (claimData.billingProvider.lastName.substring(0, 30)) : '') + '\n' + (claimData.payToProvider ? (claimData.payToProvider.addressLine1 ?
                                claimData.payToProvider.addressLine1.substring(0, 30) : '') : (claimData.billingProvider && claimData.billingProvider.addressLine1 ? claimData.billingProvider.addressLine1.substring(0, 30) : '') + '\n' + (claimData.billingProvider ? claimData.billingProvider.city + ' ' +
                                    claimData.billingProvider.state + ' ' + claimData.billingProvider.zipCode : '').substring(0, 30)) , colSpan: 5
                        },
                        {}, {}, {}, {},
                        {text: claimData.billingProvider && claimData.billingProvider.phoneNo ? claimData.billingProvider.phoneNo : '', colSpan: 2}, {}
                    ],
                ],
            }, layout: 'noBorders'
        },
        {
            style: 'pageBreakStyle',
            margin: [30, 3, 0, 0],
            table: {
                widths: [94, 37, 95, 90, 95, 90],
                heights: [17, 10, 10],
                body: [
                    [
                        { text: 'SIGNED' },
                        { text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0] ? claimData.subscriber[0].claim[0].claimDt : '' },
                        {
                            text: claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0] && claimData.subscriber[0].claim[0].servicefacility
                                && claimData.subscriber[0].claim[0].servicefacility[0].NPINO ? claimData.subscriber[0].claim[0].servicefacility[0].NPINO.toString().substring(0, 10) : ''
                        },
                        { text: '' },
                        { text: claimData.billingProvider && claimData.billingProvider.npiNo ? claimData.billingProvider.npiNo.toString().substring(0, 10) : '' },
                        { text: claimData.billingProvider && claimData.billingProvider.legacyID ? claimData.billingProvider.legacyID.toString().substring(0, 14) : '' }
                    ]
                ],
            }, layout: 'noBorders', pageBreak: pageBrk,
        },

    ]);
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
    claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryPaidTotal ? parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryPaidTotal) : 0 : 0;
    let adj = claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].payerpaidAmount  ? 
    claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryAdjTotal ? parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryAdjTotal) : 0 : 0;
    let total = primary + adj;
    return total;
}

function getSecondaryAmountPaid(claimData) {
    let primary = claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].payerpaidAmount ? 
    claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryPaidTotal ? parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryPaidTotal) : 0 : 0;
    let adj = claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].payerpaidAmount  ? 
    claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryAdjTotal ? parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].primaryAdjTotal) : 0 : 0;
    let secondary = claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].payerpaidAmount ? claimData.subscriber[0].claim[0].payerpaidAmount[0].secondaryPaidTotal ? 
    parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].secondaryPaidTotal) : 0 : 0;
    let adj2 = claimData && claimData.subscriber && claimData.subscriber[0].claim && claimData.subscriber[0].claim[0].payerpaidAmount ? claimData.subscriber[0].claim[0].payerpaidAmount[0].secondaryAdjTotal ? 
    parseInt(claimData.subscriber[0].claim[0].payerpaidAmount[0].secondaryAdjTotal) : 0 : 0;
    let total = primary + adj + secondary + adj2;
    return total;
}

function mergeData(claim) {
    var blocks = formatRedForm(claim);
    if (typeof mailMerge === 'undefined') {
        return blocks;
    }
    for (var i = 0; i < blocks.length; i++) {
        blocks[i] = mailMerge.mergeData(blocks[i], claim);
    }
    return blocks;
}

function claimTable(claims) {
    var blocks = [];
    claims.forEach(function (claim, index) {
        totalBill = 0;
        if (claim && claim.data[0].subscriber && claim.data[0].subscriber[0].claim && claim.data[0].subscriber[0].claim[0].serviceLine &&
            claim.data[0].subscriber[0].claim[0].serviceLine.length > 6 && claim.data[0].subscriber[0].claim[0].serviceLine.length < 13) {
            for (let i = 0; i < 2; i++) {
                pageBrk = 'after';
                if (i === 1) {
                    pageBrk = 'none';
                    start = 6;
                    end = 12;
                }
                console.log("PAGEBREAK" + pageBrk);
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
                console.log("PAGEBREAK" + pageBrk);
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

if (typeof claimData !== 'undefined') {
    allBlocks = claimTable(claimData);
    console.log(allBlocks);
} else {
    allBlocks = claimTable([{
        data: [{}]
    }]);
}

var dd = {
    content: allBlocks,
    styles: {
        myTable: {
            fontSize: 7,
            margin: [0, 0, 0, 0]
        },
        ansFont: {
            bold: true,
            fontSize: 8,
            color: 'black'
        },
        pageBreakStyle: {
            fontSize: 7,
            margin: [0, 0, 0, 0]
        }
    },
    images: {
        clearDot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
        tickImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAAMNJREFUOI3VzjEOgjAYhuGvH4mJE57A5C/pqIscQXad3byBq7fSSeMRXOAA3KGOLuDSEkWlMBn/pWnT92mBvxut9VREZn7PgXGqlCpI5iKyGQS4+AJgAoAkd72BVoyqqu5KqT0ARP5SkiSLOI5H1tpbKCa5Ksvy3PxARLYArlEU5VrrtEd88neUe70AMHdntq7rDABCcQOIyJLkEcDYI27tjBvAIRnJwxOCUPwCfEJC8RvQQhSAdVf8dYwx2hijB4c/mQeKAVWWFc2OCAAAAABJRU5ErkJggg=='
    },
    defaultStyle: {
        // alignment: 'justify'
    },
    pageSize: {
        width: 612,
        height: 792
    },
    pageOrientation: 'portrait',
    pageMargins: [15, 22, 0, 0]

};