
define(['backbone'],function(Backbone){
    var appsettings=Backbone.Collection.extend({

        url:'/exa_modules/billing/appSettings',

        initialize:function(){
        },

        parse:function(response){
            return response;
        }
    });

    return appsettings;
});
