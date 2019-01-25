module.exports = {
  "config": {
    "ALLOW_EMPTY_SEGMENT": true
  },
  "header": {
    "authInfoQualifier": "00",
    "authInfo": "",
    "securityInfoQualifier": "00",
    "securityInfo": "",
    "interchangeSenderIDQualifier": "ZZ",
    "interchangeSenderID": "222282999",
    "interchangeReceiverIDQualifier": "ZZ",
    "interchangeReceiverID": "010809227",
    "interchangeCtrlStdIdentifier": "X",
    "interchangeCtrlVersionNo": "005010X222A1",
    "interchangeCtrlNo": "000049776",
    "acqRequested": "0",
    "usageIndicator": "T",
    "functionalIDCode": "HC",
    "applicationSenderCode": "222282999",
    "applicationReceiverCode": "010809227",
    "fgDate": "20180117",
    "fgTime": "1325",
    "groupControlNo": "49776",
    "responsibleAgencyCode": "X",
    "verReleaseIDCode": "005010X222A1",
    "tsIDCode": "837",
    "tsControlNo": "0001"
  },
  "bht": {
    "requestID": "1",
    "tsCreationDate": "20180204",
    "tsCreationTime": "0604"
  },
  "data": [
    {
      "billingProvider": {
        "taxonomyCode": "335V00000X",
        "lastName": "Viztek LLC",
        "npiNo": " 272133220",
        "addressLine1": "2217 US HWY 70 E",
        "addressLine2": "VIZTEK",
        "city": "GARNER",
        "state": "NC",
        "zipCode": "27529",
        "federalTaxID": "4555555555"
      },
      "payToProvider": {
        "lastName": "Viztek LLC",
        "firstName": "272133220",
        "npiNo": "44456543",
        "addressLine1": "2217 US HWY 70 E",
        "addressLine2": "VIZTEK",
        "city": "GARNER",
        "state": "NC",
        "zipCode": "27529"
      },
      "subscriber": [
        {
          "claimResponsibleParty": "P",
          "relationship": "18",
          "policyNo": "1q9o0p",
          "planName": "health",
          "groupNumber": "12",
          "claimFilingCode": "MC",
          "lastName": " ADAM",
          "firstName": "ANDREW",
          "middleName": "ST",
          "prefix": "",
          "suffix": "",
          "policyNO": "1q9o0p",
          "addressLine1": "1st main road",
          "addressLine2": "2nd street",
          "city": "chennai",
          "state": "TN",
          "zipCode": "123456",
          "dob": "04022018 ",
          "gender": "M",
          "payer": {
            "payerName": "1199 insurance",
            "payerID": "1q6y0p",
            "insuranceprovideraddressline1": "123 main road",
            "insuranceprovideraddressline2": "2nd street",
            "payerCity": "Chennai",
            "payerState": "AK",
            "payerZIPCode": "3690"
          },
          "patient": [
            {
              "ignore": false,
              "relationship": "18",
              "lastName": "jack",
              "firstName": "Andrew",
              "middleName": "",
              "suffix": "",
              "accountNumber": "JCN2390",
              "addressLine1": "white corner road",
              "addressLine2": "",
              "city": "garner",
              "state": "AK",
              "zipCode": "529374",
              "dob": "02022002",
              "gender": "F"
            }
          ],
          "claim": [
            {
              "claimNumber": "112580",
              "claimTotalCharge": "4000",
              "POS": "11",
              "claimFrequencyCode": "7",
              "relatedCauseCode1": "EE",
              "relatedCauseCode2": "OA",
              "relatedCauseCode3": "AA",
              "illnessDate": "02022018",
              "renderingProvider": [
                {
                  "lastName": "Rendering_LAST",
                  "firstName": "Rendering_FIRST",
                  "middileName": "",
                  "prefix": "",
                  "suffix": "",
                  "NPINO": "REN9872NPI",
                  "taxonomyCode": "RENDTAX"
                },
                {
                  "lastName": "Rendering_LAST2",
                  "firstName": "Rendering_FIRST2",
                  "middileName": "",
                  "prefix": "",
                  "suffix": "",
                  "NPINO": "REN9872NPI2",
                  "taxonomyCode": "RENDTAX2"
                }
              ],
              "servicefacility": [
                {
                  "lastName": "SF_LAST",
                  "firstName": "SF_FIRST",
                  "middileName": "",
                  "prefix": "",
                  "suffix": "",
                  "NPINO": "SF9872NPI",
                  "taxonomyCode": "SFDTAX"
                }
              ],
              "referringProvider": [
                {
                  "lastName": "Referring_LAST",
                  "firstName": "Referring_FIRST",
                  "middileName": "",
                  "prefix": "",
                  "suffix": "",
                  "NPINO": "REF9872NPI",
                  "taxonomyCode": "REFTAX"
                }
              ],
              "otherSubscriber": [
                {
                  "otherClaimResponsibleParty": "S",
                  "relationship": "11",
                  "policyNumber": "azsx",
                  "groupName": "",
                  "insuranceTypeCode": "retried",
                  "claimFillingCode": "CL",
                  "lastName": " ADAM",
                  "firstName": "ANDREW",
                  "middleName": "ST",
                  "prefix": "",
                  "suffix": "",
                  "policyNO": "1q9o0p",
                  "addressLine1": "1st main road",
                  "addressLine2": "2nd street",
                  "city": "chennai",
                  "state": "TN",
                  "zipCode": "123456"
                }
              ],
              "OtherPayer": [
                {
                  "name": "21st century insurance",
                  "payerID": "1q2w",
                  "addressLine1": "1st street",
                  "addressLine2": " ",
                  "city": "bangalore",
                  "state": "AK",
                  "zipCode": "1233"
                }
              ],
              "serviceLine": [
                {
                  "examCpt": "76377",
                  "mod1": "TC",
                  "mod2": "",
                  "mod3": "",
                  "mod4": "",
                  "billFee": "200",
                  "unit": "1",
                  "pointer1": "2",
                  "pointer2": "",
                  "pointer3": "",
                  "pointer4": "",
                  "studyDate": "04022018",
                  "lineAdjudication": [
                    {
                      "payerID": "azsx",
                      "paidAmount": "200",
                      "cpt": 76377,
                      "modifier1": "TC",
                      "modifier2": "",
                      "modifier3": "",
                      "modifier4": "",
                      "unit": "1",
                      "lineAdjustment": {
                        "adjustmentGroupCode": "OA",
                        "reasonCode": "19",
                        "monetaryAmount": "10"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};
