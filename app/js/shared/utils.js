define([ 'jquery', 'underscore' ], function ( jQuery, _ ) {
    var $ = jQuery;
    var _TRUE = 'true';
    var _FALSE = 'false';
    var validationHeaderTimeout = null;

    var isTrue = function ( val ) {
        return val === true || val === _TRUE;
    };

    var isFalse = function ( val ) {
        return val === false || val === _FALSE;
    };

    var isNotTrue = function ( val ) {
        return val !== true && val !== _TRUE;
    };

    var isNotFalse = function ( val ) {
        return val !== false && val !== _FALSE;
    };

    /**
     * getData - Essentially identical to sister method in customgrid.js but usable on any grid/store.
     * @param {string|number}   id
     * @param {Object}          store
     * @param {string}          [tableID]
     * @param {Object}          [searchObj]
     * @returns {Object}
     */
    var getData = function ( id, store, tableID, searchObj ) {
        var model = store.get(id) || searchObj && store.findWhere(searchObj);
        var data = model && model.toJSON() || tableID && $(tableID).jqGrid('getRowData', id) || null; // fallback
        if ( data === null || typeof data === 'object' && Object.keys(data).length === 0 ) {
            commonjs.showError('Error getting data for row - ID: ' + id);
            console.log('getData - ID: ', id, ' | store: ', store);
        }
        return data;
    };


    var disableRightClick = function () {
        if ( app.usersettings && app.usersettings.worklist_filter_info && app.usersettings.worklist_filter_info.options ) {
            return !isTrue(app.usersettings.worklist_filter_info.options.disableRightClick);
        }
        return true;
    };

    var serverPrefetch = function ( studyids, callback ) {
        prefetch.serverPrefetch(true, studyids, 0, callback);
    };

    var setRightMenuPosition = function ( divObj, e ) {
        var mouseX = e.clientX
            , mouseY = e.clientY
            , $divObj = $(document.getElementById(divObj))
            , indexHeaderHeight = $(document.getElementById('indexHeader')).height()
            , boundsX = $window.width()
            , boundsY = $window.height()
            , menuWidth = $divObj.outerWidth()
            , menuHeight = $divObj.outerHeight()
            , css = {
            'left': mouseX,
            'top': mouseY
        }
            , classes = [];

        if ( mouseY + menuHeight + 70 > boundsY ) {
            var cTop = mouseY - menuHeight;
            if ( cTop < indexHeaderHeight ) {
                cTop = indexHeaderHeight;
            }
            css.top = cTop;
            classes.push('dropdown-context-up');
        }

        if ( mouseX + menuWidth > boundsX && (mouseX - menuWidth) > 0 ) {
            css.left = mouseX - menuWidth;
            classes.push('dropdown-context-left');
        }
        else {
            classes.push('dropdown-context');
        }

        $divObj
            .removeClass('dropdown-context dropdown-context-up dropdown-context-left')
            .addClass(classes.join(' '))
            .css(css);
    };

    var updateCollection = function ( dataset, something, pager ) {
        var pageoffset = (pager.get('PageNo') - 1) * pager.get('PageSize');
        var j = 0;
        var count = dataset.length;
        for ( ; j < count; j++ ) {
            pageoffset = pageoffset + 1;
            dataset[ j ].set({
                'record_no': pageoffset
            }, {
                'silent': true
            });
        }
        //getTATCount();
    };

    var updateReorderColumn = function ( studyFields ) {
        var study_fields = [];
        var field_order = [];
        var gridOptions = studyFields.map(function ( col ) {
            var name = col.field_name;
            study_fields[ study_fields.length ] = name;
            field_order[ field_order.length ] = col.id;
            return {
                'name': name,
                'width': col.field_info.width || 0
            };
        });
        jQuery.ajax({
            "url": "/userSetting",
            "type": "PUT",
            "data": {
                "flag": "updateReorderCol",
                "study_fields": study_fields,
                "field_order": field_order,
                "grid_options": JSON.stringify(gridOptions)
            },
            "success": function ( data ) {
                if ( data ) {
                    app.usersettings.study_fields = study_fields;
                    app.usersettings.field_order = field_order;
                    app.usersettings.grid_options = gridOptions;
                }
            },
            "error": function ( err ) {
                commonjs.handleXhrError(err);
            }
        });
    };

    var updateResizeColumn = function ( studyFields ) {
        var gridOptions = studyFields.map(function ( col ) {
            return {
                'name': col.field_name,
                'width': col.field_info.width || 0
            };
        });
        jQuery.ajax({
            "url": "/userSetting",
            "type": "PUT",
            "data": {
                "flag": "updateResizeCol",
                "grid_options": JSON.stringify(gridOptions)
            },
            "success": function ( data ) {
                if ( data ) {
                    app.usersettings.grid_options = gridOptions;
                }
            },
            "error": function ( err ) {
                commonjs.handleXhrError(err);
            }
        });
    };

    var getDatasetName = function ( datasetname ) {
        switch ( datasetname ) {
            case 'patientName':
                return 'Patient Name';
            case 'patientGender':
                return 'Gender';
            case 'patientDOB':
                return 'DOB';
            case 'patientRace':
                return 'Patient Race';
            case 'patientEthnicity':
                return 'Patient Ethnicity';
            case 'patientPreferredLanguage':
                return 'Patient Language';
            case 'patientMedication':
                return 'Patient Medication';
            case 'patientPrescription':
                return 'Patient Prescription';
            case 'patientAllergies':
                return 'Patient Allergies';
            case 'patientProblems':
                return 'Patient Problems';
            case 'patientLaboratoryTest':
                return 'Lab Tests';
            case 'patientLaboratoryResults':
                return 'Lab Results';
            case 'Procedures':
                return 'Procedures';
            case 'patientSmokingStatus':
                return 'Patient Smoking Status';
            case 'patientVitalSigns':
                return 'Patient Vital Signs';
            case 'providername_office':
                return 'Provider Office';
            case 'Reason_referral':
                return 'Referral Reasons';
            case 'Encounter_diagnoses':
                return 'Encounter Diagnoses';
            case 'patientCognitiveStatus':
                return 'Cognitive Status';
            case 'functional_status':
                return 'Functional Status';
            case 'patientImmunizations':
                return 'Patient Immunizations';
            case 'patientEduMaterial':
                return 'Patient Education Material';
            case 'discharge_insructions':
                return 'Patient Discharge Insructions';
            case 'care_team':
                return 'Patient Care Team';
            case 'care_plan':
                return 'Patient Care Plan';
            case 'directive_status':
                return 'Patient Directive Status';
            case 'timely_access':
                return 'Timely Access';
            case 'health_info':
                return 'Patient Health Info';
            case 'clinical_summary':
                return 'Patient Clinical Summary';
            case 'Remainder':
                return 'Patient Remainder';
            case 'medrecon':
                return 'Patient Medrecon';
            case 'transactioncare':
                return 'Patient Transaction Care';
            case 'transcationref':
                return 'Transaction And Referrals';
            case 'patientDemographics':
                return 'Patient Demographics';
            case 'ePrescriptions':
                return 'Patient ePrescriptions';
            case 'family_health_info':
                return 'Family Health History';
            case 'healthHistory':
                return 'Health Info';
            case 'patientMessages':
                return 'Patient Messages';
            case 'electronicNotes':
                return 'Patient Electronic Notes';
            case 'imageResults':
                return 'Patient Image Results';
            case 'clinicalSummaryReq':
                return 'Clinical Summary Request';
            case 'patientSummaryOfCare':
                return 'Patient Summary Of Care';
            case 'patientSummaryOfCareElectronic':
                return 'Patient Summary Of Care Electronic';
            case 'patientElectronicAccessVDT':
                return 'Patient Electronic Access VDT';
            case 'default':
                return '';
        }
    };


    var setScrollHandler = function ( filterid, divId ) {
        var divid = "#divGrid" + filterid, scrolldiv = "";

        if ( $(divid).find("#gview_tblGrid" + filterid).length > 0 ) {
            scrolldiv = $(divid).find("#gview_tblGrid" + filterid).find(".ui-jqgrid-bdiv");
        }

        scrolldiv.scroll(function ( e ) {
            $(divId).hide();
        });
    };

    var getTATCount = function () {
        var self = this;
        $.ajax({
            url: '/getTatCount',
            data: {
                flag: 'TAT',
                providercontact_ids: app.providercontact_ids
            },

            type: 'GET',
            success: function (response, textStatus, jqXHR) {
                if (response && response.result) {
                    var tat = response.result;
                    for (var i=0; i<4; i++) {
                        $("#tatCount" + i).text(tat[i].y);
                    }

                    if (app && app.tat_config && app.tat_config.length > 0) {
                        for (var i=0; i<app.tat_config.length; i++) {
                            var tc = app.tat_config[i];
                            if (tc.color) {
                                $("#tatCount" + tc.level)
                                    .css("background-color", tc.color)
                                    .css("color", tc.text_color || "White");
                            }
                        }
                    }
                }
            },
            error: function (err) {
                $('#divStudiesTat').html("");
            }
        });
    };

    return {
        isTrue: isTrue,
        isFalse: isFalse,
        isNotTrue: isNotTrue,
        isNotFalse: isNotFalse,
        getData: getData,
        disableRightClick: disableRightClick,
        setRightMenuPosition: setRightMenuPosition,
        updateCollection: updateCollection,
        updateReorderColumn: updateReorderColumn,
        updateResizeColumn: updateResizeColumn,
        setScrollHandler: setScrollHandler
    };
});
