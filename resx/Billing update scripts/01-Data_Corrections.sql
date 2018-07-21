DO
$$
DECLARE

s_rec RECORD; 
coverage_level_wrong character varying := '';
originalProvider json ;
wrong_patient_insurance_id int := 0;
patient_insuarances_id int :=0;
policy_no character varying := '';
wrong_insuarances_id int :=0; 

BEGIN
-- -----------------------------------------------------------------------------------------------------------------------
-- FOR SNO -11 ,SNO-12 for we have same migration script 
-- SNO-11 Patient id in orders and patient id in  "patient insurances" are  not matching-- 64 Row
-- SNO-11 Kyle Reply :Look up and assign these orders to the corresponding patient insurance profile.  ie Primary, Secondary, Tertiary "
-- SNO-12 Patient Insurances in Order ID don’t have matching patient id of orders- 1 Row
-- SNO-12 Kyle Reply : Clear claim insurance assignment and set the claim to patient responsibility"
-- -----------------------------------------------------------------------------------------------------------------------
RAISE NOTICE '--- 1 Starts patient_insuarances data correction  ---';
-- -----------------------------------------------------------------------------------------------------------------------
-- Creating dummy table for patient_insuarances data correction
CREATE TABLE patient_insuarances_exception_data AS
SELECT
    orders.id,
    orders.patient_id,
    patient_insuarances.patient_id AS ins_patient_id,
    patient_insuarances.id patient_insuarances_id,
    coverage_level,
    FALSE AS is_updated,
    FALSE AS is_exclude
FROM
    orders
    INNER JOIN patient_insuarances ON patient_insuarances.id = ANY (
        insurance_provider_ids)
WHERE
    orders.patient_id != patient_insuarances.patient_id;
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE
    patient_insuarances_exception_data pied
SET
    is_exclude = TRUE
WHERE
    pied.patient_insuarances_id IN (
        SELECT
            orders.id
        FROM orders
        INNER JOIN patient_insuarances ON patient_insuarances.id = ANY (insurance_provider_ids)
        WHERE 1=1 
        AND orders.patient_id = patient_insuarances.patient_id
        AND orders.id IN ((SELECT
                               orders.id FROM orders
                           INNER JOIN patient_insuarances ON patient_insuarances.id = ANY (insurance_provider_ids)
                           WHERE orders.patient_id != patient_insuarances.patient_id)
                          ));
-- -----------------------------------------------------------------------------------------------------------------------
FOR s_rec IN SELECT * FROM patient_insuarances_exception_data WHERE NOT is_updated  AND NOT is_exclude LOOP
SELECT coverage_level,id as patient_insuarances_id,subscriber_info->'PolicyNo' as policy_no,insurance_provider_id INTO coverage_level_wrong, patient_insuarances_id,policy_no,wrong_insuarances_id FROM patient_insuarances
 WHERE s_rec.patient_insuarances_id = patient_insuarances.id ;
wrong_patient_insurance_id =(SELECT id FROM patient_insuarances WHERE s_rec.patient_id = patient_insuarances.patient_id 
AND coverage_level_wrong=patient_insuarances.coverage_level AND patient_insuarances.insurance_provider_id = wrong_insuarances_id AND policy_no=subscriber_info->'PolicyNo' LIMIT 1);
 RAISE notice 'row = % coverage_level_wrong',coverage_level_wrong;
 RAISE notice 'row = % patient_insuarances_id',patient_insuarances_id;
 RAISE notice 'row = % policy_no',policy_no;
 RAISE notice 'row = % s_rec.patient_insuarances_id',s_rec.patient_insuarances_id;
 RAISE notice 'row = % wrong_patient_insurance_id',wrong_patient_insurance_id;


 UPDATE patient_insuarances
SET patient_id=s_rec.patient_id
WHERE id = s_rec.patient_insuarances_id ;
 UPDATE patient_insuarances
SET patient_id=s_rec.ins_patient_id
WHERE id = wrong_patient_insurance_id  ;
update patient_insuarances_exception_data SET is_updated =true WHERE id=s_rec.id AND NOT is_exclude ;
END LOOP;


RAISE NOTICE '--- 2 insurance_provider_ids ----';

/***
-- This script is only for MRI
------------------------------------------------------------------------
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '355919', '75206') WHERE id= 588653;
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '355919', '75206') WHERE id= 588343;
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '173551', null) WHERE id= 95372  ;
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '173551', null) WHERE id= 537833 ;
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '256739', '357610') WHERE id in( 235176 , 235195) ;
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '256739', '357610') WHERE id= 235195 ;
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '299400', '280902') WHERE id= 531548  ;
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '283104', '77313') WHERE id in( 151717,147974,164591);
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '276371', null) WHERE id= 537833 ;
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '250202','132099') WHERE id= 543642 ;
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '283005','282310') WHERE id= 536628 ;
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '250202','132099') WHERE id= 543642 ; 
update orders set insurance_provider_ids= array_replace(insurance_provider_ids, '382160',null) WHERE id= 785316;
------------------------------------------------------------------------
***/

DROP TABLE patient_insuarances_exception_data;

-- -----------------------------------------------------------------------------------------------------------------------
-- SNO-13 Data correction for Order having duplicate patient_insurance ids - 26859 Rows
-- Kyle Reply :  If there is no primary coverage available then do not populate any insurance profiles and set the claim to patient responsibility.
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE orders ic SET insurance_provider_ids = null , order_info = ic.order_info || hstore(ARRAY['payer', 'payer_id', 'payer_type', 'payer_name'], ARRAY['Patient', o.patient_id::text, 'PPP', patients.full_name::text])
FROM 
    orders o
INNER JOIN patient_insuarances pi ON pi.id = insurance_provider_ids[1]
INNER JOIN patients ON patients.id = pi.patient_id
WHERE 1 = 1
AND o.id = ic.id
AND coverage_level != 'P'
AND NOT o.is_quick_appt
AND o.order_type!='E'
AND array_length(o.insurance_provider_ids, 1) <= 3
AND o.order_status NOT IN ('NOS', 'ABRT', 'ORD', 'CAN' );
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE orders ic SET insurance_provider_ids = ARRAY(SELECT o.insurance_provider_ids[1])
FROM 
    orders o
INNER JOIN patient_insuarances pip ON pip.id = insurance_provider_ids[1] AND pip.coverage_level = 'P'
INNER JOIN patient_insuarances pis ON pis.id = insurance_provider_ids[2] AND pis.coverage_level != 'S'
WHERE 1 = 1
AND o.id = ic.id
AND NOT o.is_quick_appt
AND o.order_type!='E'
AND array_length(o.insurance_provider_ids, 1) <= 3
AND o.order_status NOT IN ('NOS', 'ABRT', 'ORD', 'CAN' );
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE orders ic SET insurance_provider_ids =   ARRAY[o.insurance_provider_ids[1], o.insurance_provider_ids[2]]
FROM 
    orders o
INNER JOIN patient_insuarances pip ON pip.id = insurance_provider_ids[1] AND pip.coverage_level = 'P'
INNER JOIN patient_insuarances pis ON pis.id = insurance_provider_ids[2] AND pis.coverage_level = 'S'
INNER JOIN patient_insuarances pit ON pit.id = insurance_provider_ids[3] AND pit.coverage_level != 'T'
WHERE 1 = 1
AND o.id = ic.id
AND NOT o.is_quick_appt
AND o.order_type!='E'
AND array_length(o.insurance_provider_ids, 1) <= 3
AND o.order_status NOT IN ('NOS', 'ABRT', 'ORD', 'CAN' );
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE orders ic SET insurance_provider_ids =  null, order_info = ic.order_info || hstore(ARRAY['payer', 'payer_id', 'payer_type', 'payer_name'], ARRAY['Patient', o.patient_id::text, 'PPP', patients.full_name::text])
FROM 
    orders o
INNER JOIN patients ON patients.id = o.patient_id
INNER JOIN patient_insuarances pip ON pip.id = insurance_provider_ids[1] AND pip.coverage_level != 'P'
WHERE 1 = 1
AND o.id = ic.id
AND NOT o.is_quick_appt
AND o.order_type!='E'
AND array_length(o.insurance_provider_ids, 1) > 3
AND o.order_status NOT IN ('NOS', 'ABRT', 'ORD', 'CAN' );
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE orders ic SET insurance_provider_ids =  ARRAY[o.insurance_provider_ids[1]]
FROM 
    orders o
