

define(['backbone', 'underscore'], function (Backbone, _) {

    return {
        services: {
            EDT_UPLOAD: 'upload',
            EDT_SUBMIT: 'submit',
            EDT_LIST: 'list',
            EDT_DOWNLOAD: 'download',
            EDT_INFO: 'info',
            EDT_UPDATE: 'update',
            EDT_DELETE: 'delete',
            EDT_GET_TYPE_LIST: 'getTypeList'
        },

        responseCodes: {
            SUCCESS: "IEDTS0001",  // green

            RESOURCE_TYPE_NOT_FOUND: "EEDTS0003",
            FILE_UPLOAD_FAILED: "EEDTS0010",
            INVALID_MUID: "EEDTS0012",

            USER_NOT_ALLOWED: "EEDTS0050",
            NO_DATA_FOR_PROCESSING: "EEDTS0051",
            DATA_PROCESSING_FAILED: "EEDTS0052",
            DATA_NOT_PROCESSED: "EEDTS0053",
            DIFFERENT_SUBMIT_USER: "EEDTS0054",
            RESOURCE_CANNOT_BE_SUBMITTED: "EEDTS0055",  // (because it's not in the upload status)
            RESOURCE_ID_CANNOT_BE_FOUND: "EEDTS0056",
            RESOURCE_CANNOT_BE_DELETED: "EEDTS0057",    // (because it's not in the upload status)
            DIFFERENT_DELETE_USER: "EEDTS0058",
            RESOURCE_CANNOT_BE_UPDATED: "EEDTS0059",    // (because it's not in the upload status)
            DIFFERENT_UPDATE_USER: "EEDTS0060",
            USER_DOES_NOT_HAVE_PERMISSION: "EEDTS0061",

            MALFORMED_HEADER: "ECLAM0002",
            MISSING_BILLING_NUMBER: "ECLAM0003",    // (in the header)
            TRAILER_HEADER_ONE_COUNT_MISMATCH: "ECLAM0005",
            TRAILER_HEADER_TWO_COUNT_MISMATCH: "ECLAM0006",
            TRAILER_ITEM_COUNT_MISMATCH: "ECLAM0007",
            CLAIM_FILE_MUST_BE_79_BYTES: "ECLAM0008",

            OBEC_INVALID_FILE_LENGTH: "EOBEC0002",
            OBEC_MALFORMED_HEADER: "EOBEC0003",
            OBEC_INVALID_HEALTH_NUMBER_LENGTH: "EOBEC0004",
            OBEC_NON_NUMEROC_HEALTH_NUMBER: "EOBEC0005"
        },

        isResourceResult: function(service) {
            return [this.services.EDT_UPLOAD, this.services.EDT_UPDATE, this.services.EDT_DELETE, this.services.EDT_SUBMIT].includes(service);
        },

        isDetailResult: function(service) {
            return [this.services.EDT_INFO, this.services.EDT_LIST].includes(service);
        },

        isDownloadResult: function(service) {
            return [this.services.EDT_DOWNLOAD].includes(service);
        },

        isTypeListResult: function(service) {
            return [this.services.EDT_GET_TYPE_LIST].includes(service);
        },

        getDataPlucker: function(service) {

            if (this.isDetailResult(service)|| this.isDownloadResult(service) || this.isTypeListResult(service)) {
                return (result) => {
                    return result.data;
                }
            }
            else if (this.isResourceResult(service)) {
                return (result) => {
                    return result.response;
                }
            }
            else {
                return null;
            }
        },

        separateResults: function(ebsResponse, service, responseCode) {

            if (!responseCode) {
                responseCode = 'IEDTS0001';
            }

            var dataPlucker = this.getDataPlucker(service);
            return _.reduce(ebsResponse.results, function(results, result) {
                var pluckedData = dataPlucker(result);
                if (pluckedData) {
                    pluckedData.forEach((data) => {
                        if (data.code === responseCode) {
                            results[responseCode] = (results[responseCode] || []).concat(data);
                        }
                        else {
                            results['other'] = (results['other'] || []).concat(data);
                        }
                    });
                }
                return results;
            }, {});
        }
    };
});
