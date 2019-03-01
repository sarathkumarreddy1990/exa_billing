const responseCodes = {
    IEDTS0001: "Success",

    EEDTS0003: "Resource Type Not Found",
    EEDTS0010: "File Upload Failed",
    EEDTS0012: "MOH ID not Valid",

    EEDTS0050: "User not Allowed",
    EEDTS0051: "No Data for Processing",
    EEDTS0052: "Data Processing failed",
    EEDTS0053: "Data Not Processed",
    EEDTS0054: "User that is submitting the resource is not the same as the user that uploaded it.",
    EEDTS0055: "The resource is not in the upload status so cannot be submitted",
    EEDTS0056: "The resource id specified cannot be found.",
    EEDTS0057: "The resource is not in the upload status so cannot be deleted",
    EEDTS0058: "User that is deleting the resource is not the same as the user that uploaded it.",
    EEDTS0059: "The resource is not in the upload status so cannot be updated",
    EEDTS0060: "User that is updating the resource is not the same as the user that uploaded it",
    EEDTS0061: "User does not have permission to perform this action",

    ECLAM0002: "Mal Formed Header",
    ECLAM0003: "Missing Billing Number in the header",
    ECLAM0005: "Mal Formed Trailer. Claim Header – 1 header count does not match number of Claim Header – 1 headers in batch",
    ECLAM0006: "Mal Formed Trailer. Claim Header – 2 header count does not match number of Claim Header – 2 headers in batch",
    ECLAM0007: "Mal Formed Trailer. Item Record count does not match number of Item Records in batch",
    ECLAM0008: "Claim File must be 79 bytes",

    EOBEC0002: "OBEC File is an invalid length",
    EOBEC0003: "Mal Formed Header. The ‘OBE’ in the transaction code field is invalid.",
    EOBEC0004: "OBEC Health Number length invalid.",
    EOBEC0005: "OBEC Health Number is not numeric.",
};

module.exports = {
    responseCodes,
};
