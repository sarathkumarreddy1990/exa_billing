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
    'views/claims/followup'
], function (jQuery, _, initChangeGrid, utils, Pager, StudyFields, Studies, claimWorkbench, claimsView, UserSettingsView, StudyFilterView, studyFilterGrid, claimInquiryView, splitClaimView, followUpView) {
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
                    claimView.showEditClaimForm(studyInfo.studyIds, gridName, studyInfo);
                });
            }
        };

        var validateClaimSelection = function (row_id, enabled, _element, store) {

            var isPatientMatch, isStudyDateMatch, isStudyIdMatch;
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
                    study_date: commonjs.convertToFacilityTimeZone(_storeEle.facility_id, _storeEle.study_dt).format('MM/DD/YYYY')
                };
                selectedStudyArray.push(study);
            }

            if (enabled) {
                if (selectedStudyArray.length) {

                    var patientGroup = _.groupBy(selectedStudyArray, 'patient_id');
                    isPatientMatch = Object.keys(patientGroup).length;
                    var facilityGroup = _.groupBy(selectedStudyArray, 'facility_id');
                    isFacilityMatch = Object.keys(facilityGroup).length;
                    var studyDtGroup = _.groupBy(selectedStudyArray, 'study_date');
                    isStudyDateMatch = Object.keys(studyDtGroup).length;
                    var $divObj = $("#studyRightMenu");

                    if (isPatientMatch > 1) {
                        commonjs.showWarning('messages.warning.claims.samePatientValidate');
                        $divObj.empty();
                        $divObj.css('display','none')
                        return false;
                    }
                    if (isStudyDateMatch > 1) {
                        commonjs.showWarning('messages.warning.claims.sameStudyDtValidate');
                        $divObj.empty();
                        $divObj.css('display','none')
                        return false;
                    }
                    if (isFacilityMatch > 1) {
                        commonjs.showWarning('messages.warning.claims.sameFacilityValidate');
                        $divObj.empty();
                        $divObj.css('display','none')
                        return false;
                    }

                    return true;
                } selectedStudyArray.push(study);
            }
        };

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
            var isbilled_status = false;
            var isUnbilled_status = false;

            for (var r = 0; r < selectedCount; r++) {
                var rowId = $checkedInputs[r].parentNode.parentNode.id;
                _storeEle = getData(rowId, store, gridID);
                var gridData = $(gridID).jqGrid('getRowData', rowId);
                studyArray.push(rowId);
                orderIds.push(_storeEle.order_id);
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
                    billing_method: _storeEle.billing_method
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
            if (isClaimGrid) {
                var liClaimStatus = commonjs.getRightClickMenu('ul_change_claim_status','setup.rightClickMenu.billingStatus',false,'Change Claim Status',true);
                $divObj.append(liClaimStatus);
                self.checkSubMenuRights('li_ul_change_claim_status');
                var liArray = [];
                commonjs.getClaimStudy(selectedStudies[0].study_id, function (result) {
                    if (result) {
                        study_id = result.study_id;
                        order_id = result.order_id;
                        if(rightclickMenuRights.indexOf('anc_view_documents') == -1){
                            $('#anc_view_documents').removeClass('disabled')
                            $('#anc_view_reports').removeClass('disabled')
                        }
                    }
                });

                // Claim status updation
                $.each(app.claim_status, function (index, claimStatus) {
                    var $claimStatusLink = $(commonjs.getRightClickMenu('ancclaimStatus_' + claimStatus.id,'setup.rightClickMenu.billingCode',true,claimStatus.description ,false));
                        $claimStatusLink.click(function () {

                            $.ajax({
                                url: '/exa_modules/billing/claim_workbench/claims/update',
                                type: 'PUT',
                                data: {
                                    claimIds: studyArray,
                                    claim_status_id:claimStatus.id,
                                    process:"Claim Status"
                                },
                                success: function (data, response) {

                                    if (data && data.length) {
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

                // Billing Code status updation
                var liBillingCode = commonjs.getRightClickMenu('ul_change_billing_code','setup.rightClickMenu.billingCode',false,'Change Billing Code',true);
                $divObj.append(liBillingCode);
                self.checkSubMenuRights('li_ul_change_billing_code');
                var liArrayBillingCode = [];

                $.each(app.billing_codes, function (index, billing_code) {
                        var $billingCodeLink = $(commonjs.getRightClickMenu('ancBillingCode_' + billing_code.id,'setup.rightClickMenu.billingCode',true,billing_code.description ,false));

                        $billingCodeLink.click(function () {
                            $.ajax({
                                url: '/exa_modules/billing/claim_workbench/claims/update',
                                type: 'PUT',
                                data: {
                                    claimIds:  studyArray,
                                    billing_code_id:billing_code.id,
                                    process:"Billing Code"
                                },
                                success: function (data, response) {

                                    if (data && data.length) {
                                        commonjs.showStatus('messages.status.billingCodeChanged');
                                        _.each(data, function (obj) {
                                            $target.jqGrid('setCell', obj.id, 'billing_code', billing_code.description);
                                        });
                                    }

                                },
                                error: function (err, response) {
                                    commonjs.handleXhrError(err, response);
                                }
                            });
                        });
                        liArrayBillingCode[liArrayBillingCode.length] = $billingCodeLink;
                });
                $('#ul_change_billing_code').append(liArrayBillingCode);

                // Billing class updation
                var liBillingClass = commonjs.getRightClickMenu('ul_change_billing_class','setup.rightClickMenu.billingClass',false,'Change Billing Class',true);
                $divObj.append(liBillingClass);
                self.checkSubMenuRights('li_ul_change_billing_class');
                var liArrayBillingClass = [];
                $.each(app.billing_classes, function (index, billing_class) {
                    var $BillingClassLink = $(commonjs.getRightClickMenu('ancBillingClass_' + billing_class.id,'setup.rightClickMenu.billingClass',true,billing_class.description ,false));

                        $BillingClassLink.click(function () {
                                $.ajax({
                                    url: '/exa_modules/billing/claim_workbench/claims/update',
                                    type: 'PUT',
                                    data: {
                                        claimIds:studyArray,
                                        billing_class_id:billing_class.id,
                                        process:"Billing Class"
                                    },
                                    success: function (data, response) {
                                        if (data && data.length) {
                                            commonjs.showStatus('messages.status.billingClassChanged');
                                            _.each(data, function (obj) {
                                                $target.jqGrid('setCell', obj.id, 'billing_class', billing_class.description);
                                            });
                                        }
                                    },
                                    error: function (err, response) {
                                        commonjs.handleXhrError(err, response);
                                    }
                                });
                            });

                        liArrayBillingClass[liArrayBillingClass.length] = $BillingClassLink;
                });
                $('#ul_change_billing_class').append(liArrayBillingClass);

                if (studyArray.length == 1) {
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
                                    liPayerTypeArray.push($(commonjs.getRightClickMenu('ancPrimaryIns_' + billingPayers.primary_patient_insurance_id, '', true, billingPayers.p_insurance_name + '( Primary Insurance )', false)));
                                }
                                if (billingPayers.secondary_patient_insurance_id) {
                                    liPayerTypeArray.push($(commonjs.getRightClickMenu('ancSecondaryIns_' + billingPayers.secondary_patient_insurance_id, '', true, billingPayers.s_insurance_name + '( Secondary Insurance )', false)));
                                }
                                if (billingPayers.tertiary_patient_insurance_id) {
                                    liPayerTypeArray.push($(commonjs.getRightClickMenu('ancTertiaryIns_' + billingPayers.tertiary_patient_insurance_id, '', true, billingPayers.t_insurance_name + '( Tertiary Insurance )', false)));
                                }
                                if (billingPayers.ordering_facility_id) {
                                    liPayerTypeArray.push($(commonjs.getRightClickMenu('ancOrderingFacility_' + billingPayers.ordering_facility_id, '', true, billingPayers.ordering_facility_name + '( Service Facility )', false)));
                                }
                                if (billingPayers.referring_provider_contact_id) {
                                    liPayerTypeArray.push($(commonjs.getRightClickMenu('ancRenderingProvider_' + billingPayers.referring_provider_contact_id, '', true, billingPayers.ref_prov_full_name + '( Referring Provider )', false)));
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
                                    }
                                    $.ajax({
                                        url: '/exa_modules/billing/claim_workbench/billing_payers',
                                        type: 'PUT',
                                        data:{
                                            id:rowID,
                                            payer_type:payer_type
                                        },
                                        success: function (data, response) {
                                            if(data) {
                                                commonjs.showStatus('messages.status.claimPayerCompleted');
                                                $target.jqGrid('setCell',rowID,'payer_type', payer_type);
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

                var liEditClaim = commonjs.getRightClickMenu('anc_edit_claim','setup.rightClickMenu.editClaim',false,'Edit Claim',false);
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
                        patient_name: selectedStudies[0].patient_name,
                        patient_id: selectedStudies[0].patient_id,
                        order_id: order_id,
                        grid_id: gridID
                    });
                });

                var liDeleteClaim = commonjs.getRightClickMenu('anc_delete_claim','setup.rightClickMenu.deleteClaim',false,'Delete Claim',false);

                if(studyArray.length == 1)
                    $divObj.append(liDeleteClaim);

                self.checkRights('anc_delete_claim');

                $('#anc_delete_claim').off().click(function () {
                    if ($('#anc_delete_claim').hasClass('disabled')) {
                        return false;
                    }

                if (confirm(commonjs.geti18NString("messages.status.areYouSureWantToDeleteClaims"))) {

                    $.ajax({
                        url: '/exa_modules/billing/claim_workbench/claim_check_payment_details',
                        type: 'GET',
                        data: {
                            target_id: studyIds,
                            type: 'claim'
                        },
                        success: function (data, response) {
                            var claim_adjustment = data.rows[0].claim_adjustment;
                            var claim_applied = data.rows[0].claim_applied;
                            var claim_refund = data.rows[0].claim_refund;

                            if(parseInt(claim_applied) === 0 && parseInt(claim_adjustment) === 0 && parseInt(claim_refund) === 0){
                                $.ajax({
                                    url: '/exa_modules/billing/claim_workbench/claim_charge/delete',
                                    type: 'PUT',
                                    data: {
                                        target_id: studyIds,
                                        type: 'claim'
                                    },
                                    success: function (data, response) {
                                        commonjs.showStatus('messages.status.claimHasBeenDeleted');
                                        $("#btnClaimsRefresh").click();
                                    },
                                    error: function (err, response) {
                                        commonjs.handleXhrError(err, response);
                                    }
                                });
                                }
                                else{
                                    alert('Claim has payment, Please unapply before delete');
                                }

                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });

                 }
                });

                var liClaimInquiry = commonjs.getRightClickMenu('anc_claim_inquiry','setup.rightClickMenu.claimInquiry',false,'Claim Inquiry',false);
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
                        'patient_id': selectedStudies[0].patient_id,
                        'grid_id': gridID,
                        'source': 'claims'
                    });

                });

                var liPatientClaimInquiry = commonjs.getRightClickMenu('anc_patient_claim_inquiry','setup.rightClickMenu.patientClaims',false,'Patient Claims',false);
                if(studyArray.length == 1)
                    $divObj.append(liPatientClaimInquiry);
                self.checkRights('anc_patient_claim_inquiry');
                $('#anc_patient_claim_inquiry').click(function () {
                    if ($('#anc_patient_claim_inquiry').hasClass('disabled')) {
                        return false;
                    }

                self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                self.claimInquiryView.patientInquiryForm(studyIds, selectedStudies[0].patient_id, selectedStudies[0].patient_name, gridID, true);
                });


                var liInvoiceInquiry = commonjs.getRightClickMenu('anc_invoice_inquiry','setup.rightClickMenu.directBillingInquiry',false,'Direct Billing Inquiry',false);
                if (studyArray.length == 1 && selectedStudies[0].billing_method == "direct_billing")
                    $divObj.append(liInvoiceInquiry);
                self.checkRights('anc_invoice_inquiry');
                $('#anc_invoice_inquiry').click(function () {
                    if ($('#anc_invoice_inquiry').hasClass('disabled')) {
                        return false;
                    }
                    commonjs.showDialog({
                        'header': 'Invoices',
                        'i18nHeader': 'shared.fields.invoices',
                        'width': '95%',
                        'height': '80%',
                        'needShrink': true
                    });
                self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                self.claimInquiryView.invoiceInquiry(studyIds,selectedStudies[0].patient_id,selectedStudies[0].payer_type); //selectedStudies[0].invoice_no
                });

                var liPatientClaimLog = commonjs.getRightClickMenu('anc_patient_claim_log','setup.rightClickMenu.patientClaimLog',false,'Patient Claim Log',false);
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
                self.claimInquiryView.patientInquiryLog(studyIds,selectedStudies[0].patient_id);
                });

                var liSplitOrders = commonjs.getRightClickMenu('anc_split_claim','setup.rightClickMenu.splitClaim',false,'Split Claim',false);
                if(studyArray.length == 1)
                    $divObj.append(liSplitOrders);
                self.checkRights('anc_split_claim');
                $('#anc_split_claim').click(function () {
                    if ($('#anc_split_claim').hasClass('disabled')) {
                        return false;
                    }
                    self.splitClaimView = new splitClaimView();
                    self.splitClaimView.validateSplitClaim(studyIds);
                });

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
                            url: '/vieworder#order/document/' + btoa(order_id) + '/' + btoa(selectedStudies[0].patient_id) + '/' + btoa(study_id) + '/encounter'
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
                        var queryStrVal = [
                            'study_id=' + study_id,
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
                    var liEditClaim = commonjs.getRightClickMenu('anc_reset_invoice_no','setup.rightClickMenu.resetInvoice',false,'Reset Invoice Number',false);
                    if(studyArray.length == 1 && selectedStudies[0].invoice_no != null && selectedStudies[0].invoice_no != '')
                        $divObj.append(liEditClaim);
                    self.checkRights('anc_reset_invoice_no');

                    $('#anc_reset_invoice_no').click(function () {
                        if ($('#anc_reset_invoice_no').hasClass('disabled')) {
                            return false;
                        }
                        self.resetInvoiceNumber(selectedStudies[0].invoice_no);
                    });
                }

            } else {
                if (!isbilled_status) {
                    var liCreateClaim = commonjs.getRightClickMenu('anc_create_claim','setup.rightClickMenu.createClaim',false,'Create Claim',false);
                    $divObj.append(liCreateClaim);
                    self.checkRights('anc_create_claim');
                    $('#anc_create_claim').off().click(function () {

                        if ($('#anc_create_claim').hasClass('disabled')) {
                            return false;
                        }
                            window.localStorage.setItem('selected_studies', null);
                            window.localStorage.setItem('primary_study_details', JSON.stringify(selectedStudies[0]));
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
                            studyIds: selectedStudies[0].claim_id,
                            study_id: selectedStudies[0].study_id,
                            patient_name: selectedStudies[0].patient_name,
                            patient_id: selectedStudies[0].patient_id,
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
            var $checkedInputs = $tblGrid.find('input').filter('[name=chkStudy]:checked');
            var selectedCount = $checkedInputs.length;
            var currentFilter = commonjs.studyFilters.find(function (filter) {
                return filter.filter_id == commonjs.currentStudyFilter;
            });
            var filterContent = commonjs.loadedStudyFilters.get(filterID);
            filterData = JSON.stringify(filterContent.pager.get('FilterData'));
            filterCol = JSON.stringify(filterContent.pager.get('FilterCol'));
            var isDatePickerClear = filterCol.indexOf('study_dt') === -1;

            batchClaimArray = [];
            for (var r = 0; r < selectedCount; r++) {
                var rowId = $checkedInputs[r].parentNode.parentNode.id;
                var gridData = $(gridID).jqGrid('getRowData', rowId);

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
                    study_id: gridData.hidden_study_id,
                    order_id: gridData.hidden_order_id
                });
            }

            if (batchClaimArray.length) {

                var selectedIds = JSON.stringify(batchClaimArray)
                commonjs.showLoading();
                var param ;
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
                        isAllStudies: true,
                        isDatePickerClear: isDatePickerClear,
                        customArgs: {
                            filter_id: filterID,
                            isClaimGrid: false
                        },
                        isBatchClaim: true
                    }
                } else {
                    param = {
                        studyDetails: selectedIds,
                        company_id: app.companyID,
                        isAllStudies: false
                    }
                }
                    $.ajax({
                        url: '/exa_modules/billing/claim_workbench/claims/batch',
                        type: 'POST',
                        data: param,
                        success: function (data, response) {
                            commonjs.showStatus('messages.status.batchClaimCompleted');
                            commonjs.hideLoading();

                            var claim_id = data && data.length && data[0].create_claim_charge || null;

                            // Change grid values after claim creation instead of refreshing studies grid
                            if (claim_id) {

                                var claimsTable = new customGrid(studyDataStore, gridID);
                                claimsTable.options = { gridelementid: gridID }
                                var changeGrid = initChangeGrid(claimsTable);
                                var cells = [];

                                cells = cells.concat(changeGrid.getClaimId(claim_id))
                                        .concat(changeGrid.getBillingStatus('Billed'))
                                        .concat(changeGrid.setEditIcon());

                                for (var r = 0; r < batchClaimArray.length; r++) {
                                    var rowId = batchClaimArray[r].study_id;
                                    var $row = $tblGrid.find('#' + rowId);
                                    var setCell = changeGrid.setCell($row);

                                    setCell(cells);
                                    // In user filter Billed Status selected as unbilled means, After claim creation hide from grid.
                                    var isBilledStatus = currentFilter.filter_info && currentFilter.filter_info.studyInformation && currentFilter.filter_info.studyInformation.billedstatus === 'unbilled' || false;

                                    if ($('#gs_billed_status').val() === 'unbilled' || isBilledStatus) {
                                        $row.remove();
                                    }

                                }
                            }
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                            commonjs.hideLoading();
                        }
                    });
            } else {
                commonjs.showWarning('messages.warning.claims.selectClaimToCreate');
            }
        },

        self.renderStudy = function (doExport, filterData, filterCol) {
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
                '','', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Assigned To', ''
            ]);

            i18nName = i18nName.concat([
                '','', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'billing.claims.assignedTo', ''
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
                        if(['ABRT','CAN','NOS'].indexOf(rowObject.study_status)>-1||rowObject.has_deleted)
                            return "";
                        else  return '<input type="checkbox" name="chkStudy" id="chk'+gridID.slice(1)+'_' + (options.isClaimGrid?rowObject.id:rowObject.study_id )+ '" />'

                    },
                    customAction: function (rowID, e, that) {
                    }
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
                            else  return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"

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
                                        .append($('<td/>').addClass('col-3').text(commonjs.geti18NString("order.summary.cptCodes")))
                                        .append($('<td/>').addClass('pl-0 pr-2').text(':'))
                                        .append($('<td/>').addClass('col-8 pl-0 text-truncate').text(cptCodes).attr({ title: cptCodes }))
                                    );
                                    _contentTable.append($('<tr/>')
                                        .addClass('row')
                                        .append($('<td/>').addClass('col-3').text(commonjs.geti18NString("billing.payments.cptDescription")))
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
                            var i18n;
                            var color;
                            cellvalue = cellvalue || "";

                            switch (cellvalue) {
                              case 'valid':             i18n = 'messages.status.healthNumberValid';         color = 'green';        break;
                              case 'invalid':           i18n = 'messages.status.healthNumberInvalid';       color = 'red';          break;
                              case 'data_unavailable':  i18n = 'messages.status.healthNumberNotValidated';  color = '#2f74e2';      break;
                              case 'null_response':     i18n = 'messages.status.noValidationData';          color = 'black';        break;
                              case 'recheck':           i18n = 'messages.status.healthNumberRevalidate';    color = 'orange';       break;
                              default:                  i18n = 'messages.status.healthNumberNotValidated';  color = 'red';          break;
                            }

                            return "<i href='#' i18nt='" + i18n + "' class='icon-ic-status' data-value='" + cellvalue + "' style='color: " + color + ";text-shadow:0 0 " + color + ", 0 0 " + color + ", 0 0 " + color + ", 0 0 red, 0 0 " + color + "'></i>";
                        }
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
                        return rowObject.claim_id || "";
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
            var studyFieldsCollection = new StudyFields(null, { gridOptions: null, field_order: userSettings.field_order, filterType: userSettings.grid_name });
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
                var searchFilterFlag = grid.getGridParam("postData")._search;
                var colHeader = studyFields.colName;
                var current_filter_id = $('#claimsTabs').find('.active a').attr('data-container')
                var isDatePickerClear = filterCol.indexOf('claim_dt') === -1;

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

                            commonjs.prepareCsvWorker({
                                data: data,
                                reportName: 'CLAIMS',
                                fileName: 'Claims',
                                filter_order: userSettings.field_order,
                                filterType: userSettings.grid_name,
                                columnHeader: colHeader
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
                else {
                    $('#btnValidateExport').css('display', 'inline');
                    options.filterid = '';
                }
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
                    if (screenCode.indexOf('ECLM') > -1)
                        return false;
                    var gridData = getData(rowID, studyStore, gridID);
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
                    } else {
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
                    if (['Aborted', 'Cancelled', 'Canceled', 'No Shows'].indexOf(gridData.study_status) > -1 || gridData.has_deleted == "Yes") {
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

                    if (i > 0) {
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
                        'field_info': {
                            'width': col.width
                        }
                    }, { 'merge': true });
                    updateResizeColumn(studyFieldsCollection.toJSON());
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
            var subMenuHeight = $(list).height();
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
                    success: function (data, response) {
                        commonjs.showStatus('messages.status.invoiceNoReset');
                        $("#btnClaimsRefresh").click();
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            }
        }
    };
});
