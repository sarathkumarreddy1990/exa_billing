define(['jquery'
        ,'underscore'
        , 'backbone'
        , 'text!modules/multichat/templates/modals/modalBase.html'
        , 'modules/multichat/utils/triggers'
    ],
    function(
        $
        , _
        , Backbone
        , templateModalBase
        , Triggers
    ) {

        return Backbone.View.extend({

            templateModalBase: _.template(templateModalBase),

            events: {
                "click .js_chat-modal-overlay, .js_chat-modal__close": "close",
            },

            initialize: function(options) {
                this._appendTemplates(options);
                this.options = options;
                $(document).on('keyup', this._closeOnEsc.bind(this));
            },

            _appendTemplates: function(options){
                options = options || {};
                options.template = options.template || '';

                var getCustomTemplates = function(){
                    return {
                        header: $(options.templates.headerFrom).filter('#header').html(),
                        body: $(options.templates.bodyFrom).filter('#body').html(),
                        footer: $(options.templates.footerFrom).filter('#footer').html()
                    }
                };

                var getDefaultTemplates = function() {
                    var $template = $(options.template);
                    return {
                        header: $template.filter('#header').html(),
                        body: $template.filter('#body').html(),
                        footer: $template.filter('#footer').html()
                    };
                };

                this.templates = 'templates' in options ? getCustomTemplates() : getDefaultTemplates();

                $(this.el).append(this.templateModalBase(options));
                $('.chat-panel').append(this.el);
            },

            extendableProperties: {
                "events": "defaults",
                "className": function(propertyName, prototypeValue) {
                    this[propertyName] += " " + prototypeValue;
                }
            },

            _extendProperties: function(properties) {
                var propertyName, prototypeValue, extendMethod,
                    prototype = this.constructor.prototype;

                while (prototype) {
                    for (propertyName in properties) {
                        if (properties.hasOwnProperty(propertyName) && prototype.hasOwnProperty(propertyName)) {
                            prototypeValue = _.result(prototype, propertyName);
                            extendMethod = properties[propertyName];
                            if (!this.hasOwnProperty(propertyName)) {
                                this[propertyName] = prototypeValue;
                            } else if (_.isFunction(extendMethod)) {
                                extendMethod.call(this, propertyName, prototypeValue);
                            } else if (extendMethod === "defaults") {
                                _.defaults(this[propertyName], prototypeValue);
                            }
                        }
                    }
                    prototype = prototype.constructor.__super__;
                }
            },

            _closeOnEsc: function (e) {
                var keyCode = e.keyCode || e.which;
                if (keyCode === 27) {
                    this.close();
                }
            },

            constructor: function() {
                if (this.extendableProperties) {
                    this._extendProperties({"extendableProperties": "defaults"});
                    this._extendProperties(this.extendableProperties);
                }
                Backbone.View.apply(this, arguments);
            },

            close: function (data) {
                var options = this.options;
                if(options && 'actions' in options && 'onClose' in options.actions && typeof options.actions.onClose === 'function'){
                    options.actions.onClose(data);
                }
                this.trigger(Triggers.CLOSE_MODAL, data);
                this.remove();
            },

            show: function() {
                var model = (this.options && 'model' in this.options) ? this.options.model : {};
                this.render(model);
            },

            customRender: function(){
                // Inherited objects overrides this method to render a custom content after templates are rendered by the base class
            },

            render: function(model) {
                this.$('.chat-modal-header-content').html(_.template(this.templates.header)({model: model}));
                this.$('.chat-modal-body').html(_.template(this.templates.body)({model: model}));
                this.$('.chat-modal-footer').html(_.template(this.templates.footer)({model: model}));

                this.customRender();
                commonjs.updateCulture(app.currentCulture);
                this.$('.chat-modal').show(0);

                return this;
            }
        }, {
            checkModalsOpen : function() {
                return $('.modals_open').length > 0;
            }
        });

    });
