'use strict';

const moment = require('moment');

module.exports = (fieldID, fieldValue) => {
    if (!fieldValue) {
        return ` "${fieldID}" IS NULL`;
    }

    const fromToDates = fieldValue.split(/\s-\s/);
    const useToFacilityDate = ['studies.study_dt', 'studies.schedule_dt', 'studies.study_received_dt', 'studies.approved_dt'].includes(fieldID);  // This is a hack to force query planner to use specific index which is much faster

    if (fromToDates.length === 1) {
        const date = moment(fromToDates[0], 'YYYY-MM-DD');

        if (date.isValid()) {
            if (useToFacilityDate) {
                return ` (to_facility_date(studies.facility_id, ${fieldID}) = ('${date.format('YYYY-MM-DD')}')::date AND ${fieldID} IS NOT NULL)`;
            }

            return ` ((${fieldID})::date = ('${date.format('YYYY-MM-DD')}')::date)`;
        }
    } else if (fromToDates.length === 2) {
        const from = moment(fromToDates[0], 'YYYY-MM-DD');
        const to = moment(fromToDates[1], 'YYYY-MM-DD');

        if (from.isValid() && to.isValid()) {
            if (useToFacilityDate) {
                return ` (to_facility_date(studies.facility_id, ${fieldID}) BETWEEN ('${from.format('YYYY-MM-DD')}')::date AND ('${to.format('YYYY-MM-DD')}')::date AND ${fieldID} IS NOT NULL)`;
            }

            return ` ((${fieldID})::date BETWEEN ('${from.format('YYYY-MM-DD')}')::date AND ('${to.format('YYYY-MM-DD')}')::date)`;
        }
    }

    return '';
};
