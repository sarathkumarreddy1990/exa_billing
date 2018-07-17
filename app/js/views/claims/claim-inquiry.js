define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'shared/paper-claim',
    'models/pager',
    'text!templates/claims/claim-inquiry.html',
    'collections/claim-inquiry',
    'views/reports/patient-activity-statement',
    'views/reports/payment-invoice',
    'text!templates/claims/claimInquiryPayment.html',
    'collections/claim-patient-inquiry',
    'collections/claim-invoice',
    'text!templates/claims/claim-patient.html',
    'text!templates/claims/age-summary.html',
    'text!templates/claims/claim-patient-log.html',
    'text!templates/claims/claim-invoice.html',
    'text!templates/claims/invoice-age-summary.html',
    'collections/claim-patient-log',
    'shared/permissions',
    'views/app/unapplied-payment'
], function (
    $,
    _,
    Backbone,
    JGrid,
    JGridLocale,
    PaperClaim,
    Pager,
    claimInquiryTemplate,
    claimCommentsList,
    patientActivityStatement,
    paymentInvoice,
    paymentDetails,
    claimPatientList,
    claimInvoiceList,
    claimPatientInquiryTemplate,
    agingSummaryHTML,
    claimPatientLogHTML,    
    claimInvoiceHTML,
    claimInvoiceAgeHTML,
    claimPatientLogList,
    Permission,
    unappliedPaymentView
) {
        var paperClaim = new PaperClaim(true);

        return Backbone.View.extend({
            el: null,
            pager: null,
            inquiryTemplate: _.template(claimInquiryTemplate),
            claimPatientTemplate: _.template(claimPatientInquiryTemplate),
            paymentTemplate: _.template(paymentDetails),
            agingSummaryTemplate: _.template(agingSummaryHTML),
            claimPatientLogTemplate: _.template(claimPatientLogHTML), 
            claimInvoiceTemplate: _.template(claimInvoiceHTML),
            invoiceAgingSummaryTemplate: _.template(claimInvoiceAgeHTML),
            payCmtGrid: '',
            claim_id: null,     
            events: {
                "click #radioActivityStatus": "showActivityStatus",
                "click #radActivityAllStatus": "showAllActivity",

            },

            initialize: function (options) {
                this.options = options;
                this.pager = new Pager();
                this.claimCommentsList = new claimCommentsList();
                this.claimPatientList = new claimPatientList();
                this.claimInvoiceList = new claimInvoiceList();
                this.claimPatientLogList = new claimPatientLogList();
                if(app.userInfo.user_type != 'SU'){
                    var rights = (new Permission()).init();
                    this.screenCode = rights.screenCode;
                }
                else {
                    this.screenCode = [];
                }
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
                this.followDate =  commonjs.bindDateTimePicker("divFollowUpDate", { format: 'L', minDate: moment().startOf('day') });               
                this.followDate.date();
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

                $('#btnCIAddBillingComments').off().click(function () {
                    self.billingCommentsReadonly();
                });

                $('.claimProcess').off().click(function (e) {
                    self.applyToggleInquiry(e);
                });

            },

            claimInquiryDetails: function (claimID, fromTogglePreNext, from) {
                var self = this;
                self.claim_id = claimID;

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
                                $('#lblCIBillProv').text(claim_data.billing_provider_name)
                                $('#lblCIReadPhy').text(claim_data.rend_provider_name);
                                $('#lblCIRefPhy').text(claim_data.ref_provider_name);
                                $('#lblCIOrdFac').text(claim_data.group_name);
                                $('#lblCIPOS').text(claim_data.pos_name)
                                $('#lblCIStatus').text(claim_data.claim_status);
                                $('#lblCIBillFee').text(claim_data.bill_fee && claim_data.bill_fee != 'undefined' ? claim_data.bill_fee : '$0.00');
                                $('#lblCIBalance').text(claim_data.claim_balance && claim_data.claim_balance != 'undefined' ? claim_data.claim_balance : '$0.00');
                                $('#lblCIAllowed').text(claim_data.allowed_fee && claim_data.allowed_fee != 'undefined' ? claim_data.allowed_fee : '$0.00');
                                $('#txtCIBillingComment').val(claim_data.billing_notes);
                                var claim_date = commonjs.checkNotEmpty(claim_data.claim_dt) ? moment(claim_data.claim_dt).format('L') : '';
                                $('#lblCIClaimDate').text(claim_date);
                            }

                            if (payment_data && payment_data.length > 0) {
                                $('#lblCIPatientPaid').text(payment_data[0].patient_paid && payment_data[0].patient_paid != 'undefined' ? payment_data[0].patient_paid : '$0.00');
                                $('#lblCIOthersPaid').text(payment_data[0].others_paid && payment_data[0].others_paid != 'undefined' ? payment_data[0].others_paid : '$0.00');
                                $('#lblCIAdj').text(payment_data[0].adjustment_amount && payment_data[0].adjustment_amount != 'undefined' ? payment_data[0].adjustment_amount : '$0.00');
                                $('#lblCIRefund').text(payment_data[0].refund_amount && payment_data[0].refund_amount != 'undefined' ? payment_data[0].refund_amount : '$0.00')
                            }

                            if (patient_details && patient_details.length > 0) {
                                var patient_details = 'Claim Inquiry: ' + patient_details[0].patient_name + ' (Acc#:' + patient_details[0].account_no + ')' + ',  ' + moment(patient_details[0].birth_date).format('L') + ',  ' + patient_details[0].gender;
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
                                self.showInsuranceGrid(data.insurance_details, claimID);
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

            showInsuranceGrid: function (data, claimID) {
                var self = this;

                $('#tblCIInsurance').jqGrid({
                    datatype: 'local',
                    data: data != null ? data : [],
                    colNames: ['', 'code', 'description', 'Subscriber Name', 'DOB', 'Policy No', 'Group No', 'Paper Claim Original', 'Paper Claim Full'],
                    colModel: [
                        { name: 'id', hidden: true },
                        { name: 'insurance_code', search: false },
                        { name: 'insurance_name', search: false },
                        { name: 'name', search: false },
                        { name: 'subscriber_dob', search: false },
                        { name: 'policy_number', search: false },
                        { name: 'group_number', search: false },
                        {
                            name: 'paper_claim_original', search: false,
                            customAction: function (rowID) {
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                return "<input type='button' style='line-height: 1;' class='btn btn-paper-claim-original btn-primary' value='Paper Claim' data-payer-type=" + rowObject.payer_type + " i18n='shared.buttons.paperclaimOrg' id='spnPaperClaim_" + rowObject.id + "'>"
                            }
                        },
                        {
                            name: 'paper_claim_full', search: false,
                            customAction: function (rowID) {
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                return "<input type='button' style='line-height: 1;' class='btn btn-paper-claim-full btn-primary' value='Paper Claim' data-payer-type=" + rowObject.payer_type + " i18n='shared.buttons.paperclaimFull' id='spnPaperClaim_" + rowObject.id + "'>"
                            }
                        }
                    ],
                    cmTemplate: { sortable: false },
                    customizeSort: true,
                    width: $('#claimDetails').width() - 50,
                    shrinkToFit: true,

                    beforeSelectRow: function (rowid, e) {
                        var target = e.target || e.srcElement;
                        var cellIndex = (target).parentNode.cellIndex;
                        var payerType = $(target).attr('data-payer-type');

                        if (target.className.indexOf('btn-paper-claim-original') > -1) {
                            self.showPaperClaim('paper_claim_original', [claimID], rowid, payerType);
                        } else if (target.className.indexOf('btn-paper-claim-full') > -1) {
                            self.showPaperClaim('paper_claim_full', [claimID], rowid, payerType);
                        }
                    },
                });

                $('#gview_tblCIInsurance').find('.ui-jqgrid-bdiv').css('max-height', '130px')
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

            showPatientClaimsGrid: function (claimID, patientId, billingProviderID) {
                var self = this;
                $('#divPatientClaimsGrid').show();
                this.patientClaimsTable = new customGrid();
                this.patientClaimsTable.render({
                    gridelementid: '#tblPatientClaimsGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', 'Claim Number', 'Claim Date', 'Billing Fee', 'Total Adjustment','Total Insurance Payments', 'Total Patient Payments', 'Balance', 'Claim Status', 'Current responsibility'],
                    i18nNames: ['', 'billing.fileInsurance.claimNo', 'billing.claims.claimDate', 'billing.COB.billingFee','billing.fileInsurance.totalAdjustment', 'billing.claims.totalInsurancePayments', 'billing.claims.totalPatientPayments', 'billing.claims.Balance', 'billing.claims.claimStatus', 'billing.claims.currentResponsibility'],
                    colModel: [
                        { name: '', index: 'claim_id', key: true, hidden: true, search: false },
                        {
                            name: 'claim_id', search: false, width: 70
                        },
                        {
                            name: 'claim_dt', search: false, formatter: self.dateFormatter, width: 100
                        },
                        {
                            name: 'billing_fee', search: false, width: 100
                        },
                        {
                            name: 'ajdustments_applied_total', search: false, width: 100
                        },
                        {
                            name: 'total_insurance_payment', search: false, width: 150
                        },
                        {
                            name: 'total_patient_payment', search: false, width: 150
                        },
                        {
                            name: 'claim_balance', search: false, width: 100
                        },
                        {
                            name: 'claim_status', search: false, width: 150
                        },
                        {
                            name: 'payer_name', search: false, width: 250
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
                        patientId: patientId,
                        billProvId: parseInt(billingProviderID)
                    },
                    pager: '#gridPager_PatientClaim',
                    onaftergridbind: self.afterGridBind,
                });


                setTimeout(function () {
                    $("#tblPatientClaimsGrid").setGridWidth($(".modal-body").width()-15);
                    $("#tblPatientClaimsGrid").setGridHeight($(window).height()-600);
                }, 200);
                $('#divAgeSummary').html(self.agingSummaryTemplate());
            },

            showInvoiceGrid: function (claimID, patientId,payer_type) {
                var self = this;
                $('#divInvoiceGrid').show();
                this.invoiceTable = new customGrid();
                this.invoiceTable.render({
                    gridelementid: '#tblInvoiceGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', 'Invoice No', 'Date', 'Total Billing Fee', 'Total Payments', 'Total Adjustment',  'Balance',''],
                    i18nNames: ['', '', 'billing.fileInsurance.invoiceNo', 'billing.claims.Date', 'billing.COB.billingFee','billing.claims.totalPayments', 'billing.fileInsurance.totalAdjustment',  'billing.claims.Balance',''],
                    colModel: [
                        { name: '', index: 'id', key: true, hidden: true, search: false },  
                        { name: 'claim_ids', hidden: true} ,                    
                        {
                            name: 'invoice_no', search: true, width: 100
                        },
                        {
                            name: 'invoice_date', search: true, formatter: self.dateFormatter, width: 150
                        },
                        {
                            name: 'invoice_bill_fee', search: true, width: 150
                        },
                        {
                            name: 'invoice_payment', search: true, width: 150
                        },                       
                        {
                            name: 'invoice_adjustment', search: true, width: 150
                        },
                        {
                            name: 'invoice_balance', search: true, width: 150
                        },
                        {
                            name: 'edit', width: 50, sortable: false, search: false,
                            formatter: function (cellvalue, options, rowObject) {
                                return '<span class="icon-ic-print spnInvoicePrint" title="Print Claim" id="spnInvoicePrint" style="font-size: 20px; cursor:pointer;"></span>'
                            },
                            cellattr: function () {
                                return "style='text-align: center;text-decoration: underline;'";
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblInvoiceGrid').jqGrid('getRowData', rowID);
                                self.printInvoice(gridData.claim_ids);
                            }
                        }

                    ],
                    datastore: self.claimInvoiceList,
                    container: self.el,
                    cmTemplate: { sortable: false },
                    customizeSort: false,
                    sortname: "invoice_no",
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
                        payerType: payer_type
                    },
                    pager: '#gridPager_invoiceClaim',
                    onaftergridbind: self.afterGridBind,
                });


                setTimeout(function () {
                    $("#tblInvoiceGrid").setGridWidth($(".modal-body").width()-15);
                    $("#tblInvoiceGrid").setGridHeight($(window).height()-600);
                }, 200);

                commonjs.initializeScreen({ header: { screen: 'Claim Invoice', ext: 'Claim Invoice' } });
                $('#divIvoiceAgeSummary').html(self.invoiceAgingSummaryTemplate());



                $.ajax({
                    url: "/exa_modules/billing/claims/claim_inquiry/claim_invoice/age",
                    type: 'GET',
                    data: {
                        claimID: claimID,
                        payerType: payer_type
                    },
                    success: function (data, response) {
                        if(data && data.length){
                            $('#tdPtCurrent').text(data[0].current_balance || '$0.00')
                            $('#tdPtAge30').text(data[0].to30 || '$0.00')
                            $('#tdPtAge60').text(data[0].to60 || '$0.00')
                            $('#tdPtAge90').text(data[0].to90 || '$0.00')
                            $('#tdPtAge120').text(data[0].to120 || '$0.00')
                            $('#tdPtAgeTotal').text(data[0].sum || '$0.00') 
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });

                $('.inquiryReload').click(function(){
                    self.showInvoiceGrid.refreshAll();
                });

            },

            printInvoice: function(claimids) {
                claimids =  claimids && claimids.split(',')
                paperClaim.print( 'direct_invoice', claimids );
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
                            name: 'created_dt', search: true, formatter: self.dateFormatter, width: 200
                        },
                        {
                            name: 'screen_name', search: true, width: 200
                        },
                        {
                            name: 'username', search: true, width: 200
                        },
                        {
                            name: 'description', search: true, width: 400
                        }

                    ],
                    datastore: self.claimPatientLogList,
                    container: self.el,
                    cmTemplate: { sortable: false },
                    customizeSort: false,
                    sortname: "audit.id",
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
                    $("#tblPatientClaimsLogGrid").setGridWidth($(".modal-body").width()-15);
                    $("#tblPatientClaimsLogGrid").setGridHeight(($(window).height() - 300));
                }, 200);

                commonjs.initializeScreen({ header: { screen: 'Claim Log', ext: 'Claim log' } });
            },

            dateFormatter: function (cellvalue, options, rowObject) {
                return commonjs.checkNotEmpty(cellvalue) ?
                    commonjs.convertToFacilityTimeZone(rowObject.facility_id, cellvalue).format('L') :
                    '';
            },

            afterGridBind: function (model, gridObj) {
                var self = this;

                    var age_summary = model && model[0] && model[0].get('age_summary');
                    $('#tdInsCurrent').html(age_summary && age_summary.insurance_age_0_30 || '$0.00');
                    $('#tdInsAge30').html(age_summary && age_summary.insurance_age_31_60 || '$0.00');
                    $('#tdInsAge60').html(age_summary && age_summary.insurance_age_61_90 || '$0.00');
                    $('#tdInsAge90').html(age_summary && age_summary.insurance_age_91_120 || '$0.00');
                    $('#tdInsAge120').html(age_summary && age_summary.insurance_age_121 || '$0.00');
                    $('#tdInsAgeTotal').html(age_summary && age_summary.insurance_total || '$0.00');
                    $('#tdPtCurrent').html(age_summary && age_summary.patient_age_0_30 || '$0.00');
                    $('#tdPtAge30').html(age_summary && age_summary.patient_age_31_60 || '$0.00');
                    $('#tdPtAge60').html(age_summary && age_summary.patient_age_61_90 || '$0.00');
                    $('#tdPtAge90').html(age_summary && age_summary.patient_age_91_120 || '$0.00');
                    $('#tdPtAge120').html(age_summary && age_summary.patient_age_121 || '$0.00');
                    $('#tdPtAgeTotal').html(age_summary && age_summary.patient_total || '$0.00');
                    $('#tdCurrent').html(age_summary && age_summary.total_age_30 || '$0.00');
                    $('#tdAge30').html(age_summary && age_summary && age_summary.total_age_31_60 || '$0.00');
                    $('#tdAge60').html(age_summary && age_summary.total_age_61_90 || '$0.00');
                    $('#tdAge90').html(age_summary && age_summary.total_age_91_120 || '$0.00');
                    $('#tdAge120').html(age_summary && age_summary.total_age_121 || '$0.00');
                    $('#tdAgeTotal').html(age_summary && age_summary.total_balance || '$0.00'); 
                    $('#spUnapplied').html(age_summary && age_summary.total_unapplied || '$0.00');

            },

            showClaimCommentsGrid: function () {
                var self = this;
                var commentType = ["payment", "adjustment", "charge", 'refund'];
                var payCmtGrid;
                payCmtGrid = new customGrid();
                payCmtGrid.render({
                    gridelementid: '#tblCIClaimComments',
                    custompager: self.pager,
                    emptyMessage: 'No Records Found',
                    colNames: ['','', 'date', '', 'code', 'payment.id', 'comment', 'Diag Ptr', 'charge', 'payment', 'adjustment', '', '', '', '',''],
                    colModel: [
                        { name: 'id', hidden: true},
                        { name: 'row_id', hidden: true },
                        { name: 'commented_dt', width: 40, search: false, sortable: false, formatter: self.commentDateFormatter },
                        { name: 'code', hidden: true },
                        { name: 'type', width: 40, search: false, sortable: false,
                            cellattr: function (rowId, tv, rowdata) {
                                if(rowdata && rowdata.code == 'manual')
                                    return ' style="display:none;"';
                            } 
                        },
                        {
                            name: 'payment_id', width: 30, search: false, sortable: false,
                            customAction: function (rowID) {
                                var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                $("#tBodyCIPayment").empty();
                                self.getPaymentofCharge(gridData.row_id);
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.type && rowObject.code == 'charge')
                                    return "<i class='icon-ic-raw-transctipt' title='View Pay details of this charge'></i>"
                                else
                                    return rowObject.payment_id;
                            },
                            cellattr: function (rowId, tv, rowdata) {
                                if(rowdata && rowdata.code == 'manual')
                                    return 'style="display:none;" ';
                            }
                        },
                        { name: 'comments', width: 50, search: false, sortable: false,
                            cellattr: function (rowId, tv, rowdata) {
                                if(rowdata && rowdata.code == 'manual')
                                    return ' colspan=8 style="white-space : nowrap ';
                            } 
                        },
                        { name: 'charge_pointer', width: 20, search: false, sortable: false, formatter: self.pointerFormatter,
                            cellattr: function (rowId, tv, rowdata) {
                                if(rowdata && rowdata.code == 'manual')
                                    return 'style="display:none;" ';
                            } 
                        },
                        { name: 'charge_amount', width: 20, search: false, sortable: false,
                            cellattr: function (rowId, tv, rowdata) {
                                if(rowdata && rowdata.code == 'manual')
                                    return 'style="display:none;" ';
                            } 
                        },
                        { name: 'payment', width: 20, search: false, sortable: false, 
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.code && (rowObject.code == 'adjustment' || rowObject.payment == null || rowObject.code == null))
                                    return '';
                                else
                                    return rowObject.payment;
                            },
                            cellattr: function (rowId, tv, rowdata) {
                                if(rowdata && rowdata.code == 'manual')
                                    return 'style="display:none;" ';
                            }  
                        },
                        { name: 'adjustment', width: 30, search: false, sortable: false,
                            formatter: function(cellvalue, options, rowObject){
                                if(rowObject.adjustment && rowObject.adjustment == '$0.00' || rowObject.adjustment == null)
                                    return '';
                                else 
                                    return rowObject.adjustment
                            },
                            cellattr: function (rowId, tv, rowdata) {
                                if(rowdata && rowdata.code == 'manual')
                                    return 'style="display:none;" ';
                            }  
                        },
                        {
                            name: 'view_payment', width: 20, sortable: false, search: false,
                            customAction: function (rowID) {
                                var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                $("#tBodyCIPayment").empty();
                                self.getDetailsOfPay(gridData.payment_id, gridData.row_id); //row_id = pay_application id
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.type && rowObject.code == 'payment')
                                    return "<i class='fa fa-eye' title='view payment details'></i>"
                                else
                                    return "";
                            },
                            cellattr: function (rowId, tv, rowdata) {
                                if(rowdata && rowdata.code == 'manual')
                                    return 'style="display:none;" ';
                            } 
                        },
                        {name: 'comment_space', width: 10, search: false, sortable: false },
                        {
                            name: 'del', width: 20, search: false, sortable: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure that you want to delete?")) {
                                    var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                    self.deleteClaimComment(gridData.row_id);
                                }
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.code && commentType.indexOf(rowObject.code) == -1)
                                    return "<i class='icon-ic-delete' title='Delete'></i>"
                                else
                                    return "";
                            }
                        },
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            customAction: function (rowID) {
                                var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                self.getClaimComment(gridData.row_id);
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.code && rowObject.code != null && commentType.indexOf(rowObject.code) == -1)
                                    return "<i class='icon-ic-edit' title='Edit'></i>"
                                else
                                    return "";
                            }
                        },
                        {
                            name: 'is_internal', width: 20, sortable: false, search: false, hidden: false,
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.code && rowObject.code != null && commentType.indexOf(rowObject.code) == -1) {
                                    if (rowObject.is_internal == true)
                                        return '<input type="checkbox" checked   class="chkPaymentReport" name="paymentReportChk"  id="' + rowObject.row_id + '" />'
                                    else
                                        return '<input type="checkbox"   class="chkPaymentReport" name="paymentReportChk"  id="' + rowObject.row_id + '" />'

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
                commonjs.showNestedDialog({
                    header: 'Add Comment',
                    width: '50%',
                    height: '20%',
                    html: $('#divCIFormComment').html()
                });
                if (from == 'edit') {
                    $('#siteModalNested').find('#txtCIAddComment').val(comment);
                }
                else {
                    commentId = 0;
                }
                $('#siteModalNested').find('#btnCICommentSave').off().click(function () {
                    var comment = $('#siteModalNested').find('#txtCIAddComment').val();
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
                $('#siteModalNested').find('#btnCICommentSave').prop('disabled', true)
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
                            $('#siteModalNested').find('#btnCICommentSave').prop('disabled', false)
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
                            $('#siteModalNested').find('#btnCICommentSave').prop('disabled', false)
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

            patientInquiryForm: function (claimId, patientId, patientName) {
                var self = this;
                commonjs.showDialog({
                    'header': 'Patient Claims',
                    'width': '85%',
                    'height': '75%',
                    'needShrink': true
                });
                setTimeout(function () {
                    var billingProviderList = app.billing_providers,reportBy
                        ddlBillingProvider = $('#ddlBillingProvider');
                    ddlBillingProvider.empty();
                    ddlBillingProvider.append("<option value='0'>Select</option>")
                    if (billingProviderList && billingProviderList.length > 0) {
                        for (var b = 0; b < billingProviderList.length; b++) {
                            ddlBillingProvider.append($('<option/>', {
                                value: billingProviderList[b].id,
                                text: billingProviderList[b].full_name
                            }));
                        }
                    }
                }, 300);


                this.$el.html(this.claimPatientTemplate());
                 var headerName = 'Patient Claims: ' + patientName ;
                 $(parent.document).find('#spanModalHeader').html(headerName)
                this.fromDate =  commonjs.bindDateTimePicker("divFDate", { format: 'L' }); 
                this.fromDate.date(); 
                this.toDate =  commonjs.bindDateTimePicker("divTDate", { format: 'L' }); 
                this.toDate.date(); 
                $('#radActivityAllStatus').prop('checked', true);
                $('#activityDetails').hide();
                if(this.screenCode.indexOf('PACT') > -1)
                    $('#btnPatientActivity').attr('disabled', true); // if Patient Activity report have rights then only can access this report
                self.showPatientClaimsGrid(claimId, patientId, 0);

                $('#ddlBillingProvider').on().change(function () {
                    self.changePatientIngrid(claimId, patientId);
                });

                $('#paymentSearch').off().click(function () {
                    self.showUnAppliedPayments(patientId);
                })

                $('#btnPatientActivity').on().click(function () {

                    if ($('#txtDate').val() > $('#txtOtherDate').val()) {
                        commonjs.showWarning('From date is greater than To Date');
                        return
                    }

                    if ($('#radActivityAllStatus').prop("checked")){
                        reportBy = true;
                    }
                    else{
                        if ( $('#txtOtherDate').val() < moment(moment().format('MM/DD/YYYY'))) {
                            commonjs.showWarning('To date is Future');
                            return
                        }
                        
                        if ( $('#txtDate').val() < moment(moment().format('MM/DD/YYYY'))) {
                            commonjs.showWarning('From date is Future');
                            return
                        }
                        if ($('#radioActivityStatus').prop("checked")) {
                            if ($('#txtDate').val() == '') {
                                commonjs.showWarning('Please select From Date');
                                return
                            }
                            if ($('#txtOtherDate').val() == '') {
                                commonjs.showWarning('Please select To Date');
                                return
                            }
    
                            if ( ( $('#txtOtherDate').val() == '') || $('#txtOtherDate').val() == '') {
                                commonjs.showWarning('Please select date');
                                return
                            }
    
                        }
                        
                        reportBy = false;
                        fromDate = $('#txtDate').val();
                        toDate = $('#txtOtherDate').val();
                    }

               
                    var billing_pro = [], selectedBillingProList, allBillingProvider;
                    selectedBillingProList = $('#ddlBillingProvider option:selected').val() ? [$('#ddlBillingProvider option:selected').val()] : [];

                    reportBy  ? self.generatePatientActivity(claimId, patientId, reportBy,null,null, selectedBillingProList) : self.generatePatientActivity(claimId, patientId, reportBy, fromDate, toDate, selectedBillingProList)
                    $('#modal_div_container').removeAttr('style');
                });
            },

            patientInquiryLog: function (claimId, patientId) {
                var self = this;
                this.$el.html(this.claimPatientLogTemplate());
                self.showPatientClaimsLogGrid(claimId, patientId);
            },

            invoiceInquiry: function (claimId, patientId, payer_type) {
                var self = this;
                this.$el.html(this.claimInvoiceTemplate());
                self.showInvoiceGrid(claimId, patientId, payer_type);

            },

            printPaymentInvoice: function (e) {
                var self = this;
                self.paymentInvoice = new paymentInvoice({ el: $('#modal_div_container') });
                self.paymentInvoice.onReportViewClick(e);
            },

            closeSaveComment: function () {
                commonjs.hideNestedDialog();
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
                        $("#tBodyCIPayment").empty();

                        if (data.length > 0) {

                            var paymentCASRow = self.paymentTemplate({ rows: data });
                            $('#tBodyCIPayment').append(paymentCASRow);

                            commonjs.showNestedDialog({
                                header: 'Payment of Charge Details',
                                width: '80%',
                                height: '30%',
                                html: $('#divCIpaymentDetails').html()
                            });

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

            getDetailsOfPay: function (pay_id, application_id) {
                var self = this;

                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/payment_details',
                    type: 'GET',
                    data: {
                        'claim_id': self.claim_id,
                        'payment_id': pay_id,
                        'pay_application_id': application_id
                    },
                    success: function (data, response) {
                        $("#tBodyCIPayment").empty();

                        if (data.length > 0) {

                            var paymentCASRow = self.paymentTemplate({ rows: data });
                            $('#tBodyCIPayment').append(paymentCASRow);

                            commonjs.showNestedDialog({
                                header: 'Payment Details',
                                width: '80%',
                                height: '30%',
                                html: $('#divCIpaymentDetails').html()
                            });
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

            generatePatientActivity: function (patientIds, claimIds, reportBy, fromDate, toDate, selectedBillingProList, e) {
                var self = this;
                self.patientActivityStatement = new patientActivityStatement({
                    el: $('#reportFrame')
                });
                var claimInfo = {
                    'claimID': patientIds,
                    flag: "patient-activity-statement",
                    'patientId': claimIds,
                     reportByFlag: reportBy ,
                    'fromDate': fromDate || '',
                    'toDate': toDate || '',
                    'billingProId': selectedBillingProList || []
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
            },

            showActivityStatus: function () {
                if ($('#radioActivityStatus').is(':visible'))
                    $('#activityDetails').show();
            },

            showAllActivity: function () {
                if ($('#radActivityAllStatus').is(':visible'))
                    $('#activityDetails').hide();
                $('input[type=date]').val('');
            },

            showPaperClaim: function (format, claimId, insuranceProviderId, payerType) {
                paperClaim.print(format, claimId, {
                    payerType: payerType,
                    payerId: insuranceProviderId
                });
            },

            changePatientIngrid: function(claimID, patientID) {
                var self = this;
                var selectedProv = $("#ddlBillingProvider option:selected").val() ? $("#ddlBillingProvider option:selected").val(): 0;

                self.showPatientClaimsGrid(claimID, patientID, selectedProv);
            },

            showUnAppliedPayments: function(patientID) {
                var self = this;
                self.unappliedPaymentView = new unappliedPaymentView({el: $('#modal_div_container_nested')}); 
                self.unappliedPaymentView.render(patientID);
            }
    });
});