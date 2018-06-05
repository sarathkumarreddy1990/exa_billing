define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'models/pager',
    'text!templates/claim-inquiry.html'
], function (
    $,
    _,
    Backbone,
    JGrid,
    JGridLocale,
    Pager,
    claimInquiryTemplate) {
        return Backbone.View.extend({
            el: null,
            pager: null,
            inquiryTemplate: _.template(claimInquiryTemplate),

            initialize: function(options){
                var self = this;
                self.options = options;
                self.pager = new Pager();
                self.render();
                self.encounterDetails();
            },

            render: function(){
                this.$el.html(this.inquiryTemplate());
            },

            encounterDetails: function(){
                var self = this;
                 $.ajax({
                    url: '/exa_modules/billing/claimInquiry',
                    type: 'GET',
                    data: {
                         'claim_id': 4262
                    },
                    success: function(data, response){
                         if(data){
                             console.log('data ', data);
                             console.log('response', response)
                            data = data[0];
                            var encounter = data.encounter_details[0];

                            //binding the values from data base
                            $('#lblCIReadPhy').text(encounter.rend_provider_name); 
                            $('#lblCIRefPhy').text(encounter.ref_provider_name);
                            $('#lblCIOrdFac') .text(encounter.group_name);
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
                         }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }

                })
            },

            insuranceGrid: function(data){
                $('#tblCIInsurance').jqGrid({
                    datatype: 'local',
                    data: data,
                    colNames: ['', 'code', 'description'],
                    colModel: [
                        {name:'id', hidden: true},
                        {name:'insurance_code', search:false},
                        {name:'insurance_name', search:false}
                    ],
                    cmTemplate: {sortable: false},
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
                        {name: '', index: 'id', key: true, hidden: true},
                        {name: 'code', width: 100, search: false},
                        {name: 'description', width: 100, search: false}
                    ],
                    cmTemplate: {sortable: false},
                    customizeSort: true,
                    shrinkToFit: true,
                    width: $('#encounterDetails').width() - 50
                });
                $('#gview_tblCIDiagnosis').find('.ui-jqgrid-bdiv').css('max-height', '180px')
            },
        })

    });