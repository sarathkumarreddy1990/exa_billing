define([ 'backbone' ], function ( Backbone ) {
    return Backbone.Model.extend({
        'defaults': {
            "claim_id": '',
            "patient_id": 0,
            "facility_id": 0,
            "modality_id": 0,
            "study_dt": "",
            "room_info": "",
            "cpt_codes": [],
            "units": "",
            "duration": 0,
            "global_fee": 0,
            "body_part": "",
            "orientation": "",
            "has_deleted": false,
            "module": "patient",
            "stat_level": "",
            "priority": "",
            "order_id": ""
        },
        'idAttribute': "claim_id",
        'url': '/test',
        'initialize': function () {
            this.on('sync', function ( model ) {
                var root = parent && parent.commonjs ? parent.commonjs : commonjs;
                if ( model.get('claim_id') > 0 && model.changed ) {
                    root.updateInfo(model.id, 'study');
                }
            });
            this.on('invalid', function ( model, error, options ) {
                var filter = options.filter;
                if ( filter && filter.datastore ) {
                    filter.datastore.remove(model.cid, options);
                }
            });
        },
        'serializingRoomInfo': function () {
            var roomInfo = {
                "Office": this.get('facility_name'),
                "Modality": this.get('modality_name'),
                "ModalityRooms": this.get('room_name')
            };
            this.set({
                "room_info": roomInfo
            });
        }
    });
});
