define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'models/pager',
    'text!templates/claims/claim-inquiry.html',
    'collections/claim-inquiry',
    'views/reports/patient-activity-statement',
    'views/reports/payment-invoice',
    'text!templates/claims/claimInquiryPayment.html',
    'collections/claim-patient-inquiry',
    'text!templates/claims/claim-patient.html',
    'text!templates/claims/age-summary.html',
    'text!templates/claims/claim-patient-log.html',
    'collections/claim-patient-log',
], function (
    $,
    _,
    Backbone,
    JGrid,
    JGridLocale,
    Pager,
    claimInquiryTemplate,
    claimCommentsList,
    patientActivityStatement,
    paymentInvoice,
    paymentDetails,
    claimPatientList,
    claimPatientInquiryTemplate,
    agingSummaryHTML,
    claimPatientLogHTML,
    claimPatientLogList
) {
        return Backbone.View.extend({
            el: null,
            pager: null,
            inquiryTemplate: _.template(claimInquiryTemplate),
            claimPatientTemplate: _.template(claimPatientInquiryTemplate),
            paymentTemplate: _.template(paymentDetails),
            agingSummaryTemplate: _.template(agingSummaryHTML),
            claimPatientLogTemplate: _.template(claimPatientLogHTML),
            payCmtGrid: '',
            claim_id: null,      

            initialize: function (options) {
                this.options = options;
                this.pager = new Pager();
                this.claimCommentsList = new claimCommentsList();
                this.claimPatientList = new claimPatientList();
                this.claimPatientLogList = new claimPatientLogList();
            },

            render: function (cid, patientId, from) {
                this.rendered = true;
                commonjs.showDialog({
                    header: 'Claim Inquiry',
                    width: '90%',
                    height: '85%',
                    html: this.inquiryTemplate()
                });

                this.bindEvents();
                // commonjs.bindDateTimePicker("divFollowUpDate", { format: 'L' }); //to bind date picker to followup date  . Now not working that's y commented               
                this.claimInquiryDetails(cid, false, from);
                $('#modal_div_container').removeAttr('style');
            },

            bindEvents: function () {
                var self = this;

                $('#btnCIAddComment').off().click(function () {
                    self.showCommentPopup();
                });

                $('#btnCISaveIsInternal').off().click(function () {
                    self.saveIsInternalComment();
                });

                $('btnCIPrintInvoice').off().click(function (e) {
                    self.printPaymentInvoice(e);
                });

                $('#btnCICommentCancel').off().click(function () {
                    self.closeSaveComment();
                });

                $('#btnCIAddBillingComments').off().click(function () {
                    self.billingCommentsReadonly();
                });

                $('#btnCIPayCancel').off().click(function (e) {
                    self.closePaymentDetails(e);
                });

                $('.claimProcess').off().click(function (e) {
                    self.applyToggleInquiry(e);
                });

            },

            claimInquiryDetails: function (claimID, fromTogglePreNext, from) {
                var self = this;
                self.claim_id = claimID;
                // if (!self.rendered)
                // self.render();
                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry',
                    type: 'GET',
                    data: {
                        'claim_id': self.claim_id
                    },
                    success: function (data, response) {

                        if (from) {
                            $('#headerbtn').hide(); //to hide the prevoius/next button in claim inquiry when  from payments section
                        }

                        if (data) {
                            data = data[0];
                            var claim_data = data.claim_details && data.claim_details.length > 0 ? data.claim_details : '[]';
                            var payment_data = data.payment_details && data.payment_details.length > 0 ? data.payment_details : '[]';
                            var patient_details = data.patient_details && data.patient_details.length > 0 ? data.patient_details : '[]';

                            if (claim_data.length > 0) {

                                claim_data = claim_data[0];
                                //binding the values from data base
                                $('#lblCIReadPhy').text(claim_data.rend_provider_name);
                                $('#lblCIRefPhy').text(claim_data.ref_provider_name);
                                $('#lblCIOrdFac').text(claim_data.group_name);
                                $('#lblCIfac').text(claim_data.facility_name);
                                $('#lblCIStatus').text(claim_data.claim_status);
                                $('#lblCIBillFee').text(claim_data.bill_fee && claim_data.bill_fee != 'undefined' ? claim_data.bill_fee : '$0.00');
                                $('#lblCIBalance').text(claim_data.claim_balance && claim_data.claim_balance != 'undefined' ? claim_data.claim_balance : '$0.00');
                                $('#lblCIAllowed').text(claim_data.allowed_fee && claim_data.allowed_fee != 'undefined' ? claim_data.allowed_fee : '$0.00');
                                $('#txtCIBillingComment').val(claim_data.billing_notes);
                                var claim_date = commonjs.checkNotEmpty(claim_data.claim_dt) ? moment(claim_data.claim_dt).format('L') : '';
                                $('#lblCIClaimDate').text(claim_date);
                            }

                            if (payment_data && payment_data.length > 0) {
                                $('#lblCIPatientPaid').text(payment_data.patient_paid && payment_data.patient_paid != 'undefined' ? payment_data.patient_paid : '$0.00');
                                $('#lblCIOthersPaid').text(payment_data.others_paid && payment_data.others_paid != 'undefined' ? payment_data.others_paid : '$0.00');
                                $('#lblCIAdj').text(payment_data.adjustment_amount && payment_data.adjustment_amount != 'undefined' ? payment_data.adjustment_amount : '$0.00');
                            }

                            if (patient_details && patient_details.length > 0) {
                                var patient_details = 'Claim Inquiry: ' + patient_details[0].patient_name + ' (Acc#:' + patient_details[0].account_no + ')' + ',  ' + patient_details[0].birth_date + ',  ' + patient_details[0].gender;
                                $(parent.document).find('#spanModalHeader').html(patient_details)
                            }

                            if (fromTogglePreNext) {

                                data.icdcode_details = data.icdcode_details && data.icdcode_details.length > 0 ? data.icdcode_details : '[]';
                                data.insurance_details = data.insurance_details && data.insurance_details.length > 0 ? data.insurance_details : '[]';

                                self.showClaimCommentsGrid();
                                $("#tblCIInsurance").jqGrid('clearGridData');
                                $("#tblCIDiagnosis").jqGrid('clearGridData');

                                $("#tblCIInsurance").jqGrid('setGridParam', { datatype: 'local', data: data.insurance_details }).trigger("reloadGrid");
                                $("#tblCIDiagnosis").jqGrid('setGridParam', { datatype: 'local', data: data.icdcode_details }).trigger("reloadGrid");

                            } else {
                                self.showInsuranceGrid(data.insurance_details);
                                self.showDiagnosisGrid(data.icdcode_details);
                                self.showClaimCommentsGrid();
                            }

                            self.getFollowupDate();
                            $('.claimProcess').prop('disabled', false);
                            $('#gview_tblCIClaimComments .ui-search-toolbar').hide();
                            $('#divClaimInquiry').height(from ? $(window).height() - 220 : $(window).height() - 260);
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });                

                $('#btnCIPrintInvoice').on().click(function () {
                    self.generatePrintInvoice(claimID);
                });
            },

            showInsuranceGrid: function (data) {

                $('#tblCIInsurance').jqGrid({
                    datatype: 'local',
                    data: data != null ? data : [],
                    colNames: ['', 'code', 'description', 'Subscriber Name', 'DOB', 'Policy No', 'Group No', 'Paper Claim'],
                    colModel: [
                        { name: 'id', hidden: true },
                        { name: 'insurance_code', search: false },
                        { name: 'insurance_name', search: false },
                        { name: 'name', search: false },
                        { name: 'subscriber_dob', search: false },
                        { name: 'policy_number', search: false },
                        { name: 'group_number', search: false },
                        {
                            name: 'paper_claim', search: false,
                            customAction: function (rowID) {
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                return "<input type='button' id='btnCIPaperClaim' class='btn btnCommentSave  btn-primary' value='Paper Claim' i18n='shared.buttons.paperclaim' id='spnPaperClaim_" + rowObject.id + "'>"
                            }
                        }
                    ],
                    cmTemplate: { sortable: false },
                    customizeSort: true,
                    width: $('#claimDetails').width() - 50,
                    shrinkToFit: true
                });
                $('#gview_tblCIInsurance').find('.ui-jqgrid-bdiv').css('max-height', '100px')
            },

            showDiagnosisGrid: function (data) {
                $("#tblCIDiagnosis").jqGrid({
                    datatype: 'local',
                    data: data != null ? data : [],
                    colNames: ['', 'Code', 'Description'],
                    colModel: [
                        { name: '', index: 'id', key: true, hidden: true },
                        { name: 'code', width: 20, search: false },
                        { name: 'description', width: 100, search: false }
                    ],
                    cmTemplate: { sortable: false },
                    customizeSort: true,
                    shrinkToFit: true,
                    width: $('#icdGrid').width() - 10
                });
                $('#gview_tblCIDiagnosis').find('.ui-jqgrid-bdiv').css('max-height', '300px')
            },

            showPatientClaimsGrid: function (claimID, patientId) {
                var self = this;
                $('#divPatientClaimsGrid').show();
                this.patientClaimsTable = new customGrid();
                this.patientClaimsTable.render({
                    gridelementid: '#tblPatientClaimsGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', 'Claim Number', 'Claim Date', 'Billing Fee', 'Total Insurance Payments', 'Total Patient Payments', 'Balance', 'Claim Status', 'Current responsibility'],
                    i18nNames: ['', 'billing.fileInsurance.claimNo', 'billing.claims.claimDate', 'billing.COB.billingFee', 'billing.claims.totalInsurancePayments', 'billing.claims.totalPatientPayments', 'billing.claims.Balance', 'billing.claims.claimStatus', 'billing.claims.currentResponsibility'],
                    colModel: [
                        { name: '', index: 'claim_id', key: true, hidden: true, search: false },
                        {
                            name: 'claim_id', search: false, width: '70px'
                        },
                        {
                            name: 'claim_dt', search: false, formatter: self.dateFormatter, width: '130px'
                        },
                        {
                            name: 'billing_fee', search: false, width: '70px'
                        },
                        {
                            name: 'total_insurance_payment', search: false, width: '100px'
                        },
                        {
                            name: 'total_patient_payment', search: false, width: '100px'
                        },
                        {
                            name: 'claim_balance', search: false, width: '70px'
                        },
                        {
                            name: 'claim_status', search: false, width: '100px'
                        },
                        {
                            name: 'payer_name', search: false, width: '100px'
                        }


                    ],
                    datastore: self.claimPatientList,
                    container: self.el,
                    cmTemplate: { sortable: false },
                    customizeSort: false,
                    sortname: "claims.id",
                    sortorder: "desc",
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    customargs: {
                        claimID: claimID,
                        patientId: patientId
                    },
                    pager: '#gridPager_PatientClaim',
                    onaftergridbind: self.afterGridBind,
                });


                setTimeout(function () {
                    $("#tblPatientClaimsGrid").setGridWidth($(".modal-body").width());
                    $("#tblPatientClaimsGrid").setGridHeight(($(".modal-body").height() / 2) * 2);
                }, 200);
                $('#divAgeSummary').html(self.agingSummaryTemplate());
            },

            showPatientClaimsLogGrid: function (claimID, patientId) {
                var self = this;
                $('#divPatientClaimsLogGrid').show();
                this.patientClaimsLogTable = new customGrid();
                this.patientClaimsLogTable.render({
                    gridelementid: '#tblPatientClaimsLogGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', 'Logged date', 'Screen', 'User', 'Log Description'],
                    i18nNames: ['', 'setup.log.logDt', 'setup.common.screen', 'setup.billingprovider.Username', 'setup.log.logDescription'],
                    colModel: [
                        { name: 'id', index: 'id', key: true, hidden: true },
                        {
                            name: 'created_dt', search: true, formatter: self.dateFormatter, width: '100px'
                        },
                        {
                            name: 'screen_name', search: true, width: '70px'
                        },
                        {
                            name: 'username', search: true, width: '70px'
                        },
                        {
                            name: 'description', search: true, width: '130px'
                        }

                    ],
                    datastore: self.claimPatientLogList,
                    container: self.el,
                    cmTemplate: { sortable: false },
                    customizeSort: false,
                    sortname: "audit_log.id",
                    sortorder: "desc",
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    customargs: {
                        claimID: claimID,
                        patientId: patientId
                    },
                    pager: '#gridPager_PatientClaimLog'
                });


                setTimeout(function () {
                    $("#tblPatientClaimsLogGrid").setGridWidth($(".modal-body").width());
                    $("#tblPatientClaimsLogGrid").setGridHeight(($(".modal-body").height() - 200));
                }, 200);

                commonjs.initializeScreen({ header: { screen: 'Claim Log', ext: 'Claim log' } });
            },

            dateFormatter: function (cellvalue, options, rowObject) {
                return commonjs.checkNotEmpty(cellvalue) ?
                    commonjs.convertToFacilityTimeZone(rowObject.facility_id, cellvalue).format('L LT z') :
                    '';
            },

            afterGridBind: function (model, gridObj) {
                var self = this;
                if (model && model.length > 0) {
                    var age_summary = model[0].get('age_summary');
                    $('#tdCurrent').html(age_summary.age_0_30 || '$0.00');
                    $('#tdAge30').html(age_summary.age_31_60 || '$0.00');
                    $('#tdAge60').html(age_summary.age_61_90 || '$0.00');
                    $('#tdAge90').html(age_summary.age_91_120 || '$0.00');
                    $('#tdAge120').html(age_summary.age_121 || '$0.00');
                    $('#tdAgeTotal').html(age_summary.total_balance || '$0.00');
                    $('#tdAgeOtherPaid').html(age_summary.payment_insurance_total || '$0.00');
                    $('#tdAgePatientPaid').html(age_summary.payment_patient_total || '$0.00');
                }
            },

            showClaimCommentsGrid: function () {
                var self = this;
                var commentType = ["payment", "adjustment", "charge"]
                var payCmtGrid;
                payCmtGrid = new customGrid();
                payCmtGrid.render({
                    gridelementid: '#tblCIClaimComments',
                    custompager: self.pager,
                    emptyMessage: 'No Records Found',
                    colNames: ['','', 'date', '', 'code', 'payment.id', 'comment', 'Diag Ptr', 'charge', 'payment', 'adjustment', '', '', '', ''],
                    colModel: [
                        { name: 'row_number', hidden: true},
                        { name: 'id', hidden: true },
                        { name: 'commented_dt', width: 40, search: false, sortable: false, formatter: self.commentDateFormatter },
                        { name: 'code', hidden: true },
                        { name: 'type', width: 40, search: false, sortable: false },
                        {
                            name: 'payment_id', width: 30, search: false, sortable: false,
                            customAction: function (rowID) {
                                var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                $("#tBodyCIPayment").empty();
                                self.getPaymentofCharge(gridData.id);
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.type && rowObject.code == 'charge')
                                    return "<span class='icon-ic-raw-transctipt' rel='tooltip' title='View Pay details of this charge'></span>"
                                else
                                    return rowObject.payment_id;
                            }
                        },
                        { name: 'comments', width: 50, search: false, sortable: false },
                        { name: 'charge_pointer', width: 20, search: false, sortable: false, formatter: self.pointerFormatter },
                        { name: 'charge_amount', width: 20, search: false, sortable: false },
                        { name: 'payment', width: 20, search: false, sortable: false },
                        { name: 'adjustment', width: 30, search: false, sortable: false,
                            formatter: function(cellvalue, options, rowObject){
                                if(rowObject.adjustment && rowObject.adjustment == '$0.00' || rowObject.adjustment == null)
                                    return '';
                                else 
                                    return rowObject.adjustment
                            } 
                        },
                        {
                            name: 'view_payment', width: 20, sortable: false, search: false,
                            customAction: function (rowID) {
                                var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                self.getDetailsOfPay(gridData.payment_id);
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.type && rowObject.code == 'payment')
                                    return "<span class='fa fa-eye' rel='tooltip' title='view payment details'></span>"
                                else
                                    return "";
                            }
                        },
                        {
                            name: 'del', width: 20, search: false, sortable: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure that you want to delete?")) {
                                    var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                    self.deleteClaimComment(gridData.id);
                                }
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.type && commentType.indexOf(rowObject.code) == -1)
                                    return "<span class='icon-ic-delete' rel='tooltip' title='Click here to delete'></span>"
                                else
                                    return "";
                            }
                        },
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            customAction: function (rowID) {
                                var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                self.getClaimComment(gridData.id);
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.type && commentType.indexOf(rowObject.code) == -1)
                                    return "<span class='icon-ic-edit' rel='tooltip' title='Click here to edit'></span>"
                                else
                                    return "";
                            }
                        },
                        {
                            name: 'is_internal', width: 20, sortable: false, search: false, hidden: false,
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.type && commentType.indexOf(rowObject.code) == -1) {
                                    if (rowObject.is_internal == true)
                                        return '<input type="checkbox" checked   class="chkPaymentReport" name="paymentReportChk"  id="' + rowObject.id + '" />'
                                    else
                                        return '<input type="checkbox"   class="chkPaymentReport" name="paymentReportChk"  id="' + rowObject.id + '" />'

                                }
                                else
                                    return '';
                            },
                            customAction: function (rowID, e) {
                            }
                        }
                    ],
                    sortname: 'id',
                    sortorder: 'ASC',
                    caption: 'Claim Comments',
                    datastore: self.claimCommentsList,
                    container: self.el,
                    dblClickActionIndex: -2,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: true,
                    disableadd: true,
                    disablereload: true,
                    shrinkToFit: true,
                    customargs: {
                        claim_id: self.claim_id
                    }                   
                })
                $('#gview_tblCIClaimComments').find('.ui-jqgrid-bdiv').css('max-height', '180px')
                commonjs.initializeScreen({ header: { screen: 'Claim Comments', ext: 'Claim Comments' } });
            },

            getFollowupDate: function () {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/followup',
                    type: 'GET',
                    data: {
                        'claim_id': self.claim_id
                    },
                    success: function (data, response) {
                        data = data[0];
                        if (data) {
                            self.previousFollowUpDate = (commonjs.checkNotEmpty(data.followup_date)) ? moment(data.followup_date).format('YYYY-MM-DD') : '';
                            $('#txtCIFollowUpDate').val(self.previousFollowUpDate);
                        }
                        else {
                            self.previousFollowUpDate = '';
                            $('#txtCIFollowUpDate').val('');
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                })
            },

            showCommentPopup: function (from, comment, commentId) {
                var self = this;

                $('#divCIFormComment').css({ top: '25%', height: '20%' });
                $('#divCIFormComment').show();
                if (from == 'edit') {
                    $('#siteModal').find('#txtCIAddComment').val(comment);
                }
                else {
                    commentId = 0;
                }
                $('#siteModal').find('#btnCICommentSave').unbind().click(function () {
                    var comment = $('#siteModal').find('#txtCIAddComment').val();
                    if (comment != '')
                        self.saveClaimComment(commentId, comment);
                    else
                        commonjs.showWarning("Please add comments");
                });

            },

            deleteClaimComment: function (commentId) {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry',
                    type: 'DELETE',
                    data: {
                        'id': commentId
                    },
                    success: function (data, response) {
                        commonjs.showStatus('Comment Deleted Successfully');
                        self.showClaimCommentsGrid();
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            getClaimComment: function (commentId) {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/claim_comment',
                    type: 'GET',
                    data: {
                        'commentId': commentId
                    },
                    success: function (data, response) {
                        if (data) {
                            self.showCommentPopup('edit', data[0].comments, commentId)
                        }

                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            saveClaimComment: function (commentId, comment) {
                var self = this;
                if (commentId != 0) {

                    $.ajax({
                        url: '/exa_modules/billing/claims/claim_inquiry/claim_comment',
                        type: 'PUT',
                        data: {
                            'commentId': commentId,
                            'note': comment,
                            'from': 'tmt'
                        },
                        success: function (data, response) {
                            commonjs.showStatus('Record Saved Successfully');
                            self.closeSaveComment();
                            self.showClaimCommentsGrid();

                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });

                } else if (commentId == 0) {

                    $.ajax({
                        url: '/exa_modules/billing/claims/claim_inquiry/claim_comment',
                        type: 'POST',
                        data: {
                            'note': comment,
                            'type': 'manual',
                            'claim_id': self.claim_id
                        },
                        success: function (data, response) {
                            commonjs.showStatus('Record Saved Successfully');
                            self.closeSaveComment();
                            self.showClaimCommentsGrid();
                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });
                }
            },

            saveIsInternalComment: function () {
                var comments = [];
                var self = this;
                var selectedFollowUpDate = $('#txtCIFollowUpDate').val() ? moment($('#txtCIFollowUpDate').val()).format('L') : '';
                var currentDate = moment().format('L');
                if (moment(selectedFollowUpDate).format('MM/DD/YYYY') < currentDate) {
                    commonjs.showWarning('Cannot Select Past date');
                    return;
                }

                $('#tblCIClaimComments  td input:checkbox').each(function () {
                    var content = {};
                    content.isinternal = $(this).prop('checked');
                    content.commentid = $(this).attr('id');
                    comments.push(content);
                });
                comments = JSON.stringify(comments);

                var notes = $('#txtCIBillingComment').val();

                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/claim_comment',
                    type: 'PUT',
                    data: {
                        'comments': comments,
                        'from': 'cb', //check box
                        'claim_id': self.claim_id,
                        'followupDate': selectedFollowUpDate,
                        'assignedTo': app.userID,
                        'notes': notes
                    },
                    success: function (data, response) {
                        commonjs.showStatus('Record Saved Successfully');
                        $('#txtCIBillingComment').attr('readonly', 'readonly');

                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            commentDateFormatter: function (cellvalue, options, rowObject) {
                var colValue = (commonjs.checkNotEmpty(rowObject.commented_dt) ? moment(rowObject.commented_dt).format('L') : '');
                return colValue;
            },

            pointerFormatter: function(cellvalue, options, rowObject) {
                var pointer  = rowObject.charge_pointer.toString();
                pointer = pointer.replace(/^,+|,(?=,+|$)/g, "");
                return pointer;
            },

            patientInquiryForm: function (claimId, patientId) {
                var self = this;
                this.$el.html(this.claimPatientTemplate());
                self.showPatientClaimsGrid(claimId, patientId);
                $('#btnPatientActivity').on().click(function () {
                    self.generatePatientActivity(claimId, patientId);
                });
            },

            patientInquiryLog: function (claimId, patientId) {
                var self = this;
                this.$el.html(this.claimPatientLogTemplate());
                self.showPatientClaimsLogGrid(claimId, patientId);
            },

            printPaymentInvoice: function (e) {
                var self = this;
                self.paymentInvoice = new paymentInvoice({ el: $('#modal_div_container') });
                self.paymentInvoice.onReportViewClick(e);
            },

            closeSaveComment: function (e) {
                $('#divCIFormComment').hide();
                $('#txtCIAddComment').val('');
            },

            billingCommentsReadonly: function () {
                var self = this;

                if ($('#txtCIBillingComment').prop('readonly')) {
                    $('#txtCIBillingComment').removeAttr('readonly');
                }
                else {
                    $('#txtCIBillingComment').attr('readonly', 'readonly');
                }
            },

            getPaymentofCharge: function (charge_id) {
                var self = this;

                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/charge_payment_details',
                    type: 'GET',
                    data: {
                        'charge_id': charge_id
                    },
                    success: function (data, response) {
                        if (data.length > 0) {
                            $('#divCIpaymentDetails').show();
                            var paymentCASRow = self.paymentTemplate({ rows: data });
                            $('#tBodyCIPayment').append(paymentCASRow);
                        }
                        else {
                            commonjs.showStatus('No Payment to Show');
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            getDetailsOfPay: function (pay_id) {
                var self = this;

                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/payment_details',
                    type: 'GET',
                    data: {
                        'claim_id': self.claim_id,
                        'payment_id': pay_id
                    },
                    success: function (data, response) {
                        if (data.length > 0) {
                            $('#divCIpaymentDetails').show();
                            var paymentCASRow = self.paymentTemplate({ rows: data });
                            $('#tBodyCIPayment').append(paymentCASRow);
                        }
                        else {
                            commonjs.showStatus('No Payment to Show');
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                })
            },

            closePaymentDetails: function (e) {
                $('#divCIpaymentDetails').hide();
                $("#tBodyCIPayment").empty();
            },

            applyToggleInquiry: function (e) {

                var self = this;
                var $tblGrid = $('#tblClaimGridAll_Claims');

                if (self.claim_id) {

                    var rowData = $($tblGrid, parent.document).find('tr#' + self.claim_id);
                    var nextRowData = $(e.target).attr('id') == 'btnPreviousInquiry' ? rowData.prev() : rowData.next();

                    if (nextRowData.attr('id') && nextRowData.length > 0) {
                        var rowId = nextRowData.attr('id');
                        $(e.target).prop('disabled', true);
                        $($tblGrid, parent.document).closest('tr').find('tr#' + rowId);

                        self.claimInquiryDetails(rowId, true, false);
                    } else {
                        commonjs.showWarning('No more order found')
                    }

                } else {
                    commonjs.showWarning('Error on process claim');
                }
            },
            generatePatientActivity: function (patientIds, claimIds, e) {
                var self = this;
                self.patientActivityStatement = new patientActivityStatement({ el: $('#reportFrame') });
                var claimInfo = {
                    'claimID': patientIds,
                     flag: "patient-activity-statement",
                    'patientId': claimIds
                }
                self.patientActivityStatement.onReportViewClick(e, claimInfo);
            },
            generatePrintInvoice: function(claimId, e){
                var self = this;
                self.patientActivityStatement = new patientActivityStatement({ el: $('#reportFrame') });
                var claimInfo = {
                    'claimID': claimId,
                     flag: "paymentInvoice"                    
                }
                self.patientActivityStatement.onReportViewClick(e, claimInfo);
            }
        });

    });