(function(XHR) {
    var open = XHR.prototype.open;
    var send = XHR.prototype.send;

    var token = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    XHR.prototype.open = function(method, url, async, user, pass) {
        this._url = url;
        open.call(this, method, url, async, user, pass);
    };

    /**
     * Extend the XMLHttpRequest to set request header
     *
     * @param data
     */
    XHR.prototype.send = function(data) {
        this.setRequestHeader('CSRF-Token', token);
        send.call(this, data);
    }
})(XMLHttpRequest);
