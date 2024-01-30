/**
 * Provider Alert Popup
 *
 * This is the physician icon that pops up provider details when clicked on
 */
define([
    "jquery",
    "underscore",
    "backbone",
    "text!templates/common/icon_and_name.html",
    "text!templates/common/providerAlert.html"
],
function (
    $,
    _,
    Backbone,
    icon_name_template,
    provider_alert_template
) {
    return Backbone.View.extend({
        /* #region Global Variables */
        el: null,
        model: null,
        options: {},
        args: {},
        data: {},
        provider_alert_template: _.template(provider_alert_template),
        icon_name_template: _.template(icon_name_template),
        /* #endregion */


        /* #region Event Handlers */
        // --------------------------------------------------------------------------------
        //                                 EVENT HANDLERS
        // --------------------------------------------------------------------------------

        events: {
            "click .name-icon": "handleClickIcon"
        },

        /**
         * User clicked on the icon
         *
         * @param {object} e
         */
        handleClickIcon: function (e) {
            var $target = $(e.target).closest(".phy-summary");
            var id = ~~$target.data("id");
            var type = $target.data("type");

            if (id === this.args.id && type === this.args.type) {
                this.load();
            }

            return this;
        },
        /* #endregion */


        /* #region Initializations */
        // --------------------------------------------------------------------------------
        //                                 INITIALIZATIONS
        // --------------------------------------------------------------------------------

        /**
         * Runs automatically before render
         *
         * @param {object} options
         */
        initialize: function (options) {
            this.options = options || {};
        },

        /**
         * Entry point for this view
         *
         * @param {object} args
         * @prop  {number} args.id    Provider or provider contact id
         * @prop  {string} args.name  Name associated wiht the id
         * @prop  {string} args.type  Provider or resource type (referring physician, technologist etc.)
         * @prop  {object} args.data  Parent view already has all of the data. This skips the API request completely.
         * @prop  {object} args.placement  Placement of the popover (auto, top, bottom, left, right)
         * @prop  {object} args.anchor  Optional element to anchor the popover to as opposed to the physician icon
         *
         */
        initializeArguments: function (args) {
            this.args = args || {};
            this.args.id = ~~this.args.id;
            this.args.name = this.args.name || "";
            this.args.type = this.args.type || "";
            this.args.anchor = this.args.anchor || "";
            this.args.placement = this.args.placement || "auto";
            this.data = this.args.data || {};

            return this;
        },

        /**
         * Entry point for this view
         *
         * @param {object} args
         * @prop  {number} args.id  Provider or provider contact id
         * @prop  {string} args.name  Name associated with the id
         * @prop  {string} args.type  Provider or resource type (referring physician, technologist etc.)
         * @prop  {string} args.iconCss  CSS class to
         * @prop  {string} args.containerCss
         * @prop  {boolean} args.fixMultipleOpen  This is a hack to ensure popover can be opened more than once
         */
        render: function (args) {
            this.initializeArguments(args);

            $(this.el).append(this.icon_name_template({
                data: {
                    id: this.args.id,
                    type: this.args.type,
                    name: this.args.name,
                    iconCss: this.args.iconCss,
                    containerCss: this.args.containerCss,
                    title: this.popupTitle(),
                    popover: true,
                    reverseOrder:true
                }
            }));

            commonjs.updateCulture();

            return this;
        },
        /* #endregion */

        /* #region Load Data */
        // --------------------------------------------------------------------------------
        //                                    LOAD DATA
        // --------------------------------------------------------------------------------

        /**
         * Fetches the provider / resource data
         *
         * @param {function} callback
         */
        fetch: function (callback) {
            callback = commonjs.ensureCallback(callback);

            // Don't refetch data we already have
            if (!_.isEmpty(this.data)) {
                callback();
                return this;
            }

            var self = this;
            var use_provider_id = _.includes(["attorney", "technologist"], this.args.type);
            var provider_id = use_provider_id ? this.args.id : null;
            var provider_contact_id = !use_provider_id ? this.args.id : null;

            $.ajax({
                url: "/providerContacts",
                type: "GET",
                data: {
                    provider_id: provider_id,
                    provider_contact_id: provider_contact_id,
                    from: "serviceProvider"
                },
                success: function (response) {
                    self.data = _.get(response, "result[0]", []);
                    callback();
                },
                error: function (err, response) {
                    commonjs.handleXhrError(err, response);
                    callback();
                }
            });

            return this;
        },
        /* #endregion */

        /* #region Functionality */
        // --------------------------------------------------------------------------------
        //                                  FUNCTIONALITY
        // --------------------------------------------------------------------------------

        /**
         * Combines the data fetch and open popup functionality
         *
         * @param {function} callback
         */
        load: function (callback) {
            callback = commonjs.ensureCallback(callback);
            var self = this;

            this.fetch(function () {
                self.openPopover();
                callback();
            });

            return this;
        },

        /**
         * Open provider popup
         */
        openPopover: function () {
            var $el = this.popupEl();
            var props = {
                html: true,
                container: this.args.anchor || $el.closest(".provider-alert-anchor"),
                placement: this.args.placement,
                content: this.provider_alert_template({
                    provider: this.data,
                    labels: this.popupLabels()
                })
            };

            $el.popover(props);
            $el.popover("show");

            // Hack that allows the popover to show more than once on the ImagineSoft screen
            if (this.args.fixMultipleOpen) {
                setTimeout(function () {
                    $(".popover").css("display", "block");  // Makes visible
                    window.scrollTo(1, 0);  // Scrolling fixes the positioning of the popover and tail
                    window.scrollTo(0, 0);  // Scroll back to top so that works every time
                }, 100);
            }

            return this;
        },
        /* #endregion */

        /* #region Getters */
        // --------------------------------------------------------------------------------
        //                                     GETTERS
        // --------------------------------------------------------------------------------

        /**
         * Returns the popup element
         *
         * @returns {jQuery}
         */
        popupEl: function () {
            return $(this.el)
                .find(".phy-summary[data-id='" + this.args.id + "'][data-type='" + this.args.type + "']")
                .find(".name-icon");
        },

        /**
         * Returns labels for popover element
         *
         * @returns {object}
         */
        popupLabels: function () {
            return {
                office_phone: commonjs.geti18NString("shared.fields.officePhone"),
                phone: commonjs.geti18NString("shared.fields.phone"),
                mobile: commonjs.geti18NString("shared.fields.mobilePhone"),
                office_fax: commonjs.geti18NString("shared.fields.officeFax"),
                fax: commonjs.geti18NString("shared.fields.fax"),
                pager: commonjs.geti18NString("shared.fields.pager")
            }
        },

        /**
         * Returns translated placeholder text
         *
         * @returns {string}
         */
        popupTitle: function () {
            return commonjs.geti18NString("order.provider." + this.args.type);
        }
        /* #endregion */
    });
});
