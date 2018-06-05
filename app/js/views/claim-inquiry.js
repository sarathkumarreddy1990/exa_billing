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
        return Backbone.view.extend({
            el: null,
            pager: null,
            inquiryTemplate: _.template(claimInquiryTemplate),

            initialize: function(options){
                this.options = options;
                this.pager = new Pager();
            },

            render: function(){
                this.$el.template(this.inquiryTemplate());
            },

            encounterDetails: function(){
                //  $.ajax({
                //      url: ''
                // })
            }
        })

    });