define(['jquery',
    'underscore',
    'backbone',
    'text!templates/claims/followup.html',
], function (
    $,
    _,
    Backbone,
    followUpHTML
) {
    return Backbone.View.extend({
        el: null,
        followUpTemplate: _.template(followUpHTML),

        initialize: function (options) {
            this.options = options;
        },

        render: function (claimIDs) {
            this.rendered = true;
            commonjs.showDialog({
                header: 'Add FollowUp',
                i18nHeader: 'setup.rightClickMenu.addFollowUP',
                width: '30%',
                height: '20%',
                html: this.followUpTemplate()
            });
            commonjs.bindDateTimePicker("divFollowUpDateBilling", { format: 'L' });
            $('#siteModal').removeAttr('tabindex'); //removed tabIndex attr for select2 search text can't editable
            this.bindEvents(claimIDs);
        },

        bindEvents: function (claimIDs) {
            var self = this;
            
            $('#saveFollowup').off().click(function () {
                self.saveFollowup(claimIDs);
            });

            if (app.userInfo && app.userInfo.user_settings && app.userInfo.user_settings) {
                if (app.userInfo.user_settings.assignClaimsToFollowUpQueue && app.userInfo.user_settings.assignClaimsToFollowUpQueue == 'true') {
                    $('#followUpUsersList').show();
                    self.setUserAutoComplete();
                }
            }
            
        },

        saveFollowup: function (claimIDs) {
            var followUpDate = $('#txtFollowUpDate').val();
            var followUPUserID = $('#txtFollowupUsers').val();
            var currentDate = moment().format('L');
            if (moment(followUpDate).format('MM/DD/YYYY') < currentDate) {
                commonjs.showWarning('Cannot Select Past date');
                return;
            }

            var followUpDetails = [];
            claimIDs = claimIDs.split(',');

            _.each(claimIDs, function (id) {
                followUpDetails.push({ claimID: id, assignedTo: app.userID, followupDate: followUpDate, followUPUserID: followUPUserID })
            });
            
            $.ajax({
                url: '/exa_modules/billing/claim_workbench/follow_ups',
                type: 'PUT',
                data: {
                    'claimIDs': claimIDs.join(','),
                    'followupDate': followUpDate,
                    'assignedTo': followUPUserID ? followUPUserID : app.userID,
                    'followUpDetails': JSON.stringify(followUpDetails)
                },
                success: function (data, response) {
                    commonjs.showStatus('Record Saved Successfully');
                    commonjs.hideDialog();
                    $('#btnClaimsRefresh').trigger('click');
                },
                error: function (err) {
                    commonjs.handleXhrError(err);
                }
            });

        },

        setUserAutoComplete: function () {
            var self = this;

            $("#txtFollowupUsers").select2({
                ajax: {
                    url: "/exa_modules/billing/autoCompleteRouter/getUsers",
                    dataType: 'json',
                    delay: 250,
                    data: function (params) {
                        return {
                            page: params.page || 1,
                            q: params.term || '',
                            pageSize: 10,
                            sortField: "user_name",
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
                placeholder: 'Select users',
                escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                minimumInputLength: 0,
                templateResult: formatRepo,
                templateSelection: formatRepoSelection
            });
            
            function formatRepo(repo) {
                if (repo.loading) {
                    return repo.user_name;
                }
                var markup = "<table><tr>";
                markup += "<td  data-id='" + repo.id + " ' title='" + repo.user_name + "(" + repo.user_name + ")'> <div>" +  repo.last_name +" "+  repo.first_name + "("+ repo.id + ")" + "</div>";
                markup += "</td></tr></table>";
                return markup;

            }
            function formatRepoSelection(res) {
                if (res && res.id) {
                    return res.user_name;
                }
            }            
            
        },

        resetFollowUp: function(claimIDs) {
            claimIDs = claimIDs.split(',');

            $.ajax({
                url: '/exa_modules/billing/claim_workbench/follow_ups',
                type: 'PUT',
                data: {
                    'claimIDs': claimIDs.join(','),
                    'followupDate': '',
                    'assignedTo': '',
                    'followUpDetails': ''
                },
                success: function (data, response) {
                    commonjs.showStatus('Followup Reset Successfully');
                    $('#btnClaimsRefresh').trigger('click');
                },
                error: function (err) {
                    commonjs.handleXhrError(err);
                }
            });
        }
    });
});