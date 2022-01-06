const _ = require('lodash');
const Promise = require('bluebird');
const db = require('../db');
const dataHelper = require('../dataHelper');
const queryBuilder = require('../queryBuilder');
const logger = require('../../../../../logger');
const moment = require('moment');

// generate query template ***only once*** !!!

const agedARSummaryDataSetQueryTemplate = _.template(`
WITH charges_cwt AS (
    SELECT
          bc.id AS claim_id
        , max(date_part('day', ((timezone(f.time_zone,  <%= cutOffDate %>)))  - timezone(f.time_zone, bc.claim_dt))) AS age
        , SUM(c.bill_fee * c.units) AS charges_bill_fee_total
    FROM
        billing.claims AS bc
    INNER JOIN billing.charges AS c ON c.claim_id = bc.id
    INNER JOIN facilities f on f.id = bc.facility_id
    WHERE
        (timezone(f.time_zone, bc.claim_dt)::date <=   <%= cutOffDate %>)
    GROUP BY bc.id
  ),
applications_cwt AS (
    SELECT  cc.claim_id
        ,  coalesce(SUM(pa.amount) FILTER (WHERE pa.amount_type = 'payment'),0::MONEY) AS payments_applied_total
        , coalesce(SUM(pa.amount) FILTER (WHERE pa.amount_type = 'adjustment'),0::MONEY) AS adjustments_applied_total
    FROM charges_cwt cc
    INNER JOIN billing.charges AS c  ON c.claim_id = cc.claim_id
    INNER JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
    INNER JOIN billing.payments AS p ON pa.payment_id = p.id
    WHERE
        p.accounting_date <= <%= cutOffDate %>
    GROUP BY cc.claim_id
 ),
get_claim_details AS (
    SELECT
        cc.claim_id AS claim_id,
        cc.age AS age,
        (cc.charges_bill_fee_total - ( coalesce(ac.payments_applied_total,0::MONEY) +  coalesce(ac.adjustments_applied_total,0::MONEY))) AS balance
    FROM charges_cwt cc
    LEFT JOIN applications_cwt ac ON cc.claim_id = ac.claim_id
    WHERE (cc.charges_bill_fee_total - ( coalesce(ac.payments_applied_total,0::MONEY) +  coalesce(ac.adjustments_applied_total,0::MONEY) )) != 0::MONEY
 ),
aged_ar_summary_details AS(
 SELECT
    <% if (facilityIds) { %> MAX(pf.facility_name) <% } else  { %> 'All'::text <% } %> AS "Facility",
    <% if(incPatDetail == 'true') { %>
         CASE
            WHEN bcpi.patient_insurance_id IS NOT NULL THEN
                'Primary Insurance'
            ELSE
                '-- No payer --'
        END AS "Responsible Party",
    <%} else {%>
    CASE
       WHEN payer_type = 'primary_insurance' THEN 'Insurance'
       WHEN payer_type = 'secondary_insurance' THEN 'Insurance'
       WHEN payer_type = 'tertiary_insurance' THEN 'Insurance'
       WHEN payer_type = 'referring_provider' THEN 'Provider'
       WHEN payer_type = 'patient' THEN 'Patient'
       WHEN payer_type = 'ordering_facility' THEN 'Ordering Facility'
    END AS "Responsible Party",
    <% } %>
    <% if(incPatDetail == 'true') { %>
        CASE
            WHEN bcpi.patient_insurance_id IS NOT NULL THEN
                pip.insurance_name
        ELSE
            CASE
                WHEN payer_type = 'secondary_insurance' THEN pip.insurance_name
                WHEN payer_type = 'tertiary_insurance' THEN pip.insurance_name
                WHEN payer_type = 'referring_provider' THEN  ppr.full_name
                WHEN payer_type = 'patient' THEN get_full_name(pp.last_name,pp.first_name)
                WHEN payer_type = 'ordering_facility' THEN pof.name
            END
       END AS "Payer Name",
    <%} else {%>
       CASE
          WHEN payer_type = 'primary_insurance' THEN pip.insurance_name
          WHEN payer_type = 'secondary_insurance' THEN pip.insurance_name
          WHEN payer_type = 'tertiary_insurance' THEN pip.insurance_name
          WHEN payer_type = 'referring_provider' THEN  ppr.full_name
          WHEN payer_type = 'patient' THEN get_full_name(pp.last_name,pp.first_name)
          WHEN payer_type = 'ordering_facility' THEN pof.name
       END AS "Payer Name",
    <% } %>
    pippt.description AS "Provider Type",
    CASE
       WHEN MAX(pip.insurance_info->'ediCode') ='A' THEN 'Attorney'
       WHEN MAX(pip.insurance_info->'ediCode') ='C' THEN 'Medicare'
       WHEN MAX(pip.insurance_info->'ediCode') ='D' THEN 'Medicaid'
       WHEN MAX(pip.insurance_info->'ediCode') ='F' THEN 'Commercial'
       WHEN MAX(pip.insurance_info->'ediCode') ='G' THEN 'Blue Cross'
       WHEN MAX(pip.insurance_info->'ediCode') ='R' THEN 'RailRoad MC'
       WHEN MAX(pip.insurance_info->'ediCode') ='W' THEN 'Workers Compensation'
       WHEN MAX(pip.insurance_info->'ediCode') ='X' THEN 'X Champus'
       WHEN MAX(pip.insurance_info->'ediCode') ='Y' THEN 'Y Facility'
       WHEN MAX(pip.insurance_info->'ediCode' )='M' THEN 'M DMERC'
    ELSE   ''
    END  AS  "EDI",
    COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age <= 30 ),0) AS "0-30 Count",
    COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age <= 30 ),0::MONEY) AS "0-30 Sum",
    COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 30 and gcd.age <=60  ),0) AS "31-60 Count",
    COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 30 and gcd.age <=60  ),0::MONEY) AS "31-60 Sum",
    COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 60 and gcd.age <=90  ),0) AS "61-90 Count",
    COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 60 and gcd.age <=90  ),0::MONEY) AS "61-90 Sum",
    COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 90 and gcd.age <=120  ),0) AS "91-120 Count",
    COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 90 and gcd.age <=120  ),0::MONEY) AS "91-120 Sum" ,
    <% if(excelExtented == 'true') { %>
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 120 and gcd.age <=150  ),0) AS "121-150 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 120 and gcd.age <=150  ),0::MONEY) AS "121-150 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 150 and gcd.age <=180  ),0) AS "151-180 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 150 and gcd.age <=180  ),0::MONEY) AS "151-180 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 180 and gcd.age <=210  ),0) AS "181-210 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 180 and gcd.age <=210  ),0::MONEY) AS "181-210 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 210 and gcd.age <=240  ),0) AS "211-240 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 210 and gcd.age <=240  ),0::MONEY) AS "211-240 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 240 and gcd.age <=270  ),0) AS "240-270 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 240 and gcd.age <=270  ),0::MONEY) AS "240-270 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 270 and gcd.age <=300  ),0) AS "271-300 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 270 and gcd.age <=300  ),0::MONEY) AS "271-300 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 300 and gcd.age <=330  ),0) AS "301-330 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 300 and gcd.age <=330  ),0::MONEY) AS "301-330 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 330 and gcd.age <=360  ),0) AS "331-360 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 330 and gcd.age <=360  ),0::MONEY) AS "331-360 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 361 and gcd.age <=450  ),0) AS "361-450(Q4) Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 361 and gcd.age <=450  ),0::MONEY) AS "361-450(Q4) Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 451 and gcd.age <=540  ),0) AS "451-540(Q3) Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 451 and gcd.age <=540  ),0::MONEY) AS "451-540(Q3) Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 541 and gcd.age <=630  ),0) AS "541-630(Q2) Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 541 and gcd.age <=630  ),0::MONEY) AS "541-630(Q2) Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 631 and gcd.age <=730  ),0) AS "631-730(Q1) Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 631 and gcd.age <=730  ),0::MONEY) AS "631-730(Q1) Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 730  ),0) AS "730+ Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 730),0::MONEY) AS "730+ Sum",
    <% } else { %>
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 120 ),0) AS "120+ Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 120 ),0::MONEY) AS "120+ Sum",
    <%}%>
    SUM(gcd.balance) AS "Total Balance",
    COUNT(gcd.balance) AS "Total Count"
 FROM
    billing.claims bc
 INNER JOIN get_claim_details gcd ON gcd.claim_id = bc.id
 INNER JOIN public.patients pp ON pp.id = bc.patient_id
 INNER JOIN public.facilities pf ON pf.id = bc.facility_id
 <% if(incPatDetail == 'true') { %>
    LEFT JOIN billing.claim_patient_insurances bcpi ON bcpi.claim_id = bc.id AND bcpi.coverage_level = 'primary'
    LEFT JOIN public.patient_insurances ppi  ON ppi.id = bcpi.patient_insurance_id
 <%} else {%>
    LEFT JOIN LATERAL (
        SELECT
            CASE claims.payer_type
                WHEN 'primary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'primary')
                WHEN 'secondary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'secondary')
                WHEN 'tertiary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'tertiary')
            END AS patient_insurance
        FROM billing.claim_patient_insurances
        WHERE claim_id = bc.id
    ) AS pat_claim_ins ON TRUE
    LEFT JOIN public.patient_insurances ppi ON ppi.id = pat_claim_ins.patient_insurance
 <% } %>
 LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
 LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = pip.provider_payer_type_id
 LEFT JOIN public.ordering_facility_contacts ofc ON ofc.id = bc.ordering_facility_contact_id
 LEFT JOIN public.ordering_facilities pof ON pof.id = ofc.ordering_facility_id
 LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
 LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
  <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
     WHERE TRUE
     AND <%=companyId%>
     AND payer_type != 'patient'
     <% if (facilityIds) { %>AND <% print(facilityIds); } %>
     <% if(billingProID) { %> AND <% print(billingProID); } %>
     <% if(excCreditBal == 'true'){ %> AND  gcd.balance::MONEY > '0' <% } %>
     <% if(insGroups) { %> AND <%=insGroups%> <%}%>
     <% if(insuranceIds) { %> AND <%=insuranceIds%> <%}%>
 GROUP BY "Responsible Party","Payer Name",pippt.description
 <% if(incPatDetail == 'true') { %>
    ORDER BY "Responsible Party" DESC
   <% } %>
 ),
 aged_ar_summary_details_p AS(
    SELECT
        'All'::text  as "Facility",
        <% if(incPatDetail == 'true') { %>
          CASE
             WHEN bcpi.patient_insurance_id IS NOT NULL THEN 'Primary Insurance'
             ELSE '-- No payer --'  END AS "Responsible Party",
        <%} else {%>
          CASE
             WHEN payer_type = 'primary_insurance' THEN 'Insurance'
             WHEN payer_type = 'secondary_insurance' THEN 'Insurance'
             WHEN payer_type = 'tertiary_insurance' THEN 'Insurance'
             WHEN payer_type = 'referring_provider' THEN 'Provider'
             WHEN payer_type = 'patient' THEN 'Patient'
             WHEN payer_type = 'ordering_facility' THEN 'Ordering Facility'
          END AS "Responsible Party",
        <% } %>
          CASE
             WHEN payer_type = 'primary_insurance' THEN pip.insurance_name
             WHEN payer_type = 'secondary_insurance' THEN pip.insurance_name
             WHEN payer_type = 'tertiary_insurance' THEN pip.insurance_name
             WHEN payer_type = 'referring_provider' THEN  ppr.full_name
             WHEN payer_type = 'patient' THEN get_full_name(pp.last_name,pp.first_name)
             WHEN payer_type = 'ordering_facility' THEN pof.name
          END AS "Payer Name",
        pippt.description AS "Provider Type",
        CASE
           WHEN MAX(pip.insurance_info->'ediCode') ='A' THEN 'Attorney'
           WHEN MAX(pip.insurance_info->'ediCode') ='C' THEN 'Medicare'
           WHEN MAX(pip.insurance_info->'ediCode') ='D' THEN 'Medicaid'
           WHEN MAX(pip.insurance_info->'ediCode') ='F' THEN 'Commercial'
           WHEN MAX(pip.insurance_info->'ediCode') ='G' THEN 'Blue Cross'
           WHEN MAX(pip.insurance_info->'ediCode') ='R' THEN 'RailRoad MC'
           WHEN MAX(pip.insurance_info->'ediCode') ='W' THEN 'Workers Compensation'
           WHEN MAX(pip.insurance_info->'ediCode') ='X' THEN 'X Champus'
           WHEN MAX(pip.insurance_info->'ediCode') ='Y' THEN 'Y Facility'
           WHEN MAX(pip.insurance_info->'ediCode' )='M' THEN 'M DMERC'
        ELSE   ''
        END  AS  "EDI",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age <= 30 ),0) AS "0-30 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age <= 30 ),0::MONEY) AS "0-30 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 30 and gcd.age <=60  ),0) AS "31-60 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 30 and gcd.age <=60  ),0::MONEY) AS "31-60 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 60 and gcd.age <=90  ),0) AS "61-90 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 60 and gcd.age <=90  ),0::MONEY) AS "61-90 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 90 and gcd.age <=120  ),0) AS "91-120 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 90 and gcd.age <=120  ),0::MONEY) AS "91-120 Sum" ,
        <% if(excelExtented == 'true') { %>
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 120 and gcd.age <=150  ),0) AS "121-150 Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 120 and gcd.age <=150  ),0::MONEY) AS "121-150 Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 150 and gcd.age <=180  ),0) AS "151-180 Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 150 and gcd.age <=180  ),0::MONEY) AS "151-180 Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 180 and gcd.age <=210  ),0) AS "181-210 Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 180 and gcd.age <=210  ),0::MONEY) AS "181-210 Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 210 and gcd.age <=240  ),0) AS "211-240 Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 210 and gcd.age <=240  ),0::MONEY) AS "211-240 Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 240 and gcd.age <=270  ),0) AS "240-270 Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 240 and gcd.age <=270  ),0::MONEY) AS "240-270 Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 270 and gcd.age <=300  ),0) AS "271-300 Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 270 and gcd.age <=300  ),0::MONEY) AS "271-300 Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 300 and gcd.age <=330  ),0) AS "301-330 Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 300 and gcd.age <=330  ),0::MONEY) AS "301-330 Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 330 and gcd.age <=360  ),0) AS "331-360 Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 330 and gcd.age <=360  ),0::MONEY) AS "331-360 Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 361 and gcd.age <=450  ),0) AS "361-450(Q4) Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 361 and gcd.age <=450  ),0::MONEY) AS "361-450(Q4) Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 451 and gcd.age <=540  ),0) AS "451-540(Q3) Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 451 and gcd.age <=540  ),0::MONEY) AS "451-540(Q3) Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 541 and gcd.age <=630  ),0) AS "541-630(Q2) Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 541 and gcd.age <=630  ),0::MONEY) AS "541-630(Q2) Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 631 and gcd.age <=730  ),0) AS "631-730(Q1) Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 631 and gcd.age <=730  ),0::MONEY) AS "631-730(Q1) Sum",
           COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 730  ),0) AS "730+ Count",
           COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 730),0::MONEY) AS "730+ Sum",
        <% } else { %>
            COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 120 ),0) AS "120+ Count",
            COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 120 ),0::MONEY) AS "120+ Sum",
        <% } %>
        SUM(gcd.balance) AS "Total Balance",
        COUNT(gcd.balance) AS "Total Count",
        payer_type
    FROM billing.claims bc
    INNER JOIN get_claim_details gcd ON gcd.claim_id = bc.id
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    INNER JOIN public.facilities pf ON pf.id = bc.facility_id
    <% if(incPatDetail == 'true') { %>
        LEFT JOIN billing.claim_patient_insurances bcpi ON bcpi.claim_id = bc.id AND bcpi.coverage_level = 'primary'
        LEFT JOIN public.patient_insurances ppi  ON ppi.id = bcpi.patient_insurance_id
     <%} else {%>
        LEFT JOIN LATERAL (
            SELECT
                CASE claims.payer_type
                    WHEN 'primary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'primary')
                    WHEN 'secondary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'secondary')
                    WHEN 'tertiary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'tertiary')
                END AS patient_insurance
            FROM billing.claim_patient_insurances
            WHERE claim_id = bc.id
        ) AS pat_claim_ins ON TRUE
        LEFT JOIN patient_insurances ppi ON ppi.id = pat_claim_ins.patient_insurance
     <% } %>
    LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
    LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = pip.provider_payer_type_id
    LEFT JOIN public.ordering_facility_contacts ofc ON ofc.id = bc.ordering_facility_contact_id
    LEFT JOIN public.ordering_facilities pof ON pof.id = ofc.ordering_facility_id
    LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
    LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
    <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
        WHERE TRUE
        AND <%=companyId%>
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>
        <% if(billingProID) { %> AND <% print(billingProID); } %>
        <% if(excCreditBal == 'true'){ %> AND  gcd.balance::MONEY > '0' <% } %>
        <% if(insGroups) { %> AND <%=insGroups%> <%}%>
        <% if(insuranceIds) { %> AND <%=insuranceIds%> <%}%>
    GROUP BY
          "Responsible Party"
        , "Payer Name"
        , pippt.description
        , payer_type
  )
 SELECT
    "Facility",
    "Responsible Party",
    to_char(<%= cutOffDate %>, 'MM/DD/YYYY') AS "Cut-off Date",
    "Payer Name",
    "Provider Type",
    "EDI",
    "0-30 Count",
    "0-30 Sum",
    "31-60 Count",
    "31-60 Sum",
    "61-90 Count",
    "61-90 Sum",
    "91-120 Count",
    "91-120 Sum",
    <% if(excelExtented == 'true') { %>
        "121-150 Count",
        "121-150 Sum",
        "151-180 Count",
        "151-180 Sum",
        "181-210 Count",
        "181-210 Sum",
        "211-240 Count",
        "211-240 Sum",
        "240-270 Count",
        "240-270 Sum",
        "271-300 Count",
        "271-300 Sum",
        "301-330 Count",
        "301-330 Sum",
        "331-360 Count",
        "331-360 Sum",
        "361-450(Q4) Count",
        "361-450(Q4) Sum",
        "451-540(Q3) Count",
        "451-540(Q3) Sum",
        "541-630(Q2) Count",
        "541-630(Q2) Sum",
        "631-730(Q1) Count",
        "631-730(Q1) Sum",
        "730+ Count",
        "730+ Sum",
    <% } else { %>
        "120+ Count",
        "120+ Sum",
    <% } %>
    "Total Balance",
    "Total Count"
 FROM
    aged_ar_summary_details
 <% if(insGroups == null  && insuranceIds == null) { %>
  UNION ALL
   SELECT
        NULL::TEXT "Facility",
        NULL::TEXT responsible_party,
        NULL::TEXT "Cut-off Date",
        ('--- Patient ---')::text "Payer Name",
        NULL::TEXT,
        NULL::TEXT,
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age <= 30 ),0) AS "0-30 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age <= 30 ),0::MONEY) AS "0-30 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 30 and gcd.age <=60  ),0) AS "31-60 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 30 and gcd.age <=60  ),0::MONEY) AS "31-60 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 60 and gcd.age <=90  ),0) AS "61-90 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 60 and gcd.age <=90  ),0::MONEY) AS "61-90 Sum",
        COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 90 and gcd.age <=120  ),0) AS "91-120 Count",
        COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 90 and gcd.age <=120  ),0::MONEY) AS "91-120 Sum" ,
        <% if(excelExtented == 'true') { %>
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 120 and gcd.age <=150  ),0) AS "121-150 Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 120 and gcd.age <=150  ),0::MONEY) AS "121-150 Sum" ,
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 150 and gcd.age <=180  ),0) AS "151-180 Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 150 and gcd.age <=180  ),0::MONEY) AS "151-180 Sum" ,
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 180 and gcd.age <=210  ),0) AS "181-210 Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 180 and gcd.age <=210  ),0::MONEY) AS "181-210 Sum" ,
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 210 and gcd.age <=240  ),0) AS "211-240 Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 210 and gcd.age <=240  ),0::MONEY) AS "210-240 Sum" ,
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 240 and gcd.age <=270  ),0) AS "241-270 Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 240 and gcd.age <=270  ),0::MONEY) AS "241-270 Sum" ,
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 270 and gcd.age <=300  ),0) AS "271-300 Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 270 and gcd.age <=300  ),0::MONEY) AS "271-300 Sum" ,
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 300 and gcd.age <=330  ),0) AS "301-330 Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 300 and gcd.age <=330  ),0::MONEY) AS "301-330 Sum" ,
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 330 and gcd.age <=360  ),0) AS "331-360 Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 330 and gcd.age <=360  ),0::MONEY) AS "331-360 Sum" ,
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 360 and gcd.age <=450  ),0) AS "361-450(Q4) Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 360 and gcd.age <=450  ),0::MONEY) AS "361-450(Q4) Sum",
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 450 and gcd.age <=540  ),0) AS "451-540(Q3) Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 450 and gcd.age <=540  ),0::MONEY) AS "451-540(Q3) Sum",
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 540 and gcd.age <=630  ),0) AS "540-630(Q2) Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 540 and gcd.age <=630  ),0::MONEY) AS "540-630(Q2) Sum",
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 630 and gcd.age <=730  ),0) AS "630-730(Q1)) Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 630 and gcd.age <=730  ),0::MONEY) AS "630-730(Q1) Sum",
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 730 ),0) AS "730+ Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 730 ),0::MONEY) AS "730+ Sum",
        <% } else { %>
          COALESCE(COUNT(gcd.balance) FILTER(WHERE gcd.age > 120 ),0) AS "120+ Count",
          COALESCE(SUM(gcd.balance) FILTER(WHERE gcd.age > 120 ),0::MONEY) AS "120+ Sum",
        <% } %>
        SUM(gcd.balance) AS "Total Balance",
        COUNT(gcd.balance) AS "Total Count"
        FROM
            billing.claims bc
        INNER JOIN get_claim_details gcd ON gcd.claim_id = bc.id
        INNER JOIN public.patients pp ON pp.id = bc.patient_id
        INNER JOIN public.facilities pf ON pf.id = bc.facility_id
        <% if(incPatDetail == 'true') { %>
            LEFT JOIN billing.claim_patient_insurances bcpi ON bcpi.claim_id = bc.id AND bcpi.coverage_level = 'primary'
            LEFT JOIN public.patient_insurances ppi ON ppi.id = bcpi.patient_insurance_id
         <%} else {%>
            LEFT JOIN LATERAL (
                SELECT
                    CASE bc.payer_type
                        WHEN 'primary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'primary')
                        WHEN 'secondary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'secondary')
                        WHEN 'tertiary_insurance' THEN MAX(patient_insurance_id) FILTER (WHERE coverage_level = 'tertiary')
                    END AS patient_insurance
                FROM billing.claim_patient_insurances
                WHERE claim_id = bc.id
            ) AS pat_claim_ins ON TRUE
            LEFT JOIN public.patient_insurances ppi ON ppi.id = pat_claim_ins.patient_insurance
         <% } %>
        LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
        LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = pip.provider_payer_type_id
        LEFT JOIN public.ordering_facility_contacts ofc ON ofc.id = bc.ordering_facility_contact_id
        LEFT JOIN public.ordering_facilities pof ON pof.id = ofc.ordering_facility_id
        LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
        LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
        <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
        WHERE TRUE
            AND <%=companyId%>
            <% if (facilityIds) { %>AND <% print(facilityIds); } %>
            <% if(billingProID) { %> AND <% print(billingProID); } %>
            <% if(excCreditBal == 'true'){ %> AND  gcd.balance::MONEY > '0' <% } %>
            <% if(insGroups) { %> AND <%=insGroups%> <%}%>
            <% if(insuranceIds) { %> AND <%=insuranceIds%> <% } %>
            AND payer_type = 'patient'
<% } %>
  UNION ALL
   SELECT
        NULL::TEXT "Facility",
        NULL::TEXT responsible_party,
        NULL::TEXT "Cut-off Date",
        ('--- Total A R ---')::text "Payer Name",
        NULL::TEXT "Provider Type",
        NULL::TEXT "EDI",
        SUM("0-30 Count") AS "0-30 Count",
        SUM(CAST("0-30 Sum" AS NUMERIC))::MONEY as "0-30 Sum",
        SUM("31-60 Count") AS "31-60 Count",
        SUM(CAST("31-60 Sum" AS NUMERIC))::MONEY as "31-60 Sum",
        SUM("61-90 Count") AS "61-90 Count",
        SUM(CAST("61-90 Sum" AS NUMERIC))::MONEY as "61-90 Sum",
        SUM("91-120 Count") AS "91-120 Count",
        SUM(CAST("91-120 Sum" AS NUMERIC))::MONEY as "91-120 Sum",
        <% if(excelExtented == 'true') { %>
            SUM("121-150 Count") AS "121-150 Count",
            SUM(CAST("121-150 Sum" AS NUMERIC))::MONEY as "121-150 Sum",
            SUM("151-180 Count") AS "151-180 Count",
            SUM(CAST("151-180 Sum" AS NUMERIC))::MONEY as "151-180 Sum",
            SUM("181-210 Count") AS "181-210 Count",
            SUM(CAST("181-210 Sum" AS NUMERIC))::MONEY as "181-210 Sum",
            SUM("211-240 Count") AS "211-240 Count",
            SUM(CAST("211-240 Sum" AS NUMERIC))::MONEY as "211-240 Sum",
            SUM("240-270 Count") AS "240-270 Count",
            SUM(CAST("240-270 Sum" AS NUMERIC))::MONEY as "240-270 Sum",
            SUM("271-300 Count") AS "271-300 Count",
            SUM(CAST("271-300 Sum" AS NUMERIC))::MONEY as "271-300 Sum",
            SUM("301-330 Count") AS "301-330 Count",
            SUM(CAST("301-330 Sum" AS NUMERIC))::MONEY as "301-330 Sum",
            SUM("331-360 Count") AS "331-360 Count",
            SUM(CAST("331-360 Sum" AS NUMERIC))::MONEY as "331-360 Sum",
            SUM("361-450(Q4) Count") AS "361-450(Q4) Count",
            SUM(CAST("361-450(Q4) Sum" AS NUMERIC))::MONEY as "361-450(Q4) Sum",
            SUM("451-540(Q3) Count") AS "121-150  Count",
            SUM(CAST("451-540(Q3) Sum" AS NUMERIC))::MONEY as "451-540(Q3) Sum",
            SUM("541-630(Q2) Count") AS "541-630(Q2) Count",
            SUM(CAST("541-630(Q2) Sum" AS NUMERIC))::MONEY as "541-630(Q2) Sum",
            SUM("631-730(Q1) Count") AS "631-730(Q1) Count",
            SUM(CAST("631-730(Q1) Sum" AS NUMERIC))::MONEY as "631-730(Q1) Sum",
            SUM("730+ Count") AS "730+ Count",
            SUM(CAST("730+ Sum" AS NUMERIC))::MONEY as "730+ Sum",
        <% } else { %>
            SUM("120+ Count") AS "120+ Count",
            SUM(CAST("120+ Sum" AS NUMERIC))::MONEY as "120+ Sum",
        <% } %>
        SUM(CAST("Total Balance" AS NUMERIC))::MONEY as "Total Balance",
        SUM("Total Count") AS "Total Count"
   FROM
      aged_ar_summary_details_p
      <% if(insGroups != null  || insuranceIds != null) { %>
            WHERE payer_type != 'patient'
      <% } %>
 ORDER BY 1
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        initialReportData.filters = api.createReportFilters(initialReportData);
        //convert array of insuranceProviderIds array of string to integer
        if (initialReportData.report.params.insuranceIds) {
            initialReportData.report.params.insuranceIds = initialReportData.report.params.insuranceIds.map(Number);
        }

        if (initialReportData.report.params.insuranceGroupIds) {
            initialReportData.report.params.insuranceGroupIds = initialReportData.report.params.insuranceGroupIds.map(Number);
        }
        return Promise.join(
            api.createagedARSummaryDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            dataHelper.getInsuranceProvidersInfo(initialReportData.report.params.companyId, initialReportData.report.params.insuranceIds),
            dataHelper.getInsuranceGroupInfo(initialReportData.report.params.companyId, initialReportData.report.params.insuranceGroupIds),
            // other data sets could be added here...
            (agedARSummaryDataSet, providerInfo, insuranceProvidersInfo, providerGroupInfo) => {
                // add report filters
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.lookups.insuranceProviders = insuranceProvidersInfo || [];
                initialReportData.lookups.providerGroup = providerGroupInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);


                // add report specific data sets
                initialReportData.dataSets.push(agedARSummaryDataSet);
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                return initialReportData;
            });
    },

    /**
     * STAGE 3
     * This method is called by controller pipeline after getReportData().
     * All data sets will be avaliable and can be used for any complex, interdependent data set manipulations.
     * Note:
     *  If no transformations are to take place just return resolved promise => return Promise.resolve(rawReportData);
     */
    transformReportData: (rawReportData) => {
        let rawReportDataSet = rawReportData.dataSets[0];
        if (rawReportDataSet && rawReportDataSet.rowCount === 0) {
            return Promise.resolve(rawReportData);
        }
        return new Promise((resolve, reject) => {
            let agedARSummaryColumns = rawReportDataSet.columns;
            let excelExtendedFlag = rawReportData.report.params;
            const rowIndexes = {
                amountSum_30: _.findIndex(agedARSummaryColumns, ['name', '0-30 Sum']),
                amountSum_60: _.findIndex(agedARSummaryColumns, ['name', '31-60 Sum']),
                amountSum_90: _.findIndex(agedARSummaryColumns, ['name', '61-90 Sum']),
                amountSum_120: _.findIndex(agedARSummaryColumns, ['name', '91-120 Sum']),
                amountSum_130: _.findIndex(agedARSummaryColumns, ['name', '120+ Sum']),
                total_balance: _.findIndex(agedARSummaryColumns, ['name', 'Total Balance'])
            }
            if (excelExtendedFlag && excelExtendedFlag.excelExtended !== 'true') {
                agedARSummaryColumns[rowIndexes.amountSum_30].cssClass = 'text-right';
                agedARSummaryColumns[rowIndexes.amountSum_60].cssClass = 'text-right';
                agedARSummaryColumns[rowIndexes.amountSum_90].cssClass = 'text-right';
                agedARSummaryColumns[rowIndexes.amountSum_120].cssClass = 'text-right';
                agedARSummaryColumns[rowIndexes.amountSum_130].cssClass = 'text-right';
                agedARSummaryColumns[rowIndexes.total_balance].cssClass = 'text-right';
            }
            return resolve(rawReportData);
        });
    },

    /**
     * Report specific jsreport options, which will be merged with default ones in the controller.
     * Allows each report to add its own, or override default settings.
     * Note:
     *  You must at least set a template (based on format)!
     */
    getJsReportOptions: (reportParams, reportDefinition) => {
        // here you could dynamically modify jsreport options *per report*....
        // if options defined in report definition are all that is needed, then just select them based on report format
        return reportDefinition.jsreport[reportParams.reportFormat];
    },

    // ================================================================================================================
    // PRIVATE ;) functions

    createReportFilters: (initialReportData) => {
        const lookups = initialReportData.lookups;
        const params = initialReportData.report.params;
        const filtersUsed = [];
        filtersUsed.push({ name: 'company', label: 'Company', value: lookups.company.name });

        if (params.allFacilities && params.facilityIds)
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.map(Number).indexOf(parseInt(f.id, 10)) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        }
        // Billing provider Filter
        if (params.allBillingProvider == 'true')
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        else {
            //const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
            const billingProviderInfo = _(lookups.billingProviderInfo).filter(f => params.billingProvider && params.billingProvider.map(Number).indexOf(parseInt(f.id, 10)) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        }
        if (params.insuranceIds && params.insuranceIds.length) {
            const insuranceInfo = _(lookups.insuranceProviders).map(f => f.name).value();
            filtersUsed.push({ name: 'insurance', label: 'Insurance', value: insuranceInfo });
        }
        else
            filtersUsed.push({ name: 'insurance', label: 'Insurance', value: 'All' });

        if (params.insuranceGroupIds && params.insuranceGroupIds.length) {
            const insuranceGroupInfo = _(lookups.providerGroup).map(f => f.description).value();
            filtersUsed.push({ name: 'insuranceGroup', label: 'Insurance Group', value: insuranceGroupInfo });
        }
        else
            filtersUsed.push({ name: 'insuranceGroup', label: 'Insurance Group', value: 'All' });

        filtersUsed.push({ name: 'Cut Off Date', label: 'Date From', value: moment(params.fromDate).format(params.dateFormat) });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - agedARSummary count

    createagedARSummaryDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getagedARSummaryDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = agedARSummaryDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getagedARSummaryDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            cutOffDate: null,
            facilityIds: null,
            billingProID: null,
            excCreditBal: null,
            insuranceIds: null,
            insGroups: null
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        //  claim_dt

        params.push(reportParams.fromDate);
        filters.cutOffDate = `$${params.length}::date`;

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        }

        filters.excelExtented = reportParams.excelExtended;
        filters.excCreditBal = reportParams.excCreditBal
        filters.incPatDetail = reportParams.incPatDetail
         // Insurance Id Mapping
         if (reportParams.insuranceIds && reportParams.insuranceIds.length) {
            params.push(reportParams.insuranceIds);
            filters.insuranceIds = queryBuilder.whereIn(`pip.id`, [params.length]);
        }

        // Insurance Group ID Mapping
        if (reportParams.insuranceGroupIds && reportParams.insuranceGroupIds.length) {
            params.push(reportParams.insuranceGroupIds);
            filters.insGroups = queryBuilder.whereIn(`pippt.id`, [params.length]);
        }


        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
