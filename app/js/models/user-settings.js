define(['backbone'],function(Backbone){
                    var UserSettingsModel=Backbone.Model.extend({
                        url:"/exa_modules/billing/user_settings",
                        defaults:{
                        },
                        initialize:function(UserSettingsModel){
                        }
                    });
                    return UserSettingsModel;
                });
                