define(
    [
        'jquery',
        'underscore',
        'backbone',
        'text!templates/claims/addInjuryDetail.html',
    ],
    function (
        $,
        _,
        Backbone,
        addInjuryDetailTemplate
    ) {
        return Backbone.View.extend({
            el: null,
            addInjuryDetailTemplate: _.template(addInjuryDetailTemplate),
            injuryDetails: [],
            fromBodyPartInitSelection: true,
            fromNOIInitSelection: true,
            fromOrientationInitSelection: true,
            events: {
                'click .addInjury': 'addInjury',
                'click .removeInjury': 'deleteInjury'
            },

            initialize: function (options) {
                this.body_parts_autocomplete_list = app.bodyPartsList.map(function (body_part) {
                    return $.extend(false, {}, { id: body_part.code }, body_part);
                });
                this.orientation_autocomplete_list = app.orientationsList.map(function (orientation) {
                    return $.extend(false, {}, { id: orientation.code }, orientation);
                });
            },

            render: function (injury_details) {
                this.bindInjuryList(injury_details);
                commonjs.hasWCBUnsavedChanges = false;
                commonjs.updateCulture(app.current_culture, commonjs.beautifyMe);
            },

            initAutoCompleteList: function(rowIndex, injury_details) {
                var self = this;
                self.initBodyPartAutocomplete(('#txtBodyPart_' + rowIndex), {
                    data_row_id: rowIndex
                });
                self.initOrientationAutocomplete(('#txtOrientation_' + rowIndex), {
                    data_row_id: rowIndex
                });
                self.initNatureOfInjuryAutocomplete(('#txtNOI_' + rowIndex), {
                    data_row_id: rowIndex
                });
            },

            bindInjuryList: function (injury_details) {
                var self = this;
                var $tblInjuryDetails = $('#divInjury #tBodyInjury');

                self.injuryDetails = injury_details || [];
                self.injuryDetailLastIndex = 0;
                $tblInjuryDetails.empty();
                var isNewInjury = !injury_details || !injury_details.length;

                if (isNewInjury) {
                    self.injuryDetails = [{
                        id: null,
                        data_row_id: 0,
                        body_part_code: null,
                        orientation_code: '',
                        injury_id: null,
                        priority_level: 'primary',
                        has_orientation: false
                    }];
                }

                self.injuryDetails.forEach(function (injury_detail, i) {
                    injury_detail.data_row_id = i;
                    self.injuryDetailLastIndex++;

                    $tblInjuryDetails.append(self.addInjuryDetailTemplate({
                        row: injury_detail,
                        study_id: self.study_id
                    }));

                    self.initAutoCompleteList(i, !isNewInjury ? injury_detail : null);

                    if (!isNewInjury) {
                        $('#txtBodyPart_' + i).select2('val', injury_detail.body_part_code);
                        $('#txtOrientation_' + i).select2('val', injury_detail.orientation_code);
                        $('#txtNOI_' + i).select2('val', injury_detail.injury_id);
                    }
                });
            },

            duplicateInjuryValidation: function (index, data_row_id) {
                var isInjuryDetailDuplicate = false;
                var injury = this.injuryDetails[index];

                this.injuryDetails.forEach(function (injury_detail, i) {
                    if (!isInjuryDetailDuplicate && i != index) {
                        isInjuryDetailDuplicate = (injury_detail.body_part_code === injury.body_part_code
                            && injury_detail.injury_id == injury.injury_id
                            && injury_detail.orientation_code === injury.orientation_code
                            && injury_detail.has_orientation === injury.has_orientation)
                    }
                });

                if (isInjuryDetailDuplicate) {
                    $('#select2-txtBodyPart_' + data_row_id + '-container').html(commonjs.geti18NString('messages.warning.shared.selectBodyPart'));
                    $('#select2-txtOrientation_' + data_row_id + '-container').html(commonjs.geti18NString('messages.warning.shared.selectOrientation'));
                    $('#select2-txtNOI_' + data_row_id + '-container').html(commonjs.geti18NString('messages.warning.shared.selectNatureOfInjury'));
                    $('#txtNOI_' + data_row_id).select2('data', null);
                    $('#txtOrientation_' + data_row_id).select2("enable", true);

                    this.injuryDetails[index].body_part_code = '';
                    this.injuryDetails[index].injury_id = '';
                    this.injuryDetails[index].orientation_code = '';
                    this.injuryDetails[index].has_orientation = '';

                    commonjs.showWarning("messages.warning.shared.duplicateInjury");
                }
            },
            /**
            * Setting default autocomplete for body parts in injury details grid
            * This autocomplete returns the response as res.body_parts
            */
            initBodyPartAutocomplete: function (containerID, options) {
                var self = this;
                var data_row_id = options.data_row_id;
                options = options || {};

                $(containerID).select2({
                    data: self.body_parts_autocomplete_list,
                    allowClear: false,
                    placeholder: {
                        id: '',
                        text: commonjs.geti18NString('messages.warning.shared.selectBodyPart')
                    },
                    width: 150,
                    minimumInputLength: 0,
                    matcher: function (params, data) {
                        var term = $.trim(params.term);
                        var bpDescription = data.description.toUpperCase();

                        if (term === '' || bpDescription.indexOf(term.toUpperCase()) >= 0) {
                            return data;
                        }

                        return null;
                    },
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection,
                });

                function formatRepo(res) {

                    if (res.loading) {
                        return res.text;
                    }

                    var markup = "<table><tr>";
                    markup += "<td title='" + res.description + "'><div>" + res.description + "</div>";
                    markup += "</td></tr></table>";
                    return markup;
                }
                function formatRepoSelection(res) {
                    if (res && res.id) {

                        $(containerID).val(res.id);
                        var has_orientation = res.sideofbodyrequired.toLowerCase() === "yes";
                        var index = self.injuryDetails.findIndex(function (i) { return i.data_row_id == data_row_id });
                        var $txtOrientation = $('#select2-txtOrientation_' + data_row_id + '-container');
                        self.injuryDetails[index].body_part_code = res.id;
                        self.injuryDetails[index].has_orientation = has_orientation;

                        if (!has_orientation) {
                            self.injuryDetails[index].orientation_code = '';
                            $txtOrientation.empty();
                        }
                        $('#txtOrientation_' + data_row_id).select2("enable", has_orientation);

                        if (!self.fromBodyPartInitSelection) {
                            commonjs.hasWCBUnsavedChanges = true;
                        }
                        self.fromBodyPartInitSelection = false;
                        return res.description;
                    }
                    else {
                        return res && res.text;
                    }
                }

                $(containerID).on('change', function (a, b) {
                    var index = self.injuryDetails.findIndex(function (i) { return i.data_row_id == data_row_id });
                    self.duplicateInjuryValidation(index, data_row_id);
                });

            },
            /**
            * Setting default autocomplete for orientation in injury details grid
            * This autocomplete returns the response as res.orientation
            */
            initOrientationAutocomplete: function (containerID, options) {
                var self = this;
                options = options || {};
                var data_row_id = options.data_row_id;
                $(containerID).select2({
                    data: self.orientation_autocomplete_list,
                    allowClear: false,
                    placeholder: {
                        id: '',
                        text: commonjs.geti18NString('messages.warning.shared.selectOrientation')
                    },
                    width: 100,
                    minimumInputLength: 0,
                    matcher: function (params, data) {
                        var term = $.trim(params.term);
                        var bpDescription = data.description.toUpperCase();

                        if (term === '' || bpDescription.indexOf(term.toUpperCase()) >= 0) {
                            return data;
                        }

                        return null;
                    },
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection,
                });

                function formatRepo(res) {
                    if (res.loading) {
                        return res.text;
                    }

                    var markup = "<table><tr>";
                    markup += "<td title='" + res.description + "'><div>" + res.description + "</div>";
                    markup += "</td></tr></table>";
                    return markup;
                }
                function formatRepoSelection(res) {
                    if (res && res.id) {
                        $(containerID).val(res.id);
                        var index = self.injuryDetails.findIndex(function (i) { return i.data_row_id == data_row_id });
                        self.injuryDetails[index].orientation_code = res.id;

                        if (!self.fromOrientationInitSelection) {
                            commonjs.hasWCBUnsavedChanges = true;
                        }
                        self.fromOrientationInitSelection = false;
                        return res.description;
                    }
                    else {
                        return res && res.text;
                    }
                }

                $(containerID).on('change', function (a, b) {
                    var index = self.injuryDetails.findIndex(function (i) { return i.data_row_id == data_row_id });
                    self.duplicateInjuryValidation(index, data_row_id);
                });

            },
            /**
            * Setting default autocomplete for nature of injury in injury details grid
            * This autocomplete returns the response as res.nature_of_injury
            */
            initNatureOfInjuryAutocomplete: function (containerID, options) {
                var self = this;
                options = options || {};
                var data_row_id = options.data_row_id;
                $(containerID).select2({
                    data: app.wcb_nature_code,
                    allowClear: false,
                    placeholder: {
                        id: '',
                        text: commonjs.geti18NString('messages.warning.shared.selectNatureOfInjury')
                    },
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection,

                    matcher: function (params, data) {
                        var term = $.trim(params.term);
                        var noiDescription = data.description.toUpperCase();

                        if (term === '' || noiDescription.indexOf(term.toUpperCase()) >= 0) {
                            return data;
                        }

                        return null;
                    }
                });
                function formatRepo(res) {
                    var markup = "<table><tr>";
                    markup += "<td  data-id='" + res.id + " ' title='" + res.code + "'> <div>" + res.description + "</div>";

                    markup += "</td></tr></table>";

                    return markup;
                }

                function formatRepoSelection(res) {
                    if (res && res.id) {
                        $(containerID).val(res.id);
                        var index = self.injuryDetails.findIndex(function (i) { return i.data_row_id == data_row_id });
                        self.injuryDetails[index].injury_id = res.id;
                        self.injuryDetails[index].injury_description = res.description;

                        if (!self.fromNOIInitSelection) {
                            commonjs.hasWCBUnsavedChanges = true;
                        }
                        self.fromNOIInitSelection = false;
                        return res.description;
                    }
                    else {
                        return res && res.text;
                    }
                }

                $(containerID).on('change', function (a, b) {
                    var index = self.injuryDetails.findIndex(function (i) { return i.data_row_id == data_row_id });
                    self.duplicateInjuryValidation(index, data_row_id);
                });

            },

            updatePriorityLevel: function (currentIndex) {
                var self = this;

                self.injuryDetails.forEach(function (injury_detail, index) {
                    if (index >= currentIndex) {
                        injury_detail.priority_level = self.getPriority(index);
                    }
                });
            },

            getPriority: function (index) {
                var priority_level = null;
                switch (index) {
                    case 0:
                        priority_level = 'primary';
                    break;
                    case 1:
                        priority_level = 'secondary';
                    break;
                    case 2:
                        priority_level = 'tertiary';
                    break;
                    case 3:
                        priority_level = 'quaternary';
                    break;
                    case 4:
                        priority_level = 'quinary';
                    break;
                }

                return priority_level;
            },

            addInjury: function (e) {
                var self = this;
                var currentIndex = $(e.currentTarget).closest('tr').index();
                var $tblInjuryDetails = $('#divInjury #tBodyInjury');
                var newRowIndex = self.injuryDetails.length;
                self.injuryDetailLastIndex++;

                if (newRowIndex >= 5) {
                    return commonjs.showWarning("messages.warning.shared.wcbExceedsMaximumLimit", "mediumwarning");
                }

                var priority_level = self.getPriority(newRowIndex);
                var injuryDetail = {
                    id: 0,
                    data_row_id: self.injuryDetailLastIndex,
                    body_part_code: '',
                    orientation_code: '',
                    injury_id: '',
                    priority_level: priority_level,
                    has_orientation: false
                };

                var injury_row = this.addInjuryDetailTemplate({
                    row: injuryDetail,
                    study_id: self.study_id
                });

                if (currentIndex + 1 == newRowIndex) {
                    $tblInjuryDetails.append(injury_row);
                    self.injuryDetails.push(injuryDetail);
                }
                else {
                    $('#tBodyInjury > tr').eq(currentIndex).after(injury_row);
                    self.injuryDetails.splice(currentIndex + 1, 0, injuryDetail);
                }

                self.updatePriorityLevel(currentIndex);
                self.initAutoCompleteList(self.injuryDetailLastIndex, null);
            },

            deleteInjury: function (e) {
                var $currentTarget = $(e.currentTarget);
                var currentIndex = $currentTarget.closest('tr').index();
                $currentTarget.closest('tr').remove();
                this.injuryDetails.splice(currentIndex, 1);
                this.injuryDetailLastIndex--;
                commonjs.hasWCBUnsavedChanges = true;

                if (!this.injuryDetails.length) {
                    this.injuryDetailLastIndex = 0;
                    var injuryDetail = {
                        id: 0,
                        data_row_id: 0,
                        body_part_code: '',
                        orientation_code: '',
                        injury_id: '',
                        priority_level: 'primary',
                        has_orientation: false
                    };
                    var injury_row = this.addInjuryDetailTemplate({
                        row: injuryDetail,
                        study_id: self.study_id
                    });
                    this.injuryDetails.push(injuryDetail);
                    $('#divInjury #tBodyInjury').append(injury_row);

                    this.initAutoCompleteList(0, null);
                }
                else {
                    this.updatePriorityLevel(currentIndex);
                }
            }
        });
    });
