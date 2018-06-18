define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'models/pager',
    'text!templates/claims/claim-inquiry.html',
    'collections/claim-inquiry',
    'views/reports/patient-activity-statement' ,
    'views/reports/payment-invoice',
    'text!templates/claims/claimInquiryPayment.html' 
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
    paymentDetails) {
        return Backbone.View.extend({
            el: null,
            pager: null,
            inquiryTemplate: _.template(claimInquiryTemplate),
            paymentTemplate: _.template(paymentDetails),
            claim_id: null,
            events: {
                "blur #txtCIFollowUpDate": "saveFollowUpDate",
                "click #btnCIAddComment": "showCommentPopup",
                "click #btnCISaveComment": "saveComment",
                "click #btnCISaveIsInternal": "saveIsInternalComment",
                "click #btnCIPatientInquiry": "patientInquiryForm",
                "click #btnCIPrintInvoice": "printPaymentInvoice",
                "click #btnCICommentCancel": "closeSaveComment",
                "click #btnCIAddBillingComments": "billingCommentsReadonly",
                "click #btnCISaveBillingNote": "saveBillingComment",
                "click #btnCIPayCancel": "closePaymentDetails"
            },

            initialize: function (options) {
                this.options = options;
                this.pager = new Pager();
                this.claimCommentsList = new claimCommentsList();
            },

            render: function (cid) {
              this.rendered = true;
              this.$el.html(this.inquiryTemplate());
                commonjs.bindDateTimePicker("divFollowUpDate", { format: 'L' }); //to bind date picker to followup date
                this.encounterDetails(cid)
            },

            encounterDetails: function (claimID) {
                var self = this;
                self.claim_id = claimID;
                if (!self.rendered)
                self.render();
                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry',
                    type: 'GET',
                    data: {
                        'claim_id': self.claim_id  
                    },
                    success: function (data, response) {
                        if (data) {
                            data = data[0];
                            var claim_data = data.claim_details && data.claim_details.length > 0 ? data.claim_details : '[]';
                            var payment_data = data.payment_details && data.payment_details.length > 0 ? data.payment_details : '[]';
                            if(claim_data.length > 0){
                                claim_data = claim_data[0];
                                //binding the values from data base
                                $('#lblCIReadPhy').text(claim_data.rend_provider_name);
                                $('#lblCIRefPhy').text(claim_data.ref_provider_name);
                                $('#lblCIOrdFac').text(claim_data.group_name);
                                $('#lblCIfac').text(claim_data.facility_name);
                                $('#lblCIStatus').text(claim_data.claim_status);
                                $('#lblCIBillFee').text(claim_data.bill_fee);
                                $('#lblCIBalance').text(claim_data.claim_balance);
                                $('#lblCIAllowed').text(claim_data.allowed_fee);
                                $('#txtCIBillingComment').text(claim_data.billing_notes)
                            }

                            if(payment_data.length > 0){
                                $('#lblCIPatientPaid').text(payment_data.patient_paid);
                                $('#lblCIOthersPaid').text(payment_data.others_paid);
                                $('#lblCIAdj').text(payment_data.adjustment_amount);
                            }

                            self.showInsuranceGrid(data.insurance_details);
                            self.showDiagnosisGrid(data.icdcode_details);
                            self.getFollowupDate();
                            self.showClaimCommentsGrid();
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }

                })
            },

            showInsuranceGrid: function (data) {

                $('#tblCIInsurance').jqGrid({
                    datatype: 'local',
                    data: data !=null ? data : [],
                    colNames: ['', 'code', 'description', 'Subscriber Name', 'DOB', 'Policy No', 'Group No', 'Paper Claim'],
                    colModel: [
                        { name: 'id', hidden: true },
                        { name: 'insurance_code', search: false },
                        { name: 'insurance_name', search: false },
                        { name: 'name', search: false },
                        { name: 'subscriber_dob', search: false },
                        { name: 'policy_number', search: false },
                        { name: 'group_number', search: false },
                        { name: 'paper_claim', search: false, 
                            customAction: function (rowID) {
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                    return "<input type='button' id='btnCICommentSave' class='btn btnCommentSave  btn-primary' value='Paper Claim' i18n='shared.buttons.paperclaim' id='spnPaperClaim_" + rowObject.id + "'>"
                            }
                        }
                    ],
                    cmTemplate: { sortable: false },
                    customizeSort: true,
                    width: $('#encounterDetails').width() - 50,
                    shrinkToFit: true
                });
                $('#gview_tblCIInsurance').find('.ui-jqgrid-bdiv').css('max-height', '180px')
            },

            showDiagnosisGrid: function (data) {
                $("#tblCIDiagnosis").jqGrid({
                    datatype: 'local',
                    data: data !=null ? data : [],
                    colNames: ['', 'Code', 'Description'],
                    colModel: [
                        { name: '', index: 'id', key: true, hidden: true },
                        { name: 'code', width: 100, search: false },
                        { name: 'description', width: 100, search: false }
                    ],
                    cmTemplate: { sortable: false },
                    customizeSort: true,
                    shrinkToFit: true,
                    width: $('#encounterDetails').width() - 50
                });
                $('#gview_tblCIDiagnosis').find('.ui-jqgrid-bdiv').css('max-height', '180px')
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
                    colNames: ['', 'date', '', 'code', 'payment.id', 'comment', 'Diag Ptr', 'charge', 'payment', 'adjustment', '', '', '', ''],
                    colModel: [
                        { name: 'id', hidden: true },
                        { name: 'commented_dt', width: 40, search: false, sortable: false, formatter: self.commentDateFormatter },
                        { name: 'code', hidden: true},
                        { name: 'type', width: 40, search: false, sortable: false },
                        { name: 'payment_id', width: 80, search: false, sortable: false,
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
                        { name: 'charge_pointer', width: 20,  search: false, sortable: false }, 
                        { name: 'charge_amount', width: 20,  search: false, sortable: false },
                        { name: 'payment', width: 20,  search: false, sortable: false },
                        { name: 'adjustment', width: 30,  search: false, sortable: false }, 
                        { name: 'view_payment', width: 20, sortable: false, search: false,
                            customAction: function (rowID) {
                                var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                self.getDetailsOfPay(gridData.id);
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.type && rowObject.code == 'payment')
                                    return "<span class='fa fa-eye' rel='tooltip' title='view payment details'></span>"
                                else
                                    return "";
                            }
                        }, 
                        { name: 'del', width: 20, search: false, sortable: false,
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

            saveFollowUpDate: function (e) {
                var self = this;
                var selectedFollowUpDate = $('#txtCIFollowUpDate').val() ? moment($('#txtCIFollowUpDate').val()).format('L') : '';
                var currentDate = moment().format('L');
                if (moment(selectedFollowUpDate).format('MM/DD/YYYY') < currentDate) {
                    commonjs.showWarning('Cannot Select Past date');
                    return;
                }
                if (e.eventPhase && self.previousFollowUpDate != selectedFollowUpDate) {
                    $.ajax({
                        url: '/exa_modules/billing/claims/claim_inquiry/followup',
                        type: 'POST',
                        data: {
                            'claim_id': self.claim_id,
                            'followupDate': selectedFollowUpDate,
                            'assignedTo': app.userID
                        },
                        success: function (data, response) {
                            if (selectedFollowUpDate == '')
                                commonjs.showStatus('Follow-up Date Deleted Successfully');
                            else if (self.previousFollowUpDate)
                                commonjs.showStatus('Follow-up Date Updated Successfully');
                            else
                                commonjs.showStatus('Follow-up Date Saved Successfully');

                             self.getFollowupDate(); 
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                }
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
                        data  = data[0];
                        if (data) {
                            self.previousFollowUpDate = (commonjs.checkNotEmpty(data.followup_date)) ? moment(data.followup_date).format('MM/DD/YYYY') : '';
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

               $('#divCIFormComment').css({ top: '10%', height: '20%' });
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
                $('#tblCIClaimComments  td input:checkbox').each(function () {
                    var content = {};
                    content.isinternal =  $(this).prop('checked');
                    content.commentid = $(this).attr('id');
                    comments.push(content);
                });
                comments = JSON.stringify(comments);
                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/claim_comment',
                    type: 'PUT',
                    data: {
                        'comments': comments,
                        'from': 'cb'
                    },
                    success: function (data, response) {
                        commonjs.showStatus('Record Saved Successfully');

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

            patientInquiryForm: function (e) {
                var self = this;
                var claimID = self.claim_id;
                self.patientActivityStatement = new patientActivityStatement({el: $('#modal_div_container')});
                self.patientActivityStatement.onReportViewClick(e, claimID);                         
            },

            printPaymentInvoice: function (e) {
                var self = this;
                self.paymentInvoice = new paymentInvoice({el: $('#modal_div_container')});
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
                    $('#btnCISaveBillingNote').show();
                }
                else {
                    $('#txtCIBillingComment').attr('readonly', 'readonly');
                    $('#btnCISaveBillingNote').hide();
                }
            },

            saveBillingComment: function () {
                var self = this;
                var notes = $('#txtCIBillingComment').val();

                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/billing_note',
                    type: 'PUT',
                    data: {
                        'claim_id': self.claim_id,
                        'notes': notes
                    },
                    success: function (data, response) {
                        $('#txtCIBillingComment').attr('readonly', 'readonly');
                        $('#btnCISaveBillingNote').hide();
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                })
            },

            getPaymentofCharge: function(charge_id) {
                var self = this;

                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/charge_payment_details',
                    type: 'GET',
                    data: {
                        'claim_id': self.claim_id,
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

            getDetailsOfPay: function(pay_id) {
                var self = this;

                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/payment_details',
                    type: 'GET',
                    data: {
                        'claim_id': self.claim_id,
                        'pay_application_id': pay_id
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

            closePaymentDetails: function(e){
                $('#divCIpaymentDetails').hide();
                $("#tBodyCIPayment").empty();
            }
        });

    });