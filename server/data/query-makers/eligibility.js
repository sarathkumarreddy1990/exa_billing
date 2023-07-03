"use strict";

module.exports = ( fieldID, fieldValue ) => {
    switch ( fieldValue === `true` || fieldValue === true ) {
        case true:
            return ` (
                orders.order_info ? 'manually_verified'
                OR (
                    eligibility.verified IS NOT NULL
                    AND eligibility.verified
                )
            ) `;
        case false:
            return ` (
                eligibility.verified IS NOT NULL
                AND NOT eligibility.verified
                AND (
                    NOT ( orders.order_info ? 'manually_verified' )
                    OR (orders.order_info -> 'manually_verified_dt') :: TIMESTAMPTZ < eligibility.dt
                )
            ) `;
    }
    return ``;
}
