define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/insurance-x12-mapping'
],
    function (
        $,
        Backbone,
        SubRoute,
        InsuranceX12MappingView
        ) {
        var InsuranceX12MappingRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.insuranceX12MappingScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.insuranceX12MappingScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.insuranceX12MappingScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Insurance Mapping";
                this.options.currentView = this.insuranceX12MappingScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.insuranceX12MappingScreen = new InsuranceX12MappingView(this.options);
                }
            }
        });

        return InsuranceX12MappingRouter;
    });