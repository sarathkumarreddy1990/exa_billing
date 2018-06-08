define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'models/pager',
    'text!templates/claim-inquiry.html',
    'collections/claim-inquiry'
], function (
    $,
    _,
    Backbone,
    JGrid,
    JGridLocale,
    Pager,
    claimInquiryTemplate,
    claimCommentsList) {
        return Backbone.View.extend({
            el: null,
            pager: null,
            inquiryTemplate: _.template(claimInquiryTemplate),
            claim_id: null,
            events: {
                "blur #txtCIFollowUpDate": "saveFollowUpDate",
                "click #btnCIAddComment": "showCommentPopup",
                "click #btnCISaveComment": "saveComment",
                "click #btnCISaveIsInternal": "saveIsInternalComment"
            },

            initialize: function (options) {
                var self = this;
                self.options = options;
                self.pager = new Pager();
                self.claimCommentsList = new claimCommentsList();
                self.render();
                self.encounterDetails();
            },

            render: function () {
                this.$el.html(this.inquiryTemplate());
                commonjs.bindDateTimePicker("divFollowUpDate", { format: 'L' }); //to bind date picker to followup date
            },

            encounterDetails: function () {
                this.claim_id = 1512;
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/claim_inquiry',
                    type: 'GET',
                    data: {
                        'claim_id': 4262
                    },
                    success: function (data, response) {
                        if (data) {
                            data = data[0];
                            var encounter = data.encounter_details[0];

                            //binding the values from data base
                            $('#lblCIReadPhy').text(encounter.rend_provider_name);
                            $('#lblCIRefPhy').text(encounter.ref_provider_name);
                            $('#lblCIOrdFac').text(encounter.group_name);
                            $('#lblCIfac').text(encounter.facility_name);
                            $('#lblCIStatus').text(encounter.claim_status);
                            $('#lblCIPatientPaid').text(encounter.patient_paid);
                            $('#lblCIOthersPaid').text(encounter.others_paid);
                            $('#lblCIBillFee').text(encounter.bill_fee);
                            $('#lblCIAdj').text(encounter.adjustment_amount);
                            $('#lblCIBalance').text(encounter.claim_balance);
                            $('#lblCIAllowed').text(encounter.allowed_fee);

                            self.insuranceGrid(data.insurance_details);
                            self.diagnosisGrid(data.icdcode_details);
                            self.getFollowupDate();
                            self.claimCommentsGrid();
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }

                })
            },

            insuranceGrid: function (data) {
                $('#tblCIInsurance').jqGrid({
                    datatype: 'local',
                    data: data,
                    colNames: ['', 'code', 'description'],
                    colModel: [
                        { name: 'id', hidden: true },
                        { name: 'insurance_code', search: false },
                        { name: 'insurance_name', search: false }
                    ],
                    cmTemplate: { sortable: false },
                    customizeSort: true,
                    width: $('#encounterDetails').width() - 50,
                    shrinkToFit: true
                });
                $('#gview_tblCIInsurance').find('.ui-jqgrid-bdiv').css('max-height', '180px')
            },

            diagnosisGrid: function (data) {
                $("#tblCIDiagnosis").jqGrid({
                    datatype: 'local',
                    data: data,
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

            claimCommentsGrid: function () {
                var self = this;
                self.claim_id = 1512;
                var commentType = ["payment", "adjustment", "charge"]
                var payCmtGrid;
                payCmtGrid = new customGrid();
                payCmtGrid.render({
                    gridelementid: '#tblCIClaimComments',
                    custompager: self.pager,
                    emptyMessage: 'No Records Found',
                    colNames: ['', 'date', 'payment.id', 'comment', '', '', ''],
                    colModel: [
                        { name: 'id', hidden: true },
                        { name: 'commented_dt', width: 80, search: false, sortable: false, formatter: self.commentDateFormatter },
                        { name: 'payment_id', width: 80, search: false, sortable: false },
                        { name: 'comments', width: 50, search: false, sortable: false },
                        {name: 'del', width: 20, search: false, sortable: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                commonjs.helpConfirm({
                                    icon: "fa fa-trash",
                                    head: "Delete",
                                    hi18n: "messages.confirm.delete",
                                    body: "Are you sure that you want to delete?",
                                    bi18n: "messages.confirm.deleteAreYouSure",
                                    buttons: [
                                        {
                                            text: "Yes",
                                            click: function () {
                                                var gridData = $('#tblPaymentComments').jqGrid('getRowData', rowID);
                                                self.deleteClaimComment(gridData.id);
                                            }
                                        },
                                        {
                                            text: "No"
                                        }
                                    ]
                                });
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.type && commentType.indexOf(rowObject.type) == -1)
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
                                if (rowObject.type && commentType.indexOf(rowObject.type) == -1)
                                    return "<span class='icon-ic-edit' rel='tooltip' title='Click here to edit'></span>"
                                else
                                    return "";
                            }
                        },
                        {
                            name: 'is_internal', width: 20, sortable: false, search: false, hidden: false,
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.type && commentType.indexOf(rowObject.type) == -1) {
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
                    pager: '#gridPager_CIClaimComment',
                    sortname: 'id',
                    sortorder: 'ASC',
                    caption: 'Claim Comments',
                    datastore: self.claimCommentsList,
                    container: self.el,
                    dblClickActionIndex: -2,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
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
                    // commonjs.showWarning("messages.warning.shared.alreadyexists");
                    return;
                }
                if (e.eventPhase && self.previousFollowUpDate != selectedFollowUpDate) {
                    $.ajax({
                        url: '/exa_modules/billing/claim_inquiry/followup',
                        type: 'POST',
                        data: {
                            'claim_id': 1512,
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

                            // self.getFollowupDate(); AS of now commented Because deleted_dt not avail in DB
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
                    url: '/exa_modules/billing/claim_inquiry/followup',
                    type: 'GET',
                    data: {
                        'claim_id': self.claim_id
                    },
                    success: function (data, response) {
                        if (data && data.result) {
                            self.previousFollowUpDate = (commonjs.checkNotEmpty(data.result.rows[0].followup_date)) ? moment(data.result.rows[0].followup_date).format('MM/DD/YYYY') : '';
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
                commonjs.showDialog({ header: 'Add Comment', i18nHeader: 'menuTitles.patient.addComment', width: '60%', height: '25%', html: $('#divCIFormComment').html() });
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
                $.ajax({
                    url: '/exa_modules/billing/claim_inquiry',
                    type: 'DELETE',
                    data: {
                        'id': commentId
                    },
                    success: function (data, response) {

                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },
            getClaimComment: function (commentId) {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/claim_inquiry/claim_comment',
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
                        url: '/exa_modules/billing/claim_inquiry/claim_comment',
                        type: 'PUT',
                        data: {
                            'commentId': commentId,
                            'note': comment,
                            'from': 'tmt'
                        },
                        success: function (data, response) {
                            commonjs.hideDialog();
                            commonjs.showStatus('Record Saved Successfully');

                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });
                } else if (commentId == 0) {
                    $.ajax({
                        url: '/exa_modules/billing/claim_inquiry/claim_comment',
                        type: 'POST',
                        data: {
                            'note': comment,
                            'type': 'manual',
                            'claim_id': self.claim_id
                        },
                        success: function (data, response) {
                            commonjs.showStatus('Record Saved Successfully');

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
                    url: '/exa_modules/billing/claim_inquiry/claim_comment',
                    type: 'PUT',
                    data: {
                        'comments': comments,
                        'from': 'cb'
                    },
                    success: function (data, response) {
                        commonjs.hideDialog();
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
            }
        })

    });