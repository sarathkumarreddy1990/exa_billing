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
    'shared/permissions'
], function (jQuery, _, initChangeGrid, utils, Pager, StudyFields, Studies, claimWorkbench, claimsView, UserSettingsView, StudyFilterView, studyFilterGrid, claimInquiryView, splitClaimView, followUpView, Permission) {
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
            var rights = (new Permission()).init();
            rightclickMenuRights = rights.screenID;
            screenCode = rights.screenCode;
        }


        var handleStudyDblClick = function (data, event, gridID) {
            event.stopPropagation();
            if (data === null) {
                return false;
            }
            if (isTrue(data.has_deleted)) {
                return commonjs.showWarning('Study is deleted - nowhere to go unless restored.', '', true);
            }
            var id = data.study_id;
            editStudyID = id;
            return chooseScreen(id, data, event, gridID);
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
                studyArray.push(rowId);
                var study = {
                    study_id: rowId,
                    patient_id: _storeEle.patient_id,
                    facility_id: _storeEle.facility_id,
                    study_date: _storeEle.study_dt,
                    patient_name: _storeEle.patient_name,
                    account_no: _storeEle.account_no,
                    patient_dob: _storeEle.birth_date,
                    accession_no: _storeEle.accession_no,
                    billed_status:_storeEle.billed_status,
                    claim_id:_storeEle.claim_id,
                    invoice_no:_storeEle.invoice_no,
                    payer_type:_storeEle.payer_type,
                    billing_method:_storeEle.billing_method
                };
                if (_storeEle.billed_status == 'billed') {
                    isbilled_status = true;
                }

                if (_storeEle.billed_status == 'unbilled') {
                    isUnbilled_status = true;
                }
                selectedStudies.push(study);
            }           

            if (isbilled_status && isUnbilled_status) {
                commonjs.showWarning("Please select same unbilled status or single billed status");
                $divObj.hide();
                return false;
            }

            if (isbilled_status && selectedStudies.length > 1) {
                commonjs.showWarning("Please select single billed status");
                $divObj.hide();
                return false;
            }

            if (isbilled_status && selectedStudies.length > 1) {
                commonjs.showWarning("Please select single billed status");
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
                                    commonjs.showStatus('Claim Status has been changed');                                    
                                    $("#btnClaimsRefresh").click();
                                },
                                error: function (err, response) {
                                    commonjs.handleXhrError(err, response);
                                }
                            });
                        });
                        liArray[liArray.length] = $claimStatusLink;
                });
                $('#ul_change_claim_status').append(liArray);

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
                                    commonjs.showStatus('Billing Code has been changed');                                    
                                    $("#btnClaimsRefresh").click();
                                },
                                error: function (err, response) {
                                    commonjs.handleXhrError(err, response);
                                }
                            });
                        });
                        liArrayBillingCode[liArrayBillingCode.length] = $billingCodeLink;
                });
                $('#ul_change_billing_code').append(liArrayBillingCode);


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
                                        commonjs.showStatus('Billing Classes has been changed');
                                        $("#btnClaimsRefresh").click();
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
                                    liPayerTypeArray.push($(commonjs.getRightClickMenu('ancRenderingProvider_' + billingPayers.referring_provider_contact_id, '', true, billingPayers.ref_prov_full_name + '( Rendering Proivider )', false)));
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
                                                commonjs.showStatus("Payer Changed Succesfully");
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
                    self.claimView = new claimsView();
                    self.claimView.showEditClaimForm(studyIds, 'claims', {
                        'study_id': study_id,
                        'patient_name': selectedStudies[0].patient_name,
                        'patient_id': selectedStudies[0].patient_id,
                        'order_id': 0
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

                if(confirm("Are you sure want to delete claims")){
                    if(confirm("Please confirm claim has been deleted and also dependent deleted ")){
                    $.ajax({
                        url: '/exa_modules/billing/claim_workbench/claim_charge/delete',
                        type: 'PUT',
                        data: {
                            target_id: studyIds,
                            type: 'claim'
                        },
                        success: function (data, response) {                            
                            commonjs.showStatus('Claim has been deleted');
                            $("#btnClaimsRefresh").click();
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                    }
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
                    self.claimInquiryView.render(studyIds,selectedStudies[0].patient_id, false);
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
                self.claimInquiryView.patientInquiryForm(studyIds, selectedStudies[0].patient_id, selectedStudies[0].patient_name);
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
    
                            self.claimView = new claimsView();
                            self.claimView.showClaimForm(studyIds, 'studies');
    
                        });
                    }                      
                
                if (isbilled_status) {
                    var liEditClaim = commonjs.getRightClickMenu('anc_edit_claim', 'setup.rightClickMenu.editClaim', false, 'Edit Claim', false);
                    $divObj.append(liEditClaim);
                    self.checkRights('anc_edit_claim');
                    $('#anc_edit_claim').off().click(function () {
                        self.claimView = new claimsView();
                        self.claimView.showEditClaimForm(selectedStudies[0].claim_id, 'studies', {
                            'study_id': selectedStudies[0].claim_id,
                            'patient_name': selectedStudies[0].patient_name,
                            'patient_id': selectedStudies[0].patient_id,
                            'order_id': 0
                        });
                    });
                }
               
            }

            $divObj.show();
            setRightMenuPosition(divObj, event);
            event.preventDefault();
        };

        self.batchClaim = function () {
            var $checkedInputs = $tblGrid.find('input').filter('[name=chkStudy]:checked');
            var selectedCount = $checkedInputs.length;
            batchClaimArray = [];
            for (var r = 0; r < selectedCount; r++) {
                var rowId = $checkedInputs[r].parentNode.parentNode.id;
                studyStoreValue = getData(rowId, studyDataStore, gridID);
                if (!studyStoreValue.study_cpt_id) {
                    commonjs.showWarning("Please select charges record for batch claim ");
                    return false;
                }
                if (studyStoreValue.billed_status == 'billed') {
                    commonjs.showWarning("Please select Unbilled record for batch claim");
                    return false;
                }
                batchClaimArray.push({
                    patient_id :studyStoreValue.patient_id,
                    study_id :studyStoreValue.study_id
                });
            }
            
            if (batchClaimArray.length) {

                var selectedIds = JSON.stringify(batchClaimArray)
                commonjs.showLoading();

                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/claims/batch',
                    type: 'POST',
                    data: {
                        study_ids: selectedIds,
                        company_id: app.companyID
                    },
                    success: function (data, response) {
                        commonjs.showStatus('Batch Claim created successfully');
                        $("#btnStudiesRefresh").click();
                        commonjs.hideLoading();
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                        commonjs.hideLoading();
                    }
                });
            }else{
                commonjs.showWarning("Please select record for batch claim");
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
                (options.isClaimGrid ? '<input type="checkbox" title="Select all studies" id="chkStudyHeader_' + filterID + '" class="chkheader" onclick="commonjs.checkMultiple(event)" />' : ''),
                '', '', '', '', '','','','','','','','','','','','','','','AssignedTo'

            ]);

            i18nName = i18nName.concat([
                '', '', '', '', '', '','','','','','','','','','','','','','','billing.claims.assignedTo'
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
                            else  return "<i class='icon-ic-edit' title='Edit'></i>"
                        
                    },
                    customAction: function (rowID, e, that) { 
                        if(screenCode.indexOf('ECLM') > -1)
                            return false;
                        var gridData = $('#'+e.currentTarget.id).jqGrid('getRowData', rowID);
                            self.claimView = new claimsView();
                            self.claimView.showEditClaimForm(gridData.claim_id, !options.isClaimGrid ? 'studies' : 'claims', {
                                'study_id': rowID,
                                'patient_name': gridData.patient_name,
                                'patient_id': gridData.patient_id,
                                'order_id': gridData.order_id
                            });

                            return false;
                        
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
                        return "<i class='icon-ic-raw-transctipt' title='Claim Inquiry'></i>"
                    },
                    customAction: function (rowID, e, that) {
                        commonjs.showDialog({
                            'header': 'Claim Inquiry',
                            'width': '95%',
                            'height': '85%',
                            'needShrink': true
                        });
                        self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                        self.claimInquiryView.render(rowID, '', false);                       
                    }
                },
                {
                    name: 'account_no',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'study_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'clearing_house',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },                
                {
                    name: 'edi_template',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                }, 
                {
                    name: 'claim_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'birth_date',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'patient_name',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'patient_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'billing_method',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'study_status',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'has_deleted',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'order_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'study_cpt_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'claim_status_code',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'invoice_no',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'facility_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
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
                    },
                    formatter: function (cellvalue, options, rowObject) {
                        var users = commonjs.getBillingUserName(rowObject.assigned_to);
                        if (users && users.length)
                            return users[0].username + ' ( ' + users[0].last_name + ', ' + users[0].first_name + ' ) ';
                        else ''
                    }
                },
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
                        "needShrink": true,
                        "html": "<div/>"
                    });

                self.UserSettingsView = new UserSettingsView({ el: $('#modal_div_container') });
                self.UserSettingsView.render();
            });

            $('#btnStudyFilter').unbind().click(function (e) {
                
                commonjs.showDialog(
                    {
                        "width": "75%",
                        "height": "75%",
                        "header": window.location && window.location.hash.split('/')[1] == 'claim_workbench' ? "Claim Filter" : "Study Filter",
                        "needShrink": true,
                        "html": "<div/>"
                    });

                    self.StudyFilterView = new StudyFilterView({el: $('#modal_div_container')});
                    self.StudyFilterView.showGrid();
                    $('#tblStudyFilterGrid').append(self.template);
            });

            if (doExport) {
                console.log('v', filterData, filterCol)
                var searchFilterFlag = grid.getGridParam("postData")._search;
                var colHeader = studyFields.colName;

                commonjs.showLoading();

                $.ajax({
                    'url': '/exa_modules/billing/claim_workbench',
                    type: 'GET',
                    data: {
                        filterData: filterData,
                        filterCol: filterCol ,
                        customArgs: {
                            filter_id: filterID,
                            flag: 'exportExcel'
                        }
                    },
                    success: function (data, response) {
                        commonjs.prepareCsvWorker({
                            data: data,
                            reportName: 'CLAIMS',
                            fileName: 'Claims'
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

            claimsTable.render({
                gridelementid: gridID,
                custompager: new Pager(),
                colNames: colName.concat(studyFields.colName),
                i18nNames: i18nName.concat(studyFields.i18nName),
                colModel: colModel.concat(studyFields.colModel),
                emptyMessage: 'No Study found',
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

                    if ($('#chk' + gridID.slice(1) + '_' + rowID).length > 0) {
                        $('#chk' + gridID.slice(1) + '_' + rowID).attr('checked', true);
                    }
                    if (options.isClaimGrid || (gridData.claim_id && gridData.claim_id != '')) {
                        self.claimView = new claimsView();
                        commonjs.getClaimStudy(rowID, function (result) {
                            if (result) {
                                study_id = result.study_id;
                                order_id = result.order_id;
                            }
                            self.claimView.showEditClaimForm(gridData.claim_id, !options.isClaimGrid ? 'studies' : 'claims', {
                                'study_id': study_id,
                                'patient_name': gridData.patient_name,
                                'patient_id': gridData.patient_id,
                                'order_id': order_id
                            });
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
                            self.claimView = new claimsView();
                            self.claimView.showClaimForm(null, 'studies');
                        }
                    }
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
                        '_as_chk,'
                    ].join('')
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

                        if (!options.isClaimGrid && !gridData.claim_id) {
                            if (validateClaimSelection(rowID, true, _selectEle, studyStore))
                                openCreateClaim(rowID, event, options.isClaimGrid, studyStore);
                        } else {
                            openCreateClaim(rowID, event, options.isClaimGrid, studyStore);
                        }

                    }
                    else {
                        event.stopPropagation();
                    }
                },
                beforeSelectRow: function (rowID, e, options) {
                    var _selectEle = $(e.currentTarget).find('#' + rowID).find('input:checkbox');
                    var enableField = _selectEle.is(':checked')
                    _selectEle.prop('checked', !enableField);

                    if (!options.isClaimGrid) {
                        enableField = _selectEle.is(':checked');
                        // validateClaimSelection(rowID, enableField, _selectEle, studyStore);
                    }

                    // var gridData = $('#'+e.currentTarget.id).jqGrid('getRowData', rowID);

                    // if (gridData.billing_method=='Paper Claim') {
                    //     $("#btnPaperClaim").show();
                    //     $("#btnInsuranceClaim").hide();
                    // }else{
                    //     $("#btnPaperClaim").hide();
                    //     $("#btnInsuranceClaim").show();  
                    // }

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
                        commonjs.showWarning('Could not save new column size');
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
            rightclickMenuRights.indexOf(menuId) !== -1 ? $('#'+ menuId).addClass('disabled') : ''
        },

        self.checkSubMenuRights = function(menuId) {
            if(rightclickMenuRights.indexOf(menuId) !== -1 ){
                $('#'+ menuId).removeClass('dropdown-submenu')
                $('#'+ menuId).css({'opacity':'0.7'});
            }
        },

        self.resetInvoiceNumber = function(invoiceNo) {

            $.ajax({
                url: '/exa_modules/billing/claim_workbench/invoice_no',
                type: 'PUT',
                data: {
                    invoiceNo: invoiceNo,
                },
                success: function (data, response) {
                    commonjs.showStatus('Claim Invoice Number has been reset');                                    
                    $("#btnClaimsRefresh").click();
                },
                error: function (err, response) {
                    commonjs.handleXhrError(err, response);
                }
            });
        }
    };
});
