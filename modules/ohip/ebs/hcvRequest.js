const _ = require('lodash');
module.exports = _.template(`
    <soapenv:Envelope xmlns:ebs="http://ebs.health.ontario.ca/" xmlns:hcv="http://hcv.health.ontario.ca/" xmlns:idp="http://idp.ebs.health.ontario.ca/" xmlns:msa="http://msa.ebs.health.ontario.ca/" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Header>
            <wsse:Security soapenv:mustUnderstand="1" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
                <wsse:BinarySecurityToken EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" wsu:Id="X509-FF9156B4BEE23716A1142978895556413">MIIGQzC..truncated..CPo=</wsse:BinarySecurityToken>

                <ds:Signature Id="SIG-30" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
                    <ds:SignedInfo>
                        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#">
                            <ec:InclusiveNamespaces PrefixList="ebs hcv idp msa soapenv" xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                        </ds:CanonicalizationM

                        ethod>
                        <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
                        <ds:Reference URI="#UsernameToken-26">
                            <ds:Transforms>
                                <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#">
                                    <ec:InclusiveNamespaces PrefixList="ebs hcv idp msa soapenv" xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                                </ds:Transform>
                            </ds:Transforms>
                            <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                            <ds:DigestValue>nuqM1lGK6rOVruau3woc66AsvIs=</ds:DigestValue>
                        </ds:Reference>
                        <ds:Reference URI="#TS-25">
                            <ds:Transforms>
                                <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#">
                                    <ec:InclusiveNamespaces PrefixList="wsse ebs hcv idp msa soapenv" xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                                </ds:Transform>
                            </ds:Transforms>
                            <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                            <ds:DigestValue>YHFurnR786jGnU0dmhB6AuZMWf0=</ds:DigestValue>
                        </ds:Reference>
                        <ds:Reference URI="#id-27">
                            <ds:Transforms>
                                <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#">
                                    <ec:InclusiveNamespaces PrefixList="hcv idp msa soapenv" xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                                </ds:Transform>
                            </ds:Transforms>
                            <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                            <ds:DigestValue>4HrW5GODU3lE87D24YfwxjGwgCo=</ds:DigestValue>
                        </ds:Reference>
                        <ds:Reference URI="#id-28">
                            <ds:Transforms>
                                <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#">
                                    <ec:InclusiveNamespaces PrefixList="ebs hcv msa soapenv" xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                                </ds:Transform>
                            </ds:Transforms>
                            <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                            <ds:DigestValue>mfmdQegqmjMNvXyV0FYGiJwqrwc=</ds:DigestValue>
                        </ds:Reference>
                        <ds:Reference URI="#id-29">
                            <ds:Transforms>
                                <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#">
                                    <ec:InclusiveNamespaces PrefixList="ebs hcv idp msa" xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                                </ds:Transform>
                            </ds:Transforms>
                            <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                            <ds:DigestValue>HiE8JaUo37dckfkchYYve9S6LuQ=</ds:DigestValue>
                        </ds:Reference>
                    </ds:SignedInfo>
                    <ds:SignatureValue>tAb..truncated..Q==</ds:SignatureValue>
                    <ds:KeyInfo Id="KI-FF9156B4BEE23716A1142978895556414">
                        <wsse:SecurityTokenReference wsu:Id="STR-FF9156B4BEE23716A1142978895556415">
                            <wsse:Reference URI="#X509-FF9156B4BEE23716A1142978895556413" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>
                        </wsse:SecurityTokenReference>
                    </ds:KeyInfo>
                </ds:Signature>


                <wsse:UsernameToken wsu:Id="UsernameToken-26">
                    <wsse:Username>confsu+355@gmail.com</wsse:Username>
                    <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">Password1!</wsse:Password>
                </wsse:UsernameToken>

                <wsu:Timestamp wsu:Id="TS-25">
                    <wsu:Created>2015-04-23T11:35:55Z</wsu:Created>
                    <wsu:Expires>2015-04-23T11:45:55Z</wsu:Expires>
                </wsu:Timestamp>
            </wsse:Security>




            <idp:IDP wsu:Id="id-28" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
                <ServiceUserMUID>614200</ServiceUserMUID>
            </idp:IDP>

            <ebs:EBS wsu:Id="id-27" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
                <SoftwareConformanceKey>65489ecd-0bef-4558-8871-f2e4b71b8e92</SoftwareConformanceKey>
                <AuditId>Your_UniqueAuditID_FOR_EACh_Transaction</AuditId>
            </ebs:EBS>
        </soapenv:Header>

        <soapenv:Body wsu:Id="id-29" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
            <hcv:validate>
                <requests>
                    <hcvRequest>
                        <healthNumber>9876543217</healthNumber>
                        <versionCode>ML</versionCode>
                        <feeServiceCodes>A110</feeServiceCodes>
                    </hcvRequest>
                </requests>
                <locale>en</locale>
            </hcv:validate>
        </soapenv:Body>
    </soapenv:Envelope>
`);


// <healthNumber>1216070563</healthNumber>
