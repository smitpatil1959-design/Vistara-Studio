-- Match the evidence categories emitted by the current extraction pipeline.
-- This only expands allowed values and preserves all existing evidence.
alter table public.evidence drop constraint if exists evidence_claim_type_check;
alter table public.evidence add constraint evidence_claim_type_check check (claim_type in (
  'company_description','product','service','feature','pricing','audience','industry','market','metric','customer',
  'location','integration','technology','security','business_model','founder','leadership','partnership','news',
  'competitor','differentiator','observation','other'
));
