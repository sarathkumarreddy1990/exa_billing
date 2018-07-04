var mailMerge = {

    mergeData: function (template, data) {
        for (var key in template) {
            if (key === 'mergeField') {
                template.text = mailMerge.getDescendantProp(data, template[key]);
                //template.content = template.text;
                //delete template[key];
            }

            if (typeof template[key] === 'object' && Object.keys(template[key]).length > 0) {
                template[key] = mailMerge.mergeData(template[key], data);
            }
        }

        return template;
    },

    getDescendantProp: function (obj, key) {
        try {
            var tokenString = key.replace(/(^{|}$|^\[|\]$)/g, '');

            // /// Checking for js script
            // if (tokenString[0] === constants.MERGE_FIELD_KEY) {
            //   var jsCode = tokenString.replace(/(^{|}$|^\[|\]$)/g, '');
            //   return this.executeJsCode(jsCode, obj);
            // }

            var data = get(obj, tokenString);
            return data || '';
        } catch (err) { return '' }

        return '';
    },

    executeJsCode: function (code, jsData) {
        try {
            return Function('"use strict"; return ( function(jsData){' + code + '})')()(jsData);
        } catch (err) { return '' }
    }
};
