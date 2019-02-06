define(['jquery', 'backbone', 'underscore', 'text!templates/countrySelect.html', 'text!templates/cityStateZip.html']
    , function ($, Backbone, _, CountrySelect, CityStateZip) {
        var addressLib = {

            countrySelectTemplate: _.template(CountrySelect),
            cityStateZipTemplate: _.template(CityStateZip),

            getCountryByAlpha3Code: function (alpha_3_code) {
                return app.countries.find(function (country) {
                    return alpha_3_code === country.alpha_3_code;
                });
            },

            renderCountrySelect: function (whereDomId, whatDomId) {
                $('#' + whereDomId).append(this.countrySelectTemplate({
                    domId: whatDomId
                }));
                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
            },

            bindCountrySelectToCityStateZip: function (divCityStateZipDomSelector, info, fieldMap) {
                var self = this;
                if (fieldMap.country) {
                    var $ddlCountry = $('#' + fieldMap.country.domId);
                    $ddlCountry.off().change(function () {
                        self.loadCityStateZipTemplate(divCityStateZipDomSelector, info, fieldMap);
                    });
                    $ddlCountry.val(info[fieldMap.country.infoKey] || app.country_alpha_3_code);
                }
                self.loadCityStateZipTemplate(divCityStateZipDomSelector, info, fieldMap);
            },

            loadCityStateZipTemplate: function (divCityStateZipDomSelector, info, fieldMap) {

                var country_alpha_3_code = fieldMap.country ? $('#' + fieldMap.country.domId).val() : app.country_alpha_3_code;
                var $divCityStateZip = $(divCityStateZipDomSelector);
                $divCityStateZip.empty();
                var country = this.getCountryByAlpha3Code(country_alpha_3_code);

                var templateParams = {
                    addressStyle: country.address_style,
                    cityDomId: fieldMap.city.domId,
                    stateDomId: fieldMap.state.domId,
                    postalCodeDomId: fieldMap.zipCode.domId,
                    provinces: country.provinces
                };
                if (fieldMap.zipCodePlus) {
                    templateParams.zipPlusDomId = fieldMap.zipCodePlus.domId;
                }
                if (fieldMap.zipCode)
                    $('#' + fieldMap.zipCode.domId).val('');

                $divCityStateZip.append(this.cityStateZipTemplate(templateParams));
                _.forEach(fieldMap, function (field, index) {
                    if (index !== 'country') {
                        $('#' + field.domId).val(info[field.infoKey]);
                    }
                });
                commonjs.setupCityStateZipInputs();
                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
            }
        };

        return addressLib;
    })
    ;