define([ 'backbone', 'immutable', 'moment', 'shared/utils' ], function ( Backbone, Immutable, moment, utils ) {

    var isTrue = utils.isTrue;
    var showOrderBasedCompletedMuDataset = utils.showOrderBasedCompletedMuDataset;

    var deliveryStatus = function ( cellvalue ) {
        if ( !cellvalue || cellvalue === "undefined" ) {
            return "Pending";
        }
        return cellvalue;
    };

    var orderTypes = {
        "P": "Pre-order",
        "S": "Schedule",
        "W": "Walkin"
    };

    var billingClassesColorCode = function (rowObject) {

        if (rowObject && rowObject.billing_class_id) {
            var billingClassObj = _.find(app.billing_classes, { 'id': parseInt(rowObject.billing_class_id) }) || {};
            return billingClassObj && billingClassObj.color_code || 'transparent';
        }
        return 'transparent';
    };

    var billingCodesColorCode = function (rowObject) {

        if (rowObject && rowObject.billing_code_id) {
            var billingCodeObj = _.find(app.billing_codes, { 'id': parseInt(rowObject.billing_code_id) }) || {};
            return billingCodeObj && billingCodeObj.color_code || 'transparent';
        }
        return 'transparent';
    };


    var sortCasCodes = function() {
        var integers = [];
        var characters = [];

        //Determine which CAS Codes are integers and which are strings
        for (var i = 0; i < app.cas_reason_codes.length; i++) {
            var indCode = app.cas_reason_codes[i].code;
            if (isNaN(indCode)) {
                characters.push(indCode);
            } else {
                integers.push(parseInt(indCode));
            }
        }

        //Sort by respective type, then combine
        var x = integers.sort(function(a, b){return a-b});
        var y = characters.sort();
        var combinedArr = x.concat(y);

        //Assemble array to be returned
        var sortedCasCodes = [];
        /* eslint-disable no-redeclare */
        for (var i = 0; i < combinedArr.length; i++) {
        /* eslint-enable no-redeclare */
            var combInd = combinedArr[i];
            for (var j = 0; j < app.cas_reason_codes.length; j++) {
                var casIndCode = app.cas_reason_codes[j].code;
                var casIndObj = app.cas_reason_codes[j];
                if (combInd == casIndCode) {
                    sortedCasCodes.push(casIndObj);
                }
            }
        }

        return sortedCasCodes;
    }

    return function ( filterType ) {
        var isNeither = true;

        var typeValue =   ":All;S:Schedule;W:Walkin";
        var deliveryStatusValue = ':All;Sent:Sent;Pending:Pending';
        var statLevelValue = {};
        var alt_status = {};

        var priorityValue = commonjs.makeValue(commonjs.bindArray(app.priorities, false), ":All;");
        var modalityValue = commonjs.makeValue(_.sortBy(app.modalities, 'modality_code'), ":All;", "modality_code", "modality_code");

        // filter inactive and no show study facilities
        var facilityValue = commonjs.makeValue(commonjs.getCurrentUsersFacilitiesFromAppSettings(), ":All;", "id", "facility_name");
        var bodyPartValue = commonjs.makeValue(commonjs.bindArray(app.bodyParts, false), ":All;");
        var insProviderTypeValue = commonjs.makeValue(app.insurance_provider_payer_types, ":All;", "description", "description");
        var billingCodeValue = commonjs.makeValue(app.billing_codes, ":All;", "id", "description");
        var billingClassesValue = commonjs.makeValue(app.billing_classes, ":All;", "id", "description");
        var claimStatusValue = commonjs.makeValue(app.claim_status, ":All;", "id", "description");
        var billedStatus = ':All;billed:Billed;unbilled:Unbilled';
        var balanceSearchList = ':All; =0:= 0; >0:> 0; <0:< 0; |5:0 < 5; |10:0 - 10; |15:0 - 15; |20:0 - 20; |25:0 - 25; |30 :0 - 30';
        var studyFlagArray = app.studyflag;
        var clearingHouse = commonjs.makeValue(app.clearing_house, ":All;", "id", "name");
        var billingProviders = commonjs.makeValue(app.billing_providers, ":All;", "id", "full_name");
        var casReasonCodes = commonjs.makeValue(sortCasCodes(), ":All;", "code", "code");
        var placeOfService = commonjs.makeValue(app.places_of_service, ":All;", "id", "description");
        var vehicles = commonjs.makeValue(app.vehicles, ":All;", "id", "vehicle_name");
        var gender = commonjs.makeValue(commonjs.bindArray(app.gender, false), ":All;");
        var orderingFacilityTypes = commonjs.makeValue(app.ordering_facility_types, ":All;", "description", "description");
        var claimAction = ':All;corrected_claim:Corrected claim;new_claim:New claim';
        var renderingProvider = commonjs.makeValue(app.rendering_provider, ":All;", "full_name", "full_name");
        var billingType = (filterType == "claims")
            ? ':All;global:Global;facility:Facility;split:Split'
            : ':All;census:Census;global:Global;facility:Facility;split:Split';

        for ( var i = 0; i < studyFlagArray.length; i++ ) {
            if ( studyFlagArray[ i ].description.toUpperCase() == 'NONE' ) {
                break;
            }
        }
        app.report_queue_status = [
            {
                "code": "QU",
                "description": "Queued"
            },
            {
                "code": "PR",
                "description": "Progress"
            },
            {
                "code": "SE",
                "description": "Sending"
            },
            {
                "code": "ST",
                "description": "Sent"
            },
            {
                "code": "CA",
                "description": "Canceled"
            },
            {
                "code": "RS",
                "description": "Resend"
            },
            {
                "code": "FA",
                "description": "Failed"
            },
            {
                "code": "IV",
                "description": "Invalid"
            },
            {
                "code": "PQ",
                "description": "Print - Queued"
            },
            {
                "code": "PD",
                "description": "Printed"
            },
            {
                "code": "UP",
                "description": "[Updox] Sent - Pending"
            },
            {
                "code": "US",
                "description": "[Updox] Sent - Succeeded"
            },
            {
                "code": "UF",
                "description": "[Updox] Sent - Failed"
            }
        ];

        var studyFlagFormatter = function (cellvalue, options, rowObject) {
            var flag_design = [];

            if (rowObject) {
                var flagList = rowObject.study_flags;

                if (flagList && flagList.length) {
                    flagList.forEach(function (flagId) {
                        var flagDetails = _.find(app.studyflag, { 'id': parseInt(flagId) }) || {};

                        flag_design.push("<div title='" + flagDetails.description + "' data_id='" + flagDetails.id + "' style='text-align: center;  max-width: 100px; width: 24%; float: left; margin: 1px; overflow: inherit; border-radius: 10px; background:" + flagDetails.color_code + ";' >" + flagDetails.description + "</div>");
                    });
                }
            }
            return flag_design.join(' ');
        };

        var modalityRoomValue = commonjs.makeValue(app.modality_room, ":All;", "id", "modality_room_name");
        var reportQueueValue = commonjs.makeValue(app.report_queue_status, ":All;", "code", "description");

        var imageDeliveryOptions = [{
            'type': 'delivery_cd',
            'label': 'CD'
        }, {
            'type': 'delivery_film',
            'label': 'Film'
        }, {
            'type': 'delivery_paper',
            'label': 'Paper'
        }];
        var imageDeliveryValue = commonjs.makeValue(imageDeliveryOptions, ':All;', 'type', 'label');
        var deletedValue = ":All;true:Only;false:None";
        var verifiedValue = ":All;true:Yes;false:No";
        var billingMethodValue =  ":All;electronic_billing:Electronic Billing;paper_claim:Paper Claim;direct_billing:Direct Billing;patient_payment:Patient Payment";
        var payerTypeValue =  ':All;primary_insurance:Primary Insurance;secondary_insurance:Secondary Insurance;tertiary_insurance:Tertiary Insurance;ordering_facility:Ordering facility;referring_provider:Referring Provider;patient:Patient';
        var billingMethodValueCan = ":All;electronic_billing:Electronic Billing;direct_billing:Direct Billing;patient_payment:Patient Payment";
        var payerTypeValueCan = ':All;primary_insurance:Primary Insurance;ordering_facility:Ordering facility;referring_provider:Referring Provider;patient:Patient';

        if (app.isMobileBillingEnabled && app.settings.enableMobileRad) {
            payerTypeValue = payerTypeValue + ';service_facility_location:Service Facility Location';
        }

        $.each(app.stat_level, function ( index, stat ) {
            if ( !stat.deleted ) {
                if ( parseInt(stat.level) === 0 ) {
                    statLevelValue[ 0 ] = "All";
                    alt_status[ '0' ] = "";
                }
                else {
                    statLevelValue[ stat.level ] = stat.description;
                    alt_status[ stat.level ] = stat.level.toString();
                }
            }
        });

        var searchTatValue = {};
        var searchAltTat = {};
        $.each(app.tat_config, function ( index, tat ) {
            if ( !tat.deleted ) {
                var tat_index = (tat.id && tat.id.indexOf('_') > -1) ? parseInt(tat.id.split('_')[1]) : -1;
                if ( tat_index === 0 ) {
                    searchTatValue[ 0 ] = "All";
                    searchAltTat[ 0 ] = "";
                }
                else {
                    searchTatValue[ tat_index ] = (tat.description) ? tat.description : "";
                    searchAltTat[ tat_index ] = (tat.level) ? tat.level.toString() : "-1";
                }
            }
        });

        var dateFormatter = function ( cellvalue, options, rowObject ) {
            return commonjs.checkNotEmpty(cellvalue) ?
            commonjs.convertToFacilityTimeZone(rowObject.facility_id, cellvalue).format('L LT z') :
            '';
        };


        var claimDateFormatter = function ( cellvalue, options, rowObject ) {
            return commonjs.checkNotEmpty(cellvalue) ?
            commonjs.convertToFacilityTimeZone(rowObject.facility_id, cellvalue).format('L') : '';
        };
        var queuseStatusFormatter = function (cellvalue) {
            if (!cellvalue) return '-';
            return app.report_queue_status[_.findIndex(app.report_queue_status, {code: cellvalue})] && app.report_queue_status[_.findIndex(app.report_queue_status, {code: cellvalue})].description;
        };
        var getStatus = function ( data ) {
            var status = data.study_status || data.order_status_code ;
            status = status === 'TE' ?
                     'INC' :
                     status;
            return commonjs.getColorCodeForStatus(data.facility_id, status);
        };

        /**
         * Indicates if the study has addendum report
         *
         * @param {Object} data
         * @returns {boolean}
         */
        var hasAddendumReport = function(data) {
            return data.addendum_no && ['APP', 'DRFT', 'TRAN'].indexOf(data.study_status) > -1
        };

        // ADDING A NEW WORKLIST COLUMN <-- Search for this
        if(filterType=="claims"){
            return Immutable.Map({
                "Claim Date": {
                    "id": 1,
                    "field_code": "claim_dt",
                    "field_name": "Claim Date",
                    "i18n_name": "billing.claims.studyDate",
                    "field_info": {
                        "custom_name": "Claim Date",
                        "name": "claim_dt",
                        "searchFlag": "datetime",
                        "formatter": claimDateFormatter,
                        "width": 200
                    }
                },
                "Patient Name": {
                    "id": 2,
                    "field_code": "patient_name",
                    "field_name": "Patient Name",
                    "i18n_name": "billing.fileInsurance.patientNameGrid",
                    "field_info": {
                        "custom_name": "Patient Name",
                        "name": "patient_name",
                        "width": 170, "searchFlag": "%"
                    },
                },
                "Account No": {
                    "id": 3,
                    "field_code": "account_no",
                    "field_name": "Account No",
                    "i18n_name": "billing.refund.accountNo",
                    "field_info": {
                        "custom_name": "Account No",
                        "name": "account_no",
                        "width": 100,
                        "searchFlag": "%"
                    }
                },
                "Date Of Birth": {
                    "id": 4,
                    "field_code": "birth_date",
                    "field_name": "Date Of Birth",
                    "i18n_name": "setup.userSettings.dateofBirth",
                    "field_info": {
                        "custom_name": "Date Of Birth",
                        "name": "birth_date",
                        "width": 100,
                        "searchFlag": "date",
                        "formatter": function ( cellvalue ) {
                            return commonjs.checkNotEmpty(cellvalue) ?
                                   commonjs.getFormattedUtcDate(cellvalue) :
                                   '';
                        }
                    }
                },
                "SSN": {
                    "id": 5,
                    "field_code": "patient_ssn",
                    "field_name": "SSN",
                    "i18n_name": "shared.fields.ssn",
                    "field_info": {
                        "custom_name": "SSN",
                        "name": "patient_ssn",
                        "width": 100,
                        "searchFlag": "%",
                        "hidden": app.country_alpha_3_code === 'can'
                    }
                },
                "Place Of Service": {
                    "id":6,
                    "field_code": "place_of_service",
                    "field_name": "Place Of Service",
                    "i18n_name": "billing.refund.placeOfService",
                    "field_info": {
                        "custom_name": "Place Of Service",
                        "name": "place_of_service",
                        "width": 200,
                        "stype": "select",
                        "hidden": app.country_alpha_3_code === 'can',
                        "searchoptions": {
                            "value": placeOfService,
                            "tempvalue": placeOfService
                        },
                    }

                },
                "Referring Providers": {
                    "id":7,
                    "field_code": "referring_providers",
                    "field_name": "Referring Providers",
                    "i18n_name": "setup.userSettings.referringPhysician",
                    "field_info": {
                        "custom_name": "Referring Providers",
                        "name": "referring_providers",
                        "width": 200,
                        "searchFlag": "%"
                    }
                },
                "Rendering Providers": {
                    "id":8,
                    "field_code": "rendering_provider",
                    "field_name": "Rendering Providers",
                    "i18n_name": "setup.userSettings.renderingPhysician",
                    "field_info": {
                        "custom_name": "Rendering Providers",
                        "name": "rendering_provider",
                        "width": 200,
                        "stype": "select",
                        "searchoptions": {
                            "value": renderingProvider,
                            "tempvalue": renderingProvider
                        }
                    }
                },
                "Billing Fee": {
                    "id":9,
                    "field_code": "billing_fee",
                    "field_name": "Billing Fee",
                    "i18n_name": "billing.COB.billingFee",
                    "field_info": {
                        "custom_name": "Billing Fee",
                        "name": "billing_fee",
                        "width": 200
                    }
                },
                "Payer Type": {
                    "id": 11,
                    "field_code": "payer_type",
                    "field_name": "Payer Type",
                    "i18n_name": "billing.fileInsurance.payerType",
                    "field_info": {
                        "custom_name": "Payer Type",
                        "name": "payer_type",
                        "stype": "select",
                        "searchoptions": {
                            "value": app.country_alpha_3_code !== 'can' ? payerTypeValue : payerTypeValueCan,
                            "tempvalue": app.country_alpha_3_code !== 'can' ? payerTypeValue : payerTypeValueCan,
                        },
                        "formatter": function ( cellvalue ) {
                            return commonjs.checkNotEmpty(cellvalue) ?
                                   commonjs.getPayerType(cellvalue) :
                                   '';
                        },
                        "width": 150,
                        "sortable": " true"
                    }
                },
                "Clearing House": {
                    "id": 12,
                    "field_code": "clearing_house",
                    "field_name": "Clearing House",
                    "i18n_name": "billing.fileInsurance.clearingHouse",
                    "hidden": app.country_alpha_3_code === "can",
                    "field_info": {
                        "custom_name": "Clearing House",
                        "name": "clearing_house",
                        "width": 80,
                        "stype": "select",
                        "searchoptions": {
                            "value": clearingHouse,
                            "tempvalue":clearingHouse
                        },
                    }
                },
                "Payer Name": {
                    "id": 13,
                    "field_code": "payer_name",
                    "field_name": "Responsible Party",
                    "i18n_name": "setup.userSettings.responsibleParty",
                    "field_info": {
                        "custom_name": "Payer Name",
                        "name": "payer_name",
                        "width": 150,
                        "sortable": "true"
                    }
                },
                "Balance": {
                    "id": 14,
                    "field_code": "claim_balance",
                    "field_name": "Balance",
                    "i18n_name": "billing.claims.balance",
                    "field_info": {
                        "custom_name": "Balance",
                        "name": "claim_balance",
                        "sortable": false,
                        "width": 100,
                        "stype": "select",
                        "searchoptions": {
                            "value": balanceSearchList,
                            "tempvalue": balanceSearchList
                        }
                    }
                },
                "Billing Class": {
                    "id": 15,
                    "field_code": "billing_class",
                    "field_name": "Billing Class",
                    "i18n_name": "billing.fileInsurance.billingClass",
                    "field_info": {
                        "custom_name": "Billing Class",
                        "name": "billing_class",
                        "width": 120,
                        "stype": "select",
                        "searchoptions": {
                            "value": billingClassesValue,
                            "tempvalue": billingClassesValue
                        },
                        "cellattr": function (id, cellvalue, rowObject) {
                            return 'style="background:' +  billingClassesColorCode(rowObject) + ';"';
                        }
                    }
                },
                "Billing Code": {
                    "id": 16,
                    "field_code": "billing_code",
                    "field_name": "Billing Code",
                    "i18n_name": "billing.fileInsurance.billingCode",
                    "field_info": {
                        "custom_name": "Billing Code",
                        "name": "billing_code",
                        "width": 100,
                        "stype": "select",
                        "searchoptions": {
                            "value": billingCodeValue,
                            "tempvalue": billingCodeValue
                        },
                        "cellattr": function (id, cellvalue, rowObject) {
                            return 'style="background:' + billingCodesColorCode(rowObject) + ';"';
                        }
                    }
                },
                "Claim Status": {
                    "id": 17,
                    "field_code": "claim_status",
                    "field_name": "Claim Status",
                    "i18n_name": "billing.fileInsurance.claimStatus",
                    "field_info": {
                        "custom_name": "Claim Status",
                        "name": "claim_status",
                        "width": 120,
                        "stype": "select",
                        "searchoptions": {
                            "value": claimStatusValue,
                            "tempvalue": claimStatusValue
                        },
                        "defaultValue": "",
                        "cellattr": function ( id, cellvalue, rowObject ) {
                            var statusDetail = commonjs.getClaimColorCodeForStatus(rowObject.claim_status_code, 'claim');
                            var statusObj = statusDetail[ 0 ];
                            return 'style="background:' + (statusObj && statusObj.color_code || 'transparent') + ';"';
                        },
                    }
                },
                "Notes": {
                    "id": 18,
                    "field_code": "billing_notes",
                    "field_name": "Notes",
                    "i18n_name": "billing.COB.notes",
                    "field_info": {
                        "custom_name": "Notes",
                        "name": "billing_notes",
                        "width": 100,
                        "defaultValue": "",
                        "cellattr": function (id, cellvalue, rowObject) {
                            if (app.country_alpha_3_code === "can") {
                                return 'title="' + rowObject.billing_notes + '"';
                            }
                        },
                        "formatter": function ( cellvalue ) {
                            cellvalue = cellvalue || '';

                            if (app.country_alpha_3_code === "can") {
                                var errors = cellvalue.split('\n');
                                var codes = [];

                                for (var i = 0; i < errors.length; i++) {
                                    var code = errors[i].split(' - ');
                                    codes.push(code[0]);
                                }

                                return codes.join();
                            }

                            cellvalue = cellvalue.replace(/(?:\n)/g, '<br />');
                            var regex = /<br\s*[/]?>/gi;
                            return cellvalue.replace(regex, "\n");
                        }
                    }

                },
                "Claim No": {
                    "id": 19,
                    "field_code": "claim_no",
                    "field_name": "Claim No",
                    "i18n_name": "billing.fileInsurance.claimNo",
                    "field_info": {
                        "custom_name": "Claim No",
                        "name": "claim_no",
                        "width": 75,
                        "hidden": false
                    }
                },
                "AHS Claim Num": {
                    "id": 70,
                    "field_code": "can_ahs_claim_no",
                    "field_name": "AHS Claim Num",
                    "i18n_name": "setup.cptCodes.can_ahs.ahsclaimno",
                    "field_info": {
                        "custom_name": "AHS Claim Num",
                        "name": "can_ahs_claim_no",
                        "width": 150,
                        "hidden": app.billingRegionCode !== "can_AB"
                    }
                },
                "Invoice": {
                    "id": 21,
                    "field_code": "invoice_no",
                    "field_name": "Invoice",
                    "i18n_name": "shared.buttons.invoice",
                    "field_info": {
                        "custom_name": "Invoice",
                        "name": "invoice_no",
                        "width": 75
                    }
                },
                "Billing Method": {
                    "id": 22,
                    "field_code": "billing_method",
                    "field_name": "Billing Method",
                    "i18n_name": "billing.fileInsurance.billingmethod",
                    "field_info": {
                        "custom_name": "Billing Method",
                        "name": "billing_method",
                        "formatter": function ( cellvalue ) {
                            return commonjs.checkNotEmpty(cellvalue) ?
                                   commonjs.getBillingMethod(cellvalue) :
                                   '';
                        },
                        "width": 150,
                        "stype": "select",
                        "searchoptions": {
                            "value": app.billingRegionCode !== 'can_ON' ? billingMethodValue : billingMethodValueCan,
                            "tempvalue": app.billingRegionCode !== 'can_ON' ? billingMethodValue : billingMethodValueCan
                        }
                    },
                },
                "Follow-up Date": {
                    "id": 23,
                    "field_code": "followup_date",
                    "field_name": "Follow-up Date",
                    "i18n_name": "billing.fileInsurance.followUpDate",
                    "field_info": {
                        "custom_name": "Follow-up Date",
                        "name": "followup_date",
                        "formatter": function ( cellvalue ) {
                            return commonjs.checkNotEmpty(cellvalue) ? commonjs.getFormattedUtcDate(cellvalue) : '';
                        },
                        "width": "150",
                        "searchFlag":"datetime"
                    }
                },
                "Date of Injury": {
                    "id": 24,
                    "field_code": "current_illness_date",
                    "field_name": "Date of Injury",
                    "i18n_name": "billing.fileInsurance.dateOfInjury",
                    "field_info": {
                        "custom_name": "Date of Injury",
                        "name": "current_illness_date",
                        "formatter":  function ( cellvalue ) {
                            return commonjs.checkNotEmpty(cellvalue) ? commonjs.getFormattedUtcDate(cellvalue) : '';
                        },
                        "width": 200
                    }
                },
                "Policy Number": {
                    "id": 25,
                    "field_code": "policy_number",
                    "field_name": "Policy Number",
                    "i18n_name": "shared.fields.policyNumber",
                    "field_info": {
                        "custom_name": "Policy Number",
                        "name": "policy_number",
                        "width": 200
                    }
                },
                "Group Number": {
                    "id": 26,
                    "field_code": "group_number",
                    "field_name": "Group Number",
                    "i18n_name": "setup.userSettings.groupNumber",
                    "field_info": {
                        "custom_name": "Group Number",
                        "name": "group_number",
                        "width": 200
                    }
                },
                "Billing Provider": {
                    "id": 27,
                    "field_code": "billing_provider",
                    "field_name": "Billing Provider",
                    "i18n_name": "shared.screens.setup.billingProvider",
                    "field_info": {
                        "custom_name": "Billing Provider",
                        "name": "billing_provider",
                        "width": 200,
                        "stype": "select",
                        "searchoptions": {
                            "value": billingProviders,
                            "tempvalue": billingProviders
                        }
                    }
                },
                "Submitted Date":{
                    "id": 28,
                    "field_code": "submitted_dt",
                    "field_name": "Submitted Date",
                    "i18n_name": "setup.userSettings.submittedDate",
                    "field_info": {
                      "custom_name": "Submitted Date",
                      "name": "submitted_dt",
                      "searchFlag": "datetime",
                      "formatter": claimDateFormatter,
                      "width": 200
                    }

                  },
                  "First Statement Date": {
                    "id": 29,
                    "field_code": "first_statement_dt",
                    "field_name": "First Statement Date",
                    "i18n_name": "setup.userSettings.firstStatementDate",
                    "field_info": {
                        "custom_name": "First Statement Date",
                        "name": "first_statement_dt",
                        "formatter": function (cellvalue) {
                            return commonjs.checkNotEmpty(cellvalue) ? commonjs.getFormattedUtcDate(cellvalue) : '';
                        },
                        "width": "150",
                        "searchFlag": "datetime"
                    }
                },
                "Ordering Facility": {
                    "id": 30,
                    "field_name": "Ordering Facility",
                    "i18n_name": "setup.userSettings.orderingFacility",
                    "field_info": {
                        "custom_name": "Ordering Facility",
                        "name": "ordering_facility_name",
                        "width": 250,
                        "defaultValue": ""
                    },
                    "field_code": "ordering_facility_name"
                },
                "Facility": {
                    "id": 31,
                    "field_name": "Facility",
                    "i18n_name": "setup.userSettings.facility",
                    "field_info": {
                        "custom_name": "Facility",
                        "name": "facility_name",
                        "width": 200,
                        "stype": "select",
                        "searchoptions": {
                            "value": facilityValue,
                            "tempvalue": facilityValue
                        }
                    },
                    "field_code": "facility_name"
                },
                "Charge Description": {
                    "id": 10,
                    "field_name": "Charge Description",
                    "i18n_name": "setup.userSettings.chargeDescription",
                    "field_info": {
                        "custom_name": "Charge Description",
                        "name": "charge_description",
                        "width": 250,
                        "defaultValue": ""
                    },
                    "field_code": "charge_description"
                },
                "Ins Provider Type": {
                    "id": 32,
                    "field_name": "Ins Provider Type",
                    "i18n_name": "setup.userSettings.insProviderType",
                    "field_info": {
                        "custom_id": 63,
                        "custom_name": "Ins Provider Type",
                        "name": "ins_provider_type",
                        "width": 200,
                        "searchFlag": "%",
                        "stype": "select",
                        "searchoptions": {
                            "value": insProviderTypeValue,
                            "tempvalue": insProviderTypeValue
                        },
                        "sortable": true
                    },
                    "field_code": "ins_provider_type"
                },
                "Insurance Providers": {
                    "id": 43,
                    "field_name": "Insurance Providers",
                    "i18n_name": "setup.userSettings.insuranceProviders",
                    "field_info": {
                        "custom_name": "Insurance Providers",
                        "name": "insurance_providers",
                        "width": 200,
                        "search": true,
                        "sortable": true,
                        "defaultValue": ""
                    },
                    "field_code": "insurance_providers"
                },
                "Payment ID": {
                    "id": 33,
                    "field_name": "Payment ID",
                    "i18n_name": "billing.payments.paymentID",
                    "field_info": {
                        "custom_id": 64,
                        "custom_name": "Payment ID",
                        "name": "payment_id",
                        "width": 200,
                        "searchFlag": "array",
                        "sortable": false,
                        "hidden": app.country_alpha_3_code !== 'can'
                    },
                    "field_code": "payment_id"
                },
                "ICD Description": {
                    "id": 34,
                    "field_name": "ICD Description",
                    "i18n_name": "patient.advancedSearch.icdDescription",
                    "field_info": {
                        "custom_name": "ICD Description",
                        "name": "icd_description",
                        "width": 250,
                        "defaultValue": ""
                    },
                    "field_code": "icd_description"
                },
                "Responsible Party": {
                    "id": 35,
                    "field_code": "payer_name",
                    "field_name": "Responsible Party",
                    "i18n_name": "setup.userSettings.responsibleParty",
                    "field_info": {
                        "custom_name": "Responsible Party",
                        "name": "payer_name",
                        "width": 250,
                        "searchFlag": "=",
                        "sortable": true,
                        "defaultValue": ""
                    }
                },
                "AHS Claim Action": {
                    "id": 44,
                    "field_code": "claim_action",
                    "field_name": "AHS Claim Action",
                    "i18n_name": "billing.claims.canAhs.claimAction",
                    "field_info": {
                        "custom_name": "AHS Claim Action",
                        "name": "claim_action",
                        "width": 250,
                        "sortable": false,
                        "defaultValue": "",
                        "stype": "select",
                        formatter: function ( cellvalue ) {
                            return cellvalue === 'corrected_claim' ? 'Corrected claim' : 'New claim';
                        },
                        "searchoptions": {
                            "value": claimAction,
                            "tempvalue": claimAction
                        },
                        "hidden": app.billingRegionCode !== 'can_AB'
                    }
                },
                "Line Reason Code": {
                    "id": 69,
                    "field_code": "line_eob_codes",
                    "field_name": "Line Reason Code",
                    "i18n_name": "setup.userSettings.lineReasonCode",
                    "field_info": {
                        "custom_name": "Line Reason Code",
                        "name": "line_eob_codes",
                        "width": 150,
                        "searchFlag": "%",
                        "stype": "select",
                        "sortable": true,
                        "searchoptions": {
                            "value": casReasonCodes
                        }
                    }
                },
                "Claim Reason Code": {
                    "id": 80,
                    "field_code": "claim_eob_codes",
                    "field_name": "Claim Reason Code",
                    "i18n_name": "setup.userSettings.claimReasonCode",
                    "field_info": {
                        "custom_name": "Claim Reason Code",
                        "name": "claim_eob_codes",
                        "width": 150,
                        "searchFlag": "%",
                        "stype": "select",
                        "sortable": true,
                        "searchoptions": {
                            "value": casReasonCodes
                        }
                    }
                },
                "Microfilm Number": {
                    "id": 71,
                    "field_code": "can_mhs_microfilm_no",
                    "field_name": "Microfilm Number",
                    "i18n_name": "setup.userSettings.microfilmNumber",
                    "field_info": {
                        "custom_name": "Microfilm Number",
                        "name": "can_mhs_microfilm_no",
                        "width": 250,
                        "searchFlag": "%",
                        "sortable": true,
                        "defaultValue": "",
                        "hidden": !(app.billingRegionCode === 'can_MB')
                    }
                },
                "Alt Account No": {
                    "id": 72,
                    "field_name": "Alt Account No",
                    "i18n_name": "patient.advancedSearch.altAccountNo",
                    "field_info": {
                        "custom_name": "Alt Account No",
                        "name": "pid_alt_account",
                        "width": 150,
                        "searchFlag": "%",
                        "sortable": true,
                        "defaultValue": "",
                        "hidden": (app.country_alpha_3_code !== 'can')
                    },
                    "field_code": "pid_alt_account"
                },
                "PHN": {
                    "id": 73,
                    "field_name": "PHN",
                    "i18n_name": "shared.fields.phnuli",
                    "field_info": {
                        "custom_name": "PHN",
                        "name": "phn_alt_account",
                        "width": 150,
                        "searchFlag": "%",
                        "sortable": true,
                        "defaultValue": "",
                        "hidden": ['can_AB', 'can_BC', 'can_MB'].indexOf(app.billingRegionCode) == -1
                    },
                    "field_code": "phn_alt_account"
                },
                "Claim Created Dt": {
                    "id": 74,
                    "field_code": "created_dt",
                    "field_name": "Claim Created Dt",
                    "i18n_name": "setup.userSettings.claimDate",
                    "field_info": {
                        "custom_name": "Claim Created Dt",
                        "name": "created_dt",
                        "searchFlag": "datetime",
                        "formatter": claimDateFormatter,
                        "width": 200
                    }
                },
                "Sequence Numbers": {
                    "id": 75,
                    "field_name": "Sequence Numbers",
                    "i18n_name": "shared.fields.sequenceNumbers",
                    "field_info": {
                        "custom_name": "Sequence Numbers",
                        "name": "can_bc_claim_sequence_numbers",
                        "width": 150,
                        "searchFlag": "%",
                        "sortable": true,
                        "defaultValue": "",
                        "hidden": app.billingRegionCode !== 'can_BC'
                    },
                    "field_code": "can_bc_claim_sequence_numbers"
                },
                "Modality": {
                    "id": 76,
                    "field_name": "Modality",
                    "i18n_name": "setup.userSettings.modality",
                    "field_info": {
                        "custom_name": "Modality",
                        "name": "modalities",
                        "width": 150,
                        "stype": "select",
                        "searchoptions": {
                            "value": modalityValue,
                            "tempvalue": modalityValue
                        }
                    },
                    "field_code": "modalities"
                },
                "Billing type": {
                    "id": 77,
                    "field_name": "Billing type",
                    "i18n_name": "shared.fields.billing_type",
                    "field_info": {
                        "custom_name": "Billing type",
                        "name": "billing_type",
                        "width": 150,
                        formatter: function ( cellvalue ) {
                            return cellvalue ? cellvalue.split('_')[0] : 'global';
                        },
                        "hidden": !app.isMobileBillingEnabled || app.country_alpha_3_code === 'can',
                        "stype": "select",
                            "searchoptions": {
                                "value": billingType,
                                "tempvalue": billingType
                            },
                    },
                    "field_code": "billing_type"
                },
                "Ordering Facility Type": {
                    "id": 78,
                    "field_code": "ordering_facility_type",
                    "field_name": "Ordering Facility Type",
                    "i18n_name": "shared.fields.ordFacilityType",
                    "field_info": {
                        "custom_name": "Ordering Facility Type",
                        "name": "ordering_facility_type",
                        "width": 150,
                        "stype": "select",
                        "searchoptions": {
                            "value": orderingFacilityTypes,
                            "tempvalue": orderingFacilityTypes
                        }
                    }
                }
            });
        }
        return Immutable.Map({
            "Account#": {
                "id": 1,
                "field_name": "Account#",
                "i18n_name": "setup.userSettings.accountNo",
                "field_info": {
                    "custom_name": "Account#",
                    "name": "account_no",
                    "width": 200
                },
                "field_code": "account_no"
            },
            "ID": {
                "id": 2,
                "field_name": "ID",
                "i18n_name": "shared.fields.id",
                "field_info": {
                    "custom_name": "ID",
                    "name": "study_id",
                    "width": 0,
                    "index": "study_id",
                    "key": true,
                    "hidden": true
                },
                "field_code": "study_id"
            },
            "Study Description": {
                "id": 3,
                "field_name": "Study Description",
                "i18n_name": "shared.fields.studyDescription",
                "field_info": {
                    "custom_name": "Study Description",
                    "name": "study_description",
                    "width": 250,
                    "defaultValue": ""
                },
                "field_code": "study_description"
            },
            "Station": {
                "id": 4,
                "field_name": "Station",
                "i18n_name": "setup.userSettings.station",
                "field_info": {
                    "custom_name": "Station",
                    "name": "station",
                    "width": 100,
                    "defaultValue": ""
                },
                "field_code": "station"
            },
            "Study Received Date": {
                "id": 5,
                "field_name": "Study Received Date",
                "i18n_name": "setup.userSettings.studyReceivedDate",
                "field_info": {
                    "custom_name": "Study Received Date",
                    "name": "study_received_dt",
                    "width": 200,
                    "formatter": dateFormatter,
                    "defaultValue": "",
                    "search": true
                },
                "field_code": "study_received_dt"
            },
            "BodyPart": {
                "id": 6,
                "field_name": "BodyPart",
                "i18n_name": "setup.userSettings.bodyPart",
                "field_info": {
                    "custom_name": "BodyPart",
                    "name": "body_part",
                    "width": 150,
                    "stype": "select",
                    "searchoptions": {
                        "value": bodyPartValue,
                        "tempvalue": bodyPartValue
                    }
                },
                "field_code": "body_part"
            },
            "Department": {
                "id": 7,
                "field_name": "Department",
                "i18n_name": "setup.userSettings.department",
                "field_info": {
                    "custom_name": "Department",
                    "name": "department",
                    "width": 100,
                    "defaultValue": ""
                },
                "field_code": "department"
            },
            "Reason for Study": {
                "id": 8,
                "field_name": "Reason for Study",
                "i18n_name": "setup.userSettings.reasonForStudy",
                "field_info": {
                    "custom_name": "Reason for Study",
                    "name": "reason_for_study",
                    "width": 150,
                    "defaultValue": ""
                },
                "field_code": "reason_for_study"
            },
            "Modality": {
                "id": 9,
                "field_name": "Modality",
                "i18n_name": "setup.userSettings.modality",
                "field_info": {
                    "custom_name": "Modality",
                    "name": "modalities",
                    "width": 150,
                    "stype": "select",
                    "searchoptions": {
                        "value": modalityValue,
                        "tempvalue": modalityValue
                    }
                },
                "field_code": "modalities"
            },
            "Patient": {
                "id": 10,
                "field_name": "Patient",
                "i18n_name": "setup.userSettings.patient",
                "field_info": {
                    "custom_name": "Patient",
                    "name": "patient_name",
                    "width": 250,
                    "formatter": function ( cellvalue, options, rowObject ) {
                        if (options.format === 'csv') {
                            return rowObject.linked_study_id > 0 ? rowObject.patient_name : cellvalue;
                        }

                        return rowObject.linked_study_id > 0 ?
                            '<span class="linkSpan"><span>' + rowObject.patient_name + '</span><span title="linked study" style="display:inline-block;" class="ui-icon ui-icon-link linkSpan"></span></span>' :
                            cellvalue;


                    }
                },
                "field_code": "patient_name"
            },
            "DOB": {
                "id": 11,
                "field_name": "DOB",
                "i18n_name": "setup.userSettings.dob",
                "field_info": {
                    "custom_name": "DOB",
                    "name": "birth_date",
                    "width": 200,
                    "formatter": function ( cellvalue ) {
                        return commonjs.checkNotEmpty(cellvalue) ?
                               commonjs.getFormattedUtcDate(cellvalue) :
                               '';
                    },
                    "defaultValue": ""
                },
                "field_code": "birth_date"
            },
            "Gender": {
                "id": 12,
                "field_name": "Gender",
                "i18n_name": "setup.userSettings.gender",
                "field_info": {
                    "custom_name": "Gender",
                    "name": "gender",
                    "width": 100,
                    "stype": "select",
                    "searchoptions": {
                        "value": gender,
                        "tempvalue": gender
                    }
                },
                "field_code": "gender"
            },
            "Age-Time of Study": {
                "id": 13,
                "field_name": "Age-Time of Study",
                "i18n_name": "setup.userSettings.ageTimeOfStudy",
                "field_info": {
                    "custom_name": "Age-Time of Study",
                    "name": "patient_age",
                    "width": 100,
                    "formatter": function ( cellvalue, options, data ) {
                        return data.patient_age || "";
                    },
                    "defaultValue": "",
                    "hidden": false
                },
                "field_code": "patient_age"
            },
            "Ref.Physician": {
                "id": 14,
                "field_name": "Ref.Physician",
                "i18n_name": "setup.userSettings.refPhy",
                "field_info": {
                    "custom_name": "Ref.Physician",
                    "name": "refphy_name",
                    "width": 250,
                    "defaultValue": ""
                },
                "field_code": "refphy_name"
            },
            "Study Date": {
                "id": 15,
                "field_name": "Study Date",
                "i18n_name": "shared.fields.studyDate",
                "field_info": {
                    "custom_name": "Study Date",
                    "name": "study_dt",
                    "width": 200,
                    "formatter": dateFormatter,
                    "defaultValue": "",
                    "search": true,
                    "hidden": false
                },
                "field_code": "study_dt"
            },
            "Accession #": {
                "id": 16,
                "field_name": "Accession #",
                "i18n_name": "setup.userSettings.accession",
                "field_info": {
                    "custom_name": "Accession #",
                    "name": "accession_no",
                    "width": 200
                },
                "field_code": "accession_no"
            },
            "Facility": {
                "id": 17,
                "field_name": "Facility",
                "i18n_name": "setup.userSettings.facility",
                "field_info": {
                    "custom_name": "Facility",
                    "name": "facility_name",
                    "width": 200,
                    "stype": "select",
                    "searchoptions": {
                        "value": facilityValue,
                        "tempvalue": facilityValue
                    }
                },
                "field_code": "facility_name"
            },
            "Alt Account No": {
                "id": 72,
                "field_name": "Alt Account No",
                "i18n_name": "patient.advancedSearch.altAccountNo",
                "field_info": {
                    "custom_name": "Alt Account No",
                    "name": "pid_alt_account",
                    "width": 150,
                    "searchFlag": "%",
                    "sortable": true,
                    "defaultValue": "",
                    "hidden": (app.country_alpha_3_code !== 'can')
                },
                "field_code": "pid_alt_account"
            },
            "PHN": {
                "id": 73,
                "field_name": "PHN",
                "i18n_name": "shared.fields.phnuli",
                "field_info": {
                    "custom_name": "PHN",
                    "name": "phn_alt_account",
                    "width": 150,
                    "searchFlag": "%",
                    "sortable": true,
                    "defaultValue": "",
                    "hidden": ['can_AB', 'can_BC', 'can_MB'].indexOf(app.billingRegionCode) == -1
                },
                "field_code": "phn_alt_account"
            },
            "Reading Physician": {
                "id": 18,
                "field_name": "Reading Physician",
                "i18n_name": "setup.userSettings.readPhy",
                "field_info": {
                    "custom_name": "Reading Physician",
                    "name": "readphy_name",
                    "width": 250,
                    "defaultValue": ""
                },
                "field_code": "readphy_name"
            },
            "Institution": {
                "id": 19,
                "field_name": "Institution",
                "i18n_name": "setup.userSettings.institution",
                "field_info": {
                    "custom_name": "Institution",
                    "name": "institution",
                    "width": 100,
                    "defaultValue": ""
                },
                "field_code": "institution"
            },
            "Stat": {
                "id": 20,
                "field_name": "Stat",
                "i18n_name": "setup.userSettings.stat",
                "field_info": {
                    "custom_name": "Stat",
                    "name": "stat_level",
                    "width": 150,
                    "stype": "select",
                    "sortable": false,
                    "formatter": function ( cellvalue ) {
                        if ( cellvalue > 0 ) {
                            if ( app.stat_level[ cellvalue ] ) {
                                return app.stat_level[ cellvalue ].description;
                            }
                            return cellvalue;
                        }
                        return '';
                    },
                    "cellattr": function ( id, cellvalue ) {
                        return 'style="background:' + (app.stat_level[ cellvalue ] && app.stat_level[ cellvalue ].color || 'transparent') + ';"';
                    },
                    "searchoptions": {
                        "value": statLevelValue,
                        "tempvalue": statLevelValue
                    },
                    "searchoptionsalt": {
                        "value": alt_status,
                        "alttempvalue": alt_status
                    }
                },
                "field_code": "stat_level"
            },
            "Series": {
                "id": 21,
                "field_name": "Series",
                "i18n_name": "shared.fields.series",
                "field_info": {
                    "custom_name": "Series",
                    "name": "no_of_series",
                    "width": 150,
                    "defaultValue": ""
                },
                "field_code": "no_of_series"
            },
            "IMGS": {
                "id": 22,
                "field_name": "IMGS",
                "i18n_name": "setup.userSettings.imgs",
                "field_info": {
                    "custom_name": "IMGS",
                    "name": "no_of_instances",
                    "width": 60,
                    "defaultValue": "",
                    "search": false
                },
                "field_code": "no_of_instances"
            },
            "Study Flag": {
                "id": 23,
                "field_name": "Study Flag",
                "i18n_name": "setup.userSettings.studyFlag",
                "field_info": {
                    "custom_name": "Study Flag",
                    "name": "study_flags",
                    "width": 100,
                    "search": true,
                    "sortable": false,
                    "formatter": studyFlagFormatter
                },
                "field_code": "study_flags"
            },
            "Priority": {
                "id": 24,
                "field_name": "Priority",
                "i18n_name": "setup.userSettings.priority",
                "field_info": {
                    "custom_name": "Priority",
                    "name": "priority",
                    "width": 150,
                    "stype": "select",
                    "searchoptions": {
                        "value": priorityValue,
                        "tempvalue": priorityValue
                    }
                },
                "field_code": "priority"
            },
            "Notes": {
                "id": 25,
                "field_name": "Notes",
                "i18n_name": "setup.userSettings.notes",
                "field_info": {
                    "custom_name": "Notes",
                    "name": "notes",
                    "width": 150,
                    "search": false,
                    "sortable": false,
                    "formatter": function ( cellvalue, options, rowObject ) {
                        var value =  rowObject.notes ;
                        var notes = commonjs.formatJson(value);
                        if ( notes && notes.length > 0 ) {
                            return notes[ 0 ].notes;
                        }
                        return '';
                    },
                    "cellattr": function ( rowID, val ) {
                        if ( val ) {
                            return 'style="text-overflow:ellipsis;"';
                        }
                    },
                    "defaultValue": ""
                },
                "field_code": "notes"
            },
            "CPT Codes": {
                "id": 26,
                "field_name": "CPT Codes",
                "i18n_name": "shared.fields.cptCodes",
                "field_info": {
                    "custom_name": "CPT Codes",
                    "name": "cpt_codes",
                    "width": 200,
                    "search": true,
                    "sortable": true,
                    "defaultValue": "",
                    "formatter": function ( cellvalue, options, rowobject ) {
                        return Array.isArray(rowobject.cpt_codes) ?
                               rowobject.cpt_codes.join() :
                               '';
                    }
                },
                "field_code": "cpt_codes"
            },
            "ICD Codes": {
                "id": 27,
                "field_name": "ICD Codes",
                "i18n_name": "setup.userSettings.icdCodes",
                "field_info": {
                    "custom_name": "ICD Codes",
                    "name": "icd_codes",
                    "width": 100,
                    "search": false,
                    "sortable": false,
                    "defaultValue": ""
                },
                "field_code": "icd_codes"
            },
            "Insurance Providers": {
                "id": 28,
                "field_name": "Insurance Providers",
                "i18n_name": "setup.userSettings.insuranceProviders",
                "field_info": {
                    "custom_name": "Insurance Providers",
                    "name": "insurance_providers",
                    "width": 200,
                    "search": true,
                    "sortable": true,
                    "defaultValue": ""
                },
                "field_code": "insurance_providers"
            },
            "Ordered By": {
                "id": 29,
                "field_name": "Ordered By",
                "i18n_name": "setup.userSettings.orderedBy",
                "field_info": {
                    "custom_name": "Ordered By",
                    "name": "ordered_by",
                    "formatter": function ( cellValue, options, rowobject ) {
                        if ( rowobject.userlastname || rowobject.userfirstname ) {
                            var concat_char = rowobject.userlastname && rowobject.userfirstname ? ',' : " ";
                            return rowobject.userlastname ? rowobject.userlastname : '' + concat_char + rowobject.userfirstname ? rowobject.userfirstname : '';
                        }
                        return '';
                    },
                    "width": 150,
                    "search": false,
                    "sortable": false,
                    "defaultValue": ""
                },
                "field_code": "ordered_by"
            },
            "Last Name": {
                "id": 30,
                "field_name": "Last Name",
                "i18n_name": "setup.userSettings.lastName",
                "field_info": {
                    "custom_name": "Last Name",
                    "name": "last_name",
                    "width": 250
                },
                "field_code": "last_name"
            },
            "First Name": {
                "id": 31,
                "field_name": "First Name",
                "i18n_name": "setup.userSettings.firstName",
                "field_info": {
                    "custom_name": "First Name",
                    "name": "first_name",
                    "width": 250
                },
                "field_code": "first_name"
            },
            "Schedule Type": {
                "id": 32,
                "field_name": "Schedule Type",
                "i18n_name": "setup.userSettings.scheduleType",
                "field_info": {
                    "custom_name": "Schedule Type",
                    "name": "order_type",
                    "width": 150,
                    "stype": "select",
                    "formatter": function ( cellvalue ) {
                        return orderTypes[ cellvalue ] || '';
                    },
                    "searchoptions": {
                        "value": typeValue,
                        "tempvalue": typeValue
                    },
                    "search": true,
                    "sortable": true
                },
                "field_code": "order_type"
            },
            "Vehicle Name": {
                "id": 33,
                "field_name": "Vehicle Name",
                "i18n_name": "setup.userSettings.vehicleName",
                "field_info": {
                    "custom_name": "Vehicle Name",
                    "name": "vehicle_name",
                    "width": 200,
                    "search": true,
                    "sortable": true,
                    "stype": "select",
                    "searchoptions": {
                        "value": vehicles,
                        "tempvalue": vehicles
                    },
                },
                "field_code": "vehicle_name"
            },
            "Technologist": {
                "id": 36,
                "field_name": "Technologist",
                "i18n_name": "setup.userSettings.technologist",
                "field_info": {
                    "custom_name": "Technologist",
                    "name": "technologist_name",
                    "width": 100,
                    "search": true,
                    "sortable": true
                },
                "field_code": "technologist_name"
            },
            "Ordering Facility": {
                "id": 37,
                "field_name": "Ordering Facility",
                "i18n_name": "setup.userSettings.orderingFacility",
                "field_info": {
                    "custom_name": "Ordering Facility",
                    "name": "ordering_facility_name",
                    "width": 250,
                    "defaultValue": ""
                },
                "field_code": "ordering_facility_name"
            },
            "MU Last Updated date": {
                "id": 38,
                "field_name": "MU Last Updated date",
                "i18n_name": "setup.userSettings.muLastUpdatedDate",
                "field_info": {
                    "custom_name": "MU Last Updated date",
                    "name": "mu_last_updated",
                    "width": 200,
                    "formatter": dateFormatter,
                    "defaultValue": "",
                    "search": true,
                    "sortable": true,
                    "hidden": false
                },
                "field_code": "mu_last_updated"
            },
            "MU Last Updated By": {
                "id": 39,
                "field_name": "MU Last Updated By",
                "i18n_name": "setup.userSettings.muLastUpdatedBy",
                "field_info": {
                    "custom_name": "MU Last Updated By",
                    "name": "mu_last_updated_by",
                    "width": 200,
                    "defaultValue": "",
                    "search": true,
                    "sortable": true,
                    "hidden": false
                },
                "field_code": "mu_last_updated_by"
            },
            "Send Status": {
                "id": 40,
                "field_name": "Send Status",
                "i18n_name": "setup.userSettings.sendStatus",
                "field_info": {
                    "custom_name": "Send Status",
                    "name": "send_status",
                    "width": 100,
                    "stype": "select",
                    "formatter": deliveryStatus,
                    "searchoptions": {
                        "value": deliveryStatusValue,
                        "tempvalue": deliveryStatusValue
                    }
                },
                "field_code": "send_status"
            },
            "Fax Status": {
                "id": 41,
                "field_name": "Fax Status",
                "i18n_name": "setup.userSettings.faxStatus",
                "field_info": {
                    "custom_name": "Fax Status",
                    "name": "fax_status",
                    "width": 100,
                    "stype": "select",
                    "formatter": deliveryStatus,
                    "searchoptions": {
                        "value": deliveryStatusValue,
                        "tempvalue": deliveryStatusValue
                    }
                },
                "field_code": "fax_status"
            },
            "Check In Date": {
                "id": 42,
                "field_name": "Check In Date",
                "i18n_name": "setup.userSettings.checkInDate",
                "field_info": {
                    "custom_name": "Check In Date",
                    "name": "check_indate",
                    "width": 200,
                    "formatter": dateFormatter,
                    "defaultValue": ""
                },
                "field_code": "check_indate"
            },
            "Status Changed Date": {
                "id": 45,
                "field_name": "Status Changed Date",
                "i18n_name": "setup.userSettings.statusChangedDate",
                "field_info": {
                    "custom_name": "Status Changed Date",
                    "name": "status_last_changed_dt",
                    "width": 200,
                    "formatter": dateFormatter,
                    "defaultValue": "",
                    "search": true,
                    "hidden": false
                },
                "field_code": "status_last_changed_dt"
            },
            "Scheduled Date": {
                "id": 46,
                "field_name": "Scheduled Date",
                "i18n_name": "setup.userSettings.scheduledDate",
                "field_info": {
                    "custom_name": "Scheduled Date",
                    "name": "scheduled_dt",
                    "width": 200,
                    "formatter": dateFormatter,
                    "defaultValue": "",
                    "search": true,
                    "hidden": !isNeither
                },
                "field_code": "scheduled_dt"
            },
            "Approving Physician": {
                "id": 47,
                "field_name": "Approving Physician",
                "i18n_name": "setup.userSettings.approvingPhysician",
                "field_info": {
                    "custom_name": "Approving Physician",
                    "name": "approving_provider",
                    "width": 200
                },
                "field_code": "approving_provider"
            },
            "Approved Date": {
                "id": 48,
                "field_name": "Approved Date",
                "i18n_name": "setup.userSettings.approvedDate",
                "field_info": {
                    "custom_name": "Approved Date",
                    "name": "approved_dt",
                    "width": 200,
                    "formatter": dateFormatter,
                    "defaultValue": ""
                },
                "field_code": "approved_dt"
            },
            "TAT": {
                "id": 49,
                "field_name": "TAT",
                "i18n_name": "setup.userSettings.tat",
                "field_info": {
                    "custom_name": "TAT",
                    // Ignoring the eslint error because I don't want to accidentally break whatever is going on here
                    /* eslint-disable no-constant-condition */
                    "name": false ? "studies.study_created_dt" :
                            false ? "studies.study_received_dt" :
                            "tat_level",
                    /* eslint-enable no-constant-condition */
                    "width": 150,
                    "formatter": function ( cellvalue, options, rowObject ) {
                        return commonjs.getTatValue(rowObject.tat_level);
                    },
                    "defaultValue": "",
                    "stype": "select",
                    "searchoptions": {
                        "value": searchTatValue,
                        "tempvalue": searchTatValue
                    },
                    "searchoptionsalt": {
                        "value": searchAltTat,
                        "alttempvalue": searchAltTat
                    },
                    "hidden": !isNeither
                },
                "field_code": "tat_level"
            },
            "Status": {
                "id": 50,
                "field_name": "Status",
                "i18n_name": "setup.userSettings.status",
                "field_info": {
                    "custom_name": "Status",
                    // Ignoring the eslint error because I don't want to accidentally break whatever is going on here
                    /* eslint-disable no-constant-condition */
                    "name": false ? "dicom_status" :
                            false ? "order_status" :
                            "study_status",
                    /* eslint-enable no-constant-condition */
                    "width": 150,
                    "formatter": function ( cellvalue, options, rowObject ) {
                        var statusDetail = getStatus(rowObject);
                        var statusObj = statusDetail[0];

                        var txtAddendum = hasAddendumReport(rowObject)
                            ? ' - ' + commonjs.geti18NString('patient.studies.linkStudies.addendum')
                            : '';

                        return (statusObj && statusObj.status_desc || cellvalue ) + txtAddendum;
                    },
                    "cellattr": function ( id, cellvalue, rowObject ) {
                        var statusDetail = getStatus(rowObject);
                        var statusObj = statusDetail[ 0 ];
                        return 'style="background:' + (statusObj && statusObj.color_code || 'transparent') + ';"';
                    },
                    "defaultValue": ""
                },
                "field_code": "study_status"
            },
            "Claim #": {
                "id": 51,
                "field_name": "Claim #",
                "i18n_name": "billing.fileInsurance.claimNo",
                "field_info": {
                    "custom_name": "Claim #",
                    "name": "claim_id",
                    "search": false,
                    "sortable": false,
                    "width": 200,
                    "defaultValue": ""
                },
                "field_code": "claim_no"
            },
            "AHS Claim Num": {
                "id": 70,
                "field_name": "AHS Claim Num",
                "i18n_name": "setup.cptCodes.can_ahs.ahsclaimno",
                "field_info": {
                    "custom_name": "AHS Claim Num",
                    "name": "can_ahs_claim_no",
                    "search": false,
                    "sortable": false,
                    "width": 200,
                    "defaultValue": "",
                    "hidden": app.billingRegionCode !== "can_AB"
                },
                "field_code": "can_ahs_claim_no"
            },
            // TODO: Add search ability IAW EXA-3299 request
            "Modality Room": {
                "id": 52,
                "field_name": "Modality Room",
                "i18n_name": "setup.userSettings.modalityRoom",
                "field_info": {
                    "custom_name": "Modality Room",
                    "name": "modality_room_id",
                    "width": 150,
                    "formatter": function ( cellvalue ) {
                        return commonjs.getModalityRoomFromId(cellvalue);
                    },
                    "stype": "select",
                    "defaultValue": "",
                    "searchoptions": {
                        "value": modalityRoomValue,
                        "tempvalue": modalityRoomValue
                    }
                },
                "field_code": "modality_room_id"
            },
            "Report Queue Status": {
                "id": 53,
                "field_name": "Report Queue Status",
                "i18n_name": "setup.userSettings.reportQueueStatus",
                "field_info": {
                    "custom_name": "Report Queue Status",
                    "name": "report_queue_status",
                    "width": 200,
                    "stype": "select",
                    "searchoptions": {
                        "value": reportQueueValue,
                        "tempvalue": reportQueueValue
                    },
                    "formatter": queuseStatusFormatter,
                },
                "field_code": "report_queue_status"
            },
            "Insurance Authorization" : {
                "id": 54,
                "field_name": "Insurance Authorization",
                "i18n_name": "setup.userSettings.insuranceAuthorization",
                "field_info": {
                    "custom_name": "Insurance Authorization",
                    "name": "as_authorization",
                    "width": 200,
                    "sortable": false,
                    "search" : true,
                    "stype": "select",
                    "searchoptions": {
                        value: {
                            "": "All",
                            "noauthorization": "No Authorization Needed",
                            "needauthorization": "Need Authorization",
                            "authorized": "Authorized",
                            "pending": "Pending Authorization",
                            "partial": "Partial Authorization",
                            "denied": "Denied Authorization",
                            "reauthorization": "Reauthorization Needed",
                            "none": "None"
                        }
                    },
                    formatter: function(cellvalue) {
                        return cellvalue !== "none"
                            ? commonjs.geti18NString("setup.studyFilters." + cellvalue)
                            : "";
                    }
                },
                "field_code": "as_authorization"
            },
            "Deleted": {
                "id": 55,
                "field_name": "Deleted",
                "i18n_name": "setup.userSettings.deleted",
                "field_info": {
                    "custom_name": "Deleted",
                    "name": "has_deleted",
                    "width": 80,
                    "formatter": function ( cellvalue ) {
                        if ( cellvalue === false ) {
                            return 'No';
                        }

                        return 'Yes';

                    },
                    "stype": "select",
                    "searchoptions": {
                        "value": deletedValue,
                        "tempvalue": deletedValue
                    }
                },
                "field_code": "has_deleted"
            },
            "MU": {
                "id": 56,
                "field_name": "MU",
                "i18n_name": "setup.userSettings.mu",
                "field_info": {
                    "className": 'ui-icon icon ui-icon-flag',
                    "custom_name": "MU",
                    "customAction": function ( rowID, e, that ) {
                        var data = that.getData(rowID);
                        showOrderBasedCompletedMuDataset(data);
                    },
                    "name": "mudatacaptured",
                    "width": 60,
                    "formatter": function ( cellvalue, options, rowObject ) {
                        if (options.format === 'csv') {
                            return isTrue(rowObject.mu_passed) ? 'MU Data Capture Completed' : 'MU Data Capture not Completed';
                        }

                        return isTrue(rowObject.mu_passed) ?
                                "<span style='color: #008000' class='icon-ic-drawer' title='MU Data Capture Completed'></span>" :
                                "<span style='color: brown' class='icon-ic-drawer' title='MU Data Capture not Completed'></span>";


                    },
                    "sortable": false,
                    "stype": "select",
                    "searchoptions": {
                        "value": {
                            "": "All",
                            "TRUE": "Success Only",
                            "FALSE": "Error Only"
                        },
                        "tempvalue": {
                            "": "All",
                            "TRUE": "Success Only",
                            "FALSE": "Error Only"
                        }
                    },
                    "hidden": false
                },
                "field_code": "mudatacaptured"
            },
            "Eligibility": {
                "id": 57,
                "field_name": "Eligibility",
                "i18n_name": "setup.ediRequestTemplate.eligibility",
                "field_info": {
                    "custom_name": "Eligibility",
                    "name": "eligibility_verified",
                    "width": 90,
                    "formatter": function ( cellvalue, options, rowObject ) {
                        /**
                         * First see if automated eligibility check already
                         * returned something we can use
                         */
                        var eligibilityDate = rowObject.eligibility_dt;
                        var verifiedDate = rowObject.manually_verified_dt;


                        if (options.format === 'csv') {
                            if ( eligibilityDate && !verifiedDate || moment(eligibilityDate).isAfter(verifiedDate) ) {
                                if ( cellvalue === false ) {
                                    return "Eligibility verified as INACTIVE on " + dateFormatter(eligibilityDate, options, rowObject);
                                }
                                return "Eligibility verified as ACTIVE on " + dateFormatter(eligibilityDate, options, rowObject);
                            }
                            else if ( verifiedDate ) {
                                /**
                                 * For when a user manually verified eligibility
                                 */
                                return  'Changed (manually) by ' + rowObject.manually_verified_by + ' on ' + dateFormatter(verifiedDate, options, rowObject);

                            }
                            return "Unverified";
                        }


                        if ( eligibilityDate && !verifiedDate || moment(eligibilityDate).isAfter(verifiedDate) ) {
                            if ( cellvalue === false ) {
                                return '<i class="fa fa-times" style="color: #FF0000" aria-hidden="true" title="Eligibility verified as INACTIVE on ' + dateFormatter(eligibilityDate, options, rowObject) + '" />';
                            }
                            return '<i class="fa fa-check-square-o" style="color: green" aria-hidden="true" title="Eligibility verified as ACTIVE on ' + dateFormatter(eligibilityDate, options, rowObject) + '" />';
                        }
                        else if ( verifiedDate ) {
                            /**
                             * For when a user manually verified eligibility
                             */
                            var verifiedBy = rowObject.manually_verified_by;
                            var titleText = 'Changed (manually) by ' + verifiedBy + ' on ' + dateFormatter(verifiedDate, options, rowObject);
                            if ( rowObject.manually_verified === false ) {
                                return '<i class="fa fa-times" style="color: #FF0000" aria-hidden="true" title="' + titleText + '" />';
                            }
                            return '<i class="fa fa-check-square-o" style="color: green" aria-hidden="true" title="' + titleText + '" />';
                        }
                        /**
                         * Default appearance
                         */
                        return '';

                    },
                    "stype": "select",
                    "searchoptions": {
                        "value": verifiedValue,
                        "tempvalue": verifiedValue
                    },
                    "customAction": function () {
                        // TODO: should this be e.stopPropagation()?
                        event.stopPropagation();
                    }
                },
                "field_code": "eligibility_verified"
            },
            "Provider Alerts": {
                "id": 58,
                "field_name": "Provider Alerts",
                "i18n_name": "setup.userSettings.providerAlerts",
                "field_info": {
                    "custom_name": "Provider Alerts",
                    "name": "providerAlerts",
                    "width": 250,
                    "sortable": false,
                    "search": false,
                    "cellattr": function ( rowID, val ) {
                        if ( val ) {
                            return 'style="text-overflow:ellipsis;"';
                        }
                    },
                    "defaultValue": "",
                    "hidden": false
                },
                "field_code": "providerAlerts"
            },
            "Attorney": {
                "id": 59,
                "field_name": "Attorney",
                "i18n_name": "setup.userSettings.attorney",
                "field_info": {
                    "custom_name": "Attorney",
                    "name": "attorney_name",
                    "width": 250,
                    "defaultValue": "",
                    "hidden": false
                },
                "field_code": "attorney_name"
            },
            "Image delivery": {
                "id": 60,
                "field_name": "Image delivery",
                "i18n_name": "setup.userSettings.imageDelivery",
                "field_info": {
                    "custom_name": "Image delivery",
                    "name": "image_delivery",
                    "width": 140,
                    "defaultValue": "",
                    "stype": "select",
                    "searchoptions": {
                        "attr": {
                            "multiple": true,
                            "style": "max-height:32px;overflow-y:scroll"
                        },
                        "value": imageDeliveryValue,
                        "tempvalue": imageDeliveryValue
                    },
                    "hidden": false
                },
                "field_code": "image_delivery"
            },
            "Pateint Room#": { //***For EXA-7148 -- Add Room Number colum to Facility Portal***//
                "id": 61,
                "field_name": "Pateint Room#",
                "i18n_name": "setup.userSettings.patientRoom",
                "field_info": {
                    "custom_id": 62,
                    "custom_name": "Pateint Room#",
                    "name": "patient_room",
                    "width": 120,
                    "defaultValue": "",
                    "hidden": false
                },
                "field_code": "patient_room"
            },
            "Ins Provider Type": {
                "id": 63,
                "field_name": "Ins Provider Type",
                "i18n_name": "setup.userSettings.insProviderType",
                "field_info": {
                    "custom_id": 63,
                    "custom_name": "Ins Provider Type",
                    "name": "ins_provider_type",
                    "width": 200,
                    "searchFlag": "%",
                    "stype": "select",
                    "searchoptions": {
                        "value": insProviderTypeValue,
                        "tempvalue": insProviderTypeValue
                    },
                    "sortable": false
                },
                "field_code": "ins_provider_type"
            },
            "Patient Visit #": {
                "id": 64,
                "field_name": "Patient Visit #",
                "i18n_name": "setup.userSettings.patientVisitNumber",
                "field_info": {
                    "custom_id": 64,
                    "custom_name": "Patient Visit #",
                    "name": "visit_no",
                    "width": 200,
                    "defaultValue": "",
                    "hidden": false,
                    "sortable": true
                },
                "field_code": "visit_no"
            },
            "Billed Status": {
                "id": 65,
                "field_code": "billed_status",
                "field_name": "Billed Status",
                "i18n_name": "setup.userSettings.billedStatus",
                "field_info": {
                    "custom_name": "Billed Status",
                    "name": "billed_status",
                    "width": 100,
                    "cellattr": function ( id, cellvalue, rowObject ) {
                        rowObject.claim_id = Array.isArray(rowObject.claim_id) ? rowObject.claim_id[0] : rowObject.claim_id;
                        var statusDetail = commonjs.getClaimColorCodeForStatus(rowObject.claim_id > 0 ? 'billed' : 'unbilled', 'study');
                        var statusObj = statusDetail[ 0 ];
                        return 'style="background:' + (statusObj && statusObj.color_code || 'transparent') + ';"';
                    },
                    "searchFlag": "%",
                    "stype": "select",
                    "sortable": false,
                    formatter: function (cellvalue) {
                        return cellvalue == 'billed' ? 'Billed' : 'UnBilled';
                    },
                    "searchoptions": {
                        "value": billedStatus,
                        "tempvalue": billedStatus
                    }
                }
            },
            "Billing Class": {
                "id": 66,
                "field_code": "billing_class",
                "field_name": "Billing Class",
                "i18n_name": "billing.fileInsurance.billingClass",
                "field_info": {
                    "custom_name": "Billing Class",
                    "name": "billing_class",
                    "width": 120,
                    "stype": "select",
                    "searchoptions": {
                        "value": billingClassesValue,
                        "tempvalue": billingClassesValue
                    },
                    "cellattr": function (id, cellvalue, rowObject) {
                        return 'style="background:' +  billingClassesColorCode(rowObject) + ';"';
                    }
                }
            },
            "Billing Code": {
                "id": 67,
                "field_code": "billing_code",
                "field_name": "Billing Code",
                "i18n_name": "billing.fileInsurance.billingCode",
                "field_info": {
                    "custom_name": "Billing Code",
                    "name": "billing_code",
                    "width": 100,
                    "stype": "select",
                    "searchoptions": {
                        "value": billingCodeValue,
                        "tempvalue": billingCodeValue
                    },
                    "cellattr": function (id, cellvalue, rowObject) {
                        return 'style="background:' + billingCodesColorCode(rowObject) + ';"';
                    }
                }
            },
            "ICD Description": {
                "id": 68,
                "field_name": "ICD Description",
                "i18n_name": "patient.advancedSearch.icdDescription",
                "field_info": {
                    "custom_name": "ICD Description",
                    "name": "icd_description",
                    "width": 250,
                    "defaultValue": ""
                },
                "field_code": "icd_description"
            },
            "Sequence Numbers": {
                    "id": 74,
                    "field_name": "Sequence Numbers",
                    "i18n_name": "shared.fields.sequenceNumbers",
                    "field_info": {
                        "custom_name": "Sequence Numbers",
                        "name": "can_bc_claim_sequence_numbers",
                        "width": 150,
                        "searchFlag": "%",
                        "sortable": true,
                        "defaultValue": "",
                        "hidden": app.billingRegionCode !== 'can_BC'
                    },
                    "field_code": "can_bc_claim_sequence_numbers"
            },
            "updated_date_time": {
                "id": 75,
                "field_code": "updated_date_time",
                "field_name": "updated_date_time",
                "i18n_name": "billing.claims.submittedDate",
                "field_info": {
                    "custom_name": "updated_date_time",
                    "name": "updated_date_time",
                    "formatter":  function ( cellvalue ) {
                        return commonjs.checkNotEmpty(cellvalue) ? commonjs.getFormattedUtcDate(cellvalue) : '';
                    },
                    "width": 200
                }
            },
            "Billing type": {
                "id": 75,
                "field_name": "Billing type",
                "i18n_name": "shared.fields.billing_type",
                "field_info": {
                    "custom_name": "Billing type",
                    "name": "billing_type",
                    "width": 150,
                    "stype": "select",
                    "hidden": !app.isMobileBillingEnabled || app.country_alpha_3_code === 'can',
                    "searchoptions": {
                        "value": billingType,
                        "tempvalue": billingType
                    },
                },
                "field_code": "billing_type"
            },
            "Ordering Facility Type": {
                "id": 76,
                "field_code": "ordering_facility_type",
                "field_name": "Ordering Facility Type",
                "i18n_name": "shared.fields.ordFacilityType",
                "field_info": {
                    "custom_name": "Ordering Facility Type",
                    "name": "ordering_facility_type",
                    "width": 150,
                    "stype": "select",
                    "searchoptions": {
                        "value": orderingFacilityTypes,
                        "tempvalue": orderingFacilityTypes
                    }
                }
            }
        });

    };
});
