define(['backbone'],function(Backbone){
    var pagerModel=Backbone.Model.extend({
        defaults:{
            "PageNo":1,
            "LastPageNo":1,
            "PreviousPageNo":0,
            "NextPageNo":0,
            "pageSize": 10,
            "PageSize":10,
            "FilterQuery":"",
            "SortField":"",
            "SortOrder":"ASC",
            "TotalRecords":0,
            "q":'',
            "pageNo":1
        },

        initialize:function(){
        }
    });

    return pagerModel;
});
