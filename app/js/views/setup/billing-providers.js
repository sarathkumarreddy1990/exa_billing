define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid', 'jqgridlocale',
    'text!templates/setup/billing-provider-grid.html',
    'text!templates/setup/billing-provider-form.html',
]
    , function (
        $,
        _,
        Backbone,
        JQGrid,
        JGridLocale,
        BillingProviderGrid,
        BillingProviderForm
    ) {
        var BillingProvidersView = Backbone.View.extend({
            el: null,
            pager: null,
            model: null,
            billingProviderTemplate: _.template(BillingProviderGrid),
            billingProviderTemplateForm: _.template(BillingProviderForm),

            events: {
            },

            initialize: function (options) {
                this.options = options;
                // this.pager = new ModelIcdPager();
                // this.model = new ModelIcdCode();
                // this.icdList = new IcdList();
                // commonjs.activatelink('Scheduling & Codes');
            },

            render: function () {
                $(this.el).html(this.billingProviderTemplate());
            },

            renderForm: function () {
                var self = this;
                var ipForm = $(this.el).find('#divBillingProvidersForm');
                ipForm.html(this.billingProviderTemplateForm);
                // commonjs.validateForm({
                //     rules: {
                //         code: {
                //             minlength: 2,
                //             maxlength: 16,
                //             required: true
                //         },
                //         description: {
                //             required: true,
                //             minlength: 2
                //         }
                //     },
                //     messages: {
                //         code: commonjs.getMessage("*", "Icd Code(16 Characters only)"),
                //         description: commonjs.getMessage("*", "Icd Description")
                //     },
                //     submitHandler: function () {
                //         self.save();
                //     },
                //     formID: '#inputFormICD'
                // });
            },

            showGrid: function () {
                this.render();
            },

            showForm: function (id) {
                var self = this;
                this.render();
                this.renderForm();
            },
        });

        return BillingProvidersView;
    });
