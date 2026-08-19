-- Revoking PUBLIC on the engine RPCs also removed service_role's implicit
-- access. The engine runs with the service key: grant it back explicitly.
grant execute on function public.claim_phase(text) to service_role;
grant execute on function public.finish_phase(uuid, boolean, text, text) to service_role;
grant execute on function public.apply_gate_decision(uuid, text, text, uuid, text) to service_role;
grant execute on function public.decide_gate(uuid, text, text) to service_role;
