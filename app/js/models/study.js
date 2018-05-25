/**
 * Author  : Sumither
 * Created : 4/20/13 2:52 PM
 * ----------------------------------------------------------------------
 * Copyright © EMD Systems Software Private Ltd.  All rights reserved.
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.txt', which is part of this source code package.
 * All other rights reserved.
 * ----------------------------------------------------------------------
 */
define([ 'backbone' ], function ( Backbone ) {
    return Backbone.Model.extend({
        'defaults': {
            "study_id": '',
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
        'idAttribute': "study_id",
        'url': '/test',
        'initialize': function () {
            this.on('sync', function ( model ) {
                var root = parent && parent.commonjs ? parent.commonjs : commonjs;
                if ( model.get('study_id') > 0 && model.changed ) {
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