INNER JOIN patients ON patients.id = o.patient_id
INNER JOIN patient_insuarances pip ON pip.id = insurance_provider_ids[1] AND pip.coverage_level = 'P'
INNER JOIN patient_insuarances pis ON pis.id = insurance_provider_ids[2] AND pis.coverage_level != 'S'
WHERE 1 = 1
AND o.id = ic.id
AND NOT o.is_quick_appt
AND o.order_type!='E'
AND array_length(o.insurance_provider_ids, 1) > 3
AND o.order_status NOT IN ('NOS', 'ABRT', 'ORD', 'CAN' );
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE orders ic SET insurance_provider_ids =  ARRAY[o.insurance_provider_ids[1], o.insurance_provider_ids[2]]
FROM 
    orders o
INNER JOIN patients ON patients.id = o.patient_id
INNER JOIN patient_insuarances pip ON pip.id = insurance_provider_ids[1] AND pip.coverage_level = 'P'
INNER JOIN patient_insuarances pis ON pis.id = insurance_provider_ids[2] AND pis.coverage_level = 'S'
INNER JOIN patient_insuarances pit ON pit.id = insurance_provider_ids[3] AND pit.coverage_level != 'T'
WHERE 1 = 1
AND o.id = ic.id
AND NOT o.is_quick_appt
AND o.order_type!='E'
AND o.insurance_provider_ids[2] = o.insurance_provider_ids[3]
AND array_length(o.insurance_provider_ids, 1) > 3
AND o.order_status NOT IN ('NOS', 'ABRT', 'ORD', 'CAN' );
-- -----------------------------------------------------------------------------------------------------------------------
-- Data fix for payer is facility or ordering physician
-- SNO-6 and SNO-7 Kyle reply - If primary insurance is available switch to this else switch to patient.
-- -----------------------------------------------------------------------------------------------------------------------
/*
UPDATE
    claims c
SET
    claim_info = claim_info || hstore (ARRAY [ 'payer',
        'payer_id',
        'payer_type','payer_name'],
        ARRAY [ CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
            'Insurance'
          ELSE
            'Patient'
          END,
          CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
              (SELECT insurance_provider_id FROM patient_insuarances WHERE id = o.insurance_provider_ids [ 1 ])::text
           ELSE
              (c.patient_id)::text
           END,
	   CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
                'PIP'
           ELSE
                'PPP'
           END ,
           CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
               (select insurance_name from insurance_providers where id = (SELECT insurance_provider_id FROM patient_insuarances WHERE id = o.insurance_provider_ids [1]))::text
           ELSE
               (SELECT Full_name from patients where id = c.patient_id )::text
           END])
    FROM
        orders o
    WHERE
        o.id = c.order_id
        AND coalesce(c.has_expired, FALSE)
        IS FALSE
        AND claim_info -> 'payer' IN ('Facility', 'Ordering Physician');
*/
-- -----------------------------------------------------------------------------------------------------------------------

RAISE NOTICE '--- 3 Data fix for duplicate claims.  ----';
-- Data fix for duplicate claims. Keep the claim with last updated date as live and make other as exprired
WITH Dup_claims as
(
    SELECT
	    order_id,
		max(submitted_dt)  as q_submitted_dt
	FROM claims c
    WHERE  1=1
    AND has_expired is null
    GROUP BY order_id
    HAVING count(order_id) >1
)
UPDATE public.claims c
    SET  has_expired = true
FROM Dup_claims
WHERE 1=1
AND c.order_id = Dup_claims.order_id
AND c.submitted_dt != q_submitted_dt;
-- -------------------------------------------------------------------------------------------------------------
-- Data fix for duplicate claims with same submission date/time  other than Electronic Billing 
WITH Dup_claims as
(
    SELECT
        order_id,
        max(submitted_dt) as q_submitted_dt,
        max(id) as q_claim_id
    FROM public.claims c
    WHERE  1=1
    AND has_expired is null 
    AND billing_method != 'EB'
    GROUP BY order_id
    HAVING count(order_id) >1
)
UPDATE public.claims c
    SET  has_expired = true
FROM Dup_claims 
WHERE 1=1
AND c.order_id = Dup_claims.order_id
AND c.submitted_dt = q_submitted_dt
AND c.id != q_claim_id;
-- -----------------------------------------------------------------------------------------------------------------------
WITH order_ids AS(
SELECT c.order_id as order_id
FROM claims c
INNER JOIN orders o on o.id = c.order_id
WHERE 1 = 1
AND coalesce(c.has_expired, FALSE) IS FALSE
AND order_info -> 'payer' IN ('Facility', 'Ordering Physician')
),
claim_update as(
UPDATE
    claims c
SET
    claim_info = claim_info || hstore (ARRAY [ 'payer',
        'payer_id',
        'payer_type','payer_name'],
        ARRAY [ CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
            'Insurance'
          ELSE
            'Patient'
          END,
          CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
              (SELECT insurance_provider_id FROM patient_insuarances WHERE id = o.insurance_provider_ids [ 1 ])::text
           ELSE
              (c.patient_id)::text
           END,
	   CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
                'PIP'
           ELSE
                'PPP'
           END ,
           CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
               (select insurance_name from insurance_providers where id = (SELECT insurance_provider_id FROM patient_insuarances WHERE id = o.insurance_provider_ids [1]))::text
           ELSE
               (SELECT Full_name from patients where id = c.patient_id )::text
           END])
    FROM
        orders o
        INNER JOIN order_ids os on o.id = os.order_id
    WHERE
        o.id = c.order_id
        AND coalesce(c.has_expired, FALSE) IS FALSE
)
UPDATE 
  orders o 
SET order_info = order_info|| hstore (ARRAY 
         ['payer','payer_id','payer_type','payer_name' ],
         ARRAY [CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
            'Insurance'
          ELSE
            'Patient'
          END,
          CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
              (SELECT insurance_provider_id FROM patient_insuarances WHERE id = o.insurance_provider_ids [ 1 ])::text
           ELSE
              (o.patient_id)::text
           END,
	   CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
                'PIP'
           ELSE
                'PPP'
           END ,
           CASE WHEN o.insurance_provider_ids [ 1 ] IS NOT NULL THEN
               (select insurance_name from insurance_providers where id = (SELECT insurance_provider_id FROM patient_insuarances WHERE id = o.insurance_provider_ids [1]))::text
           ELSE
               (SELECT Full_name from patients where id = o.patient_id )::text
           END])
FROM 
   order_ids os 
WHERE 1=1
AND o.id = os.order_id
AND NOT has_deleted;
-- -----------------------------------------------------------------------------------------------------------------------
RAISE NOTICE '--- 4 Data fix for Claim having responsible party but Responsible party details removed or deleted ----';
-- Data fix for Claim having responsible party but Responsible party details removed or deleted
-- SNO-14 -- Kyle Reply : Set these claims to patient responsibility
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE
    claims c
SET
    claim_info = claim_info || hstore (ARRAY [ 'payer',
        'payer_id',
        'payer_type','payer_name'],
	ARRAY ['Patient',(c.patient_id)::text,'PPP',(SELECT Full_name from patients where id = c.patient_id )::text])
FROM orders o
WHERE o.id = c.order_id
AND NOT coalesce(c.has_expired, FALSE)
AND NOT (CASE claim_info->'payer' WHEN 'Patient'    THEN true
          WHEN 'Insurance'    THEN o.insurance_provider_ids[1] IS NOT NULL
          WHEN 'Primary Insurance'    THEN o.insurance_provider_ids[1] IS NOT NULL
          WHEN 'Secondary Insurance'    THEN o.insurance_provider_ids[2] IS NOT NULL
          WHEN 'Teritary Insurance'    THEN o.insurance_provider_ids[3] IS NOT NULL
          WHEN 'Ordering Facility'    THEN nullif(nullif(o.order_info->'ordering_facility_id',''),'0')::BIGINT IS NOT NULL
          WHEN 'Provider'    THEN nullif(o.referring_provider_ids[1],0) IS NOT NULL
          ELSE false
          END);
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE
    orders o
SET
    order_info = order_info || hstore (ARRAY [ 'payer',
        'payer_id',
        'payer_type','payer_name'],
	ARRAY ['Patient',(o.patient_id)::text,'PPP',(SELECT Full_name from patients where id = o.patient_id )::text])
FROM claims c
WHERE o.id = c.order_id
AND NOT coalesce(c.has_expired, FALSE)
AND NOT coalesce(o.has_deleted, FALSE)
AND NOT (CASE order_info->'payer' WHEN 'Patient'    THEN true
          WHEN 'Insurance'    THEN o.insurance_provider_ids[1] IS NOT NULL
          WHEN 'Primary Insurance'    THEN o.insurance_provider_ids[1] IS NOT NULL
          WHEN 'Secondary Insurance'    THEN o.insurance_provider_ids[2] IS NOT NULL
          WHEN 'Teritary Insurance'    THEN o.insurance_provider_ids[3] IS NOT NULL
          WHEN 'Ordering Facility'    THEN nullif(nullif(o.order_info->'ordering_facility_id',''),'0')::BIGINT IS NOT NULL
          WHEN 'Provider'    THEN nullif(o.referring_provider_ids[1],0) IS NOT NULL
          ELSE false
          END);
-- -----------------------------------------------------------------------------------------------------------------------

RAISE NOTICE '--- 5    SNO-15 Payer is Empty OR Null data fix';
--SNO-15 Payer is Empty OR Null data fix 
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE
    claims
SET
    claim_info = claim_info || hstore (ARRAY [ 'payer' ],
        ARRAY [ CASE claim_info -> 'payer_type'
        WHEN 'PPP' THEN
            'Patient'
        WHEN 'PIP' THEN
            'Insurance'
        WHEN 'PF' THEN
            'Ordering Facility'
        WHEN 'PR' THEN
            'Provider'
        END ])
WHERE (claim_info -> 'payer' = ''
    OR claim_info -> 'payer' IS NULL)
AND coalesce(has_expired, FALSE) IS FALSE;
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE
    orders o
SET
    order_info = o.order_info || hstore (ARRAY [ 'payer' ],
        ARRAY [ CASE order_info -> 'payer_type'
        WHEN 'PPP' THEN
            'Patient'
        WHEN 'PIP' THEN
            'Insurance'
        WHEN 'PF' THEN
            'Ordering Facility'
        WHEN 'PR' THEN
            'Provider'
        END ])
FROM claims c
WHERE (o.order_info -> 'payer' = ''
    OR o.order_info -> 'payer' IS NULL)
AND o.id = c.order_id
AND coalesce(o.has_deleted, FALSE) IS FALSE;
--AND id IN (SELECT claim_id FROM eligible_records);
-- -----------------------------------------------------------------------------------------------------------------------
RAISE NOTICE '--- 6    SNO-5 Data fix for billing provider is null';
-- Data fix for billing provider is null
-- SNO-5 Kyle reply - Default the billing providers from facility . 
-- -----------------------------------------------------------------------------------------------------------------------
UPDATE
    orders o
SET
    order_info = o.order_info || hstore (ARRAY [ 'billing_provider' ],
        ARRAY [ facility_info -> 'billing_provider_id' ])
FROM
    orders ol
    INNER JOIN claims c ON c.order_id = ol.id
    INNER JOIN facilities f ON f.id = c.facility_id
WHERE
    ol.id = o.id
    AND (coalesce(nullif (ol.order_info -> 'billing_provider', ''), '0'))::bigint = 0::bigint
    AND (coalesce(nullif (o.order_info -> 'billing_provider', ''), '0'))::bigint = 0::bigint;
--AND c.id IN (SELECT claim_id FROM eligible_records);
-- -----------------------------------------------------------------------------------------------------------------------

RAISE NOTICE '---7            SNO-17 Data correct for adjustment and payment and deleted studies and study_cpts ';
-- Data correct for adjustment and payment and deleted studies and study_cpts   ------------ For SNO - 17
-- -----------------------------------------------------------------------------------------------------------------------
WITH deleted_studies AS (
    SELECT
        s.id AS study_id
    FROM
        studies s
    WHERE 1 = 1
        AND s.has_deleted
), deleted_study_cpts AS (
    SELECT
        id AS study_cpt_id
    FROM
        study_cpt sc
        INNER JOIN deleted_studies ON deleted_studies.study_id = sc.study_id
    WHERE 1 = 1
        AND NOT sc.has_deleted)
UPDATE
    study_cpt sct
SET
    has_deleted = TRUE
FROM
    deleted_study_cpts dsc
WHERE 1 = 1
    AND dsc.study_cpt_id = sct.id;
-- ----------------------------------------------------------------------------------
WITH deleted_study_cpts AS (
    SELECT
        id AS study_cpt_id
    FROM
        study_cpt
    WHERE
        has_deleted
), pr_exception_data AS (
    SELECT
        id AS pr_id
    FROM
        payment_reconciliations pr
        INNER JOIN deleted_study_cpts dsc ON pr.study_cpt_id = dsc.study_cpt_id
    WHERE
        NOT pr.has_deleted)
UPDATE
    payment_reconciliations prt
SET
    has_deleted = TRUE
FROM
    pr_exception_data ped
WHERE
    prt.id = ped.pr_id;
-- ----------------------------------------------------------------------------------
WITH sum_amount AS (
    SELECT
        order_payment_id,
        SUM(pr.payment_amount) AS applied_payment_amount,
        SUM(pr.adjustment) AS adjustment_amount
    FROM
        payment_reconciliations pr
        INNER JOIN study_cpt ON pr.study_cpt_id = study_cpt.id
        INNER JOIN order_payments op ON op.id = pr.order_payment_id
    WHERE
        NOT pr.has_deleted
        AND NOT study_cpt.has_deleted
    GROUP BY
        order_payment_id
),
filter_order AS (
    SELECT
        sum_amount.applied_payment_amount, (amount_paid - sum_amount.applied_payment_amount) AS payment_unapplied,
        amount_paid,
        order_id,
        id AS order_payment_id
    FROM
        order_payments
        INNER JOIN sum_amount ON sum_amount.order_payment_id = order_payments.id
    WHERE
        NOT order_payments.has_deleted
        AND (more_info -> 'payment_applied')::money != sum_amount.applied_payment_amount)
UPDATE
    order_payments
SET
    more_info = order_payments.more_info || hstore (ARRAY [ 'payment_applied',
        'payment_unapplied' ],
        ARRAY [ fo.applied_payment_amount::text,
        fo.payment_unapplied::text ])
FROM
    order_payments op
    INNER JOIN filter_order fo ON fo.order_payment_id = op.id
WHERE
    order_payments.id = op.id;
-- -----------------------------------------------------------------------------------------------------------------------
WITH sum_amount AS (
    SELECT
        DISTINCT order_payment_id,
        SUM(pr.payment_amount) AS payment_amount,
        SUM(pr.adjustment) AS adjustment_amount
    FROM
        payment_reconciliations pr
        INNER JOIN study_cpt ON pr.study_cpt_id = study_cpt.id
        INNER JOIN order_payments op ON op.id = pr.order_payment_id
    WHERE
        NOT pr.has_deleted
        AND NOT study_cpt.has_deleted
        AND pr.adjustment > 0::money
    GROUP BY
        order_payment_id
),
filter_order AS (
    SELECT
        order_id,
        id AS order_payment_id,
        sum_amount.adjustment_amount, (more_info -> 'adjustment_amount')::money AS ord_adjustment_amount, ((more_info -> 'adjustment_amount')::money - sum_amount.adjustment_amount) AS adj_unapplied, (more_info -> 'adjustment_applied')::money, (more_info -> 'adjustment_unapplied')::money
    FROM
        order_payments
        INNER JOIN sum_amount ON sum_amount.order_payment_id = order_payments.id
    WHERE
        NOT order_payments.has_deleted
        AND (more_info -> 'adjustment_amount')::money > 0::money
        AND (more_info -> 'adjustment_applied')::money != sum_amount.adjustment_amount)
UPDATE
    order_payments
SET
    more_info = order_payments.more_info || hstore (ARRAY [ 'adjustment_applied',
        'adjustment_unapplied' ],
        ARRAY [ fo.adjustment_amount::text,
        fo.adj_unapplied::text ])
FROM
    order_payments op
    INNER JOIN filter_order fo ON fo.order_payment_id = op.id
WHERE
    order_payments.id = op.id;
-- --------------------------------------------------------------------------------------------------------------------

RAISE NOTICE '---8     Data correction for paymeny status';
-- Data correction for paymeny status
-- --------------------------------------------------------------------------------------------------------------------	
-- -----------------------------------------------------------------------------------------------------------------------
WITH total_applied_amount AS (
SELECT 
    payment_id,
    sum(amount_paid) as applied_amount
FROM order_payments
WHERE NOT coalesce(has_deleted,false)
group by payment_id
)
UPDATE payments p 
SET
  applied = tam.applied_amount,
  available_balance = (p.amount - tam.applied_amount),
  current_status = CASE WHEN (p.amount = tam.applied_amount) THEN 'Applied'
			WHEN (tam.applied_amount = 0::money) THEN 'UnApplied'
			WHEN (p.amount > tam.applied_amount) THEN 'PartialApplied'
			WHEN (p.amount < tam.applied_amount) THEN 'OverApplied'
	           END
FROM total_applied_amount tam
WHERE 
     p.id = tam.payment_id
     AND coalesce(p.has_deleted,FALSE) is false
AND p.current_status != 'Refund';
-- --------------------------------------------------------------------------------------------------------------------
RAISE NOTICE '--- END OF THE SCRIPT ---';
-- --------------------------------------------------------------------------------------------------------------------
END
$$;
