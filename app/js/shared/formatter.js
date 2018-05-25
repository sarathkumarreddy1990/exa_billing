'use strict';
define('formatter', function () {
    return function ( id, data, changeGrid ) {
        this.setCell = changeGrid.setCell(id);

        // TODO: Add modality!

        this.study_flag = function ( value ) {
            return [{
                'data': value || '',
                'field': 'study_flag'
            }];
        };

        this.eligibility_verified = function ( value ) {
            return changeGrid.setEligibility(value, data);
        };

        this.has_deleted = function ( value ) {
            changeGrid.setWaitingTime(id, data);
            return changeGrid.setDeleted(id, value);
        };

        this.stat_level = function ( value ) {
            return changeGrid.getStatLevel(id, value);
        };

        this.tat_level = function ( value ) {
            return changeGrid.getTATLevel(value);
        };

        this.as_transcription = function ( value ) {
            return changeGrid.getTranscription(value);
        };

        this.as_report = function ( value ) {
            return changeGrid.getReport(value);
        };

        this.status_code = function () {
            return changeGrid.getStudyStatus(data);
        };

        this.study_status = function () {
            return changeGrid.getStudyStatus(data);
        };

        this.order_status_code = function () {
            return changeGrid.getOrderStatus(data);
        };

        this.order_status = function () {
            return changeGrid.getOrderStatus(data);
        };

        this.linked_study_id = function ( value ) {
            var cells = !value ?
                        changeGrid.getUnlinkStudy(id) :
                        changeGrid.getLinkStudy(data);
            return cells.concat(changeGrid.getViewers(data));
            // TODO: Handle better - will need to change more than one row's data potentially.
        };

        this.locked_by = function ( value ) {
            return changeGrid.getLocked(value);
        };

        this.as_authorization = function ( value ) {
            return changeGrid.getAuthorizations(value);
        };

        this.insurance_providers = function ( value ) {
            var string = Array.isArray(value) && value.length > 0 && value.join() || '';
            return [{
                'field': 'insurance_providers',
                'data': string || typeof value === 'string' && value || ''
            }];
        };

        this.empty_notes_flag = function () {
            return changeGrid.getNotes(data);
        };

        this.notes = function () {
            return changeGrid.getNotes(data);
        };

        this.order_notes = function ( value ) {
            return changeGrid.getOrderNotes(value);
        };

        this.as_prior = function () {
            return changeGrid.getPrior(data);
        };

        this.has_priors = function () {
            return changeGrid.getPrior(data);
        };

        this.as_webviewer = function () {
            return changeGrid.getViewers(data);
        };

        this.as_opal = function () {
            return changeGrid.getViewers(data);
        };

        this.as_localprefetchviewer = function () {
            return changeGrid.getViewers(data);
        };

        this.dicom_status = function ( value ) {
            return changeGrid.getTempStudyStatus(value).concat(changeGrid.getViewers(data));
        };

        this.no_of_instances = function () {
            return changeGrid.getViewers(data);
        };

        this.as_has_unread_dicom = function () {
            return changeGrid.getHasUnreadDicom(data);
        };

        this.has_unread_dicoms = function () {
            return changeGrid.getHasUnreadDicom(data);
        };

        this.mudatacaptured = function () {
            return changeGrid.getMU(data);
        };

        this.mu_passed = function () {
            return changeGrid.getMU(data);
        };

        this.referring_providers = function () {
            return changeGrid.getReferringProviders(id, data);
        };

        this.referring_provider_ids = function () {
            return changeGrid.getReferringProviders(id, data);
        };

        this.refphy_name = function () {
            return changeGrid.getRefPhy(data);
        };

        this.readphy_arr = function () {
            return changeGrid.getReadPhy(id, data);
        };

        this.readphy_name = function () {
            return changeGrid.getReadPhy(id, data);
        };

        this.patient_age = function ( value ) {
            return changeGrid.getAge(value);
        };

        this.birth_date = function ( value ) {
            return changeGrid.getDOB(value);
        };

        this.study_info = function ( value ) {
            var studyInfo = commonjs.hstoreParse(value);
            var chkInDt = studyInfo[ 'Check-InDt' ];
            if ( chkInDt ) {
                return changeGrid.getDate(data.facility_id, chkInDt || '', 'check_indate', true);
            }
        };

        this.check_indate = function ( value ) {
            var studyInfo = commonjs.hstoreParse(value);
            var chkInDt = studyInfo[ 'Check-InDt' ];
            chkInDt = chkInDt || value;
            if ( chkInDt ) {
                return changeGrid.getDate(data.facility_id, chkInDt || '', 'check_indate', true);
            }
        };

        this.study_last_changed_dt = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'study_last_changed_dt', true);
        };

        this.study_received_dt = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'study_received_dt', true);
        };

        this.study_dt = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'study_dt', true);
        };

        this.status_last_changed_dt = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'status_last_changed_dt', true);
        };

        this.mu_last_updated = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'mu_last_updated', true);
        };

        this.series_dt = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'series_dt', true);
        };

        this.created_dt = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'created_dt', true);
        };

        this.created_date = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'created_dt', true);
        };

        this.content_dt = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'content_dt', true);
        };

        this.acquisition_date = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'acquisition_date', true);
        };

        this.ordered_dt = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'ordered_dt', true);
        };

        this.scheduled_dt = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'scheduled_dt', true);
        };

        this.approved_dt = function ( value ) {
            return changeGrid.getDate(data.facility_id, value, 'approved_dt', true);
        };

        this.gender = function ( value ) {
            return changeGrid.getGender(value);
        };

        this.order_type = function ( value ) {
            return changeGrid.getOrderType(value);
        };

        this.cpt_codes = function ( value ) {
            return [{
                'field': 'studies.cpt_codes',
                'data': Array.isArray(value) && value.length > 0 && value.join() || ''
            }];
        };

        this.order_info = function ( value ) {
            var orderInfo = commonjs.hstoreParse(value);
            return [{
                'field': 'order_info',
                'data': orderInfo && orderInfo.order_status_desc || ''
            }];
        };

        this.facility_info = function ( value ) {
            var facilityInfo = commonjs.hstoreParse(value);
            return [{
                'field': 'facility_info',
                'data': facilityInfo && facilityInfo.enable_manual_checkout || ''
            }];
        };

        this.current_status_waiting_time = function () {
            return changeGrid.setWaitingTime(id, data);
        };

        this.max_waiting_time = function () {
            return changeGrid.setWaitingTime(id, data);
        };

        this.payer_name = function ( value ) {
            return changeGrid.getResponsible(value);
        };

        this.final_status = function ( value ) {
            return changeGrid.setFinalStatus(id, value === 'CO');
        };

        this.hasCompleted = function ( value ) {
            return changeGrid.setFinalStatus(id, !!value);
        };

        this.id = function () {};

        this.anything_else = function ( value, field ) {
            return [{
                'field': field,
                'data': value
            }];
        };
    };
});
