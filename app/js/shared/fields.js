define([ 'backbone', 'immutable', 'moment', 'shared/utils' ], function ( Backbone, Immutable, moment, utils ) {

    var isTrue = utils.isTrue;
    var showOrderBasedCompletedMuDataset = utils.showOrderBasedCompletedMuDataset;

    var deliveryStatus = function ( cellvalue ) {
        if ( !cellvalue || cellvalue === "undefined" ) {
            return "Pending";
        }
        return cellvalue;
    };

    var genderObj = {
        'M': 'Male',
        'F': 'Female',
        'O': 'Other',
        'U': 'Unknown'
    };

    var orderTypes = {
        "P": "Pre-order",
        "S": "Schedule",
        "W": "Walkin"
    };

    var billing_status = [
        "SCH",
        "ORD",
        "CON",
        "ASS",
        "NOS",
        "ASAC",
        "CAN",
        "ABRT"
    ];

    return function ( filterType ) {
        var isNeither = true;

        var typeValue =   ":All;S:Schedule;W:Walkin";
        var deliveryStatusValue = ':All;Sent:Sent;Pending:Pending';
        var statLevelValue = {};
        var alt_status = {};
        var Collection = Backbone.Collection.extend({
            model: Backbone.Model.extend({})
        });

        var priorityValue = commonjs.makeValue(commonjs.bindArray(app.settings.priorities, false), ":All;");
        var modalityValue = commonjs.makeValue(app.modalities, ":All;", "modality_code", "modality_code");

        // filter inactive and no show study facilities
        var facilities = [];
        var facilityValue = commonjs.makeValue(facilities, ":All;", "id", "facility_name");
        var bodyPartValue = commonjs.makeValue(commonjs.bindArray(app.settings.bodyParts, false), ":All;");
        var insProviderTypeValue = commonjs.makeValue(app.insProviderTypes, ":All;", "description", "description");

        var studyFlagArray = commonjs.bindArray(app.settings.studyflag, false);
        var studyFlagList = new Collection(studyFlagArray);
        var studyFlagArrayValue = studyFlagList.toJSON();
        var isNoneExist = false;

        for ( var i = 0; i < studyFlagArrayValue.length; i++ ) {
            if ( studyFlagArrayValue[ i ].text.toUpperCase() == 'NONE' ) {
                isNoneExist = true;
                break;
            }
        }

        var studyFlagValue = commonjs.makeValue(studyFlagArray, !isNoneExist ?
                                                       ":All;None:None;" :
                                                       ":All;");

        var modalityRoomValue = commonjs.makeValue(app.modalityRooms, ":All;", "id", "modality_room_name");
        var reportQueueValue = commonjs.makeValue(app.settings.report_queue_status, ":All;", "code", "description");

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
            return  '';
        };
        var queuseStatusFormatter = function (cellvalue, options, rowObject) {
            if (!cellvalue) return '-';
            return app.settings.report_queue_status[_.findIndex(app.settings.report_queue_status, {code: cellvalue})].description;
        };
        var getStatus = function ( data ) {
            var status = data.study_status ;
            status = status === 'TE' ?
                     'INC' :
                     status;
            return commonjs.getColorCodeForStatus(data.facility_id, status);
        };

        // ADDING A NEW WORKLIST COLUMN <-- Search for this
        return Immutable.Map({
            "Account#": {
                "id": 1,
                "field_name": "Account#",
                "i18n_name": "setup.studyFilters.accountNo",
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
                "i18n_name": "setup.studyFilters.studyDescription",
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
                "i18n_name": "order.newOrder.station",
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
                "i18n_name": "setup.studyFilters.studyReceivedDate",
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
                "i18n_name": "setup.studyFilters.bodyPart",
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
                "i18n_name": "order.newOrder.department",
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
                "i18n_name": "order.notes.reasonForStudy",
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
                "i18n_name": "shared.fields.modality",
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
                "i18n_name": "shared.fields.patient",
                "field_info": {
                    "custom_name": "Patient",
                    "name": "patient_name",
                    "width": 250,
                    "formatter": function ( cellvalue, options, rowObject ) {
                        if (options.format === 'csv') {
                            return rowObject.linked_study_id > 0 ? rowObject.patient_name : cellvalue;
                        }
                        else {
                            return rowObject.linked_study_id > 0 ?
                                '<span class="linkSpan"><span>' + rowObject.patient_name + '</span><span title="linked study" style="display:inline-block;" class="ui-icon ui-icon-link linkSpan"></span></span>' :
                                cellvalue;
                        }

                    }
                },
                "field_code": "patient_name"
            },
            "DOB": {
                "id": 11,
                "field_name": "DOB",
                "i18n_name": "shared.fields.dob",
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
                "i18n_name": "shared.fields.gender",
                "field_info": {
                    "custom_name": "Gender",
                    "name": "gender",
                    "width": 100,
                    "formatter": function ( cellvalue ) {
                        return cellvalue && genderObj[ cellvalue.charAt(0).toUpperCase() ] || '';
                    },
                    "defaultValue": ""
                },
                "field_code": "gender"
            },
            "Age-Time of Study": {
                "id": 13,
                "field_name": "Age-Time of Study",
                "i18n_name": "setup.studyFilters.ageTimeOfStudy",
                "field_info": {
                    "custom_name": "Age-Time of Study",
                    "name": "patient_age",
                    "width": 100,
                    "formatter": function ( cellvalue, options, data ) {
                        return data.patient_age;


                        var birthDate = moment(data.birth_date, 'YYYY-MM-DD');
                        var studyDate = data.ordered_dt ? data.ordered_dt.split('T')[0] : data.study_created_dt;
                        studyDate = moment(studyDate, 'YYYY-MM-DD');

                        // don't display negative ages.. (birth date is after study created date)
                        var diff = studyDate.diff(birthDate);
                        if (diff < 0) {
                            return 0;
                        }

                        var duration = moment.duration(diff);
                        var age = {
                            asDays: Math.floor(duration.asDays()),
                            asMonths: Math.floor(duration.asMonths()),
                            asYears: Math.floor(duration.asYears())
                        };

                        // patient age dicom standard ftp://dicom.nema.org/medical/DICOM/2013/output/chtml/part05/sect_6.2.html
                        if (age.asDays < 60) {
                            return age.asDays + 'D';
                        }

                        if (age.asMonths < 36) {
                            return age.asMonths + 'M';
                        }

                        return age.asYears + 'Y';
                    },
                    "defaultValue": "",
                    "hidden": false
                },
                "field_code": "patient_age"
            },
            "Ref.Physician": {
                "id": 14,
                "field_name": "Ref.Physician",
                "i18n_name": "home.pendingStudies.refPhy",
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
                "i18n_name": "setup.studyFilters.accession",
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
                "i18n_name": "shared.fields.facility",
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
            "Reading Physician": {
                "id": 18,
                "field_name": "Reading Physician",
                "i18n_name": "home.pendingStudies.readPhy",
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
                "i18n_name": "setup.studyFilters.institution",
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
                "i18n_name": "setup.studyFilters.stat",
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
                "i18n_name": "setup.studyFilters.imgs",
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
                "i18n_name": "order.assignVehicle.studyFlag",
                "field_info": {
                    "custom_name": "Study Flag",
                    "name": "study_flag",
                    "width": 100,
                    "stype": "select",
                    "searchoptions": {
                        "value": studyFlagValue,
                        "tempvalue": studyFlagValue
                    },
                    "cellattr": function (id, cellvalue, rowObject) {
                        return 'style="background:' + (rowObject && rowObject.study_color_code || 'transparent') + ';"';
                    }
                },
                "field_code": "study_flag"
            },
            "Priority": {
                "id": 24,
                "field_name": "Priority",
                "i18n_name": "order.additionalInfo.priority",
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
                "i18n_name": "shared.fields.notes",
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
                            return notes[ notes.length - 1 ].notes;
                        }
                        return '';
                    },
                    "cellattr": function ( rowID, val, rowObject ) {
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
                "i18n_name": "order.summary.cptCodes",
                "field_info": {
                    "custom_name": "CPT Codes",
                    "name": "studies.cpt_codes",
                    "width": 200,
                    "search": false,
                    "sortable": false,
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
                "i18n_name": "setup.customForms.icdCodes",
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
                "i18n_name": "setup.cptCodes.insuranceProviders",
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
                "i18n_name": "setup.studyFilters.orderedBy",
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
                "i18n_name": "shared.fields.lastName",
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
                "i18n_name": "shared.fields.firstName",
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
                "i18n_name": "setup.studyFilters.scheduleType",
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
                "i18n_name": "setup.vehicleAudit.vehicleName",
                "field_info": {
                    "custom_name": "Vehicle Name",
                    "name": "vehicle_name",
                    "width": 200,
                    "search": true,
                    "sortable": true
                },
                "field_code": "vehicle_name"
            },
            "Claim Status": {
                "id": 34,
                "field_name": "Claim Status",
                "i18n_name": "order.chargePayment.claimStatus",
                "field_info": {
                    "custom_name": "Claim Status",
                    "name": "claim_status",
                    "width": 100,
                    "search": true,
                    "sortable": true
                },
                "field_code": "claim_status"
            },
            "Responsible": {
                "id": 35,
                "field_name": "Responsible",
                "i18n_name": "shared.fields.responsible",
                "field_info": {
                    "custom_name": "Responsible",
                    "name": "payer_name",
                    "width": 100,
                    "formatter": function ( cellvalue, options, rowObject ) {
                        return cellvalue ?
                               cellvalue + "(" + commonjs.getPayerType(rowObject.payer_type) + ")" :
                               '';
                    },
                    "search": true,
                    "sortable": true
                },
                "field_code": "payer_name"
            },
            "Technologist": {
                "id": 36,
                "field_name": "Technologist",
                "i18n_name": "setup.modalityRooms.technologist",
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
                "i18n_name": "shared.fields.orderingFacility",
                "field_info": {
                    "custom_name": "Ordering Facility",
                    "name": "ordering_facility",
                    "width": 250,
                    "defaultValue": ""
                },
                "field_code": "ordering_facility"
            },
            "MU Last Updated date": {
                "id": 38,
                "field_name": "MU Last Updated date",
                "i18n_name": "setup.studyFilters.muLastUpdatedDate",
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
                "i18n_name": "setup.studyFilters.muLastUpdatedBy",
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
                "i18n_name": "menuTitles.rightClickMenu.sendStatus",
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
                "i18n_name": "menuTitles.rightClickMenu.faxStatus",
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
                "i18n_name": "setup.studyFilters.checkInDate",
                "field_info": {
                    "custom_name": "Check In Date",
                    "name": "check_indate",
                    "width": 200,
                    "formatter": dateFormatter,
                    "defaultValue": ""
                },
                "field_code": "check_indate"
            },
            "Billing Code": {
                "id": 43,
                "field_name": "Billing Code",
                "i18n_name": "billing.fileInsurance.billingCode",
                "field_info": {
                    "custom_name": "Billing Code",
                    "name": "billing_code",
                    "width": 200,
                    "defaultValue": ""
                },
                "field_code": "billing_code"
            },
            "Billing Class": {
                "id": 44,
                "field_name": "Billing Class",
                "i18n_name": "billing.fileInsurance.billingClass",
                "field_info": {
                    "custom_name": "Billing Class",
                    "name": "billing_class",
                    "width": 200,
                    "defaultValue": ""
                },
                "field_code": "billing_class"
            },
            "Status Changed Date": {
                "id": 45,
                "field_name": "Status Changed Date",
                "i18n_name": "setup.studyFilters.statusChangedDate",
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
                "i18n_name": "setup.studyFilters.scheduledDate",
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
                "i18n_name": "setup.studyFilters.approvingPhysician",
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
                "i18n_name": "setup.dbTotals.approvedDate",
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
                "i18n_name": "home.common.tat",
                "field_info": {
                    "custom_name": "TAT",
                    "name": false ? "studies.study_created_dt" :
                            false ? "studies.study_received_dt" :
                            "tat_level",
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
                "i18n_name": "shared.fields.status",
                "field_info": {
                    "custom_name": "Status",
                    "name": false ? "dicom_status" :
                            false ? "order_status" :
                            "study_status",
                    "width": 150,
                    "formatter": function ( cellvalue, options, rowObject ) {
                        var statusDetail = getStatus(rowObject);
                        var statusObj = statusDetail[ 0 ];
                        return statusObj && statusDetail[ 0 ].status_desc || (cellvalue ? cellvalue : '');
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
                    "name": "claim_no",
                    "width": 200,
                    "formatter": function ( cellvalue, options, rowObject ) {
                        return billing_status.indexOf(rowObject.order_status_code) > -1 ?
                               '' :
                               rowObject.order_id;
                    },
                    "defaultValue": ""
                },
                "field_code": "claim_no"
            },
            // TODO: Add search ability IAW EXA-3299 request
            "Modality Room": {
                "id": 52,
                "field_name": "Modality Room",
                "i18n_name": "setup.studyFilters.modalityRoom",
                "field_info": {
                    "custom_name": "Modality Room",
                    "name": "modality_room_id",
                    "width": 150,
                    "formatter": function ( cellvalue ) {
                        var room = app.modalityRoomsMap.get(cellvalue);
                        return room ? room.modality_room_name : '';
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
                "i18n_name": "setup.studyFilters.reportQueueStatus",
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
                "i18n_name": "setup.studyFilters.insuranceAuthorization",
                "field_info": {
                    "custom_name": "Insurance Authorization",
                    "name": "as_authorization",
                    "width": 200,
                    "sortable": true,
                    "search" : true,
                    "stype": "select",
                    "searchoptions": {
                        value: {
                            "": "All",
                            "noauthorization": "No Authorization Needed",
                            "needauthorization": "Need Authorization",
                            "authorized": "Authorized"
                        }
                    },
                    formatter: function(cellvalue) {
                        var regSlash = /\\/g;
                        var authorizations = typeof cellvalue === 'string' && cellvalue.length > 0 ?
                            JSON.parse(cellvalue.replace('{""}', '{}').replace(regSlash, '\\\\')) :
                            cellvalue && typeof cellvalue === 'object' ?
                                cellvalue : '';

                        if ( authorizations && authorizations.length ) {
                            var needsAuth = false;
                            var authorized = false;
                            var i = 0;
                            for ( ; i < authorizations.length; i++ ) {
                                if ( authorizations[ i ].status === "NeedAuthorization" ) {
                                    needsAuth = true;
                                }
                                if ( authorizations[ i ].status === "Authorized" ) {
                                    authorized = true;
                                }

                            }

                            if ( needsAuth ) {
                                return "Need Authorization";
                            }
                            else if ( authorized ) {
                                return "Authorized";
                            }
                            return "No Authorization Needed";
                        }
                        return "";
                    }
                },
                "field_code": "as_authorization"
            },
            "Deleted": {
                "id": 55,
                "field_name": "Deleted",
                "i18n_name": "setup.studyFilters.deleted",
                "field_info": {
                    "custom_name": "Deleted",
                    "name": "has_deleted",
                    "width": 80,
                    "formatter": function ( cellvalue ) {
                        if ( cellvalue === false ) {
                            return 'No';
                        }
                        else {
                            return 'Yes';
                        }
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
                "i18n_name": "setup.studyFilters.mu",
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
                        else {
                            return isTrue(rowObject.mu_passed) ?
                                   "<span style='color: #008000' class='icon-ic-drawer' title='MU Data Capture Completed'></span>" :
                                   "<span style='color: brown' class='icon-ic-drawer' title='MU Data Capture not Completed'></span>";
                        }

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
            /**
             * TODO: would be good if clicking the checkbox icon did the action
             */
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
                                    return "Verified using automated system - inactive coverage";
                                }
                                return "Verified using automated system";
                            }
                            else if ( verifiedDate ) {
                                /**
                                 * For when a user manually verified eligibility
                                 */
                                return  'Changed (manually) by ' + rowObject.manually_verified_by + ' on ' + dateFormatter(verifiedDate, options, rowObject);

                            }
                            return "Unverified";
                        }

                        else {
                            if ( eligibilityDate && !verifiedDate || moment(eligibilityDate).isAfter(verifiedDate) ) {
                                if ( cellvalue === false ) {
                                    return '<i class="fa fa-square-o" style="color: #FF9000" aria-hidden="true" title="Verified using automated system - inactive coverage" />';
                                }
                                return '<i class="fa fa-check-square-o" style="color: green" aria-hidden="true" title="Verified using automated system" />';
                            }
                            else if ( verifiedDate ) {
                                /**
                                 * For when a user manually verified eligibility
                                 */
                                var verifiedBy = rowObject.manually_verified_by;
                                var titleText = 'Changed (manually) by ' + verifiedBy + ' on ' + dateFormatter(verifiedDate, options, rowObject);
                                if ( cellvalue === false ) {
                                    return '<i class="fa fa-square-o" style="color: #FF9000" aria-hidden="true" title="' + titleText + '" />';
                                }
                                return '<i class="fa fa-check-square-o" style="color: green" aria-hidden="true" title="' + titleText + '" />';
                            }
                            /**
                             * Default appearance
                             */
                            return '<i class="fa fa-square-o" style="color: #FF9000" aria-hidden="true" title="Unverified" />';
                        }
                    },
                    "stype": "select",
                    "searchoptions": {
                        "value": verifiedValue,
                        "tempvalue": verifiedValue
                    },
                    "hidden": false
                },
                "field_code": "eligibility_verified"
            },
            "Provider Alerts": {
                "id": 58,
                "field_name": "Provider Alerts",
                "i18n_name": "order.newOrder.providerAlerts",
                "field_info": {
                    "custom_name": "Provider Alerts",
                    "name": "providerAlerts",
                    "width": 250,
                    "sortable": false,
                    "search": false,
                    "cellattr": function ( rowID, val, rowObject ) {
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
                "i18n_name": "order.studyInfo.attorney",
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
                "i18n_name": "setup.providers.imageDelivery",
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
                "i18n_name": "order.newOrder.patientRoom",
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
                "i18n_name": "order.assignVehicle.insProviderType",
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
                "i18n_name": "order.patientVisitNumber",
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
            }
        });
    };
});
