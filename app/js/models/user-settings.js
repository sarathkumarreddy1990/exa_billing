define(['backbone'],function(Backbone){
                    var models=Backbone.Model.extend({
                        url:"/exa_modules/billing/user_setting_billing_fields",
                        defaults:{
                        },
                        initialize:function(models){
                        }
                    });
                    return models;
                });
                