module.exports = {
    "ORDER": [
      "ISA",
      "GS",
      "ST",
      "BPR",
      "TRN",
      "REF",
      "DTM",
      "N1",
      { "N1": "N1_2" },
      "LX",
      "SE",
      "GE",
      "IEA"
    ],
    "ISA": "DEFAULT",
    "GS": "DEFAULT",
    "ST": "DEFAULT",
    "BPR": {
      "ID": "financialInformation",
      "NAME": "Beginning Segment for Payment Order",
      "REPEAT": true,
      "ELEMENTS": [
        "I",
        "{bpr.totalPaymentAmount}",
        "C",
        "CHK",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "{bpr.checkIssueDate}"
      ],
      "ELEMENTS_ID": [
        "transactionHandleCode",
        "monetoryAmount",
        "credDebitFlagCode",
        "paymentMethodCode",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "date"
      ]
    },
    "TRN": {
      "ID": "reassociationTraceNumber",
      "NAME": "REASSOCIATION TRACE NUMBER",
      "ELEMENTS": [ "1", "{trn.checkNumber}", "{trn.payerID}" ],
      "ELEMENTS_ID": [ "traceTypeCode", "referenceIdent", "originatingCompanyID" ]
    },
    "REF": {
      "ID": "receiverIdentification",
      "NAME": "RECEIVER IDENTIFICATION",
      "ELEMENTS": [ "EV", "{ref.receiverIdentifier}" ],
      "ELEMENTS_ID": [ "referenceIdentQual", "referenceIdent" ]
    },
    "DTM": {
      "ID": "productionDate",
      "NAME": "PRODUCTION DATE",
      "ELEMENTS": [ "405", "dtm.productionDate" ],
      "ELEMENTS_ID": [ "dateTimeQualifier", "date" ]
    },
    "N1": {
      "LOOP": "1000A",
      "ID": "payerIdentification",
      "NAME": "PAYER IDENTIFICATION",
      "ELEMENTS": [ "PR", "{payer.name}", "XV", "{payer.npiNumber}" ],
      "ELEMENTS_ID": [ "entityIDCode", "name", "idCodeQualifier", "idCode" ],
      "ORDER": [ "N3", "N4", "PER" ],
      "N3": {
        "ID": "payerAddress",
        "NAME": "Payer Address",
        "ELEMENTS": [ "{payer.insuranceprovideraddressline1}", "{payer.insuranceprovideraddressline2}" ],
        "ELEMENTS_ID": [ "addressInformation", "addressInformation" ]
      },
      "N4": {
        "ID": "payerCityStateZipCode",
        "NAME": "Payer City/State/ZIP Code",
        "ELEMENTS": [ "{payer.payerCity}", "{payer.payerState}", "{payer.payerZIPCode}" ],
        "ELEMENTS_ID": [ "payerCity", "payerState", "payerZIPCode" ]
      },
      "PER": {
        "ID": "payerContactInformation",
        "NAME": "PAYER CONTACT INFORMATION",
        "ELEMENTS": [ "BL", "TECHSUPPORT", "TE", "8664726765", "EM", "EDISUPPORT@QUICKCAP.NET" ],
        "ELEMENTS_ID": [
          "contactFunctCode",
          "name",
          "commNumberQual1",
          "commNumber1",
          "commNumberQual2",
          "commNumber2"
        ]
      }
    },
    "N1_2": {
      "LOOP": "1000B",
      "ID": "payeeIdentification",
      "NAME": "PAYEE IDENTIFICATION",
      "SEGMENT_INDEX": 2,
      "OPTIONAL": true,
      "ELEMENTS": [ "PE", "{facility.name}", "XX", "{facility.npiNo}" ],
      "ELEMENTS_ID": [ "entityIDCode", "name", "idCodeQualifier", "npiNo" ],
      "ORDER": [ "N3", "N4" ],
      "N3": {
        "ID": "payerAddress",
        "NAME": "Facility Address",
        "ELEMENTS": [ "{facility.addressLine1}", "{facility.addressLine2}" ],
        "ELEMENTS_ID": [ "addressLine1", "addressLine2" ]
      },
      "N4": {
        "ID": "payerCityStateZipCode",
        "NAME": "Facility City/State/ZIP Code",
        "ELEMENTS": [ "{facility.City}", "{facility.State}", "{facility.zipCode}" ],
        "ELEMENTS_ID": [ "City", "State", "zipCode" ]
      }
    },
    "LX": {
      "LOOP": "2000",
      "ID": "headerNumber",
      "NAME": "HEADER NUMBER",
      "ALLOW_EMPTY_SEGMENT": false,
      "REPEAT": true,
      "ELEMENTS": [ "{svc.assingedNumber}" ],
      "ELEMENTS_ID": [ "assingedNumber" ],
      "ORDER": [ "CLP" ],
      "CLP": {
        "LOOP": "2100",
        "ID": "claimPaymentInformation",
        "NAME": "CLAIM PAYMENT INFORMATION",
        "ALLOW_EMPTY_SEGMENT": false,
        "REPEAT": true,
        "ELEMENTS": [
          "{clp.claimNumber}",
          "{clp.claimStatusCode}",
          "{clp.totalBillFee}",
          "{clp.paidAmount}",
          " {clp.patientResponsibleAmount}",
          "{clp.claimFillingCode}",
          "{clp.payerClaimContorlNumber}",
          "{clp.facilityCodeValue}",
          "{clp.claimFrequencyCode}"
        ],
        "ELEMENTS_ID": [
          "claimNumber",
          "claimStatusCode",
          "totalBillFee",
          "paidAmount",
          "patientResponsibleAmount",
          "claimFillingCode",
          "payerClaimContorlNumber",
          "facilityCodeValue",
          "claimFrequencyCode"
        ],
        "ORDER": [ "CAS", "NM1", "DTM", "AMT", "SVC" ],
        "CAS": {
          "ID": "claimAdjustment",
          "NAME": "CLAIM ADJUSTMENT",
          "OPTIONAL": true,
          "REPEAT": true,
          "ALLOW_EMPTY_SEGMENT": false,
          "ELEMENTS": [ "{cas.groupCode}", "{cas.reasonCode}", "{cas.monetaryAmount}" ],
          "ELEMENTS_ID": [ "claimAdjGroupCode", "claimAdjReasonCode", "monetaryAmount" ]
        },
        "NM1": {
          "ID": "patientName",
          "NAME": "PATIENT NAME",
          "ALLOW_EMPTY_SEGMENT": false,
          "ELEMENTS": [
            "QC",
            "1",
            "{pat.lastName}",
            "{pat.firstName}",
            "{pat.middleName}",
            "{pat.prefix}",
            "{pat.suffix}",
            "MI",
            "{pat.accountNumber}"
          ],
          "ELEMENTS_ID": [
            "entityIdCode",
            "entityTypeQualifier",
            "firstName",
            "nameFirst",
            "prefix",
            "suffix",
            "MI",
            "accountNumber"
          ]
        },
        "DTM": {
          "ID": "claimDate",
          "NAME": "CLAIM DATE",
          "ELEMENTS": [ "030", "{dtm.claimDate}" ],
          "ELEMENTS_ID": [ "dateTimeQualifier", "claimDate" ]
        },
        "AMT": {
          "ID": "claimSupplementalInformation",
          "NAME": "CLAIM SUPPLEMENTAL INFORMATION",
          "OPTIONAL": true,
          "ELEMENTS": [ "T", "{atm.balance}" ],
          "ELEMENTS_ID": [ "amountQualCode", "balance" ]
        },
        "SVC": {
          "LOOP": "2110",
          "ID": "servicePaymentInformation",
          "NAME": "SERVICE PAYMENT INFORMATION",
          "REPEAT": true,
          "ELEMENTS": [ "HC", "{svc.billFee}", "{svc.paidamount}", "{svc.revenuecode}", "{svc.units}" ],
          "ELEMENTS_ID": [
            [
              "qualifierData",
              "productIDQualifier",
              "cptCode",
              "modifier1",
              "modifier2",
              "modifier3",
              "modifier4",
              "description"
            ],
            "billFee",
            "paidamount",
            "revenuecode",
            "units"
          ],
          "ORDER": [ "DTM", "CAS", "REF" ],
          "DTM": {
            "ID": "serviceDate",
            "NAME": "SERVICE DATE",
            "ELEMENTS": [ "472", "{svc.serviceDate}" ],
            "ELEMENTS_ID": [ "dateTimeQualifier", "serviceDate" ]
          },
          "CAS": {
            "ID": "serviceAdjustment",
            "NAME": "SERVICE ADJUSTMENT",
            "OPTIONAL": true,
            "REPEAT": true,
            "ELEMENTS": [
              "{cas.groupCode}",
              "{cas.reasonCode}",
              "{cas.monetaryAmount}",
              "{cas.quantity}",
              "{cas.reasonCode1}",
              "{cas.monetaryAmount1}",
              "{cas.quantity1}",
              "{cas.reasonCode2}",
              "{cas.monetaryAmount2}",
              "{cas.quantity2}",
              "{cas.reasonCode3}",
              "{cas.monetaryAmount3}",
              "{cas.quantity3}",
              "{cas.reasonCode4}",
              "{cas.monetaryAmount4}",
              "{cas.quantity4}",
              "{cas.reasonCode5}",
              "{cas.monetaryAmount5}",
              "{cas.quantity5}",
              "{cas.reasonCode6}",
              "{cas.monetaryAmount6}",
              "{cas.quantity6}"
            ],
            "ELEMENTS_ID": [
              "groupCode",
              "reasonCode1",
              "monetaryAmount1",
              "quantity1",
              "reasonCode2",
              "monetaryAmount2",
              "quantity2",
              "reasonCode3",
              "monetaryAmount3",
              "quantity3",
              "reasonCode4",
              "monetaryAmount4",
              "quantity4",
              "reasonCode5",
              "monetaryAmount5",
              "quantity5",
              "reasonCode6",
              "monetaryAmount6",
              "quantity6",
              "reasonCode7",
              "monetaryAmount7",
              "quantity7"
            ]
          },
          "REF": {
            "ID": "serviceIdentification",
            "NAME": "SERVICE IDENTIFICATION",
            "ELEMENTS": [ "6R", "{svc.assingedNumber}" ],
            "ELEMENTS_ID": [ "referenceIdentQual", "assingedNumber" ]
          }
        }
      }
    },
    "SE": "DEFAULT",
    "GE": "DEFAULT",
    "IEA": "DEFAULT"
  };
