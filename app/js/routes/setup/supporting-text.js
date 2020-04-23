define([//
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/supporting-text'
],
    function (
        $,
        Backbone,
        SubRoute,
        SupportingTextView
        ) {
        var SupportingTextRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },
            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Supporting Text";
                this.options.currentView = this.supportingTextScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.supportingTextScreen = new SupportingTextView(this.options);
                }
            },
            showGrid: function () {
                this.initializeRouter();
                this.supportingTextScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.supportingTextScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.supportingTextScreen.showForm(id);
            }

        });

        return SupportingTextRouter;
    });