define([
        'jquery'
        , 'underscore'
    ],
    function (
        $
        , _
    ) {
        var Utils = {

            escapeHTML: function (string) {
                //common jQuery-based trick to perform escaping
                return $('<span/>').text(string).prop('innerHTML');
            },

            generateShortTimestamp: function (lastMessageTimestamp, MomentTimezone) {
                return MomentTimezone(lastMessageTimestamp).isValid() ? MomentTimezone(lastMessageTimestamp).fromNowOrNow() : '';
            }
        };
        return Utils;
    }
);
