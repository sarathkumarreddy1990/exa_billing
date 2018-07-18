const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const agedARSummaryDataSetQueryTemplate = _.template(`

WITH charges_cwt AS (
    SELECT
          bc.id                           AS claim_id
        , max(date_part('day', (<%= claimDate %> - bc.claim_dt))) as age
        , sum(c.bill_fee * c.units)       AS charges_bill_fee_total
    FROM  billing.claims AS bc
        INNER JOIN billing.charges AS c ON c.claim_id = bc.id
    WHERE 1=1
       AND (bc.claim_dt < <%= claimDate %>::DATE)  
    GROUP BY bc.id
), 
applications_cwt AS (
    SELECT  cc.claim_id
        ,  coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'payment'),0::money)    AS payments_applied_total
        , coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'adjustment'),0::money) AS ajdustments_applied_total
    FROM charges_cwt cc
    INNER JOIN billing.charges AS c  ON c.claim_id = cc.claim_id
    INNER JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
    INNER JOIN billing.payments AS p ON pa.payment_id = p.id
    GROUP BY cc.claim_id
),   
get_claim_details AS(
    SELECT 
        cc.claim_id as claim_id,
        cc.age as age,
       (cc.charges_bill_fee_total - ( ac.payments_applied_total +  ac.ajdustments_applied_total )) AS balance
    FROM charges_cwt cc
    INNER JOIN applications_cwt ac ON cc.claim_id = ac.claim_id  
    WHERE (cc.charges_bill_fee_total - ( ac.payments_applied_total +  ac.ajdustments_applied_total )) != 0::money
 ),
aged_ar_summary_details AS( 
 SELECT
 <% if (facilityIds) { %> MAX(pf.facility_name) <% } else  { %> 'All'::text <% } %> as "Facility",
 <% if(incPatDetail == 'true') { %>     
            CASE WHEN primary_patient_insurance_id is not null THEN 'Primary Insurance' ELSE '-- No payer --'  END AS "Responsible Party",     
 <%} else {%>    
 CASE WHEN payer_type = 'primary_insurance' THEN 'Insurance'
      WHEN payer_type = 'secondary_insurance' THEN 'Insurance'
      WHEN payer_type = 'tertiary_insurance' THEN 'Insurance'
      WHEN payer_type = 'referring_provider' THEN 'Provider'
      WHEN payer_type = 'patient' THEN 'Patient'
      WHEN payer_type = 'ordering_facility' THEN 'Ordering Facility'     
END AS "Responsible Party",
    <% } %>
<% if(incPatDetail == 'true') { %>     
        CASE WHEN primary_patient_insurance_id is not null THEN pip.insurance_name 
        ELSE  
            CASE 
                WHEN payer_type = 'secondary_insurance' THEN pip.insurance_name
                WHEN payer_type = 'tertiary_insurance' THEN pip.insurance_name
                WHEN payer_type = 'referring_provider' THEN  ppr.full_name
                WHEN payer_type = 'patient' THEN get_full_name(pp.last_name,pp.first_name)
                WHEN payer_type = 'ordering_facility' THEN ppg.group_name
            END
  END AS "Payer Name",     
<%} else {%>   
 CASE WHEN payer_type = 'primary_insurance' THEN pip.insurance_name
      WHEN payer_type = 'secondary_insurance' THEN pip.insurance_name
      WHEN payer_type = 'tertiary_insurance' THEN pip.insurance_name
      WHEN payer_type = 'referring_provider' THEN  ppr.full_name
      WHEN payer_type = 'patient' THEN get_full_name(pp.last_name,pp.first_name)
      WHEN payer_type = 'ordering_facility' THEN ppg.group_name
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
 COALESCE(count(gcd.balance) FILTER(where gcd.age <= 30 ),0) AS "0-30 Count",
 COALESCE(SUM(gcd.balance) FILTER(where gcd.age <= 30 ),0::money) AS "0-30 Sum",
 COALESCE(count(gcd.balance) FILTER(where gcd.age > 30 and gcd.age <=60  ),0) AS "31-60 Count",
 COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 30 and gcd.age <=60  ),0::money) AS "31-60 Sum",
 COALESCE(count(gcd.balance) FILTER(where gcd.age > 60 and gcd.age <=90  ),0) AS "61-90 Count",
 COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 60 and gcd.age <=90  ),0::money) AS "61-90 Sum",
 COALESCE(count(gcd.balance) FILTER(where gcd.age > 90 and gcd.age <=120  ),0) AS "91-120 Count",
 COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 90 and gcd.age <=120  ),0::money) AS "91-120 Sum" ,
 <% if(excelExtented == 'true') { %>    
    COALESCE(count(gcd.balance) FILTER(where gcd.age > 120 and gcd.age <=150  ),0) AS "121-150 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 120 and gcd.age <=150  ),0::money) AS "121-150 Sum",  

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 150 and gcd.age <=180  ),0) AS "151-180 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 120 and gcd.age <=150  ),0::money) AS "151-180 Sum", 

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 180 and gcd.age <=210  ),0) AS "181-210 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 180 and gcd.age <=210  ),0::money) AS "181-210 Sum", 

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 210 and gcd.age <=240  ),0) AS "211-240 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 210 and gcd.age <=240  ),0::money) AS "211-240 Sum", 

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 240 and gcd.age <=270  ),0) AS "240-270 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 240 and gcd.age <=270  ),0::money) AS "240-270 Sum", 

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 270 and gcd.age <=300  ),0) AS "271-300 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 270 and gcd.age <=300  ),0::money) AS "271-300 Sum", 

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 300 and gcd.age <=330  ),0) AS "301-330 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 300 and gcd.age <=330  ),0::money) AS "301-330 Sum", 

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 330 and gcd.age <=360  ),0) AS "331-360 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 330 and gcd.age <=360  ),0::money) AS "331-360 Sum", 

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 361 and gcd.age <=450  ),0) AS "361-450(Q4) Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 361 and gcd.age <=450  ),0::money) AS "361-450(Q4) Sum", 

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 451 and gcd.age <=540  ),0) AS "451-540(Q3) Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 451 and gcd.age <=540  ),0::money) AS "451-540(Q3) Sum", 

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 541 and gcd.age <=630  ),0) AS "541-630(Q2) Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 541 and gcd.age <=630  ),0::money) AS "541-630(Q2) Sum", 

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 631 and gcd.age <=730  ),0) AS "631-730(Q1) Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 631 and gcd.age <=730  ),0::money) AS "631-730(Q1) Sum", 

    COALESCE(count(gcd.balance) FILTER(where gcd.age > 730  ),0) AS "730+ Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 730),0::money) AS "730+ Sum", 

    <% } else { %> 
        COALESCE(COUNT(gcd.balance) FILTER(where gcd.age > 120 ),0) AS "120+ Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 120 ),0::money) AS "120+ Sum"      ,
    <%}%>
 SUM(gcd.balance) AS "Total Balance",
 COUNT(gcd.balance) AS "Total Count"
 FROM billing.claims bc
 INNER JOIN get_claim_details gcd ON gcd.claim_id = bc.id
 INNER JOIN public.patients pp ON pp.id = bc.patient_id
 INNER JOIN public.facilities pf ON pf.id = bc.facility_id

 <% if(incPatDetail == 'true') { %> 
    LEFT JOIN public.patient_insurances ppi ON ppi.id = primary_patient_insurance_id
 <%} else {%>
    LEFT JOIN public.patient_insurances ppi ON ppi.id = CASE WHEN payer_type = 'primary_insurance' THEN primary_patient_insurance_id
    WHEN payer_type = 'secondary_insurance' THEN secondary_patient_insurance_id
    WHEN payer_type = 'tertiary_insurance' THEN tertiary_patient_insurance_id
END
<% } %>
 
 LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
 LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = pip.provider_payer_type_id
 LEFT JOIN public.provider_groups ppg ON ppg.id = bc.ordering_facility_id
 LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
 LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
 
  <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
     WHERE 1 = 1
     AND <%=companyId%>
     AND payer_type != 'patient'     
     <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
     <% if(billingProID) { %> AND <% print(billingProID); } %>
     <% if(excCreditBal == 'true'){ %> AND  gcd.balance::money > '0' <% } %>
 GROUP BY "Responsible Party","Payer Name",pippt.description

 <% if(incPatDetail == 'true') { %>     
    ORDER BY "Responsible Party" DESC
   <% } %>
 ),
 aged_ar_summary_details_p AS( 
    SELECT
     'All'::text  as "Facility",
        
     <% if(incPatDetail == 'true') { %>     
        CASE WHEN primary_patient_insurance_id is not null THEN 'Primary Insurance' ELSE '-- No payer --'  END AS "Responsible Party",     
<%} else {%>    
CASE WHEN payer_type = 'primary_insurance' THEN 'Insurance'
  WHEN payer_type = 'secondary_insurance' THEN 'Insurance'
  WHEN payer_type = 'tertiary_insurance' THEN 'Insurance'
  WHEN payer_type = 'referring_provider' THEN 'Provider'
  WHEN payer_type = 'patient' THEN 'Patient'
  WHEN payer_type = 'ordering_facility' THEN 'Ordering Facility'     
END AS "Responsible Party",
<% } %>      
      
    CASE WHEN payer_type = 'primary_insurance' THEN pip.insurance_name
         WHEN payer_type = 'secondary_insurance' THEN pip.insurance_name
         WHEN payer_type = 'tertiary_insurance' THEN pip.insurance_name
         WHEN payer_type = 'referring_provider' THEN  ppr.full_name
         WHEN payer_type = 'patient' THEN get_full_name(pp.last_name,pp.first_name)
         WHEN payer_type = 'ordering_facility' THEN ppg.group_name
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
    COALESCE(count(gcd.balance) FILTER(where gcd.age <= 30 ),0) AS "0-30 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age <= 30 ),0::money) AS "0-30 Sum",
    COALESCE(count(gcd.balance) FILTER(where gcd.age > 30 and gcd.age <=60  ),0) AS "31-60 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 30 and gcd.age <=60  ),0::money) AS "31-60 Sum",
    COALESCE(count(gcd.balance) FILTER(where gcd.age > 60 and gcd.age <=90  ),0) AS "61-90 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 60 and gcd.age <=90  ),0::money) AS "61-90 Sum",
    COALESCE(count(gcd.balance) FILTER(where gcd.age > 90 and gcd.age <=120  ),0) AS "91-120 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 90 and gcd.age <=120  ),0::money) AS "91-120 Sum" ,        
           
           <% if(excelExtented == 'true') { %>    
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 120 and gcd.age <=150  ),0) AS "121-150 Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 120 and gcd.age <=150  ),0::money) AS "121-150 Sum",  
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 150 and gcd.age <=180  ),0) AS "151-180 Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 120 and gcd.age <=150  ),0::money) AS "151-180 Sum", 
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 180 and gcd.age <=210  ),0) AS "181-210 Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 180 and gcd.age <=210  ),0::money) AS "181-210 Sum", 
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 210 and gcd.age <=240  ),0) AS "211-240 Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 210 and gcd.age <=240  ),0::money) AS "211-240 Sum", 
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 240 and gcd.age <=270  ),0) AS "240-270 Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 240 and gcd.age <=270  ),0::money) AS "240-270 Sum", 
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 270 and gcd.age <=300  ),0) AS "271-300 Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 270 and gcd.age <=300  ),0::money) AS "271-300 Sum", 
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 300 and gcd.age <=330  ),0) AS "301-330 Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 300 and gcd.age <=330  ),0::money) AS "301-330 Sum", 
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 330 and gcd.age <=360  ),0) AS "331-360 Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 330 and gcd.age <=360  ),0::money) AS "331-360 Sum", 
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 361 and gcd.age <=450  ),0) AS "361-450(Q4) Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 361 and gcd.age <=450  ),0::money) AS "361-450(Q4) Sum", 
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 451 and gcd.age <=540  ),0) AS "451-540(Q3) Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 451 and gcd.age <=540  ),0::money) AS "451-540(Q3) Sum", 
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 541 and gcd.age <=630  ),0) AS "541-630(Q2) Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 541 and gcd.age <=630  ),0::money) AS "541-630(Q2) Sum", 
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 631 and gcd.age <=730  ),0) AS "631-730(Q1) Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 631 and gcd.age <=730  ),0::money) AS "631-730(Q1) Sum", 
        
            COALESCE(count(gcd.balance) FILTER(where gcd.age > 730  ),0) AS "730+ Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 730),0::money) AS "730+ Sum", 
        
            <% } else { %> 
                COALESCE(COUNT(gcd.balance) FILTER(where gcd.age > 120 ),0) AS "120+ Count",
                COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 120 ),0::money) AS "120+ Sum",
            <%}%>
            
    SUM(gcd.balance) AS "Total Balance",
    COUNT(gcd.balance) AS "Total Count"
    FROM billing.claims bc
    INNER JOIN get_claim_details gcd ON gcd.claim_id = bc.id
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    INNER JOIN public.facilities pf ON pf.id = bc.facility_id 
   LEFT JOIN public.patient_insurances ppi ON ppi.id = CASE WHEN payer_type = 'primary_insurance' THEN primary_patient_insurance_id
       WHEN payer_type = 'secondary_insurance' THEN secondary_patient_insurance_id
       WHEN payer_type = 'tertiary_insurance' THEN tertiary_patient_insurance_id
   END 
    LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
    LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = pip.provider_payer_type_id
    LEFT JOIN public.provider_groups ppg ON ppg.id = bc.ordering_facility_id
    LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
    LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
    <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>

        WHERE 1 = 1
        AND <%=companyId%>
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
        <% if(billingProID) { %> AND <% print(billingProID); } %>
        <% if(excCreditBal == 'true'){ %> AND  gcd.balance::money > '0' <% } %>
    GROUP BY "Responsible Party","Payer Name",pippt.description
    
    )
 SELECT 
    "Facility",
    "Responsible Party",
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
        <%}%>
    "Total Balance",
    "Total Count"
FROM
 aged_ar_summary_details
UNION ALL

SELECT 
    null::text "Facility",
    null::text responsible_party,
    ('--- Patient ---')::text "Payer Name",
    null::text,
    null::text,
    COALESCE(count(gcd.balance) FILTER(where gcd.age <= 30 ),0) AS "0-30 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age <= 30 ),0::money) AS "0-30 Sum",
    COALESCE(count(gcd.balance) FILTER(where gcd.age > 30 and gcd.age <=60  ),0) AS "31-60 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 30 and gcd.age <=60  ),0::money) AS "31-60 Sum",
    COALESCE(count(gcd.balance) FILTER(where gcd.age > 60 and gcd.age <=90  ),0) AS "61-90 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 60 and gcd.age <=90  ),0::money) AS "61-90 Sum",
    COALESCE(count(gcd.balance) FILTER(where gcd.age > 90 and gcd.age <=120  ),0) AS "91-120 Count",
    COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 90 and gcd.age <=120  ),0::money) AS "91-120 Sum" ,
        <% if(excelExtented == 'true') { %>         
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 120 and gcd.age <=150  ),0) AS "121-150 Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 120 and gcd.age <=150  ),0::money) AS "121-150 Sum" ,
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 150 and gcd.age <=180  ),0) AS "151-180 Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 150 and gcd.age <=180  ),0::money) AS "151-180 Sum" ,
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 180 and gcd.age <=210  ),0) AS "181-210 Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 180 and gcd.age <=210  ),0::money) AS "181-210 Sum" ,
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 210 and gcd.age <=240  ),0) AS "211-240 Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 210 and gcd.age <=240  ),0::money) AS "210-240 Sum" ,
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 240 and gcd.age <=270  ),0) AS "241-270 Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 240 and gcd.age <=270  ),0::money) AS "241-270 Sum" ,
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 270 and gcd.age <=300  ),0) AS "271-300 Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 270 and gcd.age <=300  ),0::money) AS "271-300 Sum" ,
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 300 and gcd.age <=330  ),0) AS "301-330 Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 300 and gcd.age <=330  ),0::money) AS "301-330 Sum" ,
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 330 and gcd.age <=360  ),0) AS "331-360 Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 330 and gcd.age <=360  ),0::money) AS "331-360 Sum" ,
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 360 and gcd.age <=450  ),0) AS "361-450(Q4) Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 360 and gcd.age <=450  ),0::money) AS "361-450(Q4) Sum",
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 450 and gcd.age <=540  ),0) AS "451-540(Q3) Count", 
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 450 and gcd.age <=540  ),0::money) AS "451-540(Q3) Sum", 
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 540 and gcd.age <=630  ),0) AS "540-630(Q2) Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 540 and gcd.age <=630  ),0::money) AS "540-630(Q2) Sum",
        COALESCE(count(gcd.balance) FILTER(where gcd.age > 630 and gcd.age <=730  ),0) AS "630-730(Q1)) Count", 
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 630 and gcd.age <=730  ),0::money) AS "630-730(Q1) Sum", 
        COALESCE(COUNT(gcd.balance) FILTER(where gcd.age > 730 ),0) AS "730+ Count",
        COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 730 ),0::money) AS "730+ Sum", 
        <% } else { %> 
            COALESCE(COUNT(gcd.balance) FILTER(where gcd.age > 120 ),0) AS "120+ Count",
            COALESCE(SUM(gcd.balance) FILTER(where gcd.age > 120 ),0::money) AS "120+ Sum",
        <%}%>       
         SUM(gcd.balance) AS "Total Balance",
         COUNT(gcd.balance) AS "Total Count"
         FROM billing.claims bc
         INNER JOIN get_claim_details gcd ON gcd.claim_id = bc.id
         INNER JOIN public.patients pp ON pp.id = bc.patient_id
         INNER JOIN public.facilities pf ON pf.id = bc.facility_id 
        LEFT JOIN public.patient_insurances ppi ON ppi.id = CASE WHEN payer_type = 'primary_insurance' THEN primary_patient_insurance_id
            WHEN payer_type = 'secondary_insurance' THEN secondary_patient_insurance_id
            WHEN payer_type = 'tertiary_insurance' THEN tertiary_patient_insurance_id
        END 
         LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
         LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = pip.provider_payer_type_id
         LEFT JOIN public.provider_groups ppg ON ppg.id = bc.ordering_facility_id
         LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
         LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
         <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>

             WHERE 1 = 1
             AND <%=companyId%>
             <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
             <% if(billingProID) { %> AND <% print(billingProID); } %>
             <% if(excCreditBal == 'true'){ %> AND  gcd.balance::money > '0' <% } %>
             AND payer_type = 'patient'

 UNION ALL
 SELECT    
    null::text "Facility",
    null::text responsible_party,
    ('--- Total A R ---')::text "Payer Name",
    null::text "Provider Type",
    null::text "EDI",
    sum("0-30 Count") AS "0-30 Count",
    sum(cast("0-30 Sum" AS NUMERIC))::MONEY as "0-30 Sum",
    sum("31-60 Count") AS "31-60 Count",
    sum(cast("31-60 Sum" AS NUMERIC))::MONEY as "31-60 Sum",
    sum("61-90 Count") AS "61-90 Count",
    sum(cast("61-90 Sum" AS NUMERIC))::MONEY as "61-90 Sum",
    sum("91-120 Count") AS "91-120 Count",
    sum(cast("91-120 Sum" AS NUMERIC))::MONEY as "91-120 Sum",
    <% if(excelExtented == 'true') { %>  
        sum("121-150 Count") AS "121-150 Count",
        sum(cast("121-150 Sum" AS NUMERIC))::MONEY as "121-150 Sum", 
        sum("151-180 Count") AS "151-180 Count",
        sum(cast("151-180 Sum" AS NUMERIC))::MONEY as "151-180 Sum",  
        sum("181-210 Count") AS "181-210 Count",
        sum(cast("181-210 Sum" AS NUMERIC))::MONEY as "181-210 Sum",  
        sum("211-240 Count") AS "211-240 Count",
        sum(cast("211-240 Sum" AS NUMERIC))::MONEY as "211-240 Sum",  
        sum("240-270 Count") AS "240-270 Count",
        sum(cast("240-270 Sum" AS NUMERIC))::MONEY as "240-270 Sum",  
        sum("271-300 Count") AS "271-300 Count",
        sum(cast("271-300 Sum" AS NUMERIC))::MONEY as "271-300 Sum",   
        sum("301-330 Count") AS "301-330 Count",
        sum(cast("301-330 Sum" AS NUMERIC))::MONEY as "301-330 Sum",  
        sum("331-360 Count") AS "331-360 Count",
        sum(cast("331-360 Sum" AS NUMERIC))::MONEY as "331-360 Sum",   
        sum("361-450(Q4) Count") AS "361-450(Q4) Count",
        sum(cast("361-450(Q4) Sum" AS NUMERIC))::MONEY as "361-450(Q4) Sum",    
        sum("451-540(Q3) Count") AS "121-150  Count",
        sum(cast("451-540(Q3) Sum" AS NUMERIC))::MONEY as "451-540(Q3) Sum",  
        sum("541-630(Q2) Count") AS "541-630(Q2) Count",
        sum(cast("541-630(Q2) Sum" AS NUMERIC))::MONEY as "541-630(Q2) Sum", 
        sum("631-730(Q1) Count") AS "631-730(Q1) Count",
        sum(cast("631-730(Q1) Sum" AS NUMERIC))::MONEY as "631-730(Q1) Sum",  
        sum("730+ Count") AS "730+ Count",
        sum(cast("730+ Sum" AS NUMERIC))::MONEY as "730+ Sum",     
        <% } else { %> 
            sum("120+ Count") AS "120+ Count",
            sum(cast("120+ Sum" AS NUMERIC))::MONEY as "120+ Sum",
        <%}%>
    sum(cast("Total Balance" AS NUMERIC))::MONEY as "Total Balance",
    sum("Total Count") AS "Total Count"
FROM
aged_ar_summary_details_p
 order by 1
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createagedARSummaryDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (agedARSummaryDataSet) => {
                // add report filters                
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
        return Promise.resolve(rawReportData);
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

        if (params.allFacilities && (params.facilityIds && params.facilityIds.length < 0))
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.indexOf(f.id) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        }

        // // Billing provider Filter
        if (params.allBillingProvider == 'true')
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        else {
            const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        }

        filtersUsed.push({ name: 'Cut Off Date', label: 'Date From', value: params.fromDate });

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
            claimDate: null,
            facilityIds: null,
            billingProID: null,
            excCreditBal: null
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
        filters.claimDate = `$${params.length}::date`;

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        }

        filters.excelExtented = reportParams.excelExtended;
        filters.excCreditBal = reportParams.excCreditBal
        filters.incPatDetail = reportParams.incPatDetail

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
