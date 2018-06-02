'use strict';
/**
 * Author  : Ramesh R
 * Created : 3/3/14 12:53 PM
 * ----------------------------------------------------------------------
 * Copyright © EMD Systems Software Private Ltd.  All rights reserved.
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.txt', which is part of this source code package.
 * All other rights reserved.
 * ----------------------------------------------------------------------
 */

const logger = require('../../logger');

const validator = () => {
    const queryMakers = require(`./query-maker-map`);

    const regQuote = /'/g;
    const regBackSlash = /\\/g;

    const getSearchString = (fieldID,
        fieldValue,
        fieldType,
        extras) => {
        fieldValue = fieldValue.replace(regQuote, `''`).replace(regBackSlash, ``);
        const generator = queryMakers.get(fieldType);

        if (typeof generator !== 'function') {
            logger.logError(`NoQuery Maker For fieldType ${fieldType} field ${fieldID} value ${fieldValue}`);
            return '';
        }

        const searchQuery = generator(fieldID, fieldValue, extras);
        //console.log(`GRID FILTER: getSearchString: '%s'`, searchQuery);

        if (searchQuery && extras.options.statOverride) {
            return ` (( ${searchQuery} ) OR studies.stat_level > 0) `;
        }

        return searchQuery;
    };

    const generateClientQuery = (colModel, filterElements, filterData, options) => {
        let a = 0;
        const elementCount = filterElements.length;
        let searchQuery = ``;

        for (; a < elementCount; ++a) {
            let filterColumn = filterElements[a];
            let fieldValue = filterData[a];

            if (filterColumn && fieldValue) {
                let searchFlag = ``;
                let defaultValue = ``;
                let searchColumns = [];
                let searchCondition = ` AND `;
                let equalFlag = false;

                let i = 0;
                const modelCount = colModel.length;
                let model;

                for (; i < modelCount; i++) {

                    model = colModel[i];

                    if (model && filterColumn === model.name) {
                        searchFlag = model.searchFlag;

                        if (typeof model.defaultValue !== `undefined`) {
                            defaultValue = model.defaultValue;
                        }

                        if (typeof model.searchColumns !== `undefined`) {
                            searchColumns = model.searchColumns;
                        }

                        if (typeof model.searchCondition !== `undefined`) {
                            searchCondition = ` ${model.searchCondition} `;
                        }

                        if (typeof model.equalFlag !== `undefined` && model.equalFlag) {
                            equalFlag = model.equalFlag;
                        }

                        break;
                    }
                }

                const columnCount = searchColumns.length;
                const extras = {
                    defaultValue,
                    options
                };

                if (columnCount === 0) {
                    const fieldType = `${searchFlag}${equalFlag ?
                        '_equal' :
                        ''}`;

                    if (typeof fieldValue !== `undefined` && fieldValue != `` && fieldValue !== `Select`) {
                        if (searchQuery && searchQuery !== `(`) {
                            searchQuery += searchCondition;
                        }

                        searchQuery += getSearchString(filterColumn, fieldValue, fieldType, extras);
                    }

                    if (searchQuery && options.statOverride) {
                        searchQuery = ` (( ${searchQuery} ) OR studies.stat_level > 0) `;
                    }
                }
                else {
                    let z = 0;
                    let column = '';
                    let tempSearchFlag = '';
                    let fieldType = '';
                    let filter = '';

                    for (; z < columnCount; ++z) {
                        column = searchColumns[z];

                        tempSearchFlag = Array.isArray(searchFlag) && searchFlag.length === columnCount ?
                            searchFlag[z] :
                            searchFlag;

                        fieldType = `${tempSearchFlag}${equalFlag ?
                            '_equal' :
                            ''}`;

                        if (filter && z > 0) {
                            filter += searchCondition;
                        }

                        filter += getSearchString(column, fieldValue, fieldType, extras);

                    }

                    if (filter && filter.length > 0) {
                        if (searchQuery !== ''){
                            searchQuery += ' AND ';
                        }

                        searchQuery += ` (${filter})`;
                    }
                }
            }
        }

        if (searchQuery === '()'){
            return '';
        }

        return searchQuery;
    };

    const generateQuery = (colModel, filterElements, filterData, options)=>{
        if (colModel && filterElements && filterData) {
            filterElements = JSON.parse(filterElements);
            filterData = JSON.parse(filterData);

            const searchQuery = generateClientQuery(colModel, filterElements, filterData, options);
            let endQuery = ``;

            if (searchQuery.length > 0) {
                endQuery = ` WHERE ${searchQuery}`;

                if (typeof options.defaultwherefilter === 'string' && options.defaultwherefilter.length > 0) {
                    endQuery += ` AND ${options.defaultwherefilter}`;
                }
            }
            else if (typeof options.defaultwherefilter === 'string' && options.defaultwherefilter.length > 0) {
                endQuery = ` WHERE ${options.defaultwherefilter}`;
            }

            return endQuery;
        }

        return '';
    };

    const buildSearchQuery = (fieldname, fieldvalue, isHstore) => {
        fieldvalue = fieldvalue.replace(regQuote, "''");
        return isHstore ?
            ` '${fieldname}' ILIKE '%${fieldvalue}%'` :
            ` ${fieldname} ILIKE '%${fieldvalue}%'`;
    };

    return {
        generateQuery,
        buildSearchQuery
    };
};

module.exports = validator;
