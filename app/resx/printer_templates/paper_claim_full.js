// playground requires you to assign document definition to a variable called dd
var dd = {
	content: [
		{text: 'Corrected Claim', style: 'header'},
		{text: 'HEALTH INSURANCE CLAM FORM', fontSize:13},
			{
			     style: 'myTable',
			     margin: [0, 5, 0, 0],
			table: {
			   widths: [55, 44, 58, 45, 52, 36, 25, 160, 50],
			   	heights: [1, 0, 5],
			
				body: [
					[
				        {text: '1. MEDICARE',margin: [0, 23, 0, 0]}, 
					    {text: 'MEDICAID',margin: [0, 23, 0, 0]},
					    {text: 'TRICARE',margin: [0, 23, 0, 0],},
					    {text: 'CHAMPVA',margin: [0, 23, 0, 0] },
					    {text: 'GROUP ',margin: [0, 23, 0, 0]},
					    {text: 'FECA ',margin: [0, 23, 0, 0]},
					    {text: 'OTHER',margin: [0, 23, 0, 0]},
					    {text:"1a. INSURED's ID NUMBER",margin: [-5, 23, 0, 0]},
					    {}
					],
					[
					    {}, {}, {}, {},
					    {text:'HEALTH PLAN', margin: [0, -5, 0, 0]},{text:'BLK LUNG', colSpan: 2, margin: [0, -5, 0, 0]},{},{},
					    {}
					],
				    [//Ans
					    {text: '|__| medicare',style:'ansFont', margin: [0, -5, 0, 0]},
					    {text: '|__| medicaid', style:'ansFont', margin: [-9, -5, 0, 0]}, 
					    {text: '|__|', style:'ansFont', margin: [-9, -8, 0, 0]}, 
					    {text: '|__|', style:'ansFont', margin: [-9, -8, 0, 0]},
					    {text: '|__|', style:'ansFont', margin: [-9, -8, 0, 0]},
					    {text: '|__|', style:'ansFont', margin: [-9, -8, 0, 0]},
					    {text: '|__|', style:'ansFont', margin: [-9, -8, 0, 0]},
					    {text: '56546', style:'ansFont', margin: [4, -8, 0, 0]},
					    {}
					 ],
					 ],
		    	},layout: 'noBorders',
	        	},
	            {
			        style: 'myTable',
			        margin: [0, -4, 0, 0],
			        table: {
			        widths: [101,99, 90, 45, 170, 32],
			        heights: [9, 0, 16, 0, 16, 0, 18, 0, 18, 18, 0, 18,0, 18, 0, 18, 0, 0, 20],
			    	
				    body: [
					    [
					        {text: "2. PATIENT'S NAME", colSpan: 2},
					        {}, 
					        {text: "3. PATIENT'S BIRTH DATE" },
					        {text: "SEX"},
					        {text: "4. INSURED'S NAME"},
					        {}
					     ],
					     [//Ans
					        {text: 'Rohith sharma', colSpan: 2, margin: [0, -4, 0, 0], mergeField: 'subscriber[0].firstName'},
					        {},
					        {text: '12/06/2017', margin: [0, -4, 0, 0]},
					        {text: '\tM\t\t\t\tF', margin: [0, -4, 0, 0]},
					        {text: 'Rohith Sharma',  margin: [5, -4, 0, 0]},
					        {}
					    ],
					    [
					        {text: "5. PATIENT'S ADDRESS(No., Street)", colSpan: 2},
					        {},
					        {text: '6. PATIENT RELATIONSHIP TO INSURED', colSpan: 2},
					        {},
					        {text: "7.INSURED'S ADDRESS(No., Street)"},
					        {}
					    ],
					    [//Ans
					        {text: "address1", colSpan: 2, margin: [0, -10, 0, 0]},
					        {},
					        [
    							{
	    						    style: 'myTable',
	    						    margin: [5, -10, 0, 0],
	    						    
		    						table: {
		    						    widths: [19, 26, 23, 24],
			                            heights: [10],
			    						body: [
				    						[
					    					    {text: 'Self__'},
					    					    {text: 'Spouse'},
					    					    {text: 'Child__'},
					    					    {text: 'Other__'},
									    	 ],
									    ],
								    },layout: 'noBorders',
							    }
						    ],
					        {},
					        {text: "ADDRESS1", margin: [5, -10, 0, 0]},
					        {}
					    ],
					    [
					        {text: "CITY"},
					        {text: 'STATE', margin: [78, 0, 0, 0]},
					        {text: '8.RESERVED FOR NUCC USE', colSpan: 2},
					        {},
					        {text: "CITY"},
					        {text: "STATE"}
					    ],
					    [//Ans
					        {text: "Chennai", margin: [5, -10, 0, 0]},
					        {text: 'TN', alignment: 'center', margin: [5, -10, 0, 0]},
					        {},
					        {},
					        {text: "TEXAS", margin: [5, -10, 0, 0]},
					        {text: "US", margin: [5, -10, 0, 0]}
					    ],
					    [
					        {text: "ZIP CODE"},
					        {text: "TELEPHONE (Include Area Code)", margin: [-10, 0, 0, 0]},
					        {},
					        {},
					        {text: 'ZIP CODE'},
					        {text: "TELEPHONE (Include Area Code)", margin: [-85, 0, 0, 0]}
					    ],
					    [//Ans
					        {text: "ANSZIP CODE",  margin: [5, -10, 0, 0]},
					        {text: "+917708938370", margin: [5, -10, 0, 0]},
					        {},
					        {},
					        {text: '628501', margin: [5, -10, 0, 0]},
					        {text: "+917708938370", margin: [-80, -10, 0, 0]}
					    ],
					    [
					        {text: "9.OTHER INSURED'S NAME", colSpan: 2},
					        {},
					        {text: "10.IS PATIENT'S CONDITION RELATED TO", colSpan: 2},
					        {},
					        {text: "11.INSURED'S POLICY GROUP OR FECA NUMBER"},
					        {}
					    ],
					    [
					        {text: "a.OTHER INSURED'S POLICY OR GROUP NUMBER ", colSpan: 2},
					        {},
					        {text: " a.EMPLOYMENT? (Current or Previous)", colSpan: 2},
					        {},
					        {text: "a.INSURED'S DATE OF BIRTH"},
					        {text: "SEX",  margin: [-20, 0, 0, 0]}
					    ],
					    [//ANS
					        {},{},
					        {text: "Y", alignment: 'center',  margin: [-5, -10, 0, 0]},{text: "N",  margin: [-10, -10, 0, 0]},
					        {},{}
					    ],
					    [
					        {text: "b.RESERVED FOR NUCC USE", colSpan: 2},
					        {},
					        {text: "b.AUTO ACCIDENT", colSpan: 2},
					        {},
					        {text: "b.OTHER CLAIM ID (Designated by NUCC)"},
					        {}
					    ],
					    [//ANS
					        {},{},
					        {text: "Y", alignment: 'center',  margin: [-5, -10, 0, 0]},{text: "N",  margin: [-10, -10, 0, 0]},
					        {},{}
					    ],
					    [
					        {text: "c.RESERVED FOR NUCC USE", colSpan: 2},
					        {},
					        {text: "c.OTHER ACCIDENT", colSpan: 2},
					        {},
					        {text: "c.INSURANCE PLAN NAME OR PROGRAM NAME"},
					        {}
					    ],
					    [//ANS
					        {},{},
					        {text: "Y", alignment: 'center',  margin: [-5, -10, 0, 0]},{text: "N",  margin: [-10, -10, 0, 0]},
					        {},{}
					    ],
					    [
					        {text: "d.INSURANCE PLAN NAME OR PROGRAM NAME", colSpan: 2},
					        {},
					        {text: "10d.CLAIM CODES(Designated by NUCC)", colSpan: 2},
					        {},
					        {text: "d.IS THERE ANOTHER HEALTH BENEFIT PLAN?"},
					        {}
					    ],
					    [//ANS
					        {},{},{},{},
					        {text: "Y",  margin: [20, -10, 0, 0]},{text: "N",  margin: [-135, -10, 0, 0]},
					    ],
					    [
					        {text: "READ BACK FORM COMPLETING & SIGNING THIS FORM. ",bold: true, fontSize: 7.4, colSpan: 4, alignment: 'center', rowspan:2},
					        {},{},{},{},{}
					    ],
					    [//ANS
					        {text: "12.PATIENTS OR AUTHORIZED PERSON'S SIGNATURE I authorize the release of any medical or other information necessary to process this claim. I also request payment of government benefits either to myself or to the party who accepts assignment below.", colSpan: 4, rowspan:2, margin: [0, -5, 0, 0], fontSize: 6.4},
					        {},{},{},{text: "13.INSURED'S OR AUTHORIZED PERSON'S SIGNATURE I authorize payment of medical benefits to the undesigned physician or supplier for services described below.", colSpan: 2 , margin: [0, -15, 0, 0], fontSize: 6.4},{}
					    ],
					    [//ANS
					        {text: "SIGNED___________________________________________________", colSpan: 3},
					        {},{},{text: "Date_______________________",margin: [-70, 0, 0, 0]},
					        {text: "SIGNED_______________",margin: [10, 0, 0, 0], colSpan:2},{}
					    ],
				    ],
		    	}
		    	,layout: 'noBorders',
	        },
	        {
	            style: 'myTable',
                table: {
                widths: [25,20,20,110,15, 41,13,13,40,30,15,15,32,11,15,15,35],
                heights: [18, 0, 18, 0, 18, 0],
                body: [
                    [
                        {text: '14.DATE OF CURRENT ILLNESS,INJURY, or PREGNANCY (LMP)', colSpan:4},
                        {},
                        {},
                        {},
                        {text: '15.OTHER DATE', colSpan:5},
                        {},
                        {},
                        {},
                        {},
                        {text: '16.DATES PATIENT UNABLE TO WORK IN CURRENT OCCUPATION', colSpan:8},
                        {},
                        {},
                        {},
                        {},
                        {},
                        {},
                        {}
                    
                    ],
                    [
                        {text: 'MM',margin: [10, -15, 0, 0]},
                        {text: 'DD',margin: [0, -15, 0, 0]},
                        {text: 'YY', margin: [0, -15, 0, 0]},
                        {text: 'QUAL.', margin: [0, -8, 0, 0]},
                        {text: 'QUAL.', margin: [0, -8, 0, 0], colSpan:2},
                        {},
                        {text: 'MM',margin: [0, -15, 0, 0]},
                        {text: 'DD',margin: [0, -15, 0, 0]},
                        {text: 'YY', margin: [0, -15, 0, 0]},
                        {text: 'FROM', margin: [10, -8, 0, 0]},
                        {text: 'MM',margin: [0, -15, 0, 0]},
                        {text: 'DD',margin: [0, -15, 0, 0]},
                        {text: 'YY', margin: [0, -15, 0, 0]},
                        {text: 'TO', margin: [0, -8, 0, 0]},
                        {text: 'MM',margin: [0, -15, 0, 0]},
                        {text: 'DD',margin: [0, -15, 0, 0]},
                        {text: 'YY', margin: [0, -15, 0, 0]}
                    
                    ],
                    [
                        {text: '17.NAME OF REFERRING PROVIDER OR OTHER SOURCE', colSpan:4},
                        {},
                        {},
                        {},
                        {text: '17a.'},
                        {},
                        {text: '', colSpan:3},
                        {},
                        {},
                        {text: '18.HOSPITALIZATION DATES RELATED TO CURRENT SERVICES', colSpan:8},
                        {},
                        {},
                        {},
                        {},
                        {},
                        {},
                        {}
                    ],
                    [
                        {text: '',margin: [0, -15, 0, 0], colSpan:4},
                        {},{},{},
                        {text: '17b.',margin: [0, -8, 0, 0]},
                        {text: 'NPI',margin: [0, -8, 0, 0], colSpan:4},
                        {},{},{},
                        {text: 'FROM', margin: [10, -8, 0, 0]},
                        {text: 'MM',margin: [0, -15, 0, 0]},
                        {text: 'DD',margin: [0, -15, 0, 0]},
                        {text: 'YY', margin: [0, -15, 0, 0]},
                        {text: 'TO', margin: [0, -8, 0, 0]},
                        {text: 'MM',margin: [0, -15, 0, 0]},
                        {text: 'DD',margin: [0, -15, 0, 0]},
                        {text: 'YY', margin: [0, -15, 0, 0]}
                    ],
                    [
                        {text: '19.ADDITIONAL CLAIM INFORMATION(Designated by NUCC', colSpan:9},
                        {},{},{},{},{},{},{},{},
                        {text: '20.OUTSIDE LAB?', colSpan:4},
                        {},
                        {},
                        {},
                        {text: '$CHARGES', colSpan:4},
                        {},
                        {},
                        {}
                    ],
                    [
                        {text: '',margin: [0, -16, 0, 0], colSpan:9},
                        {},{},{},{},{},{},{},{},
                        {text: 'Y',  alignment: 'center', margin: [0, -10, 0, 0]},
                        {text: 'N',  alignment: 'center', margin: [0, -10, 0, 0]},
                        {text: '', margin: [0, -8, 0, 0], colSpan:6},{},
                        {},{},{},{}
                    ],
                ],
                
            }
            ,layout: 'noBorders'
        },
        {
            style: 'myTable',
            margin: [0, -5, 0, 0],
            table: {
            widths: [360,90,120],
            heights: [0,0,0],
                body: [
                    [
                        [{text: ' 21.DIAGNOSIS OR NATUE OF ILLNESS OR INJURY Relate A-L to service line below(24E).',style: 'Headers'},
                        {text: 'ICD Ind.', margin: [280, -6, 0, 0, 0]}],
                        [{ text: '22. RESUBMISSION', style: 'Headers' },{text: 'CODE', style: 'Headers'}],
                        {text: 'ORIGINAL REF. NO.'},
                        
                    ],
                ],
                
            }
            ,layout: 'noBorders'
        },
        {
            style: 'myTable',
            margin: [10, -5, 0, 0],
            heights: [18,18],
            table: {
            widths: [84,84,84,84,200],
                body: [
                    [
                        {text: 'A. |__________________\nE. |__________________\nI.  |___________________',style: 'Headers'},
                        {text: 'B. |__________________\nF.|___________________\nJ.|___________________', },
                        {text: 'C.|___________________\nG.|___________________\nK.|___________________',style: 'Headers'},
                        {text: 'D.|___________________\nH.|___________________\nL.|___________________',style: 'Headers'},
                        {text: '23.PRIOR AUTHORIZATION NUMBER', margin: [-10, 10, 0, 0]},
                    ],
                    
                ],
                
            },layout: 'noBorders'
        },
        {
            style: 'myTable', 
            alignment: 'center',
            margin: [0, 0, 0, 0],
            table: {
            widths: [19, 11, 11, 14, 11, 11, 28, 15, 68, 50, 50, 47, 22, 19, 20, 70],
            heights: [0,0,0,0,8,8,8,8,8,8,8,8,8,8,8,8],
                body: [
                    [
                        {text: '24. A. ',style: 'Headers'},
                        {text: 'DATE(S) OF SERVICE', colSpan: 5},
                        {},{},{},{},
                        {text: 'B.'},
                        {text: 'C.'},
                        {text: 'D. PROCEDURES,SERVICES,OR SUPPLIES ', colSpan: 2, alignment: 'center', margin: [-9, 0, 0, 0]},
                        {},
                        {text: 'E.'},
                        {text: 'F.'},
                        {text: 'G.'},
                        {text: 'H.'},
                        {text: 'I.'},
                        {text: 'J.'}
                    
                    ],
                    [
                        {text: 'From', colSpan: 3, alignment: 'center', margin: [0, -3.5, 0, 0]},
                        {},{},
                        {text: 'To', colSpan: 3, alignment: 'center', margin: [0, -3.5, 0, 0]},
                        {},{},
                        {text: 'PLACE OF', fontSize: 6, margin: [0, -3.5, 0, 0]},
                        {},
                        {text: '(Explain Unusual Circumstances)', alignment: 'center', colSpan: 2, margin: [0, -3.5, 0, 0]},
                        {},
                        {text: 'DIAGNOSIS', margin: [0, -3.5, 0, 0]},
                        {},
                        {text: 'DAYS', margin: [0, -5, 0, 0]},
                        {text: 'EPSDT', margin: [0, -5, 0, 0], fontSize: 6},
                        {text: 'ID.', fontSize: 6, margin: [0, -3.5, 0, 0]},
                        {text: 'RENDERING.', margin: [0, -2.5, 0, 0]},
                    
                    ],
                    [
                       {},{},{},{},{},{},{},{},{},{},{},{},
                       {text: 'OR', fontSize: 6, margin: [0, -7, 0, 0]},
                       {text: 'Family', margin: [0, -7, 0, 0], fontSize: 6},
                       {},{}
                    ],
                    [
                           
                        {text: 'MM', margin: [4, -5.3, 0, 0]},
                        {text: 'DD', margin: [0, -5.5, 0, 0]},
                        {text: 'YY', margin: [0, -5.3, 0, 0]},
                        {text: 'MM', margin: [0, -5.3, 0, 0]},
                        {text: 'DD', margin: [0, -5.3, 0, 0]},
                        {text: 'YY',margin: [0, -5.3, 0, 0]},
                        {text: 'SERVICE', fontSize: 6, margin: [0, -5.5, 0, 0],alignment: 'center'},
                        {text: 'EMG', margin: [0, -5.3, 0, 0]},
                        {text: 'CPT/HCPCS', alignment: 'center', margin: [0, -5.3, 0, 0]},
                        {text: 'MODIFIER', alignment: 'center', margin: [0, -5.3, 0, 0]},
                        {text: 'POINTER', margin: [0, -5.3, 0, 0]},
                        {text: '$ CHARGES', margin: [0, -5.3, 0, 0]},
                        {text: 'UNITS', margin: [0, -5.3, 0, 0]},
                        {text: 'Plan', margin: [0, -5.3, 0, 0]},
                        {text: 'QUAL', fontSize: 6, margin: [0, -5.3, 0, 0]},
                        {text: 'PROVIDER ID. #', margin: [0, -5.3, 0, 0]},
                    ],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{text: 'NPI',  alignment: 'center'},{}],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}],
                    [{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}],
                    
                ],
                
            }
            ,layout: 'noBorders'
        },
        {
            style: 'myTable', 
            table: {
                widths: [110, 18, 18, 92, 40, 45, 70, 58, 80],
		        margin: [0, 0, 0, 0],
		        heights: [13, 10],
                body: [
                        [
                            {text: '25. FEDERAL TAX I.D. NUMBER'},
                            {text: 'SSN'}, 
                            {text: 'EIN'}, 
                            {text: "26. PATIENT'S ACCOUNT NO"},
                            {text: '27. ACCEPT ASSIGNMENT?', colSpan: 2},
                            {},
                            {text: '28. TOTAL CHARGE'},
                            {text: '29. AMOUNT PAID'},
                            {text: '30. Rsvd for NUCC Use'},
                            
                        ],
                        [
                            {},
                            {text: '____'}, 
                            {text: '____'}, 
                            {},
                            {text: '____  YES'},
                            {text: '____  NO'},
                            {text: ' $'},
                            {text: '$'},
                            {},
                            
                        ]
                ],
            },layout: 'noBorders'
        },
        {
            style: 'myTable', 
            table: {
                widths: [162,194,150,10],
		        margin: [0, -8, 0, 0, 0],
		        heights: [0, 0, 0, 17],
                body: [
                        [
                            {text: '31. SIGNATURE OF PHYSICIAN OR SUPPLIER '},
                            {text: '32. SERVICE FACILITY LOCATION INFORMATION',style: 'Headers'},
                            {text: '33. BILLING PROVIDER INFO & PH # ('},
                            {text: ')'},
                        ],
                        [{text: 'INCLUDING DEGRESS OR CREDENTIALS',margin: [10, -4, 0, 0],},{},{},{}],
                        [{text: '(I certify that the statements on the reverse', fontSize: 5.6, margin: [10, -4, 0, 0],},{},{},{}],
                        [{text: 'apply to this bill and are made a part thereof.)', fontSize: 5.6, margin: [10, -4, 0, 0],},{},{},{}]
                ],
            },layout: 'noBorders'
        },
        {
            style: 'myTable',
            margin: [0, 0, 0, 0],
            table: {
                widths: [102,50,75,110,73,125],
		        
                body: [
                        [
                            {text: 'SIGNED'},
                            {text: ' DATE'},
                            {text: 'a.'},
                            {text: 'b.'},
                            {text: 'a.'},
                            {text: 'b.'},
                        ]
                ],
            },layout: 'noBorders'
        },
	],
	styles: {
		myTable: {
		    fontSize: 7,
			margin: [0, 0, 0, 0]
			
		},
		ansFont: {
			bold: true,
			fontSize: 8,
			color: 'black'
		}
	},
	defaultStyle: {
		// alignment: 'justify'
	},
	pageSize: {
        width: 612,
        height: 792
    },
    pageOrientation: 'portrait',
    pageMargins: [ 15, 22, 0, 0 ]
	
}