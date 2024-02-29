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
    // 'text!templates/faxDialog.html',
    'collections/claim-patient-log',
    'views/app/unapplied-payment',
    'text!templates/claims/claim-inquiry-cas.html',
    'shared/report-utils',
    'text!templates/claims/claim-inquiry-cas-header.html',
    'views/reports/patient-statement',
    'shared/claim-alerts'
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
    // faxDialogHtml,
    claimPatientLogList,
    unappliedPaymentView,
    casTemplate,
    UI,
    claimEnquiryCasHeader,
    PatientStatementView,
    claimAlertsView
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
            casTemplate: _.template(casTemplate),
            payCmtGrid: '',
            casHeaderTemplate: _.template(claimEnquiryCasHeader),
            claim_id: null,
            mailTo: '',
            rights: null,
            patientClaims: {
                header: null,
            },
            events: {
            },
            isCleared: false,
            initialize: function (options) {
                this.options = options;
                this.invoicePager = new Pager();
                this.claimsPager = new Pager();
                this.claimInquiryPager = new Pager();
                this.claimCommentsList = new claimCommentsList();
                this.claimPatientList = new claimPatientList();
                this.claimInvoiceList = new claimInvoiceList();
                this.claimPatientLogList = new claimPatientLogList();
                if(app.userInfo.user_type != 'SU'){
                    this.rights = (window.appRights).init();
                    this.screenID = this.rights.screenID;
                    this.screenCode = this.rights.screenCode;
                }
                else {
                    this.screenCode = [];
                }
            },

            render: function (options) {

                this.rendered = true;
                this.options = options || {};
                this.editOff = options.editOff === "true";
                var claimId = this.options.claim_id
                var isFromClaimScreen = this.options.source && this.options.source === 'claims'

                $(this.el).html(this.inquiryTemplate({
                    country_alpha_3_code: app.country_alpha_3_code,
                    province_alpha_2_code: app.province_alpha_2_code,
                    billingRegionCode: app.billingRegionCode
                }));
                if (this.options.source !== 'web')
                    commonjs.showDialog({
                        header: 'Claim Inquiry',
                        i18nHeader: 'billing.fileInsurance.claimInquiry',
                        width: '90%',
                        height: '85%',
                        html: this.inquiryTemplate({
                            country_alpha_3_code: app.country_alpha_3_code,
                            province_alpha_2_code: app.province_alpha_2_code,
                            billingRegionCode: app.billingRegionCode
                        })
                    });
                else
                    $('.navbar').remove();

                if (this.editOff) {
                    $('#btnCISaveIsInternal,#txtCIFollowUpDate,#txtCIBillingComment,#btnCIAddComment').prop('disabled', true);
                }

                if (this.screenID && this.screenID.indexOf('anc_patient_claim_inquiry') !== -1) {
                    $('#btnPatientClaims').hide();
                }

                this.bindEvents();
                this.followDate =  commonjs.bindDateTimePicker("divFollowUpDate", {
                    format: 'L',
                    widgetPositioning: {
                        vertical: "bottom"
                    },
                    minDate: moment().startOf('day')
                });
                this.followDate.date();
                this.claimInquiryDetails(claimId, false, isFromClaimScreen);
                $('#modal_div_container').removeAttr('style');
                commonjs.isMaskValidate();
            },

            bindEvents: function () {
                var self = this;

                $('#btnCIAddComment').off().click(function () {
                    self.showCommentPopup();
                });

                $('#btnCISaveIsInternal').off().click(function () {
                    self.saveIsInternalComment();
                });

                $('#btnCISaveNotes').off().click(function () {
                    self.updateNotes();
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

            claimInquiryDetails: function (claimID, fromTogglePreNext, isFromClaimScreen) {
                var self = this;
                self.claim_id = claimID;

                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry',
                    type: 'GET',
                    data: {
                        'claim_id': self.claim_id
                    },
                    success: function (data) {

                        if (!isFromClaimScreen) {
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
                                $('#claimInquiryOrderNumber').text(claim_data.order_no)
                                $('#lblCIBillProv').text(claim_data.billing_provider_name)
                                $('#lblCIReadPhy').text(claim_data.rend_provider_name);
                                $('#lblCIRefPhy').text(claim_data.ref_provider_name);
                                if(app.settings.enableMobileRad && app.isMobileBillingEnabled) {
                                    $('#divOrderingFacility').show();
                                    $('#lblCIOrdFacility').text(claim_data.ordering_facility_name);
                                }
                                $('#lblCIOrdFac').text((app.isMobileBillingEnabled && app.settings.enableMobileRad) ? claim_data.service_location : claim_data.ordering_facility_name);
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

                            $('#btnPatientClaims').off().click(function () {
                                self.patientInquiryForm(self.claim_id, patient_details[0].patient_id, patient_details[0].patient_name, self.options.grid_id, true, true);
                            });

                            self.options.patient_id = patient_details[0].patient_id;

                            if (patient_details && patient_details.length > 0) {
                                var patientHeaderInfo = commonjs.geti18NString('shared.screens.setup.claimInquiry') + ':' + patient_details[0].patient_name + ' (Acc#:' + patient_details[0].account_no + ')' + ',  '+ ' (Claim#:' + self.claim_id + ')' + ',  '+ moment(patient_details[0].birth_date).format('L') + ',  ' + patient_details[0].gender;
                                $(parent.document).find('#spanModalHeader').html(patientHeaderInfo);
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
                            if (self.options.source === 'web') {
                                $('#divClaimInqiry').height($('#modalBody').height() - ($('.modal-header').height() + $('.modal-footer').height() + 40));
                            } else {
                                $('#divClaimInquiry').height(isFromClaimScreen ? $(window).height() - 220 : $(window).height() - 260);
                            }
                            self.clearFaxInfo();
                            self.disableElementsForProvince(claim_data);
                            var claimInquiryAlerts = claim_data.claim_comments || null;

                            if (claimInquiryAlerts) {
                                claimAlertsView.showClaimAlerts(claimInquiryAlerts);
                            }
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });

                $('#btnCIPrintInvoice').off().click(function () {
                    self.generatePrintInvoice(self.claim_id);
                });

                $('#btnPatientStatement').off().on('click', function(e) {
                    self.mailTo = 'select';
                    self.printStatement(e, self.claim_id, [self.options.patient_id]);
                });

                $('.printStatement').off().on('click', function(e) {
                    self.mailTo = $(e.target).attr('data-method');
                    self.printStatement(e, self.claim_id, [self.options.patient_id]);
                });

            },

            disableElementsForProvince: function(data) {
                var saveBtn = $('#btnCISaveIsInternal');
                var saveNotesBtn = $('#btnCISaveNotes');

                if ((app.billingRegionCode === 'can_MB' && data.claim_status_code === 'P77') || (app.billingRegionCode === 'can_BC' && data.claim_status_code === 'OH'))  {
                    saveNotesBtn.show();
                    saveBtn.hide();
                } else {
                    saveBtn.show();
                    saveNotesBtn.hide();
                }
            },

            getSubscriberDOBFormat: function ( cellvalue, options, rowObject ) {
                return commonjs.checkNotEmpty(rowObject.subscriber_dob)
                    ? moment(rowObject.subscriber_dob).format('L')
                    : '';
            },

            showInsuranceGrid: function (data) {
                var self = this;
                var colNames = ['', 'code', 'description', 'Subscriber Name', 'DOB', 'Policy No', 'Group No'];
                var i18nNames = ['', 'billing.COB.code', 'billing.COB.description', 'billing.claims.subscriberName', 'billing.COB.DOB', 'shared.fields.policyNumber', 'patient.patientInsurance.groupNo'];
                var colModel = [
                    { name: 'id', hidden: true },
                    { name: 'insurance_code', search: false },
                    { name: 'insurance_name', search: false },
                    { name: 'name', search: false },
                    { name: 'subscriber_dob', search: false, formatter: self.getSubscriberDOBFormat },
                    { name: 'policy_number', search: false },
                    { name: 'group_number', search: false }
                ];

                if (app.billingRegionCode !== "can_ON") {
                    colNames.push('Paper Claim Original', 'Paper Claim Full', 'Special Form');
                    i18nNames.push('billing.COB.paperClaimOriginal', 'billing.COB.paperClaimFull', 'billing.COB.specialForm');
                    colModel.push({
                        name: 'paper_claim_original', search: false,
                        customAction: function () {
                        },
                        formatter: function (cellvalue, options, rowObject) {
                            return "<input type='button' style='line-height: 1;' class='btn btn-paper-claim-original btn-primary' value='Paper Claim' data-payer-type=" + rowObject.payer_type + " i18n='shared.buttons.paperclaimOrg' id='spnPaperClaim_" + rowObject.id + "'>"
                        }
                    },
                    {
                        name: 'paper_claim_full', search: false, width: '200px',
                        customAction: function () {
                        },
                        formatter: function (cellvalue, options, rowObject) {
                            return "<input type='button' style='line-height: 1;' class='btn btn-paper-claim-fax btn-primary' value='Paper Claim' data-payer-type=" + rowObject.payer_type + " i18n='shared.buttons.fax' id='spnPaperClaim_" + rowObject.id + "'>" +
                                "<input type='button' style='line-height: 1;' class='btn btn-paper-claim-full btn-primary ml-2' value='Paper Claim' data-payer-type=" + rowObject.payer_type + " i18n='shared.buttons.paperclaimFull' id='spnPaperClaim_" + rowObject.id + "'>";
                        }
                    },
                    {
                        name: 'special_form', search: false,
                        customAction: function () {
                        },
                        formatter: function (cellvalue, options, rowObject) {
                            return "<input type='button' style='line-height: 1;' class='btn btn-special_form btn-primary' value='Special Form' data-payer-type=" + rowObject.payer_type + " i18n='shared.buttons.specialForm' id='spnSpecialForm_" + rowObject.id + "'>"
                        }
                    });
                }

                $('#tblCIInsurance').jqGrid({
                    datatype: 'local',
                    data: data != null ? data : [],
                    colNames: colNames,
                    i18nNames: i18nNames,
                    colModel: colModel,
                    cmTemplate: { sortable: false },
                    customizeSort: true,
                    width: $('#claimDetails').width() - 50,
                    shrinkToFit: true,

                    beforeSelectRow: function (rowid, e) {
                        var target = e.target || e.srcElement;
                        var payerType = $(target).attr('data-payer-type');

                        if (target.className.indexOf('btn-paper-claim-original') > -1) {
                            self.showPaperClaim('paper_claim_original', [self.claim_id], rowid, payerType);
                        } else if (target.className.indexOf('btn-paper-claim-full') > -1) {
                            self.showPaperClaim('paper_claim_full', [self.claim_id], rowid, payerType);
                        } else if (target.className.indexOf('btn-special_form') > -1){
                            self.showPaperClaim('special_form', [self.claim_id], rowid, payerType);
                        }
                        else if (target.className.indexOf('btn-paper-claim-fax') > -1) {
                            $('#divFaxReceipientPaperClaim').show();
                            var faxClaimId = self.claim_id;
                            var faxInsuranceId = rowid;
                            var faxPayerType = payerType;

                            var faxUrl = [
                                'claimIds=' + faxClaimId,
                                'payerId=' + faxInsuranceId,
                                'payerType=' + faxPayerType,
                                'userId=' + app.userID,
                                'templateType=paper_claim_full'
                            ];
                            faxUrl = '/exa_modules/billing/claim_workbench/paper_claim_fax?' + faxUrl.join('&');

                            $('#btnClaimFaxSend').off().click(function () {
                                var faxReceiverName = $('#txtFaxReceiverName').val();
                                var faxReceiverNumber = $('#txtFaxReceiverNumber').val();

                                if (!commonjs.checkNotEmpty(faxReceiverName))
                                    return commonjs.showWarning(commonjs.geti18NString("messages.status.faxReceiverName"));

                                if (!commonjs.checkNotEmpty(faxReceiverNumber))
                                    return commonjs.showWarning(commonjs.geti18NString("messages.status.faxNumberInvalid"));

                                // Getting Study id for selected claim
                                commonjs.getClaimStudy(faxClaimId, function (result) {

                                    self.faxReport({
                                        claimID: faxClaimId,
                                        study_id: result && result.study_id || 0,
                                        order_id: result && result.order_id || 0,
                                        patientId: self.options.patient_id,
                                        documentName: 'Other Report',
                                        faxReceiverNumber: faxReceiverNumber,
                                        faxReceiverName: faxReceiverName
                                    }, faxUrl, function () {
                                        commonjs.showStatus("messages.status.faxQueued");
                                        self.saveClaimComment(0, 'Paper claim (B&W) fax sent to ' + faxReceiverName + ' (' + faxReceiverNumber + ')', 'auto');
                                        self.clearFaxInfo();
                                    });
                                });
                            });

                            $('#btnClaimFaxCancel').off().click(function () {
                                self.clearFaxInfo();
                            });
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
                    i18nNames: ['', 'billing.COB.code', 'billing.COB.description'],
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

            showPatientClaimsGrid: function (claimID, patientId, billingProviderID, isNested) {
                var self = this;
                self.patientId = patientId;
                self.billProvId = parseInt(billingProviderID);
                self.claimID = claimID;
                $('#divPatientClaimsGrid').show();
                var container = isNested ? $('#modal_div_container_nested') : self.el;
                this.patientClaimsTable = new customGrid();
                this.patientClaimsTable.render({
                    gridelementid: '#tblPatientClaimsGrid',
                    custompager: this.claimsPager,
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', 'Claim Number', 'Study Date', 'Billing Fee', 'Total Adjustment', 'Total Insurance Payments', 'Total Patient Payments', 'Balance', 'Claim Status', 'Current responsibility'],
                    i18nNames: ['', '', '', 'billing.fileInsurance.claimNo', 'billing.claims.studyDate', 'billing.COB.billingFee', 'billing.fileInsurance.totalAdjustment', 'billing.claims.totalInsurancePayments', 'billing.claims.totalPatientPayments', 'billing.claims.Balance', 'billing.claims.claimStatus', 'billing.claims.currentResponsibility'],
                    colModel: [
                        { name: '', index: 'claim_id', key: true, hidden: true, search: false },
                        { name: 'billing_provider_id', hidden: true, search: false },
                        {
                            name: 'chk_claims',
                            width: 20,
                            sortable: false,
                            resizable: false,
                            search: false,
                            isIconCol: true,
                            formatter: function (cellvalue, option, rowObject) {
                                return '<input type="checkbox" name="chkClaims" id="chkClaims_' + rowObject.claim_id + '" />';
                            }
                        },
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
                            name: 'adjustments_applied_total', search: false, width: 100
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
                    container: container,
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
                        patientId: self.patientId,
                        billProvId: parseInt(billingProviderID)
                    },
                    pager: '#gridPager_PatientClaim',
                    onaftergridbind: self.afterGridBind,
                    beforeSelectRow: function (rowID, e) {
                        var rowObj = $(e.currentTarget).find('#' + rowID);
                        $('#chkClaims' + '_' + rowID).prop('checked', rowObj.hasClass('customRowSelect'));
                    },
                    setCustomData: function (){
                        return {
                            claimID: self.claimID,
                            patientId: self.patientId,
                            billProvId: self.billProvId
                        }
                    }
                });


                setTimeout(function () {
                    var modalWidth = isNested ? $('#modalBodyNested').width() : $('.modal-body').width();
                    $("#tblPatientClaimsGrid").setGridWidth(modalWidth - 15);
                    $("#tblPatientClaimsGrid").setGridHeight($(window).height() - 600);
                }, 200);
                $('#divAgeSummary').html(self.agingSummaryTemplate());
            },

            //Bind date range filter
            bindDateRangeOnSearchBox: function (gridObj) {
                var self = this;
                var columnsToBind = ['invoice_date'];
                var drpOptions = {
                    locale: {
                        format: "L"
                    }
                };
                var currentFilter = 1;

                _.each(columnsToBind, function (col) {
                    var colSelector = '#gs_' + col;
                    var colElement = $(colSelector);

                    if (!colElement.val() && !self.isCleared) {
                        var toDate = moment(),
                            fromDate = moment().subtract(29, 'days');
                        colElement.val(fromDate.format("L") + " - " + toDate.format("L"));
                    }

                    commonjs.bindDateRangePicker(colElement, drpOptions, "past", function (start, end) {
                        if (start && end) {
                            currentFilter.startDate = start.format('L');
                            currentFilter.endDate = end.format('L');
                            $('input[name=daterangepicker_start]').removeAttr("disabled");
                            $('input[name=daterangepicker_end]').removeAttr("disabled");
                            $('.ranges ul li').each(function (i) {
                                if ($(this).hasClass('active')) {
                                    currentFilter.rangeIndex = i;
                                }
                            });
                        }
                    });
                    colElement.on("apply.daterangepicker", function () {
                        gridObj.refresh();
                    });
                    colElement.on("cancel.daterangepicker", function () {
                        self.isCleared = true;
                        gridObj.refresh();
                    });
                });
            },

            updateNotes: function () {
                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/notes/' + this.claim_id,
                    type: 'PUT',
                    data: {
                        billingNotes: $.trim($('#txtCIBillingComment').val())
                    },
                    success: function (response) {
                        if (response && response.length) {
                            commonjs.showStatus("messages.status.successfullyCompleted");
                            $('#btnSaveClaimNotes').prop('disabled', false);
                            $('.claimProcess').prop('disabled', false);
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            showInvoiceGrid: function (claimID, patientId, payer_type) {
                var self = this;
                $('#divInvoiceGrid').show();
                var balanceSearchList = ':All; =0:= 0; >0:> 0; <0:< 0; !=0:!= 0';
                $('#divInvoiceGrid').show()
                this.invoiceTable = new customGrid();
                this.invoiceTable.render({
                    gridelementid: '#tblInvoiceGrid',
                    custompager: self.invoicePager,
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', 'Invoice No', 'Date', 'Total Billing Fee', 'Total Payments', 'Total Adjustment',  'Balance', ''],
                    i18nNames: ['', '', 'billing.fileInsurance.invoiceNo', 'billing.claims.Date', 'billing.COB.billingFee', 'billing.claims.totalPayments', 'billing.fileInsurance.totalAdjustment',  'billing.claims.Balance', ''],
                    colModel: [
                        { name: '', index: 'id', key: true, hidden: true, search: false },
                        { name: 'claim_ids', hidden: true},
                        { name: 'invoice_no', search: true, width: 100},
                        {
                            name: 'invoice_date', width: 200, searchFlag: 'date', formatter: function (cellvalue, options, rowObject) {
                                return (commonjs.checkNotEmpty(rowObject.invoice_date) ? moment(rowObject.invoice_date).format('L') : '');
                            }
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
                            name: 'invoice_balance'
                            , sortable: false
                            , width: 150
                            , stype: "select"
                            , searchoptions: {
                                "value": balanceSearchList,
                                "tempvalue": balanceSearchList
                            }
                        },
                        {
                            name: 'edit', width: 50, sortable: false, search: false,
                            formatter: function () {
                                return '<span class="icon-ic-print spnInvoicePrint" title="Print Claim" id="spnInvoicePrint" style="font-size: 15px; cursor:pointer;"></span>'
                            },
                            cellattr: function () {
                                return "style='text-align: center;text-decoration: underline;'";
                            },
                            customAction: function (rowID) {
                                var invoiceData = $('#tblInvoiceGrid').jqGrid('getRowData', rowID);
                                self.printInvoice(invoiceData);
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
                        payerType: payer_type,
                        toDate: !self.isCleared ? moment().format('YYYY-MM-DD') : "",
                        fromDate: !self.isCleared ? moment().subtract(29, 'days').format('YYYY-MM-DD') : ""
                    },
                    pager: '#gridPager_invoiceClaim',
                    onaftergridbind: function (model, gridObj) {
                        self.setMoneyMask();
                        self.bindDateRangeOnSearchBox(gridObj);
                    }
                });


                setTimeout(function () {
                    $("#tblInvoiceGrid").setGridWidth($(".modal-body").width()-15);
                    $("#tblInvoiceGrid").setGridHeight($(window).height()-600);
                }, 200);

                commonjs.initializeScreen({ header: { screen: 'Claim Invoice', ext: 'Claim Invoice' } });
                $('#divIvoiceAgeSummary').html(self.invoiceAgingSummaryTemplate());

                if(this.screenCode.indexOf('IAST') > -1) {
                    $('#btnPrint').attr('disabled', true);
                }

                $.ajax({
                    url: "/exa_modules/billing/claims/claim_inquiry/claim_invoice/age",
                    type: 'GET',
                    data: {
                        claimID: claimID,
                        payerType: payer_type
                    },
                    success: function (data) {
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

                $('.inquiryReload').off().click(_.debounce(function (){
                    self.invoicePager.set({ "PageNo": 1 });
                    self.invoiceTable.refreshAll();
                }));

                $('.inquiryActivity').off().click(_.debounce(function (){
                  if(self.claimInvoiceList && self.claimInvoiceList.length){
                    self.invoiceActivityStatement(claimID, payer_type);
                  } else {
                      commonjs.showWarning('messages.status.noRecordFound')
                  }
                }));

            },

            printInvoice: function(invoiceData) {
                var claimids =  invoiceData.claim_ids.split(',');
                var options = {
                    invoice_no: invoiceData.invoice_no
                }

                paperClaim.print( 'direct_invoice', claimids, true, options);
            },

            showPatientClaimsLogGrid: function (claimID, patientId) {
                var self = this;
                $('#divPatientClaimsLogGrid').show();
                this.patientClaimsLogTable = new customGrid();
                this.patientClaimsLogTable.render({
                    gridelementid: '#tblPatientClaimsLogGrid',
                    custompager: new Pager(),
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', 'Logged date', 'Screen', 'User', 'Log Description'],
                    i18nNames: ['', 'setup.log.logDt', 'setup.common.screen', 'setup.billingProvider.Username', 'setup.log.logDescription'],
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
                    sortname: "created_dt",
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

            afterGridBind: function (model) {
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
                    custompager: self.claimInquiryPager,
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', 'Transaction date', 'Claim Date', 'code', 'comment', 'sequence_number', 'type', 'charge', 'payment', 'adjustment', 'Diag Ptr', 'payment.id', ''],
                    i18nNames: ['', '', '', '', 'billing.payments.printOnStatements', 'billing.claims.transactionDate', 'billing.claims.claimDate', 'billing.COB.code', 'billing.payments.comment', 'shared.fields.sequenceNumbers', 'shared.fields.type',
                        'billing.payments.charge', 'billing.payments.payments', 'billing.fileInsurance.adjustments', 'billing.COB.diagptr', 'billing.payments.paymentID', ''
                    ],
                    colModel: [
                        { name: 'id', hidden: true},
                        { name: 'row_id', hidden: true },
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            customAction: function (rowID) {
                                var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                self.getClaimComment(gridData.row_id);
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.code && rowObject.code != null && commentType.indexOf(rowObject.code) == -1 && !self.editOff)
                                    return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"
                                return "";
                            }
                        },
                        {
                            name: 'del', width: 20, search: false, sortable: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm(commonjs.geti18NString("messages.status.areYouSureWantToDelete"))) {
                                    var gridData = $('#tblCIClaimComments').jqGrid('getRowData', rowID);
                                    self.deleteClaimComment(gridData.row_id);
                                }
                            },
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.code && commentType.indexOf(rowObject.code) == -1 && !self.editOff)
                                    return "<i class='icon-ic-delete' i18nt='shared.buttons.delete'></i>"
                                return "";
                            }
                        },
                        {
                            name: 'is_internal', width: 40, sortable: false, search: false, hidden: false,
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.code && rowObject.code != null && commentType.indexOf(rowObject.code) == -1) {
                                    if (rowObject.is_internal == true)
                                        return '<input type="checkbox" checked   class="chkPaymentReport" name="paymentReportChk"  id="' + rowObject.row_id + '" />'
                                    return '<input type="checkbox"   class="chkPaymentReport" name="paymentReportChk"  id="' + rowObject.row_id + '" />'

                                }
                                return '';
                            },
                            customAction: function () {
                            }
                        },
                        { name: 'commented_dt', width: 40, search: false, sortable: false, formatter: self.commentDateFormatter },
                        { name: 'created_dt', width: 40, search: false, sortable: false, formatter: self.dateFormatter },
                        { name: 'code', hidden: true },
                        { name: 'comments', width: 50, search: false, sortable: false,
                            cellattr: function (rowId, tv, rowdata) {
                                if (rowdata && rowdata.code == 'manual')
                                    return ' colspan=8 title="' + rowdata.comments + '" style="white-space : nowrap ';
                                return 'title="' + rowdata.comments + '"';
                            }
                        },
                        {
                            name: 'sequence_number', width: 40, search: false, sortable: false, hidden: app.billingRegionCode !== 'can_BC',
                            cellattr: function (rowId, tv, rowdata) {
                                if (rowdata && rowdata.code === 'manual') {
                                    return 'style="display:none;" ';
                                }
                            }
                        },
                        { name: 'type', width: 40, search: false, sortable: false,
                            cellattr: function (rowId, tv, rowdata) {
                                if(rowdata && rowdata.code == 'manual')
                                    return ' style="display:none;"';
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
                                return rowObject.adjustment
                            },
                            cellattr: function (rowId, tv, rowdata) {
                                if(rowdata && rowdata.code == 'manual')
                                    return 'style="display:none;" ';
                            }
                        },
                        { name: 'charge_pointer', width: 20, search: false, sortable: false, formatter: self.pointerFormatter,
                            cellattr: function (rowId, tv, rowdata) {
                                if (rowdata && rowdata.code == 'manual')
                                    return 'style="display:none;" ';
                            },
                            hidden: !!((app.country_alpha_3_code === "can" && app.province_alpha_2_code !== 'ON' ))
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
                                return "<i class='icon-ic-raw-transctipt' i18nt='shared.screens.setup.viewPayDetailsOfThisCharge'></i>"
                                return rowObject.payment_id;
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
                                    return "<i class='fa fa-eye' i18nt='shared.screens.setup.viewPaymentDetails'></i>"
                                return "";
                            },
                            cellattr: function (rowId, tv, rowdata) {
                                if(rowdata && rowdata.code == 'manual')
                                    return 'style="display:none;" ';
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
                    customizeSort: true,
                    sortable: false,
                    customargs: {
                        claim_id: self.claim_id
                    }
                })
                $('#gview_tblCIClaimComments').find('.ui-jqgrid-bdiv').css('max-height', '180px')
                $('#siteModal').css('overflow-y', 'scroll');
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
                    success: function (data) {
                        data = data[0];
                        if (data) {
                            self.previousFollowUpDate = (commonjs.checkNotEmpty(data.followup_date)) ? moment(data.followup_date).format('L') : '';
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

            showCommentPopup: function (from, comment, commentId, alertScreens) {
                var self = this;
                commonjs.showNestedDialog({
                    header: 'Add Comment',
                    i18nHeader: 'shared.screens.setup.addComment',
                    width: '50%',
                    height: '20%',
                    html: $('#divCIFormComment').html()
                });

                var $nestedModel = $('#siteModalNested');
                var $addComment = $nestedModel.find('#txtCIAddComment');

                if (from == 'edit') {
                    $addComment.val(comment);
                    alertScreens && alertScreens.forEach(function (alertScreen) {
                        $nestedModel.find('#chkalertScreens input[value=' + alertScreen + ']').prop('checked', true);
                    });
                } else {
                    commentId = 0;
                }

                $nestedModel.find('#btnCICommentSave').off().click(_.debounce(function () {
                    var comment = $addComment.val();

                    if (comment) {
                        self.saveClaimComment(commentId, comment);
                    } else {
                        commonjs.showWarning("messages.warning.claims.missingCommentValidation");
                    }
                }, 150));

            },

            deleteClaimComment: function (commentId) {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry',
                    type: 'DELETE',
                    data: {
                        'id': commentId
                    },
                    success: function () {
                        commonjs.showStatus("messages.status.commentDeleted");
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
                    success: function (data) {
                        if (data) {
                            self.showCommentPopup('edit', data[0].comments, commentId, data[0].alert_screens);
                        }

                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            saveClaimComment: function (commentId, comment, type) {
                var self = this;
                var $nestedModel = $('#siteModalNested');
                var $saveComments = $nestedModel.find('#btnCICommentSave');
                var selectedScreens = [];
                var reqType;
                var commentsData;

                $nestedModel.find('#chkalertScreens input:checked').each(function() {
                    selectedScreens.push($(this).val());
                });

                $saveComments.prop('disabled', true);

                if (commentId) {
                    reqType = 'PUT';
                    commentsData = {
                        'commentId': commentId,
                        'note': comment,
                        'from': 'tmt',
                        'alertScreens': JSON.stringify(selectedScreens)
                    };
                } else {
                    reqType = 'POST';
                    commentsData = {
                        'note': comment,
                        'type': type || 'manual',
                        'claim_id': self.claim_id,
                        'alertScreens': JSON.stringify(selectedScreens)
                    };
                }

                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/claim_comment',
                    type: reqType,
                    data: commentsData,
                    success: function () {
                        commonjs.showStatus("messages.status.recordSaved");
                        commonjs.hideNestedDialog();
                        self.showClaimCommentsGrid();
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            saveIsInternalComment: function () {
                var comments = [];
                var self = this;
                var selectedFollowUpDate = $('#txtCIFollowUpDate').val() ? commonjs.getISODateString($('#txtCIFollowUpDate').val()) : '';

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
                    success: function () {
                        commonjs.showStatus("messages.status.recordSaved");
                        $('#txtCIBillingComment').prop('readonly', true);

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

            patientInquiryForm: function (claimId, patientId, patientName, gridID, isFromClaim, isNested) {
                var self = this;
                self.grid_id = gridID;
                self.claim_id = claimId;

                if (isFromClaim) {
                    var defaultDialogProps = {
                        'header': commonjs.geti18NString("shared.moduleheader.patientClaims") + ': ' + patientName,
                        'width': '85%',
                        'height': '75%',
                        'needShrink': true,
                        'html': this.claimPatientTemplate()
                    }

                    if (isNested) {
                        commonjs.showNestedDialog(defaultDialogProps);
                        $('#btnPrevPatientClaim,#btnNextPatientClaim').hide();
                    } else {
                        commonjs.showDialog(defaultDialogProps);
                    }

                    $('#radioActivityStatus').off().click(function () {
                        self.showActivityStatus();
                    });

                    $('#radActivityAllStatus').off().click(function () {
                        self.showAllActivity();
                    });

                    setTimeout(function () {
                        var billingProviderList = app.billing_providers,
                        ddlBillingProvider = $('#ddlBillingProvider');
                        ddlBillingProvider.empty();
                        ddlBillingProvider.append("<option value='' i18n='shared.fields.all'></option>");

                        if (billingProviderList && billingProviderList.length > 0) {
                            for (var b = 0; b < billingProviderList.length; b++) {
                                ddlBillingProvider.append($('<option/>', {
                                    value: billingProviderList[b].id,
                                    text: billingProviderList[b].full_name
                                }));
                            }
                        }
                        commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
                    }, 300);

                    this.fromDate =  commonjs.bindDateTimePicker("divFDate", { format: 'L' });
                    this.fromDate.date();
                    this.toDate =  commonjs.bindDateTimePicker("divTDate", { format: 'L' });
                    this.toDate.date();
                    $('#radActivityAllStatus').prop('checked', true);
                    $('#activityDetails').hide();
                    commonjs.isMaskValidate();
                } else {
                    if (patientName) {
                        var patientHeaderInfo = commonjs.geti18NString('shared.moduleheader.patientClaims') + ':' + patientName ;
                        $(parent.document).find('#spanModalHeader').html(patientHeaderInfo);
                    }
                }


                $(".patientClaimProcess").off().click(function (e) {
                    self.processPatientClaim(e);
                });

                if(this.screenCode.indexOf('PACT') > -1)
                    $('#btnPatientActivity').attr('disabled', true); // if Patient Activity report have rights then only can access this report
                self.showPatientClaimsGrid(claimId, patientId, 0, isNested);

                $('.patientClaimProcess').prop('disabled', false);

                $('#ddlBillingProvider').off().change(function () {
                    self.changePatientIngrid(claimId, patientId, isNested);
                });

                $('#paymentSearch').off().click(function () {
                    self.showUnAppliedPayments(patientId, typeof self.options.source !== 'undefined');
                });

                $('#btnPatientActivity').off().click(function (e) {

                    var patientActivityParams = self.createPatientActivityParams(claimId, patientId);
                    if(patientActivityParams) {
                        self.patientActivityStatement.onReportViewClick(e, patientActivityParams);
                    }
                });
                $('#btnFaxPatientActivity').off().click(function (e) {

                    var patientActivityParams = self.createPatientActivityParams(claimId, patientId);
                    var reportURL = self.patientActivityStatement.onReportFaxClick(e, patientActivityParams);
                    reportURL = reportURL.replace(/^[.]{2}/, '');
                    $('#divFaxRecipient').show();

                    $('#btnSendFax').off().click(function () {
                        var faxRecipientName = $('#txtOtherFaxName').val();
                        var faxRecipientNumber = $('#txtOtherFaxNumber').val();

                        if (!commonjs.checkNotEmpty(faxRecipientName))
                            return commonjs.showWarning('messages.status.faxReceiverName');

                        if (!commonjs.checkNotEmpty(faxRecipientNumber))
                            return commonjs.showWarning('messages.status.faxNumberInvalid');

                        // Getting Study id for selected claim
                        commonjs.getClaimStudy(claimId, function (result) {
                            patientActivityParams.study_id = result && result.study_id || 0;
                            patientActivityParams.order_id = result && result.order_id || 0;
                            self.faxReport(patientActivityParams, reportURL);
                        });

                        commonjs.showStatus("messages.status.faxQueued");
                        $('#txtOtherFaxName').val('');
                        $('#txtOtherFaxNumber').val('');
                        $('#divFaxRecipient').hide();
                    });

                    $('#btnFaxCancel').off().click(function () {
                        $('#divFaxRecipient').hide();
                    });
                });
            },

            processPatientClaim: function(e) {
                var self = this;

                $('#txtOtherFaxNumber, #txtOtherFaxName, #txtDate, #txtOtherDate').val('')

                if (self.claim_id && self.grid_id) {

                    var rowData = $(self.grid_id, parent.document).find('tr#' + self.claim_id);
                    var nextRowData = $(e.target).attr('id') == 'btnPrevPatientClaim' ? rowData.prev() : rowData.next();

                    if (nextRowData.attr('id') && nextRowData.length > 0) {
                        var rowId = nextRowData.attr('id');
                        var data = $(self.grid_id, parent.document).getRowData(rowId);

                        $(e.target).prop('disabled', true);
                        $('#ddlBillingProvider').val(0); // Set billing provider option as default ALL
                        self.patientInquiryForm(rowId, data.hidden_patient_id, data.patient_name, self.grid_id, false)

                    } else {
                        commonjs.showWarning("messages.warning.claims.orderNotFound");
                    }

                } else {
                    commonjs.showWarning("messages.warning.claims.errorOnNextPrev");
                }
            },

            createPatientActivityParams: function(claimId, patientId) {
                var reportBy;
                var fromDate;
                var toDate;
                if ($('#radActivityAllStatus').prop("checked")) {
                    reportBy = true;
                }
                else if ($('#radioActivityStatus').prop("checked") && this.validateFromAndToDate(this.fromDate, this.toDate)) {
                    reportBy = false;
                    fromDate = commonjs.getISODateString($('#txtDate').val());
                    toDate = commonjs.getISODateString($('#txtOtherDate').val());
                }
                else return false;

                var selectedBillingProList = $('#ddlBillingProvider option:selected').val() ? [$('#ddlBillingProvider option:selected').val()] : [];

                this.patientActivityStatement = new patientActivityStatement({
                    el: $('#reportFrame')
                });

                var claimIds = [];
                var billingProviderIds = [];

                $('#tblPatientClaimsGrid').find('input[name=chkClaims]:checked').each(function () {
                    var rowID = $(this).closest('tr').attr('id');
                    var gridData = $('#tblPatientClaimsGrid').jqGrid('getRowData', rowID);
                    claimIds.push(gridData.claim_id);
                    billingProviderIds.push(gridData.billing_provider_id);
                });

                return {
                    'claimID': claimId,
                    'flag': "patient-activity-statement",
                    'patientId': patientId,
                    'reportByFlag': reportBy,
                    'fromDate': reportBy ? '': fromDate,
                    'toDate': reportBy ? '': toDate,
                    'billingProId': selectedBillingProList.length ? selectedBillingProList : billingProviderIds,
                    'billingComments': $('#bindComments').prop('checked'),
                    'billingAddressTaxNpi': $('#bindAddressTaxNpi').prop('checked'),
                    'selectedClaimIds': claimIds,
                    'billingPayers': $('#bindPayers').prop('checked')
                }
            },

            printPatientStatement: function(claimId, patientId) {
                this.PatientStatementView = new PatientStatementView({
                    el: $('#reportFrame')
                });
                return {
                    'patientIds': patientId,
                    'claimID': claimId,
                    'flag': "patientStatement",
                    'logInClaimInquiry': true,
                    'mailTo': this.mailTo
                }
            },

            printStatement: function (e, claimId, patientId) {
                var patientStatementParams = this.printPatientStatement(claimId, patientId);
                if (patientStatementParams) {
                    this.PatientStatementView.onReportViewClick(e, patientStatementParams);
                    $('#modal_div_container').removeAttr('style');
                }
            },

            faxReport: function(patientActivityParams, reportUrl, cb) {
                $.ajax({
                    url: '/faxReport',
                    type: 'POST',
                    data: {
                        facility_id: app.userInfo.default_facility_id,
                        receiverType: 'OT',
                        receiverName: patientActivityParams.faxReceiverName || $('#txtOtherFaxName').val(),
                        deliveryAddress: patientActivityParams.faxReceiverNumber || $('#txtOtherFaxNumber').val(),
                        reportUrl: reportUrl,
                        patientId: patientActivityParams.patientId,
                        claimId: patientActivityParams.claimID,
                        documentName: patientActivityParams.documentName || 'Patient Activity',
                        study_id: patientActivityParams.study_id,
                        order_id: patientActivityParams.order_id
                    },
                    success: function () {
                        if (cb)
                            cb();
                        commonjs.showStatus("messages.status.reportFaxedSuccessfully");
                        $('#divFaxRecipient').hide();
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            validateFromAndToDate: function (objFromDate, objToDate) {
                var validationResult = commonjs.validateDateTimePickerRange(objFromDate, objToDate, false);
                if($('#txtDate').val() == '' && $('#txtOtherDate').val() == ''){
                    commonjs.showWarning("messages.warning.claims.dateRangeValidation")
                    return false;
                }
                if($('#txtDate').val() == ''){
                    commonjs.showWarning("messages.warning.claims.fromDateRangeValidation")
                    return false;
                }
                if($('#txtOtherDate').val() == ''){
                    commonjs.showWarning("messages.warning.claims.dateRangeValidation")
                    return false;
                }
                if (!validationResult.valid) {
                    commonjs.showWarning(validationResult.message);
                    return false;
                }
                return true;
            },

            patientInquiryLog: function (claimId, patientId, patientName) {
                var self = this;
                var defaultDialogProps = {
                    'header': commonjs.geti18NString("shared.moduleheader.patientClaimLog") + ': ' + patientName,
                    'width': '85%',
                    'height': '75%',
                    'needShrink': true,
                    'html': this.claimPatientLogTemplate()
                }
                commonjs.showDialog(defaultDialogProps);

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

            billingCommentsReadonly: function () {

                var isReadOnly = $('#txtCIBillingComment').prop('readonly');

                $('#txtCIBillingComment').prop('readonly', !isReadOnly);
            },

            getPaymentofCharge: function (charge_id) {
                var self = this;

                $.ajax({
                    url: '/exa_modules/billing/claims/claim_inquiry/charge_payment_details',
                    type: 'GET',
                    data: {
                        'charge_id': charge_id
                    },
                    success: function (data) {
                        $("#tBodyCIPayment").empty();
                        $('#tBodyCASRef').empty();
                        $('.addtionalCas').remove();
                        var casHeader = self.casHeaderTemplate({rows: data, billingRegionCode: app.billingRegionCode});
                        $('#tHeadCIPayment tr').append(casHeader);

                        if (data.length > 0) {
                            var paymentCASRow = self.paymentTemplate({ rows: data, billingRegionCode: app.billingRegionCode});
                            $('#tBodyCIPayment').append(paymentCASRow);

                            self.showCASDescription(data); // to show description of CAS code

                            commonjs.showNestedDialog({
                                header: 'Payment of Charge Details',
                                width: '80%',
                                height: '30%',
                                html: $('#divCIpaymentDetails').html()
                            });

                        }
                        else {
                            commonjs.showStatus("messages.status.noMorePayment");
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
                    success: function (data) {
                        $("#tBodyCIPayment").empty();
                        $('#tBodyCASRef').empty();
                        $('.addtionalCas').remove();

                        if (data.length > 0) {

                            var casHeader = self.casHeaderTemplate({rows: data, billingRegionCode: app.billingRegionCode});
                            $('#tHeadCIPayment tr').append(casHeader);

                            var paymentCASRow = self.paymentTemplate({ rows: data, billingRegionCode: app.billingRegionCode});
                            $('#tBodyCIPayment').append(paymentCASRow);

                            self.showCASDescription(data); // to show description of CAS code

                            commonjs.showNestedDialog({
                                header: 'Payment Details',
                                width: '90%',
                                height: '30%',
                                html: $('#divCIpaymentDetails').html()
                            });
                        }
                        else {
                            commonjs.showStatus("messages.status.noMorePayment");
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                })
            },

            showCASDescription: function (data) {
                var self = this;
                var casDesc = []

                _.each(data, function(cas) {
                    if(cas.cas_details)
                        casDesc.push(cas.cas_details);
                })
                casDesc = _.flatten(casDesc)
                var refCASDescription  = _.uniq(casDesc, 'code');

                var casRef = self.casTemplate({cas: refCASDescription});
                $('#tBodyCASRef').append(casRef);
            },

            applyToggleInquiry: function (e) {

                var self = this;
                var $tblGrid = self.options.grid_id || null;

                if (self.claim_id && $tblGrid) {

                    var rowData = $($tblGrid, parent.document).find('tr#' + self.claim_id);
                    var nextRowData = $(e.target).attr('id') == 'btnPreviousInquiry' ? rowData.prev() : rowData.next();

                    if (nextRowData.attr('id') && nextRowData.length > 0) {
                        var rowId = nextRowData.attr('id');
                        $(e.target).prop('disabled', true);
                        $($tblGrid, parent.document).closest('tr').find('tr#' + rowId);

                        self.claimInquiryDetails(rowId, true, true);
                    } else {
                        commonjs.showWarning("messages.warning.claims.orderNotFound");
                    }

                } else {
                    commonjs.showWarning("messages.errors.gridIdNotExists");
                }
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
                if ($('#radActivityAllStatus').is(':visible')){
                    $('#activityDetails').hide();
                    this.fromDate ? this.fromDate.clear() : '';
                    this.toDate ? this.toDate.clear() : '';
                }
                $('input[type=date]').val('');
            },

            showPaperClaim: function (format, claimId, insuranceProviderId, payerType) {
                paperClaim.print(format, claimId, false, {
                    payerType: payerType,
                    payerId: insuranceProviderId
                });
            },

            changePatientIngrid: function(claimID, patientID, isNested) {
                var self = this;
                var selectedProv = $("#ddlBillingProvider option:selected").val() ? $("#ddlBillingProvider option:selected").val(): 0;

                self.showPatientClaimsGrid(claimID, patientID, selectedProv, isNested);
            },

            showUnAppliedPayments: function (patientID, isFromClaimInquiry) {
                var self = this;
                self.unappliedPaymentView = new unappliedPaymentView({ el: $('#modal_div_container_nested') });
                self.unappliedPaymentView.render(patientID, isFromClaimInquiry);

                if (isFromClaimInquiry) {
                    $('#btnBackToPatientClaims').show()
                        .off().click(function () {
                            $('#divPatientClaimsGrid').show();
                            $('#divUnappliedPayment').html("");
                            $('#spanModalHeaderNested').html(self.patientClaims.header);
                        });
                    $('#divPatientClaimsGrid').hide();
                    self.patientClaims.header = $('#spanModalHeaderNested').html();
                    $('#spanModalHeaderNested').html(commonjs.geti18NString("billing.payments.unappliedPayments"));
                }
            },

            setMoneyMask: function () {
                $("#gs_invoice_bill_fee").addClass('floatbox');
                $("#gs_invoice_payment").addClass('floatbox');
                $("#gs_invoice_adjustment").addClass('floatbox');
                $("#gs_invoice_balance").addClass('floatbox');
                $("#tblInvoiceGrid #gs_invoice_no").addClass('integerbox');
                commonjs.validateControls();
            },

            clearFaxInfo: function () {
                $('#txtFaxReceiverName').val('');
                $('#txtFaxReceiverNumber').val('');
                $('#divFaxReceipientPaperClaim').hide();
            },

            invoiceActivityStatement: function(claimId, payerType){
                var urlParams = {
                    claimId: claimId,
                    payerType: payerType,
                    async: false,
                    save: false
                };
                var options = {
                    'id': 'invoice-activity-statement',
                    'category': 'billing',
                    'format': 'pdf',
                    'params': urlParams,
                    'openInNewTab': true,
                    'generateUrl': true
                };
                UI.showReport(options);
            }
    });
});
