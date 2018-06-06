const
    moment = require('moment')
    ;

const util = {
    getArrayOperator: function (condition, value, column, Filter) {
        if (Filter === 'refPhy' || Filter === 'insProv') {
            switch (condition) {
            case 'Is':
                return `( '${value}' = ANY (${column}) )`;
            case 'IsNot':
                return `( '${value}' != ALL (${column}) )`;
            case 'Contains':
                return ` array_to_string(${column},',') ~* '${value}' `;
            }
        }
        else {
            switch (condition) {
            case 'Is':
                return `( '${value}' =  ANY (${column}) )`;
            case 'IsNot':
                return `( '${value}' != ALL (${column}) )`;
            }
        }
    },

    getArrayArrayOperator: function (condition, value, column) {
        switch (condition) {
        case 'Is':
            return `( ${column} && ${value} )`;
        case 'IsNot':
            return `NOT ( ${column} && ${value} )`;
        case 'Contains':
        case 'IsContains':
            return ` array_to_string(${column},',') ~* ANY(${value}) `;
        case 'IsNotContains':
            return ` array_to_string(${column},',') !~* ALL(${value}) `;
        }
    },
    getConditionalOperatorOnly: function (condition) {
        switch (condition) {
        case 'Is':
            return '=';
        case 'IsNot':
            return '!=';
        case 'Contains':
        case 'IsContains':
            return '~*';
        case 'IsNotContains':
            return '!~*';
        }
    },
    getConditionalArrayOperatorOnly: function (condition) {
        switch (condition) {
        case 'Is':
        case 'Contains':
        case 'IsContains':
            return 'ANY';
        case 'IsNot':
        case 'IsNotContains':
            return 'ALL';
        }
    },
    getConditionalOperator: function (condition, value, isKey, Filter) {

        if (Filter == "patients" || Filter == "patientID" || Filter == "readPhy" || Filter == "study_desc" || Filter === "attorney") {
            switch (condition) {
            case 'Is':
                return ' ILIKE ' + (isKey ? value : '\'' + value + '\'');
            case 'IsNot':
                return ' NOT ILIKE ' + (isKey ? value : '\'' + value + '\'');
            case 'Contains':
            case 'IsContains':
                return ' ILIKE \'%' + value + '%\'';
            case 'IsNotContains':
                return ' NOT ILIKE ' + (isKey ? value : '\'%' + value + '%\'');
            }
        }
        else if (Filter == "modalities") {
            switch (condition) {
            case 'Is':
            case 'Contains':
            case 'IsContains':
                return ` ILIKE '%${value}%'`;
            case 'IsNot':
                return ` NOT ILIKE '%${value}%'`;
            case 'IsNotContains':
                return isKey
                    ? ` NOT ILIKE ${value}`
                    : ` NOT ILIKE '%${value}%'`;
            }
        }
        else {
            switch (condition) {
            case 'Is':
                return isKey ? ` = ${value}` : ` = '${value}'`;
            case 'IsNot':
                return isKey ? ` != ${value}` : ` != '${value}'`;
            case 'Contains':
                return ` ILIKE '%${value}%'`;
            }
        }

    },
    getConditionalRelationOperator: function (condition) {
        switch (condition) {
        case 'Is':
        case 'IsContains':
        case 'Contains':
            return ' OR ';
        case 'IsNot':
        case 'IsNotContains':
            return ' AND ';
        }
    },
    getRelationOperator: function (query) {
        return query == '' ? ' ' : ' AND ';
    },
    getFromToDuration: function (duration, type, condition) {
        let dateRange;
        let toDate = moment(),
            fromDate = moment();
        duration = parseInt(duration);

        switch (condition.toLowerCase()) {
        case "last":
            switch (type) {
            case 'Hour(s)':
                fromDate = moment(fromDate).subtract(duration, 'hour');
                break;
            case 'Day(s)':
                fromDate = moment(fromDate).subtract(duration, 'day');
                toDate = moment(toDate).add(1, 'day');
                break;
            case 'Week(s)':
                fromDate = moment(fromDate).subtract(7 * duration, 'day');
                toDate = moment(toDate).add(1, 'day');
                break;
            case 'Month(s)':
                fromDate = moment(fromDate).subtract(30 * duration, 'day');
                toDate = moment(toDate).add(1, 'day');
                break;
            case 'Year(s)':
                fromDate = moment(fromDate).subtract(365 * duration, 'day');
                toDate = moment(toDate).add(1, 'day');
                break;
            }

            break;

        case "next":
            switch (type) {
            case 'Hour(s)':
                toDate = moment(toDate).add(duration, 'hour');
                break;
            case 'Day(s)':
                toDate = moment(toDate).add(duration + 1, 'day');
                break;
            case 'Week(s)':
                toDate = moment(toDate).add(7 * duration + 1, 'day');
                break;
            case 'Month(s)':
                toDate = moment(toDate).add(30 * duration + 1, 'day');
                break;
            case 'Year(s)':
                toDate = moment(toDate).add(365 * duration + 1, 'day');
                break;
            }

            break;
        }

        if (type != 'Hour(s)') {
            dateRange = moment(fromDate).format('YYYY-MM-DD') + '~' + moment(toDate).format('YYYY-MM-DD');
        } else {
            dateRange = moment(fromDate).format() + '~' + moment(toDate).format();
        }

        return dateRange;
    },
    getClaimFilterQuery:function(filterObj){
        let query = '';
        
        if (filterObj) {

            if (typeof filterObj != "object") {
                filterObj = JSON.parse(filterObj);
            }

            if (filterObj.date) {
                query += util.getDateRangeQuery(query, filterObj);
            }

            if (filterObj.ClaimInformation) {
                if (filterObj.ClaimInformation.claimStatus) {
                    let obj = filterObj.ClaimInformation.claimStatus;
                    let statusQuery = "",   
                        l = obj.list.length;
                       

                    if (l > 0) {

                        for (let i = 0; i < l; i++) {

                            if (i == 0) {
                                
                                statusQuery += ' claims.claim_status_id' + util.getConditionalOperator(obj.condition, obj.list[i].value, false, '');
                                

                            } else {
                                
                                statusQuery += util.getConditionalRelationOperator(obj.condition) + 'claims.claim_status_id' + util.getConditionalOperator(obj.condition, obj.list[i].value, false, '');
                            }

                        }

                        if (obj.condition == "IsNot") {
                            statusQuery += ' OR claims.claim_status_id IS NULL';
                        }

                        query += util.getRelationOperator(query) + "(" + statusQuery + ")";
                    }                    
                   
                } 
				
                if (filterObj.ClaimInformation.billingMethod) {
                    let obj = filterObj.ClaimInformation.billingMethod;
                    let l = obj.list.length;
                    let billingMethodQuery = '';

                    if (l > 0) {
                        for (let i = 0; i < l; i++) {
                            if (i == 0) {
                                billingMethodQuery += 'claims.billing_method' + util.getConditionalOperator(obj.condition, obj.list[i].value, false, 'billingMethod');
                            } else {
                                billingMethodQuery += util.getConditionalRelationOperator(obj.condition) + 'claims.billing_method' + util.getConditionalOperator(obj.condition, obj.list[i].value, false, 'billingMethod');
                            }
                        }

                        if (obj.condition == "IsNot") {
                            billingMethodQuery += ' OR claims.billing_method IS NULL';
                        }

                        query += util.getRelationOperator(query) + (l == 1 && !obj.condition ? billingMethodQuery : "(" + billingMethodQuery + ")");

                    }
                }

                if (filterObj.ClaimInformation.payerType) {
                    let obj = filterObj.ClaimInformation.payerType;
                    let l = obj.length;
                    let PayerTypeQuery = '';

                    if (l > 0) {
                        for (let i = 0; i < l; i++) {
                            if (i == 0) {
                                PayerTypeQuery += 'claims.payer_type' + util.getConditionalOperator(obj.condition, obj.list[i].value, false, 'payerType');
                            } else {
                                PayerTypeQuery += util.getConditionalRelationOperator(obj.condition) + 'claims.payer_type' + util.getConditionalOperator(obj.condition, obj.list[i].value, false, 'payerType');
                            }
                        }

                        if (obj.condition == "IsNot") {
                            PayerTypeQuery += ' OR claims.payer_type IS NULL';
                        }

                        query += util.getRelationOperator(query) + (l == 1 && !obj.condition ? PayerTypeQuery : "(" + PayerTypeQuery + ")");

                    }
                }  

                if (filterObj.ClaimInformation.balance) {
                    let obj = filterObj.ClaimInformation.balance;
                    let BalanceQuery = '';

                    BalanceQuery += ' AND (select charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) from BILLING.get_claim_totals(claims.id))::numeric' +  obj.value +'::numeric';

                    query += BalanceQuery ;

                   
                }
            }
        }

        return query;

    },
    getStudyFilterQuery: function (filterObj, user_id, statOverride) {
        let query = '';

        if (filterObj) {

            if (typeof filterObj != "object") {
                filterObj = JSON.parse(filterObj);
            }

            if (filterObj.date) {
                query += util.getDateRangeQuery(query, filterObj);
            }

            if (filterObj.patientInformation) {
                if (filterObj.patientInformation.patientName) {

                    let obj = filterObj.patientInformation.patientName;
                    let l = obj.length,
                        patientQuery = '';

                    if (l > 0) {
                        for (let i = 0; i < l; i++) {
                            if (i == 0) {
                                patientQuery += ' patients.full_name' + util.getConditionalOperator(obj[i].condition, obj[i].value, false, 'patients');
                            } else {
                                patientQuery += util.getConditionalRelationOperator(obj[i].condition) + ' patients.full_name' + util.getConditionalOperator(obj[i].condition, obj[i].value, false, 'patients');
                            }
                        }

                        query += util.getRelationOperator(query) + (l == 1 && !obj.condition ? patientQuery : "(" + patientQuery + ")");
                    }
                }

                if (filterObj.patientInformation.patientID) {
                    let obj = filterObj.patientInformation.patientID;
                    let l = obj.length;
                    let accountQuery = '';

                    if (l > 0) {
                        for (let i = 0; i < l; i++) {
                            if (i == 0) {
                                accountQuery += 'patients.account_no' + util.getConditionalOperator(obj[i].condition, obj[i].value, false, 'patientID');
                            } else {
                                accountQuery += util.getConditionalRelationOperator(obj[i].condition) + 'patients.account_no' + util.getConditionalOperator(obj[i].condition, obj[i].value, false, 'patientID');
                            }
                        }

                        if (obj.condition == "IsNot") {
                            accountQuery += ' OR patients.account_no IS NULL';
                        }

                        query += util.getRelationOperator(query) + (l == 1 && !obj.condition ? accountQuery : "(" + accountQuery + ")");

                    }
                }
            }

            if (filterObj.physician) {
                if (filterObj.physician.readPhy) {
                    let obj = filterObj.physician.readPhy;
                    let l = obj.length;
                    let readPhyQuery = "";

                    if (l > 0) {

                        for (let i = 0; i < l; i++) {

                            if (i == 0) {
                                readPhyQuery += ' studies.study_info->\'readDescription\'' + util.getConditionalOperator(obj[i].condition, obj[i].value, false, 'readPhy');
                            } else {
                                readPhyQuery += util.getConditionalRelationOperator(obj[i].condition) + ' studies.study_info->\'readDescription\'' + util.getConditionalOperator(obj[i].condition, obj[i].value, false, 'readPhy');
                            }
                        }

                        query += util.getRelationOperator(query) + "(" + readPhyQuery + ")";
                    }


                }

                if (filterObj.physician.refPhy) {
                    let obj = filterObj.physician.refPhy;
                    let l = obj.length;
                    let refPhyQuery1 = ``;
                    let refPhyQuery2 = ``;

                    if (l > 0) {

                        let refPhyBlocks = {};

                        for (let i = 0; i < l; i++) {
                            let condition = obj[i].condition;

                            if (!refPhyBlocks[condition]) {
                                refPhyBlocks[condition] = [];
                            }

                            refPhyBlocks[condition].push(obj[i].value);
                        }

                        let ctrl = 0;

                        for (let condition in refPhyBlocks) {
                            if (ctrl++ != 0) {
                                refPhyQuery1 += ` AND `;
                                refPhyQuery2 += ` AND `;
                                //refPhyQuery1 += ` ${util.getConditionalRelationOperator(condition)} `;
                                //refPhyQuery2 += ` ${util.getConditionalRelationOperator(condition)} `
                            }

                            const list = refPhyBlocks[condition].reduce(function (z, v) { 
                                if(z) {
                                    z += ','; 
                                }  else {
                                    z = '';
                                } 

                                return z += `'${v}'`; 
                            }, null);

                            refPhyQuery1 += `
                            (
                                providers_ref.full_name ${util.getConditionalOperatorOnly(condition)}
                                    ${util.getConditionalArrayOperatorOnly(condition)}(
                                        ARRAY[${list}]::text[]
                                    )
                            )`;

                            refPhyQuery2 += `
                            (
                                ${util.getArrayArrayOperator(condition, `
                                ARRAY[${list}]::text[]
                                `, 'orders.referring_providers::text[]')}
                            )`;
                        }

                        query += `${util.getRelationOperator(query)}
                        (
                            ( ${refPhyQuery1} )
                            OR
                            ( ${refPhyQuery2} )
                        )`;
                    }
                }


                if (filterObj.physician.imageDelivery) {
                    let obj = filterObj.physician.imageDelivery;
                    let l = obj.list.length;
                    let imageDeliveryQuery = ``;

                    if (l > 0) {
                        const conditionalText = util.getConditionalOperator(obj.condition, true, false, '');
                        const relationalOperator = util.getConditionalRelationOperator(obj.condition);

                        for (let i = 0; i < l; i++) {
                            const field = `provider_contacts.contact_info->'${obj.list[i]}'`;

                            if (i == 0) {
                                imageDeliveryQuery += ` ${field} ${conditionalText} `;
                            }
                            else {
                                imageDeliveryQuery += ` ${relationalOperator} ${field} ${conditionalText} `;
                            }
                        }

                        if (obj.condition === `IsNot`) {
                            imageDeliveryQuery += ` OR array_to_string(
                                ARRAY [
                                    replace(
                                        NULLIF(provider_contacts.contact_info -> 'delivery_cd', 'false'), 'true', 'CD'
                                    ),
                                    replace(
                                        NULLIF(provider_contacts.contact_info -> 'delivery_film', 'false'), 'true', 'Film'
                                    ),
                                    replace(
                                        NULLIF(provider_contacts.contact_info -> 'delivery_paper', 'false'), 'true', 'Paper'
                                    )
                                ], ', '
                            ) = '' `;
                        }

                        query += `${util.getRelationOperator(query)} (${imageDeliveryQuery})`;
                    }
                }
            }

            if (filterObj.insurance) {
                if (filterObj.insurance.insProv) {
                    let obj = filterObj.insurance.insProv;
                    let l = obj.length;
                    let insProvQuery = "";

                    if (l > 0) {
                        for (let i = 0; i < l; i++) {
                            if (i == 0) {
                                insProvQuery += ' ' + util.getArrayOperator(obj[i].condition, obj[i].value, 'orders.insurance_providers', 'insProv');
                            } else {
                                insProvQuery += util.getConditionalRelationOperator(obj[i].condition) + ' ' + util.getArrayOperator(obj[i].condition, obj[i].value, 'orders.insurance_providers', 'insProv');
                            }
                        }

                        query += util.getRelationOperator(query) + "(" + insProvQuery + ")";
                    }
                }
            }

            if (filterObj.studyInformation) {
                if (filterObj.studyInformation.facility) {
                    let obj = filterObj.studyInformation.facility;
                    let l = obj.list.length;
                    let facilityQuery = "";

                    if (l > 0) {

                        for (let i = 0; i < l; i++) {

                            if (i == 0) {
                                facilityQuery += ' studies.facility_id' + util.getConditionalOperator(obj.condition, obj.list[i].id, false, '');
                            } else {
                                facilityQuery += util.getConditionalRelationOperator(obj.condition) + ' studies.facility_id ' + util.getConditionalOperator(obj.condition, obj.list[i].id, false, '');
                            }
                        }

                        if (obj.condition == "IsNot") {
                            facilityQuery += ' OR studies.facility_id IS NULL';
                        }

                        query += util.getRelationOperator(query) + "(" + facilityQuery + ")";
                    }
                }
            }

            if (filterObj.studyInformation) {
                if (filterObj.studyInformation.modality) {
                    let obj = filterObj.studyInformation.modality;
                    let l = obj.list.length;
                    let modalityQuery = "";

                    if (l > 0) {
                        for (let i = 0; i < l; i++) {
                            if (i == 0) {
                                modalityQuery += ' studies.modalities' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, 'modalities');
                            } else {
                                modalityQuery += util.getConditionalRelationOperator(obj.condition) + ' studies.modalities' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, 'modalities');
                            }
                        }

                        if (obj.condition == "IsNot") {
                            modalityQuery += ' OR studies.modalities IS NULL';
                        }

                        query += util.getRelationOperator(query) + "(" + modalityQuery + ")";
                    }
                }

                if (filterObj.studyInformation.modality_room_id) {
                    let obj = filterObj.studyInformation.modality_room_id;
                    let l = obj.list.length;
                    let modalityRoomQuery = "";

                    if (l > 0) {
                        for (let i = 0; i < l; i++) {
                            if (i == 0) {
                                modalityRoomQuery += ' orders.modality_room_id' + util.getConditionalOperator(obj.condition, obj.list[i], true, 'modality_room_id');
                            } else {
                                modalityRoomQuery += util.getConditionalRelationOperator(obj.condition) + ' orders.modality_room_id' + util.getConditionalOperator(obj.condition, obj.list[i], true, 'modality_room_id');
                            }
                        }

                        if (obj.condition == "IsNot") {
                            modalityRoomQuery += ' OR orders.modality_room_id IS NULL ';
                        }

                        query += util.getRelationOperator(query) + "(" + modalityRoomQuery + ")";
                    }
                }

                if (filterObj.studyInformation.study_description) {

                    let obj = filterObj.studyInformation.study_description;
                    let studyDescQuery = "";

                    if (obj.list !== undefined) {
                        if (obj.list.length > 0) {
                            let l = obj.list.length;

                            for (let i = 0; i < l; i++) {
                                if (i == 0){
                                    studyDescQuery = ' studies.study_description' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, 'study_desc');
                                }else{
                                    studyDescQuery += util.getConditionalRelationOperator(obj.condition) + ' studies.study_description' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, 'study_desc');
                                }
                            }

                            if (obj.condition == "IsNot") {
                                studyDescQuery = "(" + studyDescQuery + ' OR studies.study_description IS NULL' + " )";
                            }

                            query += util.getRelationOperator(query) + '(' + studyDescQuery + ')';
                        }
                    }

                }

                if (filterObj.studyInformation.ordering_facility) {
                    let obj = filterObj.studyInformation.ordering_facility;
                    let l = obj.list.length;
                    let facilityQuery = "";

                    if (l > 0) {

                        for (let i = 0; i < l; i++) {

                            if (i == 0) {

                                facilityQuery += ' studies.provider_group_id' + util.getConditionalOperator(obj.condition, obj.list[i].id, false, '');

                            } else {
                                facilityQuery += util.getConditionalRelationOperator(obj.condition) + ' studies.provider_group_id ' + util.getConditionalOperator(obj.condition, obj.list[i].id, false, '');

                            }

                        }

                        if (obj.condition == "IsNot") {
                            facilityQuery += ' OR studies.provider_group_id IS NULL';
                        }

                        query += util.getRelationOperator(query) + "(" + facilityQuery + ")";
                    }
                }

                if (filterObj.studyInformation.vehicle) {
                    let obj = filterObj.studyInformation.vehicle;
                    let l = obj.list.length;
                    let vehicleQuery = "";

                    if (l > 0) {
                        for (let i = 0; i < l; i++) {
                            if (i == 0) {

                                vehicleQuery += ' vehicles.vehicle_name' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, '');
                            }
                            else {
                                vehicleQuery += util.getConditionalRelationOperator(obj.condition) + ' vehicles.vehicle_name' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, '');
                            }
                        }

                        if (obj.condition == "IsNot") {
                            vehicleQuery += ' OR vehicles.vehicle_name IS NULL';
                        }

                        query += util.getRelationOperator(query) + "(" + vehicleQuery + ")";
                    }

                }

                if (filterObj.studyInformation.status) {
                    let obj = filterObj.studyInformation.status;
                    let l = obj.list.length, 
                        isVisit = false;
                    let statusQuery = "",
                        byMeQuery = "";

                    if (obj.last_changed_by_me) {
                        byMeQuery = (filterObj.user_id || user_id) ? ' studies.status_last_changed_by = ' + (filterObj.user_id || user_id) : '';
                    }

                    if (l > 0) {

                        for (let i = 0; i < l; i++) {

                            if (i == 0) {
                                if (obj.list[i].id == "TE" || obj.list[i].id == "INC") {
                                    if (!isVisit) {
                                        isVisit = true;
                                        let statusQry = ' (studies.study_status ' + util.getConditionalOperator(obj.condition, 'TE', false) + ' ' + util.getConditionalRelationOperator(obj.condition) + ' studies.study_status ' + util.getConditionalOperator(obj.condition, 'INC', false) + ')';
                                        statusQuery += (l == 1 ? statusQry : '( ' + statusQry + ')');
                                    }

                                } else {
                                    statusQuery += ' studies.study_status' + util.getConditionalOperator(obj.condition, obj.list[i].id, false, '');
                                }

                            } else {
                                if (obj.list[i].id == "TE" || obj.list[i].id == "INC") {
                                    if (!isVisit) {
                                        isVisit = true;
                                        statusQuery += util.getConditionalRelationOperator(obj.condition) + ' (studies.study_status ' + util.getConditionalOperator(obj.condition, 'TE', false) + util.getConditionalRelationOperator(obj.condition) + ' studies.study_status ' + util.getConditionalOperator(obj.condition, 'INC', false) + ')';
                                    }
                                }
                                else {
                                    statusQuery += util.getConditionalRelationOperator(obj.condition) + 'studies.study_status' + util.getConditionalOperator(obj.condition, obj.list[i].id, false, '');
                                }

                            }

                        }

                        if (obj.condition == "IsNot") {
                            statusQuery += ' OR studies.study_status IS NULL';
                        }

                        query += util.getRelationOperator(query) + "(" + statusQuery + ")";
                    }

                    query += byMeQuery ? util.getRelationOperator(query) + "(" + byMeQuery + ")" : '';

                }

                if (filterObj.studyInformation.bodyPart) {
                    let obj = filterObj.studyInformation.bodyPart;
                    let l = obj.list.length;
                    let bodyPartQuery = "";

                    if (l > 0) {
                        for (let i = 0; i < l; i++) {
                            if (i == 0) {

                                bodyPartQuery += ' studies.body_part' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, '');
                            }
                            else {
                                bodyPartQuery += util.getConditionalRelationOperator(obj.condition) + ' studies.body_part' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, '');
                            }
                        }

                        if (obj.condition == "IsNot") {
                            bodyPartQuery += ' OR studies.body_part IS NULL';
                        }

                        query += util.getRelationOperator(query) + "(" + bodyPartQuery + ")";
                    }
                }

                if (filterObj.studyInformation.accession) {
                    let obj = filterObj.studyInformation.accession;
                    let accessionQuery = "";

                    if (obj.value) {
                        accessionQuery = ' studies.accession_no' + util.getConditionalOperator(obj.condition, obj.value, false, '');

                        if (obj.condition == "IsNot") {
                            accessionQuery = "( " + accessionQuery + ' OR studies.accession_no IS NULL' + " )";

                        }

                        query += util.getRelationOperator(query) + accessionQuery;
                    }

                }

                if (filterObj.studyInformation.attorney) {
                    let obj = filterObj.studyInformation.attorney;
                    let attorneyQuery = ``;
                    let l = obj.length;

                    if (l > 0) {
                        attorneyQuery += '(';

                        for (let i = 0; i < l; i++) {
                            let nameSql = ' get_full_name(attorneys.last_name, attorneys.first_name, attorneys.middle_initial, NULL, attorneys.suffix)';
                            
                            if (i === 0) {
                                attorneyQuery += nameSql + util.getConditionalOperator(obj[i].condition, obj[i].value, false, 'attorney');
                            } else {
                                attorneyQuery += util.getConditionalRelationOperator(obj[i].condition) + nameSql + util.getConditionalOperator(obj[i].condition, obj[i].value, false, 'attorney');
                            }
                        }

                        attorneyQuery += `) AND attorneys.provider_type = 'AT'`;

                        query += util.getRelationOperator(query) + "(" + attorneyQuery + ")";
                    }

                }

                if (filterObj.studyInformation.studyID) {
                    let obj = filterObj.studyInformation.studyID;
                    let dicomStudyQuery = "";

                    if (obj.value) {
                        dicomStudyQuery = 'studies.dicom_study_id' + util.getConditionalOperator(obj.condition, obj.value, false, '');

                        if (obj.condition == "IsNot") {
                            dicomStudyQuery = "(" + dicomStudyQuery + ' OR studies.dicom_study_id IS NULL' + " )";
                        }

                        query += util.getRelationOperator(query) + dicomStudyQuery;
                    }
                }

                if (filterObj.studyInformation.stat) {

                    let obj = filterObj.studyInformation.stat;
                    let l = obj.list.length;
                    let statQuery = "";

                    if (l > 0) {

                        for (let i = 0; i < l; i++) {

                            if (i == 0) {
                                statQuery += ' studies.stat_level' + util.getConditionalOperator(obj.condition, obj.list[i].id, true, '');

                            } else {
                                statQuery += util.getConditionalRelationOperator(obj.condition) + ' studies.stat_level' + util.getConditionalOperator(obj.condition, obj.list[i].id, true, '');

                            }

                        }

                        if (obj.condition == "IsNot") {
                            statQuery += ' OR studies.stat_level IS NULL';
                        }

                        query += util.getRelationOperator(query) + "(" + statQuery + ")";
                    }
                }

                if (filterObj.studyInformation.flag) {
                    let obj = filterObj.studyInformation.flag;
                    let l = obj.list.length;
                    let flagQuery = "";

                    if (l > 0) {

                        for (let i = 0; i < l; i++) {
                            if (obj.list[i].text) {
                                if (i == 0) {
                                    flagQuery += ' study_flags.description' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, '');
                                }
                                else {
                                    flagQuery += util.getConditionalRelationOperator(obj.condition) + ' study_flags.description' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, '');
                                }
                            }

                        }

                        if (obj.condition == "IsNot") {
                            flagQuery += 'OR ( study_flags.description) is null';
                        }

                        query += util.getRelationOperator(query) + "(" + flagQuery + ")";
                    }
                }

                if (filterObj.studyInformation.institution) {

                    let obj = filterObj.studyInformation.institution;
                    let l = obj.list.length;
                    let institutionQuery = "";

                    if (l > 0) {

                        for (let i = 0; i < l; i++) {

                            if (i == 0) {
                                institutionQuery += ' studies.institution' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, '');
                            }
                            else {

                                institutionQuery += util.getConditionalRelationOperator(obj.condition) + ' studies.institution' + util.getConditionalOperator(obj.condition, obj.list[i].text, false, '');
                            }
                        }

                        if (obj.condition == "IsNot") {
                            institutionQuery += 'OR (studies.institution) is null';
                        }

                        query += util.getRelationOperator(query) + "(" + institutionQuery + ")";
                    }
                }

            }

            if (filterObj.options&&!filterObj.options.statOverride && statOverride && query) {
                query = ' (( ' + query + ' ) OR studies.stat_level > 0 ) ';
            }
        }

        return query;
    },

    getCombinedQuery: (joined_filters, user_id, statOverride) => {
        const queries = joined_filters.reduce((queries, { filter_info }) => {
            const sqlQuery = util.getStudyFilterQuery(filter_info, user_id, statOverride);

            if (sqlQuery) {
                queries.push(sqlQuery);
            }

            return queries;
        }, []);

        if (queries.length) {
            const joinedQueries = queries.join(`) OR (`);
            return `(( ${joinedQueries} ))`;
        }

        return ``;
    },

    getPreformattedDateRange: function (option) {
        let dateRange;
        let toDate = moment(),
            fromDate = moment();

        switch (option) {
        case "Yesterday":
            toDate = fromDate = moment().subtract(1, 'days');
            break;
        case "Today":
            toDate = fromDate = moment();
            break;
        case "Tomorrow":
            toDate = fromDate = moment().add(1, 'days');
            break;
        case "Last 7 Days":
            fromDate = moment().subtract(6, 'days');
            break;
        case "Last 30 Days":
            fromDate = moment().subtract(29, 'days');
            break;
        case "Next 7 Days":
            toDate = moment().add(6, 'days');
            break;
        case "Next 30 Days":
            toDate = moment().add(29, 'days');
            break;
        case "This Month":
            fromDate = moment().startOf('month');
            toDate = moment().endOf('month');
            break;
        case "Last Month":
            fromDate = moment().subtract('month', 1).startOf('month');
            toDate = moment().subtract('month', 1).endOf('month');
            break;
        case "This Year":
            fromDate = moment().startOf('year');
            toDate = moment().endOf('year');
            break;
        }

        dateRange = fromDate.format('YYYY-MM-DD') + '~' + toDate.format('YYYY-MM-DD');
        return dateRange;
    },

    getDateRangeQuery: function (query, filterObj) {
        let drQuery,
            scheduleDtColumn,
            preformatted,
            duration, 
            fromDate, 
            fromTime,
            toDate, 
            toTime = '';
        // NOTE:
        // When timestamp contains time zone info, there is no need for TZ conversion !!!
        // Just compare date+time+tz string directly. For example:
        //      (studies.study_received_dt BETWEEN '2017-03-08T00:00:00-05:00' AND '2017-03-08T23:59:59-05:00')   -- preformatted, today
        
        if (filterObj.date&&filterObj.date.dateType) {
            //scheduleDtColumn = "timezone(facilities.time_zone, " + orders.ordersData.getSortFields(filterObj.date.dateType) + ")";
            switch (filterObj.date.dateType) {
            case "scheduled_dt":
            case "schedule_date":
                scheduleDtColumn = "studies.schedule_dt";
                break;
            case "study_dt":
                scheduleDtColumn = "studies.study_dt";
                break;
            case "study_received_dt":
                scheduleDtColumn = "studies.study_received_dt";
                break;
            case "claim_dt":
                scheduleDtColumn = "claims.claim_dt";
                break;
            }
        }
        else {
            //scheduleDtColumn = filterObj.date.isStudyDate ? " timezone(facilities.time_zone, studies.study_dt) " : " timezone(facilities.time_zone, studies.study_received_dt) ";
            scheduleDtColumn = filterObj.date.isStudyDate ? " studies.study_dt " : " studies.study_received_dt ";
        }

        switch (filterObj.date.condition) {
        // Preformatted Date Ranges
        case "Preformatted":
            preformatted = util.getPreformattedDateRange(filterObj.date.preformatted);
            fromDate = preformatted.split('~')[0];
            toDate = preformatted.split('~')[1];
            fromTime = moment().startOf('day').format('HH:mm:ss');
            toTime = moment().endOf('day').format('HH:mm:ss');
            break;
        // Looking back a defined length of time
        case "Last":
        case "Next":
            duration = util.getFromToDuration(filterObj.date.durationValue, filterObj.date.duration, filterObj.date.condition);
            fromDate = duration.split('~')[0];
            toDate = duration.split('~')[1];
            fromTime = filterObj.date.fromTime ? filterObj.date.fromTime : moment().startOf('day').format('HH:mm:ss');
            toTime = filterObj.date.toTime ? filterObj.date.toTime : moment().endOf('day').format('HH:mm:ss');
            break;
        // To and From Exact Dates
        case "Date":
            fromDate = filterObj.date.fromDate ? moment(filterObj.date.fromDate).format('YYYY-MM-DD') : "";
            toDate = filterObj.date.toDate ? moment(filterObj.date.toDate).format('YYYY-MM-DD') : "";
            fromTime = filterObj.date.fromDateTime ? filterObj.date.fromDateTime : moment().startOf('day').format('HH:mm:ss');
            toTime = filterObj.date.toDateTime ? filterObj.date.toDateTime : moment().endOf('day').format('HH:mm:ss');
            break;
        }

        if (fromDate && toDate) {
            fromDate = (filterObj.date.condition === 'Last' || filterObj.date.condition === 'Next') && filterObj.date.duration === 'Hour(s)' ? moment(fromDate).format() : moment(fromDate + ' ' + fromTime).format();
            toDate = (filterObj.date.condition === 'Last' || filterObj.date.condition === 'Next') && filterObj.date.duration === 'Hour(s)' ? moment(toDate).format() : moment(toDate + ' ' + toTime).format();

            // NOTE:
            // When timestamp contains time zone info, there is no need for TZ conversion !!!
            // Just compare date+time+tz string directly. For example:
            //      (studies.study_received_dt BETWEEN '2017-03-08T00:00:00-05:00' AND '2017-03-08T23:59:59-05:00')   -- preformatted, today
            if (filterObj.date.condition === 'Preformatted' && fromTime) {  // Handle special case for preformatted
                drQuery = util.getRelationOperator(query) + " (" + scheduleDtColumn + " BETWEEN '" + fromDate + "' AND '" + toDate + "')";
                // time is IN THE timestamp !!!
                //+ " AND  (";
                //drQuery += (fromTime)?  scheduleDtColumn + "::time > '" + fromTime + "'::time AND " + scheduleDtColumn + "::time < '" + toTime + "'::time)" : scheduleDtColumn + "::time < '" + toTime + "'::time)";
            } else {
                drQuery = util.getRelationOperator(query) + " (" + scheduleDtColumn + " BETWEEN '" + fromDate + "' AND '" + toDate + "')";
            }

        } else {
            drQuery = '';
        }
        //console.log("STUDY FILTER: getDateRangeQuery: '%s'", drQuery);
        
        return drQuery;
    }

};

module.exports = util;
