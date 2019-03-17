const _ = require('lodash');

module.exports = _.template(`<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:msa="http://msa.ebs.health.ontario.ca/"
    xmlns:idp="http://idp.ebs.health.ontario.ca/"
    xmlns:edt="http://edt.health.ontario.ca/"
    xmlns:ebs="http://ebs.health.ontario.ca/"
    xmlns:hcv="http://hcv.health.ontario.ca/"
    xmlns:xs="http://www.w3.org/2001/XMLSchema">

    <soapenv:Header>

        <ebs:EBS xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
            <SoftwareConformanceKey><%= softwareConformanceKey %></SoftwareConformanceKey>
            <AuditId><%= auditID %></AuditId>
        </ebs:EBS>

        <idp:IDP xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
            <ServiceUserMUID><%= serviceUserMUID %></ServiceUserMUID>
        </idp:IDP>

    </soapenv:Header>

    <soapenv:Body xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
        <%= serviceXML %>
    </soapenv:Body>

</soapenv:Envelope>`);
