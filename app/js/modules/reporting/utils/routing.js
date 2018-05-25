define([
    'jquery'
    , 'underscore'
    , 'backbone'
],
    function ($, _, Backbone) {

        const Routing = {

            /**
             * In order to re-use element IDs in multiple views, we have to 'unload' previous view
             * so that none of events, and data does not get mixed up. After removing the zombie view,
             * we add back in the empty div into which new view can be rendered.
             * For more info see:
             *  http://stackoverflow.com/a/15627206
             *  https://lostechies.com/derickbailey/2011/09/15/zombies-run-managing-page-transitions-in-backbone-apps/
             */
            clearView: function(view) {
                if (view) {
                    //console.warn('routing - clearing view for: ', view.viewModel.reportId);
                    var parent = view.$el.parent();
                    view.undelegateEvents();
                    view.stopListening();
                    view.unbind();
                    view.remove();
                    view.$el.removeData().unbind();
                    parent.append('<div id="data_container" class="page-full"></div>');
                }
            }
        }

        return Routing;

    });
