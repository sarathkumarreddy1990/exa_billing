define(['jquery', 'underscore', 'backbone', 'text!templates/claims/claimForm.html','text!templates/claims/chargeRow.html'],
    function ($, _, Backbone, claimCreationTemplate,chargeRowTemplate) {
        var paymentView = Backbone.View.extend({
            el: null,
            rendered: false,
            claimCreationTemplate: _.template(claimCreationTemplate),     
            chargerowtemplate: _.template(chargeRowTemplate),
            updateResponsibleList:[],
            chargeModel: [],
            removedCharges: [],
            responsible_list: [
                { payer_type: "PPP", payer_id: null, payer_name: null },
                { payer_type: "PIP_P", payer_id: null, coverage_level: "P", payer_name: null, billing_method: null },
                { payer_type: "PIP_S", payer_id: null, coverage_level: "S", payer_name: null, billing_method: null },
                { payer_type: "PIP_T", payer_id: null, coverage_level: "T", payer_name: null, billing_method: null },
                { payer_type: "POF", payer_id: null, payer_name: null },
                { payer_type: "PR", payer_id: null, payer_name: null },
                { payer_type: "PF", payer_id: null, payer_name: null }
            ],   
            usermessage: {
                selectStudyRefProvider: 'Select Refer. Provider',
                selectStudyReadPhysician: 'Select Read. Provider',
                selectDiagnosticCode: 'Select Code',
                selectOrdFacility: 'Select Ordering Facility',
                selectCarrier: 'Search Carrier',
                selectcptcode: "Select Cpt Code",
                selectcptdescription: "Select Cpt Description"
            },    
            events: {
                "click #tab_menu a": "urlNavigation",
                "click #btnAddDiagCode": "addDiagCodes",
                "change #ddlFacility": "facilityOnchange",
                "click #btnSaveClaim": "saveClaimDetails",
                "click #newOrderNavAppointment": "newCharges",
                "change #ddlPriExistIns": "changeExistingPrimaryIns",
                'blur .units, .billFee, .allowedFee': 'changeFeeData',
                'change #chkSecMedicarePayer': 'secondaryMedicarePayer',
                "click #createNewCharge, .addChargeGrid": "addChargeLine",
                "change #ddlExistTerIns, #ddlExistSecIns, #ddlExistPriIns": "assignExistInsurance",
                'click #btnResetPriInsurance,#btnResetSecInsurance,#btnResetTerInsurance': 'resetInsurances',
                'change #ddlPriRelationShip,#ddlSecRelationShip,#ddlTerRelationShip': 'changeRelationShip'
            },
            initialize: function (options) {
                this.options = options;
            },
            render: function () {
                this.rendered = true;
            },
            showClaimForm: function (options) {
                var self = this;
                if (!this.rendered)
                    this.render();
                commonjs.showDialog({header: 'Claim Creation', width:'95%',height:'75%',html: this.claimCreationTemplate});
                var curClaimDetails = JSON.parse(window.localStorage.getItem('selected_studies'));
                self.cur_patient_id = curClaimDetails.patient_id ? parseInt(curClaimDetails.patient_id) : null;
                self.cur_patient_name = curClaimDetails.patient_name;
                self.cur_patient_acc_no = curClaimDetails.account_no;
                self.cur_patient_dob = curClaimDetails.patient_dob;
                self.cur_study_date = (commonjs.checkNotEmpty(curClaimDetails.study_date) ? commonjs.convertToFacilityTimeZone(curClaimDetails.facility_id, curClaimDetails.study_date).format('L LT z') : '');
                self.pri_accession_no = curClaimDetails.accession_no || null;
                self.cur_study_id = curClaimDetails.study_id || null;
                self.isEdit = self.claim_Id ? true : false;
                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: self.cur_patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                });
                $("#createNewCharge").off().click(function (e) {
                    self.addChargeLine(e);
                });
            },

            addChargeLine: function (e) {
                e.stopImmediatePropagation();
                var self = this;
                var _targetId = $(e.target || e.srcElement).attr('id');
                if (_targetId == "createNewCharge") {
                    var index = $('#tBodyCharge tr:last').attr('data_row_id') ? $('#tBodyCharge tr:last').attr('data_row_id') : -1;

                    var _rowObj = {
                        id: null,
                        claim_id: self.claim_Id || null,
                        ref_charge_id: null,
                        study_id: self.cur_study_id || null,
                        accession_no: $('#tBodyCharge tr:first').length > 0 ? $('#tBodyCharge tr:first').find('.charges__accession-num').text().trim() : (self.pri_accession_no || null),
                        data_row_id: parseInt(index) + 1
                    }
                } else {
                    var rowObj = $(e.target || e.srcElement).closest('tr');
                    var accession_no = $.trim(rowObj.find('.charges__accession-num').text())
                    var index = rowObj.length > 0 ? $('#tBodyCharge tr:last').attr('data_row_id') : 0;
                    var rowData = _.find(self.chargeModel, { 'data_row_id': parseInt(rowObj.attr('data_row_id')) });
                    var _rowObj = {
                        id: null,
                        claim_id: rowData.claim_id ? rowData.claim_id : null,
                        ref_charge_id: null,
                        study_id: rowData.study_id,
                        accession_no: rowData.accession_no,
                        data_row_id: parseInt(index) + 1
                    }
                }

                self.addLineItems(_rowObj, _rowObj.data_row_id, true);
                self.chargeModel.push(_rowObj);

            },
            addLineItems: function (data, index, isNew) {
                var self = this;

                data.claim_dt = (commonjs.checkNotEmpty(self.cur_study_date) ? self.cur_study_date : '');

                var chargeTableRow = self.chargerowtemplate({ row: data });
                $('#tBodyCharge').append(chargeTableRow);

                self.setChargeAutoComplete(index, 'code');
                self.setChargeAutoComplete(index, 'description');
            },
            updateResponsibleList: function (payer_details) {
                var self = this, index, responsibleEle, selected_opt;
                index = _.findIndex(self.responsible_list, (item) => item.payer_type == payer_details.payer_type);
                if (index > -1) {
                    self.responsible_list[index].payer_id = payer_details.payer_id;
                    self.responsible_list[index].payer_name = payer_details.payer_name;
                    self.responsible_list[index].billing_method = payer_details.billing_method;
                }
                responsibleEle = $('#ddlResponsible');
                selected_opt = responsibleEle.find('option[value="' + payer_details.payer_type + '"]');
                if (!payer_details.payer_name)
                    selected_opt.remove();
                else if (selected_opt && selected_opt.length && payer_details.payer_name)
                    $(selected_opt).text(payer_details.payer_name)
                else
                    $(responsibleEle).append($('<option/>').attr('value', payer_details.payer_type).text(payer_details.payer_name));
            },
            setChargeAutoComplete: function (rowIndex, type) {
                var self = this;
                var txtCptCode = 'txtCptCode_' + rowIndex;
                var txtCptDescription = 'txtCptDescription_' + rowIndex;
                var id = '';
                var message = '';
                if (type == 'code') {
                    id = txtCptCode;
                    message = self.usermessage.selectcptcode;
                   // $('.form-control-lg').css({ 'min-width': '100px' });
                }
                else {
                    id = txtCptDescription;
                    message = self.usermessage.selectcptdescription;
                }
                commonjs.setAutocompleteInfinite({
                    containerID: "#" + id,
                    placeHolder: message,
                    inputLength: 0,
                    clearnotNeed: true,
                    URL: "/billing/autocomplete/cptsAutoComplete",
                    data: function (term, page) {
                        self.term = term;
                        return {
                            pageNo: page,
                            pageSize: 10,
                            q: ($('#s2id_' + id).data('select2').search.val() == $('#s2id_' + id + ' a span').text()) ? $('#s2id_' + id + ' a span').text() : term,
                            sortField: "trim(display_description)",
                            sortOrder: "asc"
                        };

                    },
                    results: function (data, page) {
                        var more = data.result.length > 0 ? (page * 10) < data.result[0].total_records : false;
                        return { results: data.result, more: more };

                    },
                    formatID: function (obj) {
                        return obj.id;
                    },
                    formatResult: function (res) {
                        return commonjs.formatACResult(res.display_code, res.display_description, res.is_active, res.linked_cpt_codes ? res.linked_cpt_codes.toString() : '', true);
                    },
                    formatSelection: function (res) {
                        commonjs.autoCompleteChanged = true;
                        var duration = (res.duration > 0) ? res.duration : 15;
                        var units = (res.units > 0) ? parseFloat(res.units) : 1.0;
                        var fee = (res.globalfee > 0) ? parseFloat(res.globalfee) : 0.0;
                        var isExistCpt = self.checkCptExists(rowIndex, res.id);
                        if (isExistCpt) {
                            if (confirm('Code already exists. Do you want to add ?'))
                                self.setCptValues(rowIndex, txtCptCode, txtCptDescription, res, duration, units, fee);
                            else
                                self.resetCptValues(id, txtCptCode, txtCptDescription);
                        }
                        else
                            self.setCptValues(rowIndex, txtCptCode, txtCptDescription, res, duration, units, fee);

                    }
                });
                $('#' + id).on('select2-open', function (event) {
                    if ($('#s2id_' + id + '  a span').text() != message)
                        $('#s2id_' + id).data('select2').search.val($('#s2id_' + id + ' a span').text());
                });
            }
            
        });
        return paymentView;
    });

