define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/submission-types'
],
    function (
        $,
        Backbone,
        SubRoute,
        SubmissionTypesView
    ) {
        var SubmissionTypeRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.submissionTypesScreen.render();
            },

            showForm: function (id) {
                this.initializeRouter();
                this.submissionTypesScreen.renderForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Submission Types";
                this.options.currentView = this.submissionTypesScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.submissionTypesScreen = new SubmissionTypesView(this.options);
                }
            }
        });

        return SubmissionTypeRouter;
    });
