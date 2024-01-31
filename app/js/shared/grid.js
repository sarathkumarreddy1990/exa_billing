define('grid', [
    'jquery',
    'underscore',
    'change-grid',
    'shared/utils',
    'models/pager',
    'collections/study-fields',
    'collections/studies',
    'collections/claim-workbench',
    'views/claims/index',
    'views/user-settings',
    'views/setup/study-filter',
    'text!templates/setup/study-filter-grid.html',
    'views/claims/claim-inquiry',
    'views/claims/split-claim',
    'views/claims/followup',
    'views/claims/reassessClaim',
    'text!templates/claims/validations.html',
    'text!templates/claims/adjustPaidInFull.html',
    'text!templates/claims/payerTypeSubMenu.html'
], function (jQuery, _, initChangeGrid, utils, Pager, StudyFields, Studies, claimWorkbench, claimsView, UserSettingsView, StudyFilterView, studyFilterGrid, claimInquiryView, splitClaimView, followUpView, claimReassessView, validationTemplate, adjustPaidInFullTemplate, payerTypeTemplate) {
    var $ = jQuery;
    var isTrue = utils.isTrue;
    var isFalse = utils.isFalse;
    var isNotTrue = utils.isNotTrue;
    var getData = utils.getData;
    var disableRightClick = utils.disableRightClick;
    var setRightMenuPosition = utils.setRightMenuPosition;
    var updateCollection = utils.updateCollection;
    var updateReorderColumn = utils.updateReorderColumn;
    var updateResizeColumn = utils.updateResizeColumn;
    var setScrollHandler = utils.setScrollHandler;
    var selectedStudyArray = [];

    return function (options) {
        var self = this;
        var filterID = options.filterid;
        var gridID = options.gridelementid;
        var isAdmin = options.isAdmin;
        var $tblGrid = $(gridID);
        var dateFormatter = function (cellvalue, options, rowObject) {
            return '';
        };
        var checkLicense = '';
        var userSettings = options.isClaimGrid ? app.claim_user_settings : app.study_user_settings;
        var risOrderChoose = false;
        var risOrderID = 0;
        var risOrderDetails = [];
        var rightclickMenuRights = [];
        var studyDataStore =[];
        var screenCode = [];
        if(app.userInfo.user_type != 'SU'){ // for Super User No need to check rights. But normal user need to chcek user. For right click options right it is used
            var rights = (window.appRights).init();
            rightclickMenuRights = rights.screenID;
            screenCode = rights.screenCode;
        }


        var handleStudyDblClick = function (data, event, gridID) {
            event.stopPropagation();
            if (data === null) {
                return false;
            }
            if (isTrue(data.has_deleted)) {
                return commonjs.showWarning('messages.warning.claims.studyIsDeleted', '', true);
            }
            var id = data.study_id;
            editStudyID = id;
            return chooseScreen(id, data, event, gridID);
        };

        var initializeEditForm = function (studyInfo) {
            var claimView = new claimsView();
            var gridName = options.isClaimGrid ? 'claims' : 'studies';

            if (studyInfo.order_id) {
                claimView.showEditClaimForm(studyInfo.studyIds, gridName, studyInfo);
            } else {
                commonjs.getClaimStudy(studyInfo.studyIds, function (result) {
                    studyInfo.study_id = (result && result.study_id && gridName != 'studies') ? result.study_id : studyInfo.study_id;
                    studyInfo.order_id = (result && result.order_id) ? result.order_id : 0;
                    studyInfo.split_claim_ids = result && result.split_claim_ids;
                    claimView.showEditClaimForm(studyInfo.studyIds, gridName, studyInfo);
                });
            }
        };

        var showValidationWarning = function (msg) {
            commonjs.showWarning(msg);
            $("#studyRightMenu").empty().css('display', 'none');
        };

        var validateClaimSelection = function (row_id, enabled, _element, store) {
            var $checkedInputs = $tblGrid.find('input').filter('[name=chkStudy]:checked');
            var selectedCount = $checkedInputs.length;
            selectedStudyArray = [];

            for (var r = 0; r < selectedCount; r++) {
                var rowId = $checkedInputs[r].parentNode.parentNode.id;
                _storeEle = getData(rowId, store, gridID);
                var study = {
                    study_id: rowId,
                    patient_id: _storeEle.patient_id,
                    facility_id: _storeEle.facility_id,
                    study_date: commonjs.convertToFacilityTimeZone(_storeEle.facility_id, _storeEle.study_dt).format('MM/DD/YYYY'),
                    billing_type: _storeEle.billing_type
                };

                selectedStudyArray.push(study);
            }

            if (enabled) {
                if (selectedStudyArray.length) {
                    var patientGroup = _.groupBy(selectedStudyArray, 'patient_id');
                    var isPatientNotMatched = Object.keys(patientGroup).length > 1;

                    var facilityGroup = _.groupBy(selectedStudyArray, 'facility_id');
                    var isFacilityNotMatched = Object.keys(facilityGroup).length > 1;

                    var studyDtGroup = _.groupBy(selectedStudyArray, 'study_date');
                    var isStudyDateNotMatched = Object.keys(studyDtGroup).length > 1;

                    var billingTypeGroup = _.groupBy(selectedStudyArray, 'billing_type');
                    var isBillingTypeNotMatched = Object.keys(billingTypeGroup).length > 1;

                    if (isPatientNotMatched) {
                        showValidationWarning('messages.warning.claims.samePatientValidate');
                        return false;
                    }

                    if (isStudyDateNotMatched) {
                        showValidationWarning('messages.warning.claims.sameStudyDtValidate');
                        return false;
                    }

                    if (isFacilityNotMatched) {
                        showValidationWarning('messages.warning.claims.sameFacilityValidate');
                        return false;
                    }

                    if (isBillingTypeNotMatched) {
                        showValidationWarning('messages.warning.claims.sameBillingTypeValidation');
                        return false;
                    }

                    return true;
                }

                selectedStudyArray.push(study);
            }
        };

        var payerTypeSubmenu = function (data, payerType) {
            switch (payerType) {
                case 'primary':
                    elementID = 'ancPrimaryIns_' + data.primary_patient_insurance_id;
                    elementName = data.p_insurance_name;
                    website = data.p_insurance_website || "NULL";
                    type = '( Primary Insurance )';
                    break;
                case 'secondary':
                    elementID = 'ancSecondaryIns_' + data.secondary_patient_insurance_id;
                    elementName = data.s_insurance_name;
                    website = data.s_insurance_website || "NULL";
                    type = '( Secondary Insurance )';
                    break;
                case 'tertiary':
                    elementID = 'ancTertiaryIns_' + data.tertiary_patient_insurance_id;
                    elementName = data.t_insurance_name;
                    website = data.t_insurance_website || "NULL";
                    type = '( Tertiary Insurance )';
                    break;
            }

            var subMenuTemplate = _.template(payerTypeTemplate);
            return subMenuTemplate ({
                website : website,
                elementID : elementID,
                elementName : elementName,
                type : type
            });
        };

       /**
        * WCB status display handling
        * @param {Object} claimStatus contains claim status data
        * @param {Object} selectedStudies contains selected studies data
        * @param {Boolean} isWCBStatus contains status is WCB or not
        * @returns {Boolean} canShowWCBClaimStatus AS true or false
        */
        var showWCBClaimStatus = function(claimStatus, selectedStudies, isWCBStatus) {
            var canShowWCBClaimStatus;
            var isAlbWCBCommonStatus = commonjs.can_ab_claim_status.indexOf(claimStatus.code) > -1;
            var isWCBInsuranceExist = _.some(selectedStudies, function(data) {
                return data.insurance_code === 'wcb';
            });

            if (isWCBInsuranceExist) {
                var isAllWCBInsurance = _.every(selectedStudies, function(data) {
                    return data.insurance_code === 'wcb';
                });

                canShowWCBClaimStatus = isAllWCBInsurance
                    ? isWCBStatus || isAlbWCBCommonStatus
                    : commonjs.can_ab_common_claim_status.indexOf(claimStatus.code) > -1 || !claimStatus.is_system_status;
            } else {
                canShowWCBClaimStatus = !isWCBStatus;
            }

            return canShowWCBClaimStatus;
        }

        var openCreateClaim = function (rowID, event, isClaimGrid, store) {
            var target = event.currentTarget;
            var $target = $(target);
            var studyArray = [];
            var orderIds = [];
            var selectedStudies = [];
            var divObj = 'studyRightMenu';
            var $divObj = $(document.getElementById(divObj));
            $divObj.empty();
            var gridData = getData(rowID, store, gridID);
            if (gridData === null) {
                return false;
            }
            var $checkedInputs = $tblGrid.find('input').filter('[name=chkStudy]:checked');
            var selectedCount = $checkedInputs.length;
            var _storeEle;

            var study_id = 0;
            var order_id = 0;
            var linked_parent_study_id = 0;
            var isbilled_status = false;
            var isUnbilled_status = false;
            var insurance_code = gridData.insurance_code || '';
            var insurance_codes = [];

            for (var r = 0; r < selectedCount; r++) {
                var rowId = $checkedInputs[r].parentNode.parentNode.id;
                _storeEle = getData(rowId, store, gridID);
                var gridData = $(gridID).jqGrid('getRowData', rowId);
                studyArray.push(rowId);
                orderIds.push(_storeEle.order_id);
                insurance_code = _storeEle.insurance_code && _storeEle.insurance_code.toLocaleLowerCase() || '';

                if (insurance_code && insurance_codes.indexOf(insurance_code) == -1) {
                    insurance_codes.push(insurance_code);
                }
                var study = {
                    study_id: rowId,
                    patient_id: gridData.hidden_patient_id,
                    facility_id: _storeEle.facility_id,
                    study_date: _storeEle.study_dt,
                    patient_name: _storeEle.patient_name,
                    account_no: _storeEle.account_no,
                    patient_dob: _storeEle.birth_date,
                    accession_no: _storeEle.accession_no,
                    billed_status: _storeEle.billed_status,
                    claim_id: gridData.hidden_claim_id,
                    invoice_no: _storeEle.invoice_no,
                    payer_type: _storeEle.payer_type,
                    claim_status_code: _storeEle.claim_status_code,
                    billing_method: _storeEle.billing_method,
                    claim_resubmission_flag: _storeEle.claim_resubmission_flag,
                    claim_balance: _storeEle.claim_balance,
                    claim_dt: gridData.claim_dt,
                    insurance_code: insurance_code
                };
                if (gridData.billed_status && gridData.billed_status.toLocaleLowerCase() == 'billed') {
                    isbilled_status = true;
                }

                if (gridData.billed_status && gridData.billed_status.toLocaleLowerCase() == 'unbilled') {
                    isUnbilled_status = true;
                }
                selectedStudies.push(study);
            }

            if (isbilled_status && isUnbilled_status) {
                commonjs.showWarning('messages.warning.claims.selectUnbilledRecord');
                $divObj.hide();
                return false;
            }

            if (isbilled_status && selectedStudies.length > 1) {
                commonjs.showWarning('messages.warning.claims.selectSingleRecord');
                $divObj.hide();
                return false;
            }

            var studyIds = studyArray.join();
            var firstSelectedStudy = selectedStudies[0];

            if (isClaimGrid) {
                var statusIndex = _.findIndex(selectedStudies, function (item) {
                    return (item.claim_status_code === 'P77' && app.billingRegionCode === 'can_MB') || (item.claim_status_code === 'OH' && app.billingRegionCode === 'can_BC');
                });

                commonjs.getClaimStudy(firstSelectedStudy.study_id, function (result) {
                    if (result) {
                        study_id = result.study_id;
                        order_id = result.order_id;
                        linked_parent_study_id = result.linked_parent_study_id;

                        if (rightclickMenuRights.indexOf('anc_view_documents') == -1) {
                            $('#anc_view_documents').removeClass('disabled')
                            $('#anc_view_reports').removeClass('disabled')
                        }
                    }
                });

                if (statusIndex < 0) {
                    var liClaimStatus = commonjs.getRightClickMenu('ul_change_claim_status', 'setup.rightClickMenu.claimStatus', false, 'Change Claim Status', true);

                    // If the user have rights to change the claim status, then will show the claim status in right click menu
                    if (rightclickMenuRights.indexOf('li_ul_change_claim_status') === -1) {
                        $divObj.append(liClaimStatus);
                    }

                    var liArray = [];

                    // Claim status updation
                    var isAlbertaBilling =  app.billingRegionCode === 'can_AB';

                    $.each(app.claim_status, function (index, claimStatus) {
                        var isWCBStatus = commonjs.can_ab_wcb_claim_status.indexOf(claimStatus.code) > -1;

                        if (isAlbertaBilling && !showWCBClaimStatus(claimStatus, selectedStudies, isWCBStatus)) {
                            return;
                        }

                        if ((app.billingRegionCode === 'can_MB' && claimStatus.code === 'P77') || (app.billingRegionCode === 'can_BC' && claimStatus.code === 'OH')
                            || (!isAlbertaBilling && isWCBStatus)) {
                            return;
                        }

                        var resubmissionFlag = isAlbertaBilling
                                               && isClaimGrid
                                               && gridData.claim_resubmission_flag === 'true';

                        if (resubmissionFlag && gridData.hidden_billing_method === 'electronic_billing' && claimStatus.code !== 'PS') {
                            return;
                        }

                        var $claimStatusLink = $(commonjs.getRightClickMenu('ancclaimStatus_' + claimStatus.id, 'setup.rightClickMenu.billingCode', true, claimStatus.description, false));
                        $claimStatusLink.click(function () {

                            $.ajax({
                                url: '/exa_modules/billing/claim_workbench/claims/update',
                                type: 'PUT',
                                data: {
                                    claimIds: studyArray,
                                    claim_status_id: claimStatus.id,
                                    process: "Claim Status"
                                },
                                success: function (data, response) {

                                    if (data && data.length && !data[0].status) {
                                        commonjs.showStatus('messages.status.claimStatusChanged');
                                        var colorCodeDetails = commonjs.getClaimColorCodeForStatus(claimStatus.code, 'claim');
                                        var color_code = colorCodeDetails && colorCodeDetails.length && colorCodeDetails[0].color_code || 'transparent';
                                        var tblId = gridID.replace(/#/, '');
                                        var cells = [
                                            {
                                                'field': 'claim_status',
                                                'data': claimStatus.description,
                                                'css': {
                                                    "backgroundColor": color_code
                                                }
                                            }
                                        ];

                                        _.each(data, function (obj) {
                                            var $claimGrid = $(gridID + ' tr#' + obj.id);
                                            var $td = $claimGrid.children('td');
                                            commonjs.setGridCellValue(cells, $td, tblId)
                                        });
                                        $("#btnClaimsRefresh").click();
                                    }
                                },
                                error: function (err, response) {
                                    commonjs.handleXhrError(err, response);
                                }
                            });
                        });
                        liArray[liArray.length] = $claimStatusLink;
                    });
                    $('#ul_change_claim_status').append(liArray);
                }

                // Billing Code status updation
                var liBillingCode = commonjs.getRightClickMenu('ul_change_billing_code', 'setup.rightClickMenu.billingCode', false, 'Change Billing Code', true);
                $divObj.append(liBillingCode);
                self.checkSubMenuRights('li_ul_change_billing_code');
                var liArrayBillingCode = [];
                var billingCodeList = [
                    {
                        id: null,
                        code: null,
                        description: null
                    }].concat(app.billing_codes || []);
                $.each(billingCodeList, function (index, billing_code) {
                    var data = {
                        billing_option: 'BILLINGCODE',
                        claimIds: studyArray,
                        process: "Billing Code",
                        billing_code_id: billing_code ? billing_code.id : null
                    };
                    var billing = {
                        color_code: billing_code ? billing_code.color_code : null,
                        status_message: 'messages.status.billingCodeChanged',
                        column: 'billing_code',
                        description: billing_code ? billing_code.description : null
                    }
                    var $billingCodeLink = $(commonjs.getRightClickMenu('ancBillingCode_' + (data.billing_code_id || 'none'), 'setup.rightClickMenu.billingCode', true, (index == 0 ? commonjs.geti18NString('setup.rightClickMenu.none') : billing.description), false));
                    self.billingLinkEvent($billingCodeLink, data, billing, $target);
                    liArrayBillingCode[liArrayBillingCode.length] = $billingCodeLink;
                });
                $('#ul_change_billing_code').append(liArrayBillingCode);

                // Billing class updation
                var liBillingClass = commonjs.getRightClickMenu('ul_change_billing_class', 'setup.rightClickMenu.billingClass', false, 'Change Billing Class', true);
                $divObj.append(liBillingClass);
                self.checkSubMenuRights('li_ul_change_billing_class');
                var liArrayBillingClass = [];
                var billingClassList = [
                    {
                        id: null,
                        code: null,
                        description: null
                    }].concat(app.billing_classes || []);
                $.each(billingClassList, function (index, billing_class) {
                    var data = {
                        billing_option: 'BILLINGCLASS',
                        claimIds: studyArray,
                        process: "Billing Class",
                        billing_class_id:billing_class ? billing_class.id : null
                    };
                    var billing = {
                        color_code: billing_class ? billing_class.color_code : null,
                        status_message: 'messages.status.billingClassChanged',
                        column: 'billing_class',
                        description: billing_class ? billing_class.description : null
                    };
                    var $BillingClassLink = $(commonjs.getRightClickMenu('ancBillingClass_' + (data.billing_class_id || 'none'), 'setup.rightClickMenu.billingClass', true, (index == 0 ? commonjs.geti18NString('setup.rightClickMenu.none') : billing.description), false));
                    self.billingLinkEvent($BillingClassLink, data, billing, $target);
                    liArrayBillingClass[liArrayBillingClass.length] = $BillingClassLink;
                });
                $('#ul_change_billing_class').append(liArrayBillingClass);

                if (studyArray.length === 1 && statusIndex < 0) {
                    var liPayerType = commonjs.getRightClickMenu('ul_change_payer_type', 'setup.rightClickMenu.billingPayerType', false, 'Change Billing PayerType', true);
                    $divObj.append(liPayerType);
                    self.checkSubMenuRights('li_ul_change_payer_type');
                    var liPayerTypeArray = [];
                    $.ajax({
                        url: '/exa_modules/billing/claim_workbench/billing_payers?id=' + rowID,
                        type: 'GET',
                        success: function (data, response) {
                            if (data && data.length > 0) {
                                var billingPayers = data[0];
                                if (billingPayers.patient_id) {
                                    liPayerTypeArray.push($(commonjs.getRightClickMenu('ancPatient_' + billingPayers.patient_id, '', true, billingPayers.patient_full_name + '( Patient )', false)));
                                }
                                if (billingPayers.primary_patient_insurance_id) {
                                    liPayerTypeArray.push($(payerTypeSubmenu(billingPayers, 'primary')));

                                }
                                if (billingPayers.secondary_patient_insurance_id) {
                                    liPayerTypeArray.push($(payerTypeSubmenu(billingPayers, 'secondary')));
                                }
                                if (billingPayers.tertiary_patient_insurance_id) {
                                    liPayerTypeArray.push($(payerTypeSubmenu(billingPayers, 'tertiary')));
                                }
                                if (billingPayers.ordering_facility_contact_id) {
                                    var payerType = '';
                                    if (app.isMobileBillingEnabled && app.settings.enableMobileRad) {
                                        payerType = '( Ordering Facility )';
                                    } else {
                                        payerType = '( Service Facility )';
                                    }

                                    liPayerTypeArray.push($(commonjs.getRightClickMenu('ancOrderingFacility_' + billingPayers.ordering_facility_contact_id, '', true, billingPayers.ordering_facility_name + payerType, false)));
                                }
                                if (billingPayers.referring_provider_contact_id) {
                                    liPayerTypeArray.push($(commonjs.getRightClickMenu('ancRenderingProvider_' + billingPayers.referring_provider_contact_id, '', true, billingPayers.ref_prov_full_name + '( Referring Provider )', false)));
                                }

                                //Checked if selected payer is valid service location
                                var isValidServiceLocation = (
                                    billingPayers.pos_map_code
                                    && app.isMobileBillingEnabled
                                    && app.settings.enableMobileRad
                                    && billingPayers.pos_map_code !== 'OF'
                                );

                                if (isValidServiceLocation) {
                                    liPayerTypeArray.push($(commonjs.getRightClickMenu('ancServiceFacility_' + billingPayers.pos_map_code, '', true, billingPayers.service_location + '( Service Facility )', false)));
                                }
                                $('#ul_change_payer_type').append(liPayerTypeArray);
                                $('#ul_change_payer_type li').click(function (e) {
                                    var payer_type = null;
                                    var ids = e && e.target && e.target.id && e.target.id.split('_');
                                    switch (ids[0]) {
                                        case 'ancPatient':
                                            payer_type = 'patient';
                                            break;
                                        case 'ancPrimaryIns':
                                            payer_type = 'primary_insurance';
                                            break;
                                        case 'ancSecondaryIns':
                                            payer_type = 'secondary_insurance';
                                            break;
                                        case 'ancTertiaryIns':
                                            payer_type = 'tertiary_insurance';
                                            break;
                                        case 'ancOrderingFacility':
                                            payer_type = 'ordering_facility';
                                            break;
                                        case 'ancRenderingProvider':
                                            payer_type = 'referring_provider';
                                            break;
                                        case 'ancServiceFacility':
                                            payer_type = 'service_facility_location';
                                            break;
                                    }
                                    $.ajax({
                                        url: '/exa_modules/billing/claim_workbench/billing_payers',
                                        type: 'PUT',
                                        data: {
                                            id: rowID,
                                            payer_type: payer_type
                                        },
                                        success: function (data, response) {
                                            if (data) {
                                                commonjs.showStatus('messages.status.claimPayerCompleted');
                                                $target.jqGrid('setCell', rowID, 'payer_type', payer_type);
                                            }
                                        },
                                        error: function (err, response) {
                                            commonjs.handleXhrError(err, response);
                                        }
                                    });
                                });
                            }
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                }

                var liEditClaim = commonjs.getRightClickMenu('anc_edit_claim', 'setup.rightClickMenu.editClaim', false, 'Edit Claim', false);
                if(studyArray.length == 1)
                    $divObj.append(liEditClaim);

                self.checkRights('anc_edit_claim');

                $('#anc_edit_claim').off().click(function () {
                    if ($('#anc_edit_claim').hasClass('disabled')) {
                        return false;
                    }
                    return initializeEditForm({
                        studyIds: studyIds,
                        study_id: study_id,
                        patient_name: firstSelectedStudy.patient_name,
                        patient_id: firstSelectedStudy.patient_id,
                        order_id: order_id,
                        grid_id: gridID
                    });
                });

                // Adjustment paid in fill section
                var liQuickAdjustPaidFull = commonjs.getRightClickMenu('anc_quick_adjust', 'billing.claims.adjustFull', false, 'Adjust paid in full', false);
                if (selectedStudies.length === 1 && (app.screens.includes('ADPF') || app.userInfo.user_type === 'SU') && firstSelectedStudy.claim_balance != '$0.00') {
                    $divObj.append(liQuickAdjustPaidFull);
                }

                self.checkRights('anc_quick_adjust');

                $('#anc_quick_adjust').off().click(function () {
                    var paidInFullTemplate = _.template(adjustPaidInFullTemplate);
                    commonjs.showDialog({
                        i18nHeader: 'billing.claims.adjustFull',
                        width: '40%',
                        height: '25%',
                        needShrink: true,
                        html: paidInFullTemplate({
                            adjustment_code_list: app.adjustment_code_list,
                            patient_name: firstSelectedStudy.patient_name,
                            patient_dob: firstSelectedStudy.patient_dob,
                            claim_balance: firstSelectedStudy.claim_balance,
                            claim_dt: firstSelectedStudy.claim_dt,
                            age: commonjs.getAge(firstSelectedStudy.patient_dob)
                        })
                    });

                    $('#btnPayInFull').off().click(function () {
                        var adjustmentCode = $('#adjustmentCode').val();

                        if (!adjustmentCode) {
                            return commonjs.showWarning('messages.warning.payments.pleaseSelectAdjustment');
                        }

                        $.ajax({
                            url: '/exa_modules/billing/payments/process_write_off_payments/' + firstSelectedStudy.claim_id,
                            type: 'POST',
                            data: {
                                adjustmentCodeId: adjustmentCode
                            },
                            success: function (response) {
                                if (response) {
                                    commonjs.hideDialog();
                                    commonjs.showStatus('messages.status.tosSuccessfullyCompleted');
                                    $("#btnClaimsRefresh").click();
                                }
                            }, error: function (err, response) {
                                commonjs.handleXhrError(err, response);
                            }
                        });
                    });
                    commonjs.processPostRender();
                });

                if (studyArray.length === 1 && statusIndex < 0) {
                    var liDeleteClaim = commonjs.getRightClickMenu('anc_delete_claim', 'setup.rightClickMenu.deleteClaim', false, 'Delete Claim', false);
                    var isWCBBilling = gridData.hidden_insurance_provider_codes
                        && gridData.hidden_insurance_provider_codes.toLowerCase() === 'wcb';
                    $divObj.append(liDeleteClaim);
                    self.checkRights('anc_delete_claim');

                    $('#anc_delete_claim').off().click(function () {
                        if ($('#anc_delete_claim').hasClass('disabled')) {
                            return false;
                        }

                        if (confirm(commonjs.geti18NString("messages.status.areYouSureWantToDeleteClaims"))) {

                            if (app.country_alpha_3_code !== 'usa') {
                                var msg = self.provinceBasedValidationResults(app.billingRegionCode, gridData, isWCBBilling);

                                if (msg) {
                                    return commonjs.showWarning(msg);
                                }
                            }

                            var params = self.getProvinceBasedParams(app.billingRegionCode, 'delete', studyIds, gridData, isWCBBilling);

                            commonjs.showLoading();
                            $.ajax({
                                url: params.url,
                                type: params.type,
                                data: params.data,
                                success: function (data, response) {
                                    commonjs.hideLoading();

                                    if (app.billingRegionCode === 'can_AB' && gridData.hidden_billing_method === 'electronic_billing' && !isWCBBilling) {
                                        self.ahsDeleteResponse(data);
                                    } else {
                                        self.claimDeleteResponse(data, studyIds);
                                    }
                                },
                                error: function (err, response) {
                                    commonjs.handleXhrError(err, response);
                                }
                            });
                        }
                    });
                }

                var liClaimInquiry = commonjs.getRightClickMenu('anc_claim_inquiry', 'setup.rightClickMenu.claimInquiry', false, 'Claim Inquiry', false);
                if(studyArray.length == 1)
                    $divObj.append(liClaimInquiry);
                self.checkRights('anc_claim_inquiry');
                $('#anc_claim_inquiry').click(function () {
                    if ($('#anc_claim_inquiry').hasClass('disabled')) {
                        return false;
                    }

                    self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                    self.claimInquiryView.render({
                        'claim_id': studyIds,
                        'patient_id': firstSelectedStudy.patient_id,
                        'grid_id': gridID,
                        'source': 'claims'
                    });

                });

                var liPatientClaimInquiry = commonjs.getRightClickMenu('anc_patient_claim_inquiry', 'setup.rightClickMenu.patientClaims', false, 'Patient Claims', false);
                if(studyArray.length == 1)
                    $divObj.append(liPatientClaimInquiry);
                self.checkRights('anc_patient_claim_inquiry');
                $('#anc_patient_claim_inquiry').click(function () {
                    if ($('#anc_patient_claim_inquiry').hasClass('disabled')) {
                        return false;
                    }

                self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                self.claimInquiryView.patientInquiryForm(studyIds, firstSelectedStudy.patient_id, firstSelectedStudy.patient_name, gridID, true);
                });


                var liInvoiceInquiry = commonjs.getRightClickMenu('anc_invoice_inquiry', 'setup.rightClickMenu.directBillingInquiry', false, 'Direct Billing Inquiry', false);
                if (studyArray.length == 1 && firstSelectedStudy.billing_method == "direct_billing")
                    $divObj.append(liInvoiceInquiry);
                self.checkRights('anc_invoice_inquiry');
                $('#anc_invoice_inquiry').click(function () {
                    if ($('#anc_invoice_inquiry').hasClass('disabled')) {
                        return false;
                    }
                    commonjs.showDialog({
                        'header': commonjs.geti18NString('shared.fields.invoices') + ' ' +  commonjs.geti18NString('shared.fields.payerName') + ': ' + gridData.hidden_payer_name,
                        'width': '95%',
                        'height': '80%',
                        'needShrink': true
                    });
                self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                self.claimInquiryView.invoiceInquiry(studyIds, firstSelectedStudy.patient_id, firstSelectedStudy.payer_type); //firstSelectedStudy.invoice_no
                });

                var liPatientClaimLog = commonjs.getRightClickMenu('anc_patient_claim_log', 'setup.rightClickMenu.patientClaimLog', false, 'Patient Claim Log', false);
                if(studyArray.length == 1)
                    $divObj.append(liPatientClaimLog);
                self.checkRights('anc_patient_claim_log');
                $('#anc_patient_claim_log').click(function () {
                    if ($('#anc_patient_claim_log').hasClass('disabled')) {
                        return false;
                    }

                    commonjs.showDialog({
                        'header': 'Patient Claim Log',
                        'i18nHeader': 'shared.moduleheader.patientClaimLog',
                        'width': '95%',
                        'height': '80%',
                        'needShrink': true
                    });
                self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                self.claimInquiryView.patientInquiryLog(studyIds, firstSelectedStudy.patient_id, firstSelectedStudy.patient_name);
                });

                if (studyArray.length === 1 && statusIndex < 0) {
                    var liSplitOrders = commonjs.getRightClickMenu('anc_split_claim', 'setup.rightClickMenu.splitClaim', false, 'Split Claim', false);

                    $divObj.append(liSplitOrders);
                    self.checkRights('anc_split_claim');
                    $('#anc_split_claim').click(function () {
                        if ($('#anc_split_claim').hasClass('disabled')) {
                            return false;
                        }
                        self.splitClaimView = new splitClaimView();
                        self.splitClaimView.validateSplitClaim(studyIds);
                    });
                }

                if (selectedStudies.length == 1) {
                    var liViewDocumetns = commonjs.getRightClickMenu('anc_view_documents', 'setup.rightClickMenu.viewDocuments', false, 'View Documents', false);
                    $divObj.append(liViewDocumetns);
                    self.checkRights('anc_view_documents');
                    $('#anc_view_documents').click(function () {
                        if ($('#anc_view_documents').hasClass('disabled')) {
                            return false;
                        }

                        commonjs.showDialog({
                            header: 'Patient Documents',
                            i18nHeader: 'setup.rightClickMenu.patientDocuments',
                            width: '95%',
                            height: '75%',
                            url: '/vieworder#order/document/' + btoa(order_id) + '/' + btoa(firstSelectedStudy.patient_id) + '/' + btoa(study_id) + '/claim'
                        });
                    });

                    var liViewReports = commonjs.getRightClickMenu('anc_view_reports', 'setup.rightClickMenu.viewReports', false, 'View Reports', false);
                    $divObj.append(liViewReports);
                    self.checkRights('anc_view_reports');
                    $('#anc_view_reports').click(function () {
                        if ($('#anc_view_reports').hasClass('disabled')) {
                            return false;
                        }

                        var session = app.sessionID ? btoa(app.sessionID) : "demo_session";
                        var trans_study_id = linked_parent_study_id || study_id;
                        var queryStrVal = [
                            'study_id=' + trans_study_id,
                            'host_name=' + location.origin,
                            'user_id=' + app.userID,
                            'company_id=' + app.companyID,
                            'client_ip=' + location.hostname,
                            'session=' + session,
                            'screen_name=approved_report'
                        ];
                        queryStrVal = queryStrVal.join('&');
                        commonjs.showDialog({
                            header: 'Approved Reports',
                            i18nHeader: 'setup.rightClickMenu.approvedReports',
                            width: '95%',
                            height: '75%',
                            url: '/Txtranscription/transcription/TranscriptionHandler.ashx?q=' + btoa(queryStrVal)
                        });
                    });

                    $('#anc_view_documents').addClass('disabled')
                    $('#anc_view_reports').addClass('disabled')
                }

                var liFollowUp = commonjs.getRightClickMenu('anc_add_followup', 'setup.rightClickMenu.addFollowUP', false, 'Follow-up', false);
                $divObj.append(liFollowUp);
                self.checkRights('anc_add_followup');
                $('#anc_add_followup').click(function () {
                    if ($('#anc_add_followup').hasClass('disabled')) {
                        return false;
                    }
                    self.followUpView = new followUpView();
                    self.followUpView.render(studyIds);
                });

                if (options.filterid == 'Follow_up_queue') {
                    var liResetFollowUp = commonjs.getRightClickMenu('anc_reset_followup', 'setup.rightClickMenu.resetFollowUp', false, 'Cancel Follow-up', false);
                    $divObj.append(liResetFollowUp);
                    self.checkRights('anc_reset_followup');
                    $('#anc_reset_followup').click(function () {
                        if ($('#anc_reset_followup').hasClass('disabled')) {
                            return false;
                        }
                        if (!window.confirm('Are you sure you want to cancel?')) {
                            return false;
                        }

                        self.followUpView = new followUpView();
                        self.followUpView.resetFollowUp(studyIds);
                    });
                }

                if (options.filterid != 'Follow_up_queue') {
                    var liEditClaim = commonjs.getRightClickMenu('anc_reset_invoice_no', 'setup.rightClickMenu.resetInvoice', false, 'Reset Invoice Number', false);
                    if(studyArray.length == 1 && firstSelectedStudy.invoice_no != null && firstSelectedStudy.invoice_no != '')
                        $divObj.append(liEditClaim);
                    self.checkRights('anc_reset_invoice_no');

                    $('#anc_reset_invoice_no').click(function () {
                        if ($('#anc_reset_invoice_no').hasClass('disabled')) {
                            return false;
                        }
                        self.resetInvoiceNumber(firstSelectedStudy.invoice_no);
                    });
                }
                self.bindProvinceBasedMenus($divObj, studyArray, gridData, isClaimGrid, selectedStudies, $target);

            } else {
                if (!isbilled_status) {
                    var liCreateClaim = commonjs.getRightClickMenu('anc_create_claim', 'setup.rightClickMenu.createClaim', false, 'Create Claim', false);
                    $divObj.append(liCreateClaim);
                    self.checkRights('anc_create_claim');
                    $('#anc_create_claim').off().click(function () {

                        if ($('#anc_create_claim').hasClass('disabled')) {
                            return false;
                        }
                            window.localStorage.setItem('selected_studies', null);
                            window.localStorage.setItem('primary_study_details', JSON.stringify(firstSelectedStudy));
                            window.localStorage.setItem('selected_studies', JSON.stringify(studyIds));
                            window.localStorage.setItem('selected_orders', JSON.stringify(orderIds));

                            self.claimView = new claimsView();
                            self.claimView.showClaimForm({ 'grid_id': gridID }, 'studies');

                        });
                    }

                if (isbilled_status) {
                    var liEditClaim = commonjs.getRightClickMenu('anc_edit_claim', 'setup.rightClickMenu.editClaim', false, 'Edit Claim', false);
                    $divObj.append(liEditClaim);
                    self.checkRights('anc_edit_claim');
                    $('#anc_edit_claim').off().click(function () {
                        return initializeEditForm({
                            studyIds: firstSelectedStudy.claim_id,
                            study_id: firstSelectedStudy.study_id,
                            patient_name: firstSelectedStudy.patient_name,
                            patient_id: firstSelectedStudy.patient_id,
                            order_id: order_id,
                            grid_id: gridID
                        });
                    });
                }

            }

            commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
            $divObj.show();
            setRightMenuPosition(divObj, event);
            event.preventDefault();
        };

        self.batchClaim = function () {
            gridID = '#tblGrid' + commonjs.currentStudyFilter;
            $tblGrid = $(gridID);
            var $checkedInputs = $tblGrid.find('input').filter('[name=chkStudy]:checked');
            var selectedCount = $checkedInputs.length;
            var currentFilter = commonjs.studyFilters.find(function (filter) {
                return filter.filter_id == commonjs.currentStudyFilter;
            });
            var filterContent = commonjs.loadedStudyFilters.get(filterID);
            filterData = JSON.stringify(filterContent.pager.get('FilterData'));
            filterCol = JSON.stringify(filterContent.pager.get('FilterCol'));
            var isDatePickerClear = filterCol.indexOf('study_dt') === -1;
            var isAlbertaBilling = app.billingRegionCode === 'can_AB';
            var isOhipBilling = app.billingRegionCode === 'can_ON';

            batchClaimArray = [];
            for (var r = 0; r < selectedCount; r++) {
                var rowId = $checkedInputs[r].parentNode.parentNode.id;
                var gridData = $(gridID).jqGrid('getRowData', rowId);

                if (app.isMobileBillingEnabled && gridData.hidden_billing_type === 'census') {
                    commonjs.showWarning("messages.warning.validBillingType");
                    return false;
                }

                if (!gridData.hidden_study_cpt_id) {
                    commonjs.showWarning("messages.warning.claims.selectChargesRecordForBatchClaim");
                    return false;
                }

                if (gridData.billed_status && gridData.billed_status.toLocaleLowerCase() == 'billed') {
                    commonjs.showWarning("messages.warning.claims.selectUnbilledRecordForBatchClaim");
                    return false;
                }

                batchClaimArray.push({
                    patient_id: gridData.hidden_patient_id,
                    study_id: [gridData.hidden_study_id],
                    order_id: [gridData.hidden_order_id],
                    billing_type: (app.isMobileBillingEnabled && gridData.hidden_billing_type) || 'global',
                    facility_id: gridData.hidden_facility_id
                });
            }

            if (batchClaimArray.length) {

                var selectedIds = JSON.stringify(batchClaimArray);
                var param ;
                var $btnBatchClaim = $('#btnbatchClaim');

                commonjs.showLoading();
                $btnBatchClaim.prop('disabled', true);

                if ($('#chkStudyHeader_' + filterID).is(':checked')) {

                    param = {
                        filterData: filterData,
                        filterCol: filterCol,
                        sortField: filterContent.pager.get('SortField'),
                        sortOrder: filterContent.pager.get('SortOrder'),
                        company_id: app.companyID,
                        user_id: app.userID,
                        pageNo: 1,
                        pageSize: 100,
                        isAllCensus: false,
                        isAllStudies: true,
                        isDatePickerClear: isDatePickerClear,
                        customArgs: {
                            filter_id: filterID,
                            isClaimGrid: false
                        },
                        isBatchClaim: true,
                        isMobileBillingEnabled: app.isMobileBillingEnabled,
                        isMobileRadEnabled: app.settings.enableMobileRad
                    }
                } else {
                    param = {
                        studyDetails: selectedIds,
                        company_id: app.companyID,
                        isAllStudies: false,
                        isAllCensus: false,
                        isMobileBillingEnabled: app.isMobileBillingEnabled,
                        isMobileRadEnabled: app.settings.enableMobileRad
                    }
                }
                    $.ajax({
                        url: '/exa_modules/billing/claim_workbench/claims/batch',
                        type: 'POST',
                        data: param,
                        success: function (data, response) {
                            commonjs.showStatus('messages.status.batchClaimCompleted');
                            commonjs.hideLoading();
                            var claimDetails = _.get(data, '0');
                            var claim_id = claimDetails && (
                                claimDetails.create_claim_charge
                                || claimDetails.can_ahs_create_claim_per_charge
                                || claimDetails.can_ohip_create_claim_split_charge
                            ) || null;

                            // Change grid values after claim creation instead of refreshing studies grid
                            if (claim_id) {

                                var claimsTable = new customGrid(studyDataStore, gridID);
                                claimsTable.options = { gridelementid: gridID }
                                var changeGrid = initChangeGrid(claimsTable);

                                for (var r = 0; r < batchClaimArray.length; r++) {
                                    var rowId = batchClaimArray[r].study_id[0];
                                    var $row = $tblGrid.find('#' + rowId);
                                    var cells = [];
                                    var currentStudyDetails = data.find(function (row) { return row.study_id == rowId });

                                    var claimId = isAlbertaBilling ? currentStudyDetails.can_ahs_create_claim_per_charge : isOhipBilling
                                        ? currentStudyDetails.can_ohip_create_claim_split_charge : currentStudyDetails.create_claim_charge;

                                    cells = cells.concat(changeGrid.getClaimId(claimId))
                                        .concat(changeGrid.getBillingStatus('Billed'))
                                        .concat(changeGrid.setEditIcon());

                                    //Upon POST of new batch claim, place claim ID inside hidden cell specificed below
                                    $row.find("[aria-describedby='tblGridAll_Studies_hidden_claim_id']").text(claimId);

                                    var setCell = changeGrid.setCell($row);
                                    setCell(cells);
                                    // In user filter Billed Status selected as unbilled means, After claim creation hide from grid.
                                    var isBilledStatus = currentFilter.filter_info && currentFilter.filter_info.studyInformation && currentFilter.filter_info.studyInformation.billedstatus === 'unbilled' || false;

                                    if ($('#gs_billed_status').val() === 'unbilled' || isBilledStatus) {
                                        $row.remove();
                                    }
                                }
                            }

                            $btnBatchClaim.prop('disabled', false);
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                            commonjs.hideLoading();
                            $btnBatchClaim.prop('disabled', false);
                        }
                    });
            } else {
                commonjs.showWarning('messages.warning.claims.selectClaimToCreate');
            }
        },

        self.renderStudy = function (doExport, filterData, filterCol) {
            var isPopupOpen = false;
            if (options.isClaimGrid)
                var studyStore = studyDataStore = new claimWorkbench(null, { 'filterID': filterID });
            else {
                var studyStore = studyDataStore = new Studies(null, { 'filterID': filterID });
            }

            var billingUserList = {};

            $.each(app.billing_user_list, function ( index, users ) {
                billingUserList[ users.id ] = users.username+' ( '+users.last_name +', '+users.first_name +' ) ';
            });

            var claimsTable = new customGrid(studyStore, gridID);
            var changeGrid = initChangeGrid(claimsTable);
            var transcriptionHide = true;
            var opalViewerHide = true;
            var dicomViewerHide = true;
            var showPriorsHide = true;
            var reportHide = true;
            var colName = [];
            var i18nName = [];
            var colModel = [];

            if (!options.isPrior && !showPriorsHide && isNotTrue(options.showEncOnly)) {
                colName.push('');
                i18nName.push('');
                colModel.push({
                    name: 'as_prior',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: false,
                    isIconCol: true, // SMH Bug #2606 - Mark column as an icon cell which can be hidden
                    formatter: function (cellvalue, options, rowObject) {
                        return !rowObject.has_priors ?
                            "<i class='icon-ic-prior-studies' style='opacity: 0.3' title='Prior'></span>" :
                            "<i class='icon-ic-prior-studies' title='Prior'></span>";
                    },
                    customAction: function (rowID, e, that) {
                        var gridData = getData(rowID, studyStore, gridID);
                        if (gridData === null) {
                            return false;
                        }
                        if (isTrue(gridData.has_priors)) {
                            options.setpriorstudies(rowID, filterID, gridData);
                            return false;
                        }
                    }
                });
            }

            var icon_width = 24;
            colName = colName.concat([
                ('<input type="checkbox" i18nt="billing.payments.selectAllStudies" id="chkStudyHeader_' + filterID + '" class="chkheader" onclick="commonjs.checkMultiple(event)" />'),
                '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Assigned To', '', '', '', ''
            ]);

            i18nName = i18nName.concat([
                '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'billing.claims.assignedTo', '', '', '', ''
            ]);

            colModel = colModel.concat([
                {
                    name: 'as_chk',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    isIconCol: true,
                    formatter: function (cellvalue, option, rowObject) {
                        if (['ABRT', 'CAN', 'NOS'].indexOf(rowObject.study_status) > -1 || rowObject.has_deleted ||
                            (!options.isClaimGrid && app.isMobileBillingEnabled && rowObject.billing_type === 'census'
                                && rowObject.billed_status === 'unbilled')) {
                            return "";
                        }

                        return '<input type="checkbox" name="chkStudy" id="chk' + gridID.slice(1) + '_' + (options.isClaimGrid ? rowObject.id : rowObject.study_id) + '" />'


                    },
                    customAction: function (rowID, e, that) {
                    }
                },
                {
                    name: 'alert', width: 20, sortable: false, search: false,
                    className: 'icon-ic-info',
                    formatter: function (e, model, data) {
                        if (data.show_alert_icon) {
                            return '<i class="icon-ic-info" i18nt="shared.buttons.alert" id="alertInfoRow_' + model.rowId + '"></i>';
                        }

                        return "";
                    },
                },
                {
                    name: 'as_edit',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: false,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                            if(!rowObject.claim_id)
                                return "";
                            return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"

                    },
                    customAction: function (rowID, e, that) {
                        if (screenCode.indexOf('ECLM') > -1)
                            return false;
                        var gridData = $('#' + e.currentTarget.id).jqGrid('getRowData', rowID);

                        return initializeEditForm({
                            studyIds: gridData.hidden_claim_id,
                            study_id: rowID,
                            patient_name: gridData.hidden_patient_name,
                            patient_id: gridData.hidden_patient_id,
                            order_id: gridData.hidden_order_id,
                            grid_id: gridID
                        });
                    }
                },
                {
                    name: 'as_claim_inquiry',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: !options.isClaimGrid,
                    isIconCol: true,
                    formatter: function () {
                        return "<i class='icon-ic-raw-transctipt' i18nt='billing.fileInsurance.claimInquiry'></i>"
                    },
                    customAction: function (rowID, e, that) {
                        if (screenCode.indexOf('CLMI') > -1){
                            return false;
                        }

                        commonjs.showDialog({
                            'header': 'Claim Inquiry',
                            'width': '95%',
                            'height': '85%',
                            'needShrink': true
                        });
                        self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                        self.claimInquiryView.render({
                            'claim_id': rowID,
                            'grid_id': gridID,
                            'source': 'claims'
                        });
                    }
                },
                {
                    name: 'as_claim_summary',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: !options.isClaimGrid,
                    isIconCol: true,
                    formatter: function () {
                        return '<i href="#" class="icon-ic-worklist" data-toggle="popover" i18nt="shared.fields.claimSummary"></i>';
                    },
                    customAction: function (rowID, e, that) {
                        if (isPopupOpen) {
                            return false;
                        }
                        var claimSummaryId = $('.claim-summary:visible').attr('id');
                        claimSummaryId = claimSummaryId && claimSummaryId.split('_') || [];
                        var warningMsg = commonjs.geti18NString("messages.warning.claims.unableToGetClaimSummary");
                        $('.claim-summary').remove();

                        if (claimSummaryId[1] === rowID) {
                            return false;
                        }

                        $.ajax({
                            url: '/exa_modules/billing/claim_workbench/claim_summary',
                            type: "GET",
                            data: {
                                id: rowID
                            },
                            beforeSend: function(){
                                commonjs.showLoading();
                            },
                            success: function (data) {
                                if (data && data.error) {
                                    commonjs.handleXhrError(data.error);
                                    return;
                                }
                                if (data && data.length) {

                                    var summaryDetails = data[0] || {};
                                    var patient_info = commonjs.hstoreParse(summaryDetails.patient_info || {});
                                    var patientDetailsLine = summaryDetails.gender + ', ' + summaryDetails.patient_study_age + ', ' + (summaryDetails.birth_date ? moment(summaryDetails.birth_date).format('L') : '');

                                    // Claim Summary popup creation - start
                                    var _contentTable = $('<table/>').addClass('col-12 contentTable').css('table-layout', 'fixed');
                                    var _headerLeftTable = $('<table/>').addClass('col-12 contentTable').css('table-layout', 'fixed');
                                    var _headerRightTable = $('<table/>').addClass('col-12 contentTable').css('table-layout', 'fixed');
                                    var cptCodes = summaryDetails.cpt_codes && summaryDetails.cpt_codes.length ? summaryDetails.cpt_codes.join(',') : '--';
                                    var cptDesc = summaryDetails.cpt_description && summaryDetails.cpt_description.length ? summaryDetails.cpt_description.join(',') : '--';
                                    var claimDate = summaryDetails.claim_dt ? commonjs.convertToFacilityTimeZone(summaryDetails.facility_id, summaryDetails.claim_dt).format('L') : '--';

                                    // create summary parent div
                                    $(document.body).append(
                                        $('<div/>').addClass('claim-summary').css({ "display": "none" })
                                            .attr({ 'id': 'claimSummary_' + rowID })
                                            .append($('<h3/>').addClass('popover-header').css('font-size', '0.8rem'))
                                            .append($('<div/>').addClass('popover-body'))
                                    );

                                    _headerLeftTable.append(
                                        $('<tr/>').addClass('col-12')
                                            .append($('<td/>').addClass('text-truncate').text(summaryDetails.patient_name).attr({ title: summaryDetails.patient_name }))
                                    );
                                    _headerLeftTable.append(
                                        $('<tr/>').addClass('col-12')
                                            .append($('<td/>').addClass('text-truncate').text(patientDetailsLine))
                                    );

                                    if (patient_info.c1HomePhone) {
                                        _headerLeftTable.append(
                                            $('<tr/>').addClass('row')
                                                .append($('<td/>').addClass('col-5 pr-1').text(commonjs.geti18NString("shared.fields.homePhone")))
                                                .append($('<td/>').addClass('col-1 pr-0').text(':'))
                                                .append($('<td/>').addClass('col-6 pr-1 pl-1 text-truncate').text(patient_info.c1HomePhone).attr({ title: patient_info.c1HomePhone }))
                                        );
                                    }

                                    if (patient_info.c1WorkPhone) {
                                        _headerLeftTable.append(
                                            $('<tr/>').addClass('row')
                                                .append($('<td/>').addClass('col-5 pr-1').text(commonjs.geti18NString("shared.fields.workPhone")))
                                                .append($('<td/>').addClass('col-1 pr-0').text(':'))
                                                .append($('<td/>').addClass('col-6 pr-1 pl-1 text-truncate').text(patient_info.c1WorkPhone).attr({ title: patient_info.c1WorkPhone }))
                                        );
                                    }

                                    if (patient_info.c1MobilePhone) {
                                        _headerLeftTable.append(
                                            $('<tr/>').addClass('row')
                                                .append($('<td/>').addClass('col-5 pr-1').text(commonjs.geti18NString("shared.fields.mobilePhone")))
                                                .append($('<td/>').addClass('col-1 pr-0').text(':'))
                                                .append($('<td/>').addClass('col-6 pr-1 pl-1 text-truncate').text(patient_info.c1MobilePhone).attr({ title: patient_info.c1MobilePhone }))
                                        );

                                    }

                                    if (summaryDetails.account_no) {
                                        _headerLeftTable.append(
                                            $('<tr/>').addClass('row')
                                                .append($('<td/>').addClass('col-5 pr-1').text(commonjs.geti18NString("shared.fields.accountNo")))
                                                .append($('<td/>').addClass('col-1 pr-0').text(':'))
                                                .append($('<td/>').addClass('col-6 pr-1 pl-1 text-truncate').text(summaryDetails.account_no).attr({ title: summaryDetails.account_no }))
                                        );
                                    }

                                    // header top right side corner
                                    _headerRightTable.append($('<tr/>')
                                        .addClass('row')
                                        .append($('<td/>').addClass('col-6 pr-1').text(commonjs.geti18NString("order.summary.patientBalance")))
                                        .append($('<td/>').addClass('col-1 pr-0').text(':'))
                                        .append($('<td/>').addClass('col-4 pl-0 text-right text-truncate').text(summaryDetails.patient_balance).attr({ title: summaryDetails.patient_balance }))
                                    );
                                    _headerRightTable.append($('<tr/>')
                                        .addClass('row')
                                        .append($('<td/>').addClass('col-6 pr-1').text(commonjs.geti18NString("order.summary.insuranceBalance")))
                                        .append($('<td/>').addClass('col-1 pr-0').text(':'))
                                        .append($('<td/>').addClass('col-4 pl-0 text-right text-truncate').text(summaryDetails.insurance_balance).attr({ title: summaryDetails.insurance_balance }))
                                    );
                                    // clear claimSummary before bind
                                    $('claim-summary').find('.popover-body').empty();
                                    $('claim-summary').find('.popover-header').empty();

                                    $(document.body).find('.popover-header')
                                        .append(
                                            $('<div>').addClass('row')
                                                .append(
                                                    $('<div/>').addClass('col-sm-6 col-md-6 col-lg-6 pr-0')
                                                        .append(_headerLeftTable)
                                                )
                                                .append($('<div/>').addClass('col-sm-6 col-md-6 col-lg-6 pl-0')
                                                    .append(_headerRightTable))
                                        );

                                    _contentTable.append($('<tr/>')
                                        .addClass('row')
                                        .append($('<td/>').addClass('col-3').text(commonjs.geti18NString("shared.fields.cptCodes")))
                                        .append($('<td/>').addClass('pl-0 pr-2').text(':'))
                                        .append($('<td/>').addClass('col-8 pl-0 text-truncate').text(cptCodes).attr({ title: cptCodes }))
                                    );
                                    _contentTable.append($('<tr/>')
                                        .addClass('row')
                                        .append($('<td/>').addClass('col-3').text(commonjs.geti18NString("shared.fields.cptDescription")))
                                        .append($('<td/>').addClass('pl-0 pr-2').text(':'))
                                        .append($('<td/>').addClass('col-8 pl-0 text-truncate').text(cptDesc).attr({ title: cptDesc }))
                                    );
                                    _contentTable.append($('<tr/>')
                                        .addClass('row')
                                        .append($('<td/>').addClass('col-3').text(commonjs.geti18NString("billing.claims.claimDate")))
                                        .append($('<td/>').addClass('pl-0 pr-2').text(':'))
                                        .append($('<td/>').addClass('col-8 pl-0 text-truncate').text(claimDate).attr({ title: claimDate }))
                                    );
                                    _contentTable.append($('<tr/>')
                                        .addClass('row')
                                        .append($('<td/>').addClass('col-3').text(commonjs.geti18NString("order.providerSchedule.createdBy")))
                                        .append($('<td/>').addClass('pl-0 pr-2').text(':'))
                                        .append($('<td/>').addClass('col-8 pl-0 text-truncate').text(summaryDetails.created_by).attr({ title: summaryDetails.created_by }))
                                    );

                                    $(document.body).find('.popover-body').css('font-size', '0.8rem').append(_contentTable);
                                    // Claim Summary popup creation - emd
                                    // Position setting for popup
                                    var openPopup = function (offset) {
                                        var popup = $('.claim-summary');
                                        var popupContent = $('.claim-summary');
                                        if (popup.css('display') === 'none') {
                                            popup.css('display', 'block');
                                        }
                                        popupContent.css('transform', 'translate3d(82px, ' + offset + 'px, 0px)');
                                    }
                                    var target = $(e.target);
                                    var targetOffset = target.offset().top;
                                    var tableHeight = $(gridID).parents('.ui-jqgrid-bdiv').height() || 0;
                                    if (targetOffset <= tableHeight) {
                                        openPopup(targetOffset);
                                    } else {
                                        var targetHeight = target.height();
                                        var contentHeight = $('.claim-summary').outerHeight();
                                        var targetBottomOffset = targetOffset + targetHeight - contentHeight;
                                        openPopup(targetBottomOffset);
                                    }
                                    if (!isPopupOpen) {
                                        // Set the flag to indicate that the popup is open
                                        isPopupOpen = true;
                                        // Remove the popup and reset the flag on popup close
                                        $('.claim-summary').on('hidden.bs.modal', function () {
                                            isPopupOpen = false;
                                            $(this).remove();
                                        });
                                    }
                                } else {
                                    $('.popover-header').empty();
                                    $('.popover-body').empty().append(warningMsg);
                                }
                                commonjs.hideLoading();
                            },
                            error: function (request, status, error) {
                                commonjs.handleXhrError(request, status, error);
                                $('.popover-header').empty();
                                $('.popover-body').empty().append(warningMsg);
                                commonjs.hideLoading();
                            }
                        });

                        e.stopPropagation();
                        return false;
                    }
                },
                {
                    name: 'as_eligibility_status',
                    width: 40,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: app.country_alpha_3_code !== 'can',
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {

                        if (app.country_alpha_3_code === 'can') {
                            var color;
                            var result = cellvalue && cellvalue.split('__')[0] || '';
                            var i18n = cellvalue && cellvalue.split('__')[1] || 'messages.status.healthNumberNotValidated';

                            var defaultColour = app.billingRegionCode == 'can_BC' ? 'white' : 'red';

                            switch (result) {
                                case 'valid':
                                    color = 'green';
                                    break;
                                case 'future_date':
                                case 'no_data_found':
                                    color = 'orange';
                                    break;
                                case 'invalid':
                                    color = 'red'
                                    break;
                                case 'failed':
                                    color = 'yellow'
                                    break;
                                default:
                                    color = defaultColour;
                            }

                            return "<i href='#' i18nt='" + i18n + "' class='icon-ic-status' data-value='" + cellvalue + "' style='color: " + color + ";text-shadow:0 0 " + color + ", 0 0 " + color + ", 0 0 " + color + ", 0 0 " + color + ", 0 0 " + color + "'></i>";
                        }
                    },
                    customAction: function (rowID, e, that) {
                    }
                },
                {
                    name: 'as_claim_submission_status',
                    width: 40,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: app.country_alpha_3_code !== 'can',
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.error_data && rowObject.error_data.length && "<i class='icon-ic-warning' i18nt='billing.claims.claimError'></i>" || '';

                    },
                    customAction: function (rowID, e, that) {
                        var gridData = getData(rowID, studyStore, gridID);
                        var errorContent = '<div style="width:100%;height:100%" id="divError"><textarea style="width:100%;height:100%" id="txtAreaErrorData">' + JSON.stringify(gridData.error_data, undefined, 4) + '</textarea></div>';

                        commonjs.showDialog({
                            header: 'OHIP  Submission Error',
                            i18nHeader: 'shared.moduleheader.ohipClaims',
                            width: '50%',
                            height: '50%',
                            html: errorContent
                        });

                    }
                },
                {
                    name: 'hidden_study_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.study_id || "";
                    }
                },
                {
                    name: 'hidden_clearing_house',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.clearing_house || "";
                    }
                },
                {
                    name: 'hidden_claim_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return Array.isArray(rowObject.claim_id) ?
                            rowObject.claim_id[0] : rowObject.claim_id || '';
                    }
                },
                {
                    name: 'hidden_birth_date',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.birth_date || "";
                    }
                },
                {
                    name: 'hidden_patient_name',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.patient_name || "";
                    }
                },
                {
                    name: 'hidden_insurance_providers',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.insurance_providers || "";
                    }
                },
                {
                    name: 'hidden_insurance_provider_codes',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.insurance_code || "";
                    }
                },
                {
                    name: 'hidden_patient_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.patient_id || "";
                    }
                },
                {
                    name: 'hidden_billing_method',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.billing_method || "";
                    }
                },
                {
                    name: 'hidden_study_status',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.study_status || "";
                    }
                },
                {
                    name: 'hidden_has_deleted',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.has_deleted || "";
                    }
                },
                {
                    name: 'hidden_order_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.order_id || "";
                    }
                },
                {
                    name: 'hidden_study_cpt_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.study_cpt_id || "";
                    }
                },
                {
                    name: 'hidden_ordering_facility',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.ordering_facility || rowObject.ordering_facility_name || null;
                    }
                },
                {
                    name: 'hidden_is_split_enabled_primary_insurance',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.is_split_claim_enabled || "";
                    }
                },
                {
                    name: 'hidden_claim_status_code',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.claim_status_code || "";
                    }
                },
                {
                    name: 'hidden_invoice_no',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.invoice_no || "";
                    }
                },
                {
                    name: 'hidden_facility_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.facility_id || "";
                    }
                },
                {
                    name: 'assigned_to',
                    width: 200,
                    sortable: false,
                    resizable: false,
                    search: true,
                    hidden: !(options.filterid =="Follow_up_queue"),
                    isIconCol: true,
                    "stype": "select",
                    "searchoptions": {
                        "value": billingUserList,
                        "defaultValue":billingUserList
                    }
                },
                {
                    name: 'hidden_assigned_id',
                    hidden: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.assigned_id || "";
                    }
                },
                {
                    name: 'hidden_billing_type',
                    hidden: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.billing_type || "";
                    }
                },
                {
                    name: 'claim_resubmission_flag',
                    hidden: true
                },
                {
                    name: 'hidden_payer_name',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return rowObject.payer_name || "";
                    }
                }
            ]);

            if (app.showserial) {
                colName.push('#');
                i18nName.push('');
                colModel.push({
                    name: 'record_no',
                    width: 25,
                    sortable: false,
                    search: false,
                    resizable: false
                });
            }

            var gridIDPrefix = '#jqgh_' + gridID.slice(1);

            var subGridNeed = ((app.showpriors && true) || true);
            var gridSettings = options.isClaimGrid ? app.claim_user_settings : app.study_user_settings;
            var studyFieldsCollection = new StudyFields(null, { gridOptions: gridSettings.grid_field_settings || [], field_order: userSettings.field_order, filterType: userSettings.grid_name });
            var studyFields = studyFieldsCollection.reduce(function (fieldSet, field) {
                fieldSet.colName[fieldSet.colName.length] = field.get('field_name');
                fieldSet.i18nName[fieldSet.i18nName.length] = field.get('i18n_name') || '';
                fieldSet.colModel[fieldSet.colModel.length] = field.get('field_info');
                return fieldSet;
            }, {
                    'colName': [],
                    'i18nName': [],
                    'colModel': []
                });
            var defSortOrder = userSettings.default_column_order_by || "asc";
            var defColumn = studyFieldsCollection.findWhere({
                'field_name': userSettings.default_column !== 'ID' ?
                    userSettings.default_column :
                    'Study Received Date'
            });

            var defSortColumn = userSettings.default_column;

            app.usersettings.wl_sort_field = defSortColumn;

            var afterInsertRow = function (rowid, rowdata) {
                var $row = $tblGrid.find('#' + rowid);
                var setCell = changeGrid.setCell($row);
                var cells = [];

                cells = cells.concat(changeGrid.getPrior(rowdata));
                cells = cells.concat(changeGrid.getRefPhy(rowdata));
                cells = cells.concat(changeGrid.getReferringProviders(rowid, rowdata));
                cells = cells.concat(changeGrid.getOrderingFacility(rowid, rowdata));
                cells = cells.concat(changeGrid.getReadPhy(rowid, rowdata));
                cells = cells.concat(changeGrid.getAge(rowdata.patient_age));
                setCell(cells);
                if (typeof options.afterInsertRow === 'function') {
                    options.afterInsertRow(rowid, rowdata);
                }
            };

            var afterGridBind = function (model, gridObj) {
                if (typeof options.updateStudiesPager === 'function') {
                    options.updateStudiesPager(model, gridObj);
                }
                selectedStudyArray = [];
                $('#btnStudiesRefresh, #btnStudiesRefreshAll, #btnClaimsRefresh, #btnClaimRefreshAll').prop('disabled', false);
                var userEle = $('#gbox_tblClaimGridFollow_up_queue #gs_assigned_to');

                if (options.filterid === "Follow_up_queue" && !userEle.val()) {
                    userEle.val(app.userID);
                }
            };

            var rowattr = function (domData, data) {
                var attrs = {
                    'class': '',
                    'style': ''
                };

                if (isTrue(data.has_deleted) || isFalse(data.is_active)) {
                    attrs['class'] += 'inActiveRow';
                }

                if (isNotTrue(data.has_deleted) && data.current_status_waiting_time > 0 && data.max_waiting_time > 0 && (data.max_waiting_time > data.current_status_waiting_time)) {
                    attrs['class'] += 'warnExceedTime';
                    attrs['data_interval'] = 1;
                }

                var stat = data.stat_level;
                if (stat) {
                    var css = changeGrid.getStatLevelAttr(stat);
                    attrs.style += 'background-color:' + css.bgColor + ';color:' + css.textColor + ';';
                }

                return attrs;
            };

            $('#mySettings').unbind().click(function (e) {

                commonjs.showDialog(
                    {
                        "width": "50%",
                        "height": "70%",
                        "header": "User Settings",
                        "i18nHeader": "setup.userSettings.headings.userSettings",
                        "needShrink": true,
                        "html": "<div/>"
                    });

                self.UserSettingsView = new UserSettingsView({ el: $('#modal_div_container') });
                self.UserSettingsView.render();
            });

            $('#btnStudyFilter').unbind().click(function (e) {

                var header = window.location && window.location.hash.split('/')[1] == 'claim_workbench' ?
                    'shared.screens.setup.claimFilter' : 'shared.screens.setup.studyFilter';

                commonjs.showDialog(
                    {
                        "width": "75%",
                        "height": "75%",
                        "header": window.location && window.location.hash.split('/')[1] == 'claim_workbench' ? "Claim Filter" : "Study Filter",
                        "i18nHeader": header,
                        "needShrink": true,
                        "html": "<div/>"
                    });

                    self.StudyFilterView = new StudyFilterView({el: $('#modal_div_container')});
                    self.StudyFilterView.showGrid();
                    $('#tblStudyFilterGrid').append(self.template);
            });

            if (doExport) {
                var colHeader = studyFields.colName;
                var current_filter_id = $('#claimsTabs').find('.active a').attr('data-container')
                var filterContent = commonjs.loadedStudyFilters.get(filterID);
                var isDatePickerClear = filterContent.options && filterContent.options.customargs && filterContent.options.customargs.isDatePickerClear;

                if (options.filterid != 'Follow_up_queue') {
                    commonjs.showLoading();

                    $.ajax({
                        'url': '/exa_modules/billing/claim_workbench',
                        type: 'GET',
                        data: {
                            filterData: filterData,
                            filterCol: filterCol,
                            isDatePickerClear: isDatePickerClear,
                            user_id: app.userID,
                            customArgs: {
                                filter_id: current_filter_id,
                                flag: 'exportExcel'

                            }
                        },
                        success: function (data, response) {
                            var facilityTz = app.facilities.map(function (val) { return { 'id': val.id, 'value': val.time_zone } });
                            commonjs.prepareCsvWorker({
                                data: data,
                                reportName: 'CLAIMS',
                                fileName: 'Claims',
                                filter_order: userSettings.field_order,
                                filterType: userSettings.grid_name,
                                columnHeader: colHeader,
                                countryCode: app.country_alpha_3_code,
                                facilities: facilityTz,
                                companyTz: app.company.time_zone
                            }, {
                                    afterDownload: function () {
                                        $('#btnValidateExport').css('display', 'inline');
                                    }
                                });
                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                            $('#btnValidateExport').css('display', 'inline');
                        }
                    });
                    return true;
                }

                $('#btnValidateExport').css('display', 'inline');
                options.filterid = '';

            }

            claimsTable.render({
                gridelementid: gridID,
                custompager: new Pager(),
                colNames: colName.concat(studyFields.colName),
                i18nNames: i18nName.concat(studyFields.i18nName),
                colModel: colModel.concat(studyFields.colModel),
                emptyMessage: commonjs.geti18NString('messages.status.noStudyFound'),
                sortname: defSortColumn,
                sortorder: defSortOrder,
                caption: "Studies",
                idprefix: isTrue(options.showEncOnly) ? "" : "st",
                disableautowidthresize: false,
                disableautoheightresize: false,
                container: options.container,
                multiselect: true,
                ondblClickRow: function (rowID, irow, icol, event) {
                    var gridData = getData(rowID, studyStore, gridID);
                    if (screenCode.indexOf('ECLM') > -1 ||
                        (!options.isClaimGrid && app.isMobileBillingEnabled && gridData.billing_type === 'census'
                            && gridData.billed_status === 'unbilled')) {
                        return false;
                    }
                    var study_id = 0;
                    var order_id = 0;
                    var orderIds = [];
                    var gridRowData = $(gridID).jqGrid('getRowData', rowID);
                    orderIds.push(gridData.order_id);

                    if ($('#chk' + gridID.slice(1) + '_' + rowID).length > 0) {
                        $('#chk' + gridID.slice(1) + '_' + rowID).prop('checked', true);
                    }
                    if (options.isClaimGrid || (gridRowData.hidden_claim_id && gridRowData.hidden_claim_id != '')) {
                        return initializeEditForm({
                            studyIds: gridRowData.hidden_claim_id,
                            study_id: gridData.study_id,
                            patient_name: gridData.patient_name,
                            patient_id: gridData.patient_id,
                            order_id: order_id,
                            grid_id: gridID
                        });
                    }
                        if (['ABRT', 'CAN', 'NOS'].indexOf(gridData.study_status) < 0 && !gridData.has_deleted) {
                            var study = {
                                study_id: rowID,
                                patient_id: gridData.patient_id,
                                facility_id: gridData.facility_id,
                                study_date: gridData.study_dt,
                                patient_name: gridData.patient_name,
                                account_no: gridData.account_no,
                                patient_dob: gridData.birth_date,
                                accession_no: gridData.accession_no,
                            };

                            window.localStorage.setItem('selected_studies', null);
                            window.localStorage.setItem('primary_study_details', JSON.stringify(study));
                            window.localStorage.setItem('selected_studies', JSON.stringify(rowID));
                            window.localStorage.setItem('selected_orders', JSON.stringify(orderIds));
                            self.claimView = new claimsView();
                            self.claimView.showClaimForm({ 'grid_id': gridID }, 'studies');
                        }


                    $('.claim-summary').remove();
                },
                disablesearch: false,
                disablesort: false,
                disablepaging: true,
                disableadd: true,
                showcaption: false,
                offsetHeight: '0',
                customizeSort: true,
                sortable: {
                    exclude: [
                        ',',
                        gridIDPrefix,
                        '_as_chk,',
                        gridIDPrefix,
                        '_as_edit,',
                        gridIDPrefix,
                        '_as_claim_inquiry,',
                        gridIDPrefix,
                        '_as_claim_summary'
                    ].join(''),
                    update: function (permutation, gridObj) {
                        var colModel = gridObj && gridObj.p ?
                            gridObj.p.colModel :
                            $tblGrid.jqGrid('getGridParam', 'colModel');
                        studyFieldsCollection.sort(colModel.filter(function (col) {
                            return col.hasOwnProperty('custom_name');
                        }));
                        updateReorderColumn(studyFieldsCollection.toJSON(), options.isClaimGrid);
                    }
                },

                isSearch: true,
                shrinkToFit: false,
                autowidth: false,
                isPrior: options.isPrior,
                isDicomSearch: options.isDicomSearch,
                showEncOnly: options.showEncOnly,
                providercontact_ids: app.providercontact_ids,
                searchByAssociatedPatients: userSettings.searchByAssociatedPatients,
                isRisOrderSearch: options.isRisOrderSearch,
                isClaimGrid: options.isClaimGrid,

                onRightClickRow: function (rowID, iRow, iCell, event, options) {
                    var gridData = $('#' + event.currentTarget.id).jqGrid('getRowData', rowID);
                    if (['Aborted', 'Cancelled', 'Canceled', 'No Shows'].indexOf(gridData.study_status) > -1 || gridData.has_deleted == "Yes" ||
                        (!options.isClaimGrid && app.isMobileBillingEnabled && gridData.billing_type === 'census'
                            && gridData.billed_status === 'unbilled')) {
                        event.stopPropagation();
                    } else if (disableRightClick()) {
                        var _selectEle = $(event.currentTarget).find('#' + rowID).find('input:checkbox');
                        _selectEle.prop('checked', true);

                        if (!options.isClaimGrid && !gridData.hidden_claim_id) {
                            if (validateClaimSelection(rowID, true, _selectEle, studyStore))
                                openCreateClaim(rowID, event, options.isClaimGrid, studyStore);
                        } else {
                            openCreateClaim(rowID, event, options.isClaimGrid, studyStore);
                        }

                    }
                    else {
                        event.stopPropagation();
                    }
                    // remove popup claimSummary in right click
                    $('.claim-summary').remove();
                },
                beforeSelectRow: function (rowID, e, options) {
                    var _selectEle = $(e.currentTarget).find('#' + rowID).find('input:checkbox');
                    var enableField = _selectEle.is(':checked')

                    if (!options.isClaimGrid) {
                        enableField = _selectEle.is(':checked');
                    }

                    var i = (e.target || e.srcElement).parentNode.cellIndex;

                    if (i > 0 && options.colModel[i] && options.colModel[i].customAction) {
                        options.colModel[i].customAction(rowID, e, self);
                    }
                },
                beforeSearch: function () {
                    commonjs.scrollLeft = $('.ui-jqgrid-bdiv').scrollLeft();
                },

                resizeStop: function (newWidth, index, gridObj) {
                    var colModel = gridObj && gridObj.p ?
                        gridObj.p.colModel :
                        $tblGrid.jqGrid('getGridParam', 'colModel');
                    var col = colModel[index];
                    if (!col) {
                        commonjs.showWarning('messages.warning.claims.couldNotSaveNewColumnSize');
                        return false;
                    }
                    studyFieldsCollection.add({
                        'id': col.custom_id,
                        'field_name': col.custom_name,
                        'field_info': {
                            'width': col.width
                        }
                    }, { 'merge': true });
                    updateResizeColumn(studyFieldsCollection.toJSON(), options.isClaimGrid);
                },
                afterInsertRow: afterInsertRow,
                onbeforegridbind: updateCollection,
                onaftergridbind: afterGridBind,
                defaultwherefilter: '',
                customargs: {
                    flag: 'home_study',
                    isPrior: options.isPrior,
                    filter_id: filterID,
                    study_id: options.study_id,
                    isExceedsMaxTime: filterID,
                    showdeletedstudies: true,
                    isDicomSearch: options.isDicomSearch,
                    showEncOnly: options.showEncOnly,
                    isRisOrderSearch: options.isRisOrderSearch,
                    providercontact_ids: [],
                    searchByAssociatedPatients: userSettings.searchByAssociatedPatients,
                    patient_id: 0,
                    study_dt: (commonjs.prior_study_dt) ?
                        commonjs.prior_study_dt :
                        null,
                    order_id: (commonjs.prior_order_id > 0) ?
                        commonjs.prior_order_id :
                        0
                },
                rowattr: rowattr
            });

            commonjs.processPostRender();
        };

        self.setDropDownSubMenuPosition = function (e, divObj) {
            var mouseX = e.clientX;
            var mouseY = e.clientY;
            var windowWidth = $window.width();
            var windowHeight = $window.height();
            var $divObj = $(document.getElementById(divObj));
            var menuWidth = $divObj.outerWidth();
            var menuHeight = $divObj.outerHeight();
            var list = $(e.target.parentElement).find('ul')[0];
            var subMenuWidth = $(list).width();
            if (mouseX + menuWidth + subMenuWidth > windowWidth) {
                $(list).css('left', '-100%');
                list.style.float = 'left';
            }

        };

        self.checkRights = function(menuId) {
            if (rightclickMenuRights.indexOf(menuId) !== -1 ) {
                $('#'+ menuId).addClass('disabled') ;
                $('#'+ menuId).append('<span class="access">(Access Denied)</span>');
            }
        },

        self.checkSubMenuRights = function(menuId) {
            if(rightclickMenuRights.indexOf(menuId) !== -1 ){
                $('#'+ menuId).removeClass('dropdown-submenu')
                $('#'+ menuId).css({'opacity':'0.7'});
            }
        },

        self.resetInvoiceNumber = function(invoiceNo) {
            if (confirm(i18n.get('messages.confirm.billing.resetInvoice')))
            {
                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/invoice_no',
                    type: 'PUT',
                    data: {
                        invoiceNo: invoiceNo
                    },
                    success: function () {
                        commonjs.showStatus('messages.status.invoiceNoReset');
                        $("#btnClaimsRefresh").click();
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            }
        },
        self.billingLinkEvent = function ($billingLink, dataobject, billing, $target) {
            $billingLink.off().click(function () {
                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/claims/update',
                    type: 'PUT',
                    data: dataobject,
                    success: function (data) {
                        if (data && data.length && !data[0].status) {
                            commonjs.showStatus(billing.status_message);
                            _.each(data, function (obj) {
                                $target.jqGrid('setCell', obj.id, billing.column, billing.description, { background: billing.color_code || 'transparent'});
                            });
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            })
        },

        //To bind province based right click menus in claim grid
        self.bindProvinceBasedMenus = function ($divObj, studyArray, gridData, isClaimGrid, selectedStudies) {
            var isWCBBilling = gridData.hidden_insurance_provider_codes
                && gridData.hidden_insurance_provider_codes.toLowerCase() === 'wcb';

            if(app.billingRegionCode === 'can_AB') {
                var liClaimReassess = commonjs.getRightClickMenu('anc_claim_reassess', 'setup.rightClickMenu.claimReassess', false, 'Claim Reassess', false);

                if (gridData.hidden_billing_method === 'electronic_billing' && ['R', 'D', 'BR', 'AD'].indexOf(gridData.hidden_claim_status_code) === -1 && !isWCBBilling) {
                    $divObj.append(liClaimReassess);
                }

                self.checkRights('anc_claim_reassess');
                var elReassess = $('#anc_claim_reassess');
                elReassess.off().click(function () {
                    if (elReassess.hasClass('disabled')) {
                        return false;
                    }

                    if (!commonjs.isValidClaimStatusToSubmit('reassessment', gridData.hidden_claim_status_code)) {
                        return commonjs.showWarning('billing.claims.canAhs.couldNotReassessClaim');
                    }

                    self.claimReassessView = new claimReassessView({el: $('#modal_div_container')});
                    self.claimReassessView.render({claimId: studyArray, claim_status: gridData.hidden_claim_status_code});

                });

                if (gridData.hidden_billing_method === 'electronic_billing') {
                    var insurance_code;
                    var insurance_codes = [];

                    for (var i=0; i < selectedStudies.length; i++) {
                        insurance_code = selectedStudies[i].insurance_code && selectedStudies[i].insurance_code.toLocaleLowerCase() || '';

                        if (insurance_code && insurance_codes.indexOf(insurance_code) == -1) {
                            insurance_codes.push(insurance_code);
                        }
                    }
                    $('#li_ul_change_claim_status').hide();

                    var resubmissionFlag = selectedStudies.length === selectedStudies.filter(function (e) {
                        return isClaimGrid && e.claim_resubmission_flag;
                    }).length;

                    var invalidClaimStatusArray = ['DEL', 'ISS', 'PAE', 'PGA', 'PGD', 'REJ', 'REQ'];

                    if (
                        (
                            insurance_codes.length && insurance_codes.indexOf("ahs") > -1 &&
                            invalidClaimStatusArray.indexOf(gridData.hidden_claim_status_code) === -1
                        )
                        || (insurance_codes.length && insurance_codes.indexOf("wcb") > -1)
                        || resubmissionFlag
                    ) {
                        $('#li_ul_change_claim_status').show();
                    }
                }

            } else if (app.billingRegionCode === 'can_MB') {
                var queryClaimStatus = app.claim_status.find(function (e) {
                    return e.code === 'QR';
                });
                var isValidQueryClaim = selectedStudies.length === selectedStudies.filter(function (e) {
                    return ['MPP', 'OP', 'R'].includes(e.claim_status_code);
                }).length;

                var liClaimQuery = commonjs.getRightClickMenu('anc_query_claim', 'setup.rightClickMenu.queryClaim', false, 'Query Claim', false);

                if (isValidQueryClaim && rightclickMenuRights.indexOf('anc_query_claim') === -1) {
                    $divObj.append(liClaimQuery);
                } else {
                    $('#ancclaimStatus_' + queryClaimStatus.id).parent().hide();
                }

                self.checkRights('anc_claim_query');
                var elQueryClaim = $('#anc_query_claim');

                elQueryClaim.off().click(function () {
                    if (elQueryClaim.hasClass('disabled')) {
                        return false;
                    }

                    var dataObj = {
                        claimIds: studyArray,
                        claim_status_id: queryClaimStatus.id,
                        process: "Query Claim"
                    };

                    if (confirm(i18n.get('billing.claims.canMhs.queryClaimWarning'))) {
                        $.ajax({
                            url: '/exa_modules/billing/claim_workbench/claims/update',
                            type: 'PUT',
                            data: dataObj,
                            success: function (data) {
                                if (data && data.length) {
                                    commonjs.showStatus('messages.status.claimStatusChanged');
                                    var colorCodeDetails = commonjs.getClaimColorCodeForStatus(queryClaimStatus.code, 'claim');
                                    var colorCode = colorCodeDetails && colorCodeDetails.length && colorCodeDetails[0].color_code || 'transparent';
                                    var tblId = gridID.replace(/#/, '');
                                    var cells = [{
                                        'field': 'claim_status',
                                        'data': queryClaimStatus.description,
                                        'css': {
                                            "backgroundColor": colorCode
                                        }
                                    }];

                                    data.forEach(function (obj) {
                                        var $claimGrid = $(gridID + ' tr#' + obj.id);
                                        var $td = $claimGrid.children('td');
                                        commonjs.setGridCellValue(cells, $td, tblId);
                                    });
                                    $("#btnClaimsRefresh").click();
                                }
                            },
                            error: function (err, response) {
                                commonjs.handleXhrError(err, response);
                            }
                        });
                    }
                });
            }
        },

        //To handle claim delete response for alberta
        self.ahsDeleteResponse = function(data) {
            data.err = data && (data.err || data.message || data[0]);

            if (data && data.validationMessages && data.validationMessages.length) {
                var responseTemplate = _.template(validationTemplate);
                // To show array of validation messages
                commonjs.showNestedDialog({
                    header: 'Claim Validation Result',
                    i18nHeader: 'billing.claims.claimValidationResponse',
                    height: '50%',
                    width: '60%',
                    html: responseTemplate({
                        'validationMessages': data.validationMessages
                    })
                });
            } else if (data.isClaimDeleted) {
                commonjs.showStatus(data.message);
                $("#btnClaimsRefresh").click();
            } else if (data.err) {
                commonjs.showWarning(data.err);
            } else {
                commonjs.showStatus('messages.status.claimSubmitted');
            }
        },

        // Delete claim function for handing delete response when country is usa
        self.claimDeleteResponse = function(data, studyIds) {
            var deleteResponse = data && data.rows && data.rows[0];

            if (deleteResponse) {
                var claim_adjustment = deleteResponse.claim_adjustment || 0;
                var claim_applied = deleteResponse.claim_applied || 0;
                var claim_refund = deleteResponse.claim_refund || 0;
            }

            if (parseInt(claim_applied) === 0 && parseInt(claim_adjustment) === 0 && parseInt(claim_refund) === 0) {
                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/claim_charge/delete',
                    type: 'PUT',
                    data: {
                        target_id: studyIds,
                        type: 'claim'
                    },
                    success: function () {
                        commonjs.showStatus('messages.status.claimHasBeenDeleted');
                        $("#btnClaimsRefresh").click();
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            }
            else {
                alert(commonjs.geti18NString('messages.warning.claims.claimHasPaymentPleaseUnapply'));
            }
        },

        // Bind url parameters to ajax calls based on province
        self.getProvinceBasedParams = function (billingRegion, from, studyIds, gridData, isWCBBilling) {

            var defaultParamsForDelete = {
                url: '/exa_modules/billing/claim_workbench/claim_check_payment_details',
                type: 'GET',
                data: {
                    target_id: studyIds,
                    type: 'claim'
                }
            };

            switch (billingRegion) {
                case 'can_AB':
                    if (from === 'delete' && gridData.hidden_billing_method === 'electronic_billing' && !isWCBBilling) {
                        return {
                            url: '/exa_modules/billing/ahs/can_ahs_delete_claim',
                            type: 'PUT',
                            data: {
                                targetId: studyIds,
                                type: 'claim',
                                claimStatusCode: gridData.hidden_claim_status_code,
                                source: 'delete'
                            }
                        };
                    }
                        return defaultParamsForDelete;

                default:
                    if (from == 'delete') {
                        return defaultParamsForDelete;
                    }
            }
        },

        // Province based validations are handled in this block and returns validation results.
        self.provinceBasedValidationResults = function (billingRegion, gridData, isWCBBilling) {
            var msg = '';
            var claimStatus = gridData && gridData.hidden_claim_status_code || null;

            if (billingRegion === 'can_AB' && !isWCBBilling) {
                if (gridData.hidden_billing_method === 'electronic_billing') {

                    if (claimStatus !== 'AD' && (claimStatus === 'ADP' || !commonjs.isValidClaimStatusToSubmit('delete', gridData.hidden_claim_status_code))) {
                        msg = 'billing.claims.canAhs.couldNotDeleteClaimAhsPending';
                    }
                }
            }
            return msg;
        }
    };
});
