define([],
    function () {
        var Routing = {
            clearView: function (view) {
                if (view) {
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
