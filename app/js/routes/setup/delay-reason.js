define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/delay-reason'
],
    function (
        $,
        Backbone,
        SubRoute,
        DelayReasonView
    ) {
        var DelayReasonRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.delayReasonScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.delayReasonScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.delayReasonScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Delay Reasons";
                this.options.currentView = this.delayReasonScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.delayReasonScreen = new DelayReasonView(this.options);
                }
            }
        });

        return DelayReasonRouter;
    });

