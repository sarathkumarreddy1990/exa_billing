/*  Track Form Changes Plug-in   */
(function (factory) {
    if (typeof define === 'function' && define.amd) {
      // AMD. Register as an anonymous module.
      define(['jquery'], factory);
    } else {
      // Browser globals
      factory(jQuery);
    }
}(function($) {
    $.fn.extend({
        trackFormChanges: function(callback) {
            var self = this;
            self.setFormUnchanged();
            
            $(":input", self).change(function () {
                self.setFormChanged();
            });
            
            $(":input", self).keyup(function () {
                self.setFormChanged();
            });

            $(window).on('beforeunload', function (e) {
                if (self.isFormChanged()) {
                    return true;
                }
                else { 
                    e = null;
                }
            });

            $(document).off('keydown')
            .on('keydown', function (e) {
                var dialogElements = ['#divPendingPayment'];
                if (e.keyCode == 27 && $(dialogElements.join(',')).length) {
                    callback && callback(self.isFormChanged());
                }
            })
        },
        setFormChanged: function () {
            this.data("formChanged", true); 
        },
        setFormUnchanged: function () {
            this.data("formChanged", false); 
        },
        isFormChanged: function () { 
            return this.data("formChanged"); 
        }
    });
}));
