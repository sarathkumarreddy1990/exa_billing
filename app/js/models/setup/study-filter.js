define(['backbone'],function(Backbone){
                    var StudyFiltersModel=Backbone.Model.extend({
                        url:'/exa_modules/billing/setup/study_filters',
                        defaults:{
                        },
                        initialize:function(StudyFiltersModel){
                        }
                    });
                    return StudyFiltersModel;
                });