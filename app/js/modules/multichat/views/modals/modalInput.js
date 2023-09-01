define(['jquery'
        , 'underscore'
        , 'backbone'
        , 'modules/multichat/views/modals/modalBase'
    ],
    function (
        $
        , _
        , Backbone
        , ModalBase
    ) {

        return ModalBase.extend({

            events: {
                "keyup .js_chat-modal__input": "onInputKeyUp",
                "click .js_chat-modal__action": "onModalAction"
            },

            initialize: function (options) {
                var isActions = options && 'actions' in options;
                this.options = options;

                this.isActionHandled =
                    isActions &&
                    'modalAction' in options.actions && typeof options.actions.modalAction === 'function'

                this.isKeyUpHandled =
                    isActions &&
                    'inputKeyUpAction' in options.actions && typeof options.actions.inputKeyUpAction === 'function';

                ModalBase.prototype.initialize.call(this, options);
            },

            getInputData: function () {
                return $('.js_chat-modal__input').val();
            },

            getActionData: function () {
                this.getInputData();
            },

            onInputKeyUp: function () {
                if (this.isKeyUpHandled) {
                    var inputKeyUpAction = this.options.actions.inputKeyUpAction.bind(this);
                    inputKeyUpAction(this.getInputData());
                }
            },

            onModalAction: function (event) {
                event.preventDefault();
                if (this.isActionHandled) {
                    var inputAction = this.options.actions.modalAction.bind(this);
                    inputAction(this.getActionData(event));
                }
            }

        })
    }
)
