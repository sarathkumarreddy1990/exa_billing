const { query } = require('./index');

module.exports = {

    getStudyIds: async function () {

        const sql = `SELECT
                        MAX(ps.id) as id
                     FROM public.studies ps
                     WHERE
                        ps.study_status in ('CHI','SCH')
                    AND ps.deleted_dt is null
                    AND NOT EXISTS (SELECT
                                        1
                                    FROM billing.charges_studies bcs
                                    WHERE
                                    ps.id = bcs.study_id)`;

        return await query(sql);

    },

    getPatientId: async function () {

        const sql = `SELECT
                        MAX(pp.id) as id
                     FROM public.patients pp
                     INNER JOIN public.patient_insurances ppi on ppi.patient_id = pp.id
                     WHERE
                         pp.deleted_dt IS NULL `;

        return await query(sql);

    },

    getinsuranceProviderId: async function () {

        const sql = `SELECT
                        MAX(id) as id
                     FROM public.insurance_providers
                     WHERE
                        NOT has_deleted `; // insurance_providers.has_deleted

        return await query(sql);

    },

    getProviderGroupId: async function () {

        const sql = `SELECT
                        MAX(id) as id
                     FROM public.provider_groups
                     WHERE
                        NOT has_deleted `; // provider_groups.has_deleted

        return await query(sql);

    },

    getProviderContactId: async function () {

        const sql = `SELECT
                        MAX(id) as id
                     FROM public.provider_contacts
                     WHERE
                        NOT has_deleted `; // provider_contacts.has_deleted

        return await query(sql);

    },

    getPaymentReasonId: async function () {

        const sql = `SELECT
                        MAX(id) as id
                     FROM billing.payment_reasons`;

        return await query(sql);

    },

    getCompanyId: async function () {

        const sql = `SELECT
                        MAX(id) as id
                     FROM public.companies`;

        return await query(sql);

    },

    getFacilityId: async function () {

        const sql = `SELECT
                        MAX(id) as id
                     FROM public.facilities`;

        return await query(sql);

    },

    getUserId: async function () {

        const sql = `SELECT
                        MAX(id) as id
                     FROM public.users`;

        return await query(sql);

    },

    getClaimId: async function () {

        const sql = `SELECT
                        MAX(bc.id) as claim_id
                     FROM billing.claims bc
                     INNER JOIN billing.charges bch on bc.id = bch.claim_id`;

        return await query(sql);

    },

    getAdjustmentCodeId: async function () {

        const sql = `SELECT
                        MAX(id) as id
                     FROM billing.adjustment_codes`;

        return await query(sql);

    }

};
