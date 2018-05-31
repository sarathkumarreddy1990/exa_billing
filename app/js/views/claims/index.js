define(['jquery', 'underscore', 'backbone', 'text!templates/claims/claimForm.html', 'text!templates/claims/chargeRow.html', 'collections/study-filters'],
    function ($, _, Backbone, claimCreationTemplate, chargeRowTemplate, StudyFiltersCollection) {
        var claimView = Backbone.View.extend({
            el: null,
            rendered: false,
            claimCreationTemplate: _.template(claimCreationTemplate),
            chargerowtemplate: _.template(chargeRowTemplate),
            updateResponsibleList: [],
            chargeModel: [],
            claimICDLists: [],
            existingPrimaryInsurance: [],
            existingSecondaryInsurance: [],
            existingTriInsurance: [],
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
            initialize: function (options) {
                this.options = options;
                var planName = [
                    { value: '', 'text': 'Select' },
                    { value: 'Health', 'text': 'Health' },
                    { value: 'Retried', 'text': 'Retried' },
                    { value: 'Education', 'text': 'Education' }
                ];
                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });
                this.facilities = new modelCollection(commonjs.bindArray(app.facilities, true, true));
                this.planList = new modelCollection(planName);

            },
            render: function () {
                var self = this;
                this.rendered = true;

                commonjs.showDialog({
                    header: 'Claim Creation',
                    width: '95%',
                    height: '75%',
                    html: this.claimCreationTemplate({
                        patient_name: self.cur_patient_name,
                        account_no: self.cur_patient_acc_no,
                        dob: self.cur_patient_dob,
                        facilities: self.facilities.toJSON(),
                        planname: self.planList.toJSON()
                    })
                });
                self.bindDetails();
            },
            bindDetails: function () {
                var self = this;
                // listof auto-complete binded
                self.setRenderingAutoComplete();
                self.setDiagCodesAutoComplete();
                //self.bindExistingPatientInsurance();
                //self.bindBillingSummary();
                //self.setReferringAutoComplete();
                //self.setOrderingFacilityAutoComplete();
                //self.setAllInsurancesAutoComplete();
            },
            showClaimForm: function (options) {
                var self = this;
                var curClaimDetails = JSON.parse(window.localStorage.getItem('selected_studies'));
                self.cur_patient_id = curClaimDetails.patient_id ? parseInt(curClaimDetails.patient_id) : null;
                self.cur_patient_name = curClaimDetails.patient_name;
                self.cur_patient_acc_no = curClaimDetails.account_no;
                self.cur_patient_dob = curClaimDetails.patient_dob ? moment.utc(curClaimDetails.patient_dob).format('L') : null;
                self.cur_study_date = (commonjs.checkNotEmpty(curClaimDetails.study_date) ? commonjs.convertToFacilityTimeZone(curClaimDetails.facility_id, curClaimDetails.study_date).format('L LT z') : '');
                self.pri_accession_no = curClaimDetails.accession_no || null;
                self.cur_study_id = curClaimDetails.study_id || null;
                self.isEdit = self.claim_Id ? true : false;

                if (!this.rendered)
                    this.render();

                self.getLineItemsAndBind(curClaimDetails);
                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: self.cur_patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                });
                $("#createNewCharge").off().click(function (e) {
                    self.addChargeLine(e);
                });
                $("#btnAddDiagCode").off().click(function (e) {
                    self.addDiagCodes(e);
                });
            },
            getLineItemsAndBind: function (curClaimDetails) {
                var self = this, study_ids;
                if ($.isArray(curClaimDetails)) {
                    study_ids = self.getSelectedStudyID(curClaimDetails);
                    self.study_ids = study_ids;
                    study_ids = study_ids.join('~');
                } else {
                    study_ids = curClaimDetails.study_id;
                }
                if (study_ids) {

                    $.ajax({
                        type: 'GET',
                        url: '/exa_modules/billing/claims/get_line_items',
                        data: {
                            from: 'claimCreation',
                            study_ids: study_ids
                        },
                        success: function (model, response) {
                            if (model && model.length > 0) {
                                $('#tBodyCharge').empty();
                                var modelDetails = model[0];
                                _.each(modelDetails.charges, function (item) {
                                    var index = $('#tBodyCharge').find('tr').length;
                                    item.data_row_id = index;
                                    self.addLineItems(item, index);

                                    self.chargeModel.push({
                                        id: null,
                                        claim_id: null,
                                        ref_charge_id: item.study_cpt_id,
                                        accession_no: item.accession_no,
                                        study_id: item.study_id,
                                        data_row_id: index
                                    });
                                });
                            }
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                        }
                    })

                }

            },
            getSelectedStudyID: function (curClaimDetails) {
                var studyIds = [];
                $.each(curClaimDetails, function (index, obj) {
                    if (obj.study_id != '' && studyIds.indexOf(parseInt(obj.study_id)) == -1) {
                        studyIds.push(parseInt(obj.study_id))
                    }
                })
                return studyIds;
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

                /* Bind charge table data*/
                $('#select2-txtCptCode_' + index + '-container').html(data.cpt_code).prop('title', data.cpt_code).attr({ 'data_code': data.cpt_code, 'data_description': data.display_description, 'data_id': data.cpt_code_id }).css('min-width', '80');
                $('#select2-txtCptDescription_' + index + '-container').html(data.display_description).prop('title', data.display_description).attr({ 'data_code': data.cpt_code, 'data_description': data.display_description, 'data_id': data.cpt_code_id });


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
                }
                else {
                    id = txtCptDescription;
                    message = self.usermessage.selectcptdescription;
                }

                $("#" + id).select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 20,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "trim(display_description)",
                                sortOrder: "asc",
                                company_id: 1
                            };
                        },
                        processResults: function (data, params) {
                            params.page = params.page || 1;
                            return {
                                results: data,
                                pagination: {
                                    more: (params.page * 30) < data[0].total_records
                                }
                            };
                        },
                        cache: true
                    },
                    placeholder: message,
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    if (repo.is_active || repo.is_active == undefined) {
                        var markup = "<table><tr>";
                        if (repo.display_code != '')
                            markup += "<td title='" + repo.display_code + (repo.display_description ? "(" + repo.display_description + ")" : '') + "'><div>" + repo.display_code + (repo.display_description ? "(" + repo.display_description + ")" : '') + "</div>";
                        else
                            markup += "<td title='" + repo.display_code + repo.display_description ? repo.display_description : '' + "'><div>" + repo.display_code + repo.display_description ? repo.display_description : '' + "</div>";
                        markup += "</td></tr></table>"
                        return markup;
                    }
                    else {
                        var markup1 = "<table><tr class='inActiveRow'>";
                        if (repo.display_code != '')
                            markup1 += "<td title='" + repo.display_code + "(" + repo.display_description + ")" + "'><div>" + repo.display_code + "(" + repo.display_description + ")" + "</div>";
                        else
                            markup += "<td title='" + repo.display_code + repo.display_description + "'><div>" + repo.display_code + repo.display_description + "</div>";
                        markup1 += "</td></tr></table>"
                        return markup1;
                    }
                }
                function formatRepoSelection(res) {
                    var duration = (res.duration > 0) ? res.duration : 15;
                    var units = (res.units > 0) ? parseFloat(res.units) : 1.0;
                    var fee = (res.globalfee > 0) ? parseFloat(res.globalfee) : 0.0;
                    self.setCptValues(rowIndex, txtCptCode, txtCptDescription, res, duration, units, fee);
                    return type == 'code' ? res.display_code : res.display_description;
                }
            },
            setCptValues: function (rowIndex, txtCptCode, txtCptDescription, res, duration, units, fee) {
                var self = this;
                $('#select2-' + txtCptCode + '-container').html(res.display_code).attr('title', res.display_code);
                $('#select2-' + txtCptCode + '-container').attr('data_code', res.display_code);
                $('#select2-' + txtCptCode + '-container').attr('data_description', res.display_description);
                $('#select2-' + txtCptCode + '-container').attr('data_id', res.id);

                $('#select2-' + txtCptDescription + '-container').html(res.display_description).attr('title', res.display_description);
                $('#select2-' + txtCptDescription + '-container').attr('data_code', res.display_code);
                $('#select2-' + txtCptDescription + '-container').attr('data_description', res.display_description);
                $('#select2-' + txtCptDescription + '-container').attr('data_id', res.id);

                $('#txtUnits_' + rowIndex).val(units);
                $('#txtBillFee_' + rowIndex).val(parseFloat(fee).toFixed(2));
                $('#txtAllowedFee_' + rowIndex).val(parseFloat(fee).toFixed(2));
                $('#txtTotalAllowedFee_' + rowIndex).val(parseFloat(units * fee).toFixed(2));
                $('#txtTotalBillFee_' + rowIndex).val(parseFloat(units * fee).toFixed(2));

                // this class used to validate if cpt choosen or not
                $('#' + txtCptCode).removeClass('cptIsExists');

            },
            setRenderingAutoComplete: function () {
                var self = this;

                $("#ddlRenderingProvider").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/providers",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 20,
                                q: params.term || '',
                                provider_type: 'PR',
                                pageSize: 10,
                                sortField: "p.last_name",
                                sortOrder: "asc",
                                company_id: 1
                            };
                        },
                        processResults: function (data, params) {
                            params.page = params.page || 1;
                            return {
                                results: data,
                                pagination: {
                                    more: (params.page * 30) < data[0].total_records
                                }
                            };
                        },
                        cache: true
                    },
                    placeholder: self.usermessage.selectStudyReadPhysician,
                    escapeMarkup: function (markup) { return markup; },
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var contactInfo = commonjs.hstoreParse(repo.contact_info);
                    if (!repo.is_active) {
                        var markup1 = "<table class='ref-result' style='width: 100%'><tr class='inActiveRow'>";
                        markup1 += "<td><div><b>" + repo.full_name + "</b><b>" + '(' + repo.provider_code + ')' + "</b></div>";
                        markup1 += "<div>" + contactInfo.ADDR1 == "undefined" ? "" : contactInfo.ADDR1 + contactInfo.ADDR2 == "undefined" ? "" : ", " + contactInfo.ADDR2 + "</div>";
                        markup1 += "<div>" + contactInfo.CITY == "undefined" ? "" : contactInfo.CITY + ", " + contactInfo.STATE + contactInfo.ZIP == "undefined" ? "" : ", " + contactInfo.ZIP + contactInfo.MOBNO == "undefined" ? "" : ", " + contactInfo.MOBNO + "</div>";
                        markup1 += "</td></tr></table>";
                        return markup1;
                    }
                    else {
                        var markup = "<table class='ref-result' style='width: 100%'><tr>";
                        markup += "<td><div><b>" + repo.full_name + "</b><b>" + '(' + repo.provider_code + ')' + "</b></div>";
                        markup += "<div>" + (contactInfo.ADDR1 == "undefined" ? "" : contactInfo.ADDR1) + ", " + (contactInfo.ADDR2 == "undefined" ? "" : contactInfo.ADDR2) + "</div>";
                        markup += "<div>" + (contactInfo.CITY == "undefined" ? "" : contactInfo.CITY) + ", " + contactInfo.STATE + (contactInfo.ZIP == "undefined" ? "" : ", " + contactInfo.ZIP) + (contactInfo.MOBNO == "undefined" ? "" : ", " + contactInfo.MOBNO) + "</div>";
                        markup += "</td></tr></table>"
                        return markup;
                    }
                }
                function formatRepoSelection(res) {
                    return res.full_name;
                }
            },
            setDiagCodesAutoComplete: function () {
                var self = this;
                $("#ddlMultipleDiagCodes").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/icd_codes",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 20,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "code",
                                sortOrder: "ASC",
                                company_id: 1
                            };
                        },
                        processResults: function (data, params) {
                            params.page = params.page || 1;
                            return {
                                results: data,
                                pagination: {
                                    more: (params.page * 30) < data[0].total_records
                                }
                            };
                        },
                        cache: true
                    },
                    placeholder: self.usermessage.selectStudyReadPhysician,
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var codeValue = repo.code != null ? repo.code : '';
                    codeValue += repo.code_type ? '(' + repo.code_type + ')' : '';

                    var markup = "<table><tr>";
                    if (codeValue != '')
                        markup += "<td title='" + codeValue + (repo.description ? "(" + repo.description + ")" : '') + "'><div>" + codeValue + (repo.description ? "(" + repo.description + ")" : '') + "</div>";
                    else
                        markup += "<td title='" + codeValue + repo.description ? repo.description : '' + "'><div>" + codeValue + repo.description ? repo.description : '' + "</div>";
                    markup += "</td></tr></table>"
                    return markup;

                }
                function formatRepoSelection(res) {
                    self.ICDID = res.id;
                    self.icd_code = res.code;
                    self.icd_description = res.description;
                    return res.code;
                }
            },
            addDiagCodes: function () {
                var self = this;
                var curDiagnosis = ($('#hdnDiagCodes').val() !== "") ? $('#hdnDiagCodes').val().split(',') : [];

                if (self.icd_code && curDiagnosis.length < 12) {

                    if (curDiagnosis.indexOf(String(self.ICDID)) > -1) {
                        alert("Problem already exists");
                        return false;
                    }

                    curDiagnosis.push(self.ICDID);
                    $('#hdnDiagCodes').val(curDiagnosis.join(','));

                    // Adding same ICD after deleted, change[is_deleted,deleted_by] flag from icd list
                    if (_.findIndex(self.claimICDLists, { icd_id: self.ICDID }) > -1) {
                        self.claimICDLists = _.map(self.claimICDLists, function (obj) {
                            if (obj.icd_id === parseInt(self.ICDID)) {
                                obj.is_deleted = false;
                                obj.deleted_by = null;
                            }
                            return obj;
                        });
                    } else {
                        self.claimICDLists.push({
                            id: null,
                            icd_id: self.ICDID,
                            claim_id: self.claim_Id || null,
                            created_by: app.userID,
                            last_updated_by: app.userID,
                            deleted_by: null,
                            last_updated_date: null,
                            created_date: null,
                            deleted_dt: null,
                            is_deleted: false
                        });
                    }

                    /* Bind Diagnosis codes */
                    $('#ulSelectedDiagCodes').append(
                        $('<li/>').append(
                            $('<span>').addClass("beautifySpan").text(self.icd_code + '-' + self.icd_description).append(
                                $('<span/>').addClass("orderNo").text(curDiagnosis.length + ' )').css('float', 'left')
                            )
                        ).off().click(function () {
                            $('.highlight').removeClass('highlight');
                            $(this).addClass('highlight');
                        }).append(
                            $('<a/>').addClass("remove").attr('data-id', self.ICDID
                            ).append(
                                $('<span/>').addClass("icon-ic-close").off().click(function (e) {
                                    var curDiagnosis = ($('#hdnDiagCodes').val() !== "") ? $('#hdnDiagCodes').val().split(',') : [],
                                        codeId = $(e.target).parent().attr('data-id');
                                    self.claimICDLists = _.map(self.claimICDLists, function (obj) {
                                        if (obj.icd_id === parseInt(codeId)) {
                                            obj.is_deleted = true;
                                            obj.deleted_by = app.userID;
                                        }
                                        return obj;
                                    });

                                    var removePointer = curDiagnosis.indexOf(codeId)
                                    curDiagnosis.splice(removePointer, 1);
                                    $('#hdnDiagCodes').val(curDiagnosis.join(','));
                                    $(this).closest('li').remove();
                                    self.sortDigCodes();
                                })
                            )
                        )
                    );
                }
            }
        });
        return claimView;
    });

