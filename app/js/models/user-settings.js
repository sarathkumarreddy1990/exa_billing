define(['backbone'],function(Backbone){
                    var UserSettingsModel=Backbone.Model.extend({
                        url:"/exa_modules/billing/user_setting_billing_fields",
                        defaults:{
                        },
                        initialize:function(UserSettingsModel){
                        }
                    });
                    return UserSettingsModel;
                });
                