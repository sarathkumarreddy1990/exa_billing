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
            },

            encounterDetails: function () {
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
                var payCmtGrid;
                payCmtGrid = new customGrid();
                payCmtGrid.render({
                    gridelementid: '#tblCIClaimComments',
                    custompager: self.pager,
                    emptyMessage: 'No Records Found',
                    colNames: ['', 'date', 'payment.id', 'comment', '', '', ''],
                    colModel: [
                        { name: 'id', hidden: true },
                        { name: 'commented_dt', width: 100, search: false, sortable: false },
                        { name: 'payment_id', width: 100, search: false, sortable: false },
                        { name: 'comments', width: 50, search: false, sortable: false },
                        { name: 'del', width: 20, search: false, sortable: false },
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            customAction: function (rowID) {
                                var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                self.getClaimComment(gridData.id);
                            }
                        },
                        { name: 'is_patient_statement_Report', width: 20, sortable: false, search: false, hidden: false }
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
            }
        })

    });