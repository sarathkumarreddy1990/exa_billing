module.exports = {
    "ORDER": ["ISA", "GS", "ST", "BHT", "NM1", { "NM1": "NM1_2" }, "HL", "SE", "GE", "IEA"],
    "ISA": "DEFAULT",
    "GS": "DEFAULT",
    "ST": "DEFAULT",
    "BHT": {
        "NAME": "Beginning of Hierarchical Transaction",
        "ELEMENTS": [
            "0019",
            "00",
            "{bht.requestID}",
            "$$CURRENT_DATE$$",
            "{{if(jsData.commonData.flag) return jsData.commonData.testData1; return jsData.commonData.testData2;}}",
            "CH"
        ]
    },
    "NM1": {
        "LOOP": "1000A",
        "NAME": "Submitter Name",
        "IGNORE": "{data[0].billingProvider.isHidden}",
        "ORDER": ["PER"],
        "ELEMENTS": ["41", "2", "{data[0].billingProvider.lastName}", "", "", "", "", "46", "222282999"],
        "PER": {
            "NAME": "Submitter EDI Contact Information",
            "ELEMENTS": ["IC", "CONTACT", "TE", "8663038971"]
        }
    },
    "NM1_2": {
        "LOOP": "1000B",
        "NAME": "Receiver Name",
        "ELEMENTS": ["40", "2", "ZIRMED", "", "", "", "", "46", "010809227"]
    },
    "HL": {
        "LOOP": "2000A",
        "HL_CODE": "20",
        "NAME": "Billing/Pay-to Provider Hierarchical Level",
        "REPEAT": true,
        "REPEAT_DATA": "[data]",
        "ORDER": ["PRV", "NM1", "HL"],
        "PRV": {
            "NAME": "Billing/Pay-to Provider Specialty Information",
            "ELEMENTS": ["BI", "ZZ", "[billingProvider.taxonomyCode]"]
        },
        "NM1": {
            "LOOP": "2010AA",
            "NAME": "Billing Provider Name",
            "ELEMENTS": ["85", "2", "[billingProvider.lastName]", "", "", "", "XX", "", "[billingProvider.npiNo]"],
            "ORDER": ["N3", "N4", "REF", "PER", "NM1"],
            "N3": {
                "NAME": "Billing Provider Address",
                "ELEMENTS": ["[billingProvider.addressLine1]", "[billingProvider.addressLine2]"]
            },
            "N4": {
                "NAME": "Billing Provider City/State/ZIP Code",
                "ELEMENTS": ["[billingProvider.city]", "[billingProvider.state]", "[billingProvider.zipCode]"]
            },
            "REF": {
                "NAME": "Billing Provider Secondary Identification",
                "ELEMENTS": ["EI", "[billingProvider.federalTaxID]"]
            },
            "PER": {
                "NAME": "Billing Provider Contact Information",
                "ELEMENTS": [],
                "ALLOW_EMPTY_SEGMENT": false
            },
            "NM1": {
                "LOOP": "2010AB",
                "NAME": "Pay-to Provider Name",
                "IGNORE": "[{return !jsData.payToProvider.lastName;}]",
                "ELEMENTS": [
                    "87",
                    "1",
                    "[payToProvider.lastName]",
                    "[payToProvider.firstName]",
                    "",
                    "",
                    "",
                    "XX",
                    "[payToProvider.npiNo]"
                ],
                "ORDER": ["N3", "N4", "REF"],
                "N3": {
                    "NAME": "Pay-to Provider Address",
                    "ELEMENTS": ["[payToProvider.addressLine1]", "[payToProvider.addressLine2]"]
                },
                "N4": {
                    "NAME": "Pay-to Provider City/State/ZIP Code",
                    "ELEMENTS": ["[payToProvider.city]", "[payToProvider.state]", "[payToProvider.zipCode]"]
                },
                "REF": { "NAME": "Pay-to-Provider Secondary Identification", "ELEMENTS": [] }
            }
        },
        "HL": {
            "LOOP": "2000B",
            "HL_CODE": "22",
            "NAME": "Subscriber Hierarchical Level",
            "REPEAT": true,
            "REPEAT_DATA": "[subscriber]",
            "ELEMENTS": [],
            "ORDER": ["SBR", "NM1", { "NM1": "NM1_2" }, "HL", "CLM"],
            "SBR": {
                "NAME": "Subscriber Information",
                "ELEMENTS": [
                    "[claimResponsibleParty]",
                    "[relationship]",
                    "[policyNo]",
                    "[planName]",
                    "[planType]",
                    "",
                    "",
                    "",
                    "[claimFilingCode]"
                ]
            },
            "NM1": {
                "LOOP": "2010BA",
                "NAME": "Subscriber Name",
                "ELEMENTS": [
                    "IL",
                    "1",
                    "[lastName]",
                    "[firstName]",
                    "[middleName]",
                    "[prefix]",
                    "[suffix]",
                    "MI",
                    "[policyNo]"
                ],
                "ORDER": ["N3", "N4", "DMG"],
                "N3": { "NAME": "Subscriber Address", "ELEMENTS": ["[addressLine1]", "{addressLine2]"] },
                "N4": {
                    "NAME": "Subscriber City/State/ZIP Code",
                    "ELEMENTS": ["[city]", "[state]", "[zipCode]"]
                },
                "DMG": {
                    "NAME": "Subscriber Demographic Information",
                    "ELEMENTS": ["D8", "[dob]", "[gender]"]
                }
            },
            "NM1_2": {
                "LOOP": "2010BB",
                "NAME": "Payer Name",
                "ELEMENTS": ["PR", "2", "[payer.payerName]", "", "", "", "", "PI", "[payer.payerID]"],
                "ORDER": ["N3", "N4", "REF"],
                "N3": {
                    "NAME": "Payer Address",
                    "ELEMENTS": ["[payer.insuranceprovideraddressline1]", "[payer.insuranceprovideraddressline2]"]
                },
                "N4": {
                    "NAME": "Payer City/State/ZIP Code",
                    "ELEMENTS": ["[payer.payerCity]", "[payer.payerState]", "[payer.payerZIPCode]"]
                },
                "REF": { "NAME": "Payer Secondary Identification", "ELEMENTS": [] }
            },
            "HL": {
                "LOOP": "2000C",
                "HL_CODE": "23",
                "NAME": "Patient Hierarchical Level",
                "REPEAT": true,
                "REPEAT_DATA": "[patient]",
                "COPY_NEXT_LOOP": true,
                "IGNORE": "[{return jsData.relationship !== '18';}]",
                "ORDER": ["PAT", "NM1"],
                "PAT": {
                    "NAME": "Patient Information",
                    "ELEMENTS": ["[relationship]", "", "", "", "", "", ""]
                },
                "NM1": {
                    "LOOP": "2010CA",
                    "NAME": "Patient Name",
                    "ELEMENTS": [
                        "QC",
                        "1",
                        "[lastName]",
                        "[firstName]",
                        "[middleName]",
                        "",
                        "[suffix]",
                        "MI",
                        "[accountNumber]"
                    ],
                    "ORDER": ["N3", "N4", "DMG"],
                    "N3": { "NAME": "Patient Address", "ELEMENTS": ["[addressLine1]", "[addressLine2]"] },
                    "N4": {
                        "NAME": "Patient City/State/ZIP Code",
                        "ELEMENTS": ["[city]", "[state]", "[zipCode]"]
                    },
                    "DMG": { "NAME": "Patient Demographic Information", "ELEMENTS": ["D8", "[dob]", "[gender]"] }
                }
            },
            "CLM": {
                "LOOP": "2300",
                "NAME": "Claim Information",
                "REPEAT": true,
                "REPEAT_DATA": "[claim]",
                "ORDER": [
                    "DTP",
                    { "DTP": "DTP_2" },
                    { "DTP": "DTP_3" },
                    { "DTP": "DTP_4" },
                    { "DTP": "DTP_5" },
                    { "DTP": "DTP_6" },
                    { "DTP": "DTP_7" },
                    "HI",
                    "NM1",
                    { "NM1": "NM1_2" },
                    { "NM1": "NM1_3" },
                    "SBR",
                    { "NM1": "NM1_4" },
                    "LX"
                ],
                "ELEMENTS": [
                    "[claimNumber]",
                    "[claimTotalCharge]",
                    "",
                    "",
                    "[POS}",
                    "B",
                    "[claimFrequencyCode]",
                    "Y",
                    "A",
                    "Y",
                    "Y",
                    "",
                    "[relatedCauseCode1]",
                    "[relatedCauseCode2]",
                    "[relatedCauseCode3]",
                    "[{if(jsData.relatedCauseCode1 == 'EE') return jsData.relatedCauseCode1; return jsData.relatedCauseCode2;}]"
                ],
                "DTP": { "NAME": "Date - Initial Treatment", "ELEMENTS": ["454", "D8", "[illnessDate]"] },
                "DTP_2": { "NAME": "Date - Date Last Seen", "ELEMENTS": [] },
                "DTP_3": { "NAME": "Date - Onset of Current Illness/Symptom", "ELEMENTS": [] },
                "DTP_4": {
                    "NAME": "Mammography Certification Number",
                    "ELEMENTS": ["EW", "[MammographyNumber]", ""]
                },
                "DTP_5": { "NAME": "Prior Authorization Or Referral Number", "ELEMENTS": ["9F", "[referral]"] },
                "DTP_6": { "NAME": "Original Reference Number", "ELEMENTS": ["F8", "[claimOriginalNumber]"] },
                "DTP_7": { "NAME": "Claim notes", "IGNORE": "[ignore]", "ELEMENTS": ["ADD", "[claimNotes]"] },
                "HI": {
                    "NAME": "Health Care Diagnosis codes",
                    "ALLOW_SINGLE_COMPOSITE_ELEMENTS": true,
                    "ELEMENTS": [["ABK", "[icdCode1]"], ["ABF", "[icdCode2]"]]
                },
                "NM1": {
                    "LOOP": "2420A",
                    "Name": " Referring provider Name",
                    "REPEAT": true,
                    "REPEAT_DATA": "[referringProvider]",
                    "ELEMENTS": [
                        "82",
                        "1",
                        "[lastName]",
                        "[FirstName]",
                        "[middileName]",
                        "[prefix]",
                        "[suffix]",
                        "XX",
                        "[NPINO]"
                    ],
                    "ORDER": ["PRV"],
                    "PRV": {
                        "NAME": "Provider Specialty Information",
                        "ELEMENTS": ["PE", "PXC", "[taxonomyCode]"]
                    }
                },
                "NM1_2": {
                    "LOOP": "2420A",
                    "REPEAT": true,
                    "REPEAT_DATA": "[renderingProvider]",
                    "MAX_REPEAT": 10,
                    "Name": " Rendering provider Name",
                    "ELEMENTS": [
                        "82",
                        "1",
                        "[lastName]",
                        "[firstName]",
                        "[middileName]",
                        "[prefix]",
                        "[suffix]",
                        "XX",
                        "[NPINO]"
                    ],
                    "ORDER": ["PRV"],
                    "PRV": {
                        "NAME": "Provider Specialty Information",
                        "ELEMENTS": ["PE", "PXC", "[taxonomyCode]"]
                    }
                },
                "NM1_3": {
                    "LOOP": "2420C",
                    "REPEAT": true,
                    "REPEAT_DATA": "[servicefacility]",
                    "Name": "Servicefacility Name",
                    "ELEMENTS": ["77", "2", "[name]", "", "", "", "", "XX", "[npiNo]"],
                    "ORDER": ["N3", "N4", "REF"],
                    "N3": { "NAME": "Address", "ELEMENTS": ["[addressLine1]", "[addressLine2]"] },
                    "N4": {
                        "NAME": "servicefacility City/State/ZIP Code",
                        "ELEMENTS": ["[City]", "[state]", "[zipCode]"]
                    },
                    "REF": { "NAME": "servicefacility Secondary Identification", "ELEMENTS": [] }
                },
                "SBR": {
                    "LOOP": "2320",
                    "NAME": "Other subscriber information",
                    "REPEAT": true,
                    "REPEAT_DATA": "[otherSubscriber]",
                    "ELEMENTS": [
                        "[otherClaimResponsibleParty]",
                        "[relationship]",
                        "[policyNumber]",
                        "[groupName]",
                        "[insuranceTypeCode]",
                        "",
                        "",
                        "",
                        "[claimFillingCode}"
                    ],
                    "ORDER": ["OI", "NM1", "N3", "N4"],
                    "OI": {
                        "NAME": "Other insurance coverage information",
                        "ELEMENTS": ["", "", "Y", "P", "", "Y"]
                    },
                    "NM1": {
                        "NAME": "Other subscriber Name",
                        "ELEMENTS": [
                            "IL",
                            "1",
                            "[lastName]",
                            "[firstName]",
                            "[middleName]",
                            "",
                            "",
                            "MI",
                            "[policyNumber]"
                        ],
                        "N3": {
                            "NAME": "other Subscriber Address",
                            "ELEMENTS": ["[addressLine1]", "[addressLine2]"]
                        },
                        "N4": {
                            "NAME": "other Subscriber City/State/ZIP Code",
                            "ELEMENTS": ["[city]", "[state]", "[zipCode]"]
                        }
                    }
                },
                "NM1_4": {
                    "LOOP": "2330B",
                    "NAME": "Other payer name",
                    "REPEAT": true,
                    "REPEAT_DATA": "[otherPayer]",
                    "ELEMENTS": ["PR", "2", "[name]", "", "", "", "", "PI", "[payerID]"],
                    "ORDER": ["N3", "N4"],
                    "N3": { "NAME": "Other payer address", "ELEMENTS": ["[addressLine1]", "[addressLine2]"] },
                    "N4": {
                        "NAME": "otherpayer City/State/ZIP Code",
                        "ELEMENTS": ["[city]", "[state]", "[zipCode]"]
                    }
                },
                "LX": {
                    "LOOP": "2400",
                    "REPEAT": true,
                    "REPEAT_DATA": "[serviceLine]",
                    "NAME": "Service Line",
                    "ORDER": ["SV1", "DTP", "SVD"],
                    "MAX_REPEAT": 50,
                    "ELEMENTS": ["[iterationIndex]"],
                    "SV1": {
                        "NAME": "Professional Service",
                        "ELEMENTS": [
                            "HC",
                            "[examCpt]",
                            "[mod1]",
                            "[mod2]",
                            "[mod3]",
                            "[mod4]",
                            "",
                            "",
                            "[billFee]",
                            "UN",
                            "[unit]",
                            "",
                            "",
                            "[pointer1]",
                            "[pointer2]",
                            "[pointer3]",
                            "[pointer4]"
                        ]
                    },
                    "DTP": { "NAME": "Date - Service Date", "ELEMENTS": ["478", "D8", "[studyDate]"] },
                    "SVD": {
                        "LOOP": "2430",
                        "NAME": "Line adjudication information",
                        "REPEAT": true,
                        "REPEAT_DATA": "[lineAdjudication]",
                        "ALLOW_EMPTY_COMPOSITE_ELEMENTS": false,
                        "ALLOW_SINGLE_COMPOSITE_ELEMENTS": false,
                        "IGNORE": "[{return if(!jsData.lineAdjustment.reasonCode) return true; return jsData.lineAdjustment.claimResponsibleParty == 'P'; }]",
                        "ELEMENTS": [
                            "[payerID]",
                            "[paidAmount]",
                            ["HC", "[cpt]", "[modifier1]", "[modifier2]", "[modifier3]", "[modifier4]"],
                            "",
                            "[unit]"
                        ],
                        "ORDER": ["CAS"],
                        "CAS": {
                            "NAME": "line adjustment",
                            "ELEMENTS": [
                                "[lineAdjustment.adjustmentGroupCode]",
                                "[lineAdjustment.reasonCode]",
                                "[lineAdjustment.monetaryAmount]"
                            ]
                        }
                    }
                }
            }
        }
    },
    "SE": "DEFAULT",
    "GE": "DEFAULT",
    "IEA": "DEFAULT"
};
