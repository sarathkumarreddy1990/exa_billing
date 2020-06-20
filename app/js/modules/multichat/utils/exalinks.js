define([
        'jquery'
        , 'underscore'
        , 'backbone'
    ],
    function (
        $
        , _
        , Backbone
    ) {
        var ExaLinks = {
            
            _extractionRegexp: /{exalink}(.*?){\/exalink}/g,


            _getExalinkTemplateByType: function (type) {
                if (type === "dicom")
                    return "<span class='icon-ic-web-viewer'></span> " +
                        "<a class='exalink__link' onclick='window.isViewerRender = true; prefetchViewer.showViewer(0, <%- study_id %>, {dicom_status: \"<%- dicom_status %>\",patientID: \"<%- patient_id %>\"});return false' href='#'>" +
                          "Patient <%- patient_name || '' %>, Study <%- study_created_dt || '' %> <%- modalities || '' %> <%- study_description || '' %>" +
                        "</a>";

                if (type === "document")
                    return "<span class='icon-ic-office'></span> " +
                        "<a class='exalink__link' target='_blank' href='/vieworder#order/document/upload/<%- base64.encode(patient_id) %>/<%- base64.encode(order_id) %>/<%- base64.encode(row_id) %>'>" +
                        "Patient <%- full_name || '' %>, Document <%- document_name || '' %>" +
                        "</a>";

                if (type === "study")
                    return "<span class='icon-ic-edit'></span> " +
                        "<a class='exalink__link' target='_blank' href='/vieworder#order/studyinfo/<%- order_id %>/<%- patient_id %>'>" +
                        "Patient <%- patient_name || '' %>, Study <%- study_created_dt || '' %> <%- modalities || '' %> <%- study_description || '' %>" +
                        "</a>";

                if (type === "patient")
                    return "<span class='icon-ic-user'></span> " +
                        "<a class='exalink__link' target='_blank' href='/exa#patient/info/edit/<%- base64.encode(patient_id) %>'>" +
                        "<%- patient_name || '' %>" +
                        "</a>";

                if (type === "report")
                    return "<span class='icon-ic-reports'></span> " +
                        "<a class='exalink__link' target='_blank' href='/Txtranscription/transcription/TranscriptionHandler.ashx?q=" +
                        "<%- base64.encode('study_id='+study_id+'&session='+sessionID) %>'" +
                        ">" +
                        "Patient <%- patient_name || '' %>, Study <%- study_created_dt || '' %> <%- modalities || '' %> <%- study_description || '' %>" +
                        "</a>";

                //"Default" renderer, just shows structure of the exalink payload object
                return "<span class='icon-ic-question'></span> " +
                    "<span style='color: green'><%= JSON.stringify(obj) %></span>";
            },

            _renderExalink: function(payload){
                var exalink;
                try{
                    exalink = payload;
                    exalink.sessionID = app.sessionID; //Enrich payload with sessionID - some link types needs it.
                    return _.template(this._getExalinkTemplateByType(exalink.type))(exalink);
                } catch (e) {
                    return i18n.get('chat.errors.invalidExalink');
                }
            },
            
            renderExalinks: function (content){
                var self = this;
                return content.replace(this._extractionRegexp, function(match, payload){
                    return self._renderExalink(JSON.parse(payload));
                });
            },
            
// =========== Quill-related stuff ===============

            registerExalinkBlot: function(quill){
                var self = this;
                var InlineEmbed = quill.import('blots/embed');
                InlineEmbed.tagName = 'span';
                InlineEmbed.className = 'js_exalink-class';

                var ExalinkBlot = function (node, value) {
                    InlineEmbed.call(this, node, value);
                };
                //Blots are really objects. But as long as we should stick to ES5,
                //we need to do the stuff below to "immitate" blot object

  
                ExalinkBlot.prototype = Object.create(InlineEmbed.prototype);
                // Copy static functions
                $.extend(ExalinkBlot, Object.create(InlineEmbed));
                ExalinkBlot.sanitize = InlineEmbed.sanitize; // sanitize not getting copied, so I am doing it manually

                // Fixed constructor type
                ExalinkBlot.prototype.constructor = ExalinkBlot;

                ExalinkBlot.create = function(payload) {
                    var node = InlineEmbed.create(payload);
                    node.dataset.payload = JSON.stringify(payload); //We should store the payload _somewhere_
                    node.innerHTML = self._renderExalink(payload);
                    node.setAttribute('contenteditable', false);
                    return node;
                };

                ExalinkBlot.value = function(domNode) {
                    return JSON.parse(domNode.dataset.payload);
                };

                ExalinkBlot.blotName = 'exalink';
                ExalinkBlot.tagName = 'span';
                ExalinkBlot.className = 'js_exalink-class';

                quill.register(ExalinkBlot);
            }
            
    
        };
        return ExaLinks;
    }
);
