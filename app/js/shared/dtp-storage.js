/**
 * DATE-TIME PICKER (DTP) STORAGE CLASS
 *
 * How to use:
 *   1. Include dtpStore in the define parameters
 *      define(["shared/dtp-storage"], function (dtpStore) { ... });
 *
 *   2. Initialize any dtpStore by providing a reference key, the DOM object container and formatting properties if different from the default
 *      dtpStore.initialize("dob", "divDateOfBirth");  // Using default options { format: "L", useCurrent: false }
 *      dtpStore.initialize("dueDate", "divDueDate", { format: "LT", useCurrent: false, ignoreReadonly: true });
 *
 *   3. Set the dtp if it has an initial value
 *      dtpStore.set("dob", data.patient_dob);
 *
 *   4. Get the date value when you need it
 *      dtpStore.get("dob");
 *
 *   5. Other built-in functionality for easy dtp manipulation
 *      dtpStore.clear("dob");
 *      dtpStore.clearAll(); or just dtpStore.clear(); with no key provided
 *      dtpStore.disable("dob");
 *      dtpStore.enable("dob");
 *      dtpStore.setStateEnabled("dob", is_enabled);  // Use when you have a variable indicating enabled or disabled
 *
 *   6. These methods are all chainable and should be chained wherever possible
 *      dtpStore
 *          .initialize("dob", "divDateOfBirth")
 *          .initialize("validTo", "divValidTo")
 *          .initialize("validFrom", "divValidFrom")
 *          .set("dob", data.patient_dob)
 *          .set("validTo", data.valid_to)
 *          .set("validFrom", data.valid_from)
 *          .disable("dob");
 */
define([], function() {
    return {
        data: {},

        /**
         * Clears one or all of the date time pickers
         *
         * @param {string} key
         */
        clear: function (key) {
            if (key) {
                if (this.data[key]) {
                    this.data[key].clear();
                }
            }
            else {
                this.clearAll();
            }

            return this;
        },

        /**
         * Clears all of the date time pickers
         */
        clearAll: function () {
            var self = this;

            Object.keys(this.data).forEach(function (key) {
                self.data[key].clear();
            });

            return this;
        },

        /**
         * Destroys one or all of the date time pickers
         *
         * @param {string} key
         */
        destroy: function (key) {
            if (key) {
                if (this.data[key]) {
                    this.data[key].clear().destroy();
                }
            }
            else {
                this.destroyAll();
            }

            return this;
        },

        /**
         * Destroys all of the date time pickers
         */
        destroyAll: function () {
            var self = this;

            Object.keys(this.data).forEach(function (key) {
                self.data[key].clear().destroy();
            });

            this.data = {};

            return this;
        },

        /**
         * Disables a date time picker
         *
         * @param {string} key  Key to reference this picker
         */
        disable: function (key) {
            if (this.data[key]) {
                this.data[key].disable();
            }

            return this;
        },

        /**
         * Enables a date time picker
         *
         * @param {string} key  Key to reference this picker
         */
        enable: function (key) {
            if (this.data[key]) {
                this.data[key].enable();
            }

            return this;
        },

        /**
         * Sets focus on a date time picker
         *
         * @param {string} key  Key to reference this picker
         */
        focus: function (key) {
            if (this.data[key]) {
                this.data[key].focus();
            }

            return this;
        },

        /**
         * Gets a date from one of the date time pickers
         *
         * @param {string} key     Key to reference this picker
         * @param {string} format  Moment date formatting
         * @returns {Moment|string}
         */
        get: function (key, format) {
            if (this.data[key]) {
                var moment_date = this.data[key].date();
                return format
                    ? (moment_date && moment_date.format(format) || null)
                    : moment_date;
            }

            return null;
        },

        /**
         * Creates a date/time picker and stores it to this object
         *
         * @param {string} key      Key to reference this picker
         * @param {string} el_id    HTML element id that picker is bound to
         * @param {object} options  DTP init options
         */
        initialize: function (key, el_id, options) {
            options = options || { format: "L", useCurrent: false };
            this.data[key] = commonjs.bindDateTimePicker(el_id, options);

            return this;
        },

        /**
         * Sets one of the date time pickers
         *
         * @param {string} key
         * @param {string} set_date
         */
        set: function (key, set_date) {
            if (this.data[key]) {
                set_date
                    ? this.data[key].date(commonjs.getFormattedDate(set_date))
                    : this.clear(key);
            }

            return this;
        },

        /**
         * Enables or disables a DTP based on the boolean value sent
         *
         * @param {string}  key      Key to reference this picker
         * @param {boolean} enabled  Enabled state (enable = true, disable = false) Default true
         */
        setStateEnabled: function (key, enabled) {
            if (enabled === undefined) {
                enabled = true;
            }

            enabled
                ? this.enable(key)
                : this.disable(key);

            return this;
        }
    }
});
