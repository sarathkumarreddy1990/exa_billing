var i18n = {
    defaultLang: 'default',
    currentLang: 'default',
    text: {},

    getLang: function () {
        return this.currentLang ? this.currentLang : this.defaultLang;
    },

    setLang: function (lang) {
        this.currentLang = lang;
    },

    loadDefaultLanguage: function (cb) {
        if (typeof this.text[this.defaultLang] === 'undefined') {
            this.load(cb, this.defaultLang);
            return;
        }

        cb();
    },

    load: function (cb, reqLang) {
        var self = this, lang = reqLang ? reqLang : this.getLang();
        $.getJSON('billing/app_settings/i18n/' + lang + '.json',function (data) {
            self.put(lang, data).t(undefined, cb);
        }).fail(function () {
                self.put(lang, {}).t(undefined, cb);
            });
        return this;
    },

    put: function (lang, data) {
        if (typeof lang === 'string' && typeof data === 'object') {
            var obj = {};
            obj[lang] = data;
        } else
            obj = lang;
        this.text = $.extend(true, this.text, obj);
        return this;
    },

    get: function (key, useDefault) {
        var keys = key ? key.split('.') : '',
            lang = this.getLang(),
            obj = this.text[lang];

        if (useDefault) {
            obj = this.text[this.defaultLang];

            if (!obj) {
                obj = this.text[lang];
            }
        }

        var keysSplitted = key.split('.');
        var originalKey = keysSplitted.length > 0 ? keysSplitted[keysSplitted.length-1] : key;

        while (typeof obj !== 'undefined' && keys.length > 0)
            obj = obj[keys.shift()];
        //return typeof obj === 'undefined' ? lang + '.' + key : obj;

        if (typeof obj === 'undefined') {
            return useDefault ? originalKey : this.get(key, true);
        } else {
            return obj;
        }
    },

    t1: function (item) {
        if (typeof item === 'object' && item instanceof Element) {
            var it = $(item),
                key = '';
            it.removeClass('I18N');

            if (it.is('[i18n]')) {
                key = it.attr('i18n')
                if (typeof key === 'undefined')
                    key = it.text();

                //it.attr('i18n', key).text(this.get(key));
                if (it.is('option'))
                    it.attr('i18n', key).text(this.get(key));
                else
                    it.attr('i18n', key).not('option').val(this.get(key));

                if (it.is('#activeMenu')) //Arrow caret appended to the setup menu
                    it.attr('i18n', key).html(this.get(key)).append($('<span/>').addClass('caret'));
                else if (!it.hasClass('jstree-anchor'))
                    it.attr('i18n', key).html(this.get(key));
                else
                    it.contents()[2].nodeValue = this.get(key);
            }

            if (it.is('[i18np]')) {
                key = it.attr('i18np')
                if (typeof key === 'undefined')
                    key = it.text();

                it.attr('i18np', key).attr("placeholder", this.get(key));
            }

            if (it.is('[i18nt]')) {
                key = it.attr('i18nt')
                if (typeof key === 'undefined')
                    key = it.text();

                it.attr('i18nt', key).attr("title", this.get(key));
                it.attr('i18nt', key).attr("data-original-title", this.get(key));
            }

//            it.attr('i18np', key).attr("placeholder", this.get(key));
//            it.attr('i18n', key).text(this.get(key));
        }

        return this;
    },

    t: function (item, cb) {
        if (typeof this.text[this.getLang()] === 'undefined') {
            this.load(cb);
            return this;
        }

        if (typeof item === 'undefined') {
            item = $('[I18N]');
            $('.I18N').each(function () {
                if (!$.contains(item, this))
                    item = item.add(this);
            });

            $('[I18NP]').each(function () {
                if (!$.contains(item, this))
                    item = item.add(this);
            });

            $('[I18NT]').each(function () {
                if (!$.contains(item, this))
                    item = item.add(this);
            });
        }

        if (item instanceof jQuery)
            for (var i in item)
                this.t1(item[i]);
        else
            this.t1(item);

        if (cb) {
            cb();
        }
        return this;
    }
};
