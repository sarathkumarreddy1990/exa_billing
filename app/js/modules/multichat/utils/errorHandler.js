define([],
    function () {
        var ErrorHandler = {
            handleRequestError: function (error, options) {
                options = options || {};
                options.errorKey = options.errorKey || 'chat.errors.someerror';

                var errorCode = null;
                try {
                    errorCode = JSON.parse(error.responseText).errorCode;
                    /* eslint-disable no-empty */
                } catch(e) {

                }
                /* eslint-enable no-empty */
                if (errorCode == 'CHT_ROOM_TITLE_LENGTH_EXCEEDED') options.errorKey = 'chat.errors.exceedsTitleLimits';
                if (errorCode == 'CHT_ROOM_TITLE_LENGTH_DECEEDED') options.errorKey = 'chat.errors.deceedsTitleNameLimit';

                if (options.showCommonjsAlert !== false) {
                    commonjs.showWarning(options.errorKey);
                }

                this.trigger('request_error', { error: error, options: options });
            }
        };

        return ErrorHandler;
    });
