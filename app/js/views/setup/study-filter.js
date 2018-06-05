define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/setup/study-filter-form.html',
    'models/setup/study-filter'
], function (
    $,
    _,
    Backbone,
    studyFiltersTemplate,
    studyFiltersModel) {
        return Backbone.View.extend({
            template: _.template(studyFiltersTemplate),

            initialize: function () {
                this.model = new studyFiltersModel();
            },

            showForm: function () {
                var self = this;
                userID = app.userID;
                $('#site_modal_div_container').empty();
                $('#site_modal_div_container').append(self.template);
                $('#site_modal_div_container').show();
                // var dtpDateOptions = { format: "L", useCurrent: false };
                // self.dtpFromDate = commonjs.bindDateTimePicker("divDateFrom", dtpDateOptions);
                // self.dtpToDate = commonjs.bindDateTimePicker("divDateTo", dtpDateOptions);

                // var dtpTimeOptions = { format: "LT", useCurrent: false, ignoreReadonly: true };
                // self.dtpFromTime = commonjs.bindDateTimePicker("divFromTime", dtpTimeOptions);
                // self.dtpToTime = commonjs.bindDateTimePicker("divToTime", dtpTimeOptions);
                // self.dtpFromTimeLast = commonjs.p("divFromTimeLast", dtpTimeOptions);
                // self.dtpToTimeLast = commonjs.bindDateTimePicker("divToTimeLast", dtpTimeOptions);
                self.disableUnselectedData();
                $('#btnClosePopup').click(function (e) {
                    $('#site_modal_div_container').hide();
                });
                $('#btnSaveStudyFilter').click(function (e) {
                    self.saveStudyFilter();
                });
            },

            disableUnselectedData: function () {
                $('#ddlLast, #txtFromTimeLast, #txtToTimeLast, #txtDateFrom, #txtFromTimeDate, #txtDateTo, #txtToTimeDate, #txtLastTime').prop('disabled', 'disabled');
                
                $('#rbtPreformatted').click(function (e){
                    $('#ddlDatePreformatted').prop('disabled', false);
                    $('#ddlLast, #txtFromTimeLast, #txtToTimeLast, #txtDateFrom, #txtFromTimeDate, #txtDateTo, #txtToTimeDate, #txtLastTime').prop('disabled', 'disabled');
                });

                $('#rbtLast, #rbtNext').click(function (e){
                    $('#txtLastTime, #ddlLast, #txtFromTimeLast, #txtToTimeLast').prop('disabled', false);
                    $('#txtDateFrom, #txtFromTimeDate, #txtDateTo, #txtToTimeDate, #ddlDatePreformatted').prop('disabled', 'disabled');
                });
                
                $('#rbtDate').click(function (e) {
                    $('#txtDateFrom, #txtFromTimeDate, #txtDateTo, #txtToTimeDate').prop('disabled', false);
                    $('#txtLastTime, #ddlLast, #txtFromTimeLast, #txtToTimeLast, #ddlDatePreformatted').prop('disabled', 'disabled');
                });
            },

            saveStudyFilter: function () {
                var self = this;
                var dateJsonCondition = null;
                //TO DO filterType value need to confirm and assign
                filterType = 5;
                filterName = $('#txtFilterName').val()?$('#txtFilterName').val() :'';
                filterOrder = $('#txtFilterOrder').val()?$('#txtFilterOrder').val():'';
                isActive = $('#chkIsActive').is(":checked");
                isGlobal = $('#chkIsGlobalFilter').is(":checked");
                isDisplayAsTab = $('#chkDisplayAsTab').is(":checked");
                isDisplayInDropDown = $('#chkDisplayAsDDL').is(":checked");

                if ($('#rbtPreformatted').is(':checked')) {
                    var dateJsonCondition = "Preformatted";
                }
                else if ($('#rbtLast').is(':checked') || $('#rbtNext').is(':checked')) {
                    dateJsonCondition = $('#rbtLast').is(':checked') ? "Last" : "Next";
                }
                else if ($('#rbtDate').is(':checked')) {
                    dateJsonCondition = "Date";
                }
                var json = {
                    date: {
                        preformatted: $.trim($('#ddlDatePreformatted').val()),
                        durationValue: $.trim($('#txtLastTime').val()),
                        duration: $('#ddlLast option:selected').text(),
                        fromTime: $('#txtFromTimeLast').val() ? $('#txtFromTimeLast').val() : null,
                        toTime: $('#txtToTimeLast').val() ? $('#txtToTimeLast').val() : null,
                        fromDate: $('#txtDateFrom').val() ? $('#txtDateFrom').val() : null,
                        fromDateTime: $('#txtFromTimeDate').val() ? $('#txtFromTimeDate').val() : null,
                        toDate: $('#txtDateTo').val() ? $('#txtDateTo').val() : null,
                        toDateTime: $('#txtToTimeDate').val() ? $('#txtToTimeDate').val() : null,
                        isStudyDate: $('#rbtStudyDate').is(":checked"),
                        dateType: $('#rbtStudyDate').is(":checked") ? "study_dt" : $('#rbtStudyReceivedDate').is(":checked") ? "study_received_dt" : $('#rbtScheduledDate').is(":checked") ? "scheduled_dt" : $('#rbtStatusChangeDate').is(":checked") ? "status_last_changed_dt" : "study_dt"
                    }
                };
                this.model.set({
                    userID:app.userID,
                    filterType:filterType,
                    json:json,
                    filterName:filterName,
                    filterOrder:filterOrder,
                    isActive:isActive,
                    isGlobal:isGlobal,
                    isDisplayAsTab:isDisplayAsTab,
                    isDisplayInDropDown:isDisplayInDropDown                    
                });
                this.model.save({},
                    {
                       success: function (model, response) {
                           commonjs.hideLoading();
                       },
                       error: function (model, response) {
                           commonjs.handleXhrError(model, response);
                       }
                   });
            }
        })
    });