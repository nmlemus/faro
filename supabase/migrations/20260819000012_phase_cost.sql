-- Every phase records what it cost: money and tokens, straight from the
-- claude session's final result event. Rolls up per run/client in queries.
alter table public.phases
  add column cost_usd   numeric,
  add column tokens_in  bigint,
  add column tokens_out bigint;
