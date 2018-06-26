define([ 'backbone', 'immutable', 'models/study-field', 'shared/fields' ], function ( Backbone, Immutable, StudyFieldModel, defaultFields ) {
    var defaultFieldsSorter = function ( a, b ) {
        /**
         * There will always be an id and it will always be unique
         */
        if ( a.id < b.id ) {
            return -1;
        }
        return 1;
    };
    var createModels = function ( fields, defaults ) {
        return fields.reduce(function ( models, data ) {
            var model = defaults.get(data.name) || defaults.get(data.custom_name);
            if ( model ) {
                model.field_info.width = data.width || 0;
                models[ models.length ] = model;
            }
            return models;
        }, []);
    };
    var reOrder = function ( against ) {
        if ( !Array.isArray(against) || arguments.length !== 1 ) {
            return Backbone.Collection.prototype.sort.apply(this, arguments);
        }
        this.reset(createModels(against, this.defaults));
    };
    return Backbone.Collection.extend({
        'model': StudyFieldModel,
        'sort': reOrder,
        'initialize': function ( models, options ) {
            this.defaults = defaultFields(options ? options.filterType : '');
            var processedModels = options && Array.isArray(options.gridOptions) ?
                                  createModels(options.gridOptions, this.defaults) :
                                  this.defaults.toArray().sort(defaultFieldsSorter);
                                  
                                    var key = [];
                                    _.each(options.field_order, function(value){
                                    _.find(processedModels, function(v, k) {
                                        if (v.id === value) {
                                            key.push(v);
                                        }
                                    });
                                });
                            
            this.set(key);
        }
    });
});
