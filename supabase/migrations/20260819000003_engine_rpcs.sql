-- Engine RPCs: the workers talk PostgREST + these functions, so the engine
-- needs zero Postgres drivers — plain HTTP with the service key.

-- Atomic claim: the queue is Postgres itself.
create function public.claim_phase(p_worker text) returns setof phases
language plpgsql security definer set search_path = public as $$
begin
  return query
  update phases set status = 'running', claimed_by = p_worker,
                    claimed_at = now(), started_at = coalesce(started_at, now())
  where id = (
    select id from phases
    where status = 'pending'
    order by created_at
    for update skip locked
    limit 1)
  returning *;
end;
$$;

-- Finishing a phase: writes the artifact, flips status, unblocks dependents,
-- and completes the run when everything is done — one transaction.
create function public.finish_phase(
  p_phase uuid, p_ok boolean, p_content text, p_error text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  ph phases%rowtype;
begin
  select * into ph from phases where id = p_phase for update;
  if ph.id is null then raise exception 'no such phase'; end if;

  if not p_ok then
    update phases set status = 'failed', error = p_error, finished_at = now()
    where id = p_phase;
    return;
  end if;

  insert into artifacts (run_id, phase_id, org_id, client_id, path, content)
  values (ph.run_id, ph.id, ph.org_id, ph.client_id, ph.produces, p_content)
  on conflict (run_id, path) do update
    set content = excluded.content, phase_id = excluded.phase_id;

  update phases
  set status = case when ph.gate_class is not null then 'awaiting_gate' else 'done' end,
      finished_at = now(), error = null
  where id = p_phase;

  -- unblock the next phase(s) only when no gate is holding
  if ph.gate_class is null then
    update phases set status = 'pending'
    where run_id = ph.run_id and status = 'blocked'
      and seq = (select min(seq) from phases
                 where run_id = ph.run_id and status = 'blocked');
  end if;

  update job_runs set status = 'complete'
  where id = ph.run_id
    and not exists (select 1 from phases
                    where run_id = ph.run_id and status <> 'done');
end;
$$;

-- A gate decision moves the machine: approve -> done + unblock next;
-- reject -> phase back to pending with the feedback folded in.
create function public.apply_gate_decision(
  p_phase uuid, p_decision text, p_feedback text,
  p_user uuid default null, p_name text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  ph phases%rowtype;
begin
  select * into ph from phases where id = p_phase for update;
  if ph.id is null or ph.status <> 'awaiting_gate' then
    raise exception 'phase is not awaiting a gate';
  end if;
  if p_decision = 'rejected' and coalesce(trim(p_feedback),'') = '' then
    raise exception 'feedback is required to reject';
  end if;

  insert into gate_decisions (phase_id, org_id, client_id, gate_class,
                              decision, decided_by, decided_name, feedback)
  values (ph.id, ph.org_id, ph.client_id, ph.gate_class,
          p_decision, p_user, p_name, nullif(trim(p_feedback), ''));

  if p_decision = 'approved' then
    update phases set status = 'done' where id = p_phase;
    update phases set status = 'pending'
    where run_id = ph.run_id and status = 'blocked'
      and seq = (select min(seq) from phases
                 where run_id = ph.run_id and status = 'blocked');
    update job_runs set status = 'complete'
    where id = ph.run_id
      and not exists (select 1 from phases
                      where run_id = ph.run_id and status <> 'done');
  else
    update phases set status = 'pending', feedback = p_feedback, error = null
    where id = p_phase;
  end if;
end;
$$;

-- The portal calls this one as the logged-in user; RLS-equivalent check inside.
create function public.decide_gate(p_phase uuid, p_decision text, p_feedback text)
returns void language plpgsql security definer set search_path = public as $$
declare ph phases%rowtype;
begin
  select * into ph from phases where id = p_phase;
  if ph.id is null then raise exception 'no such phase'; end if;
  if not public.can_decide_gate(ph.client_id, ph.gate_class) then
    raise exception 'your role cannot decide a % gate', coalesce(ph.gate_class,'craft');
  end if;
  perform public.apply_gate_decision(
    p_phase, p_decision, p_feedback, auth.uid(),
    coalesce((auth.jwt() -> 'user_metadata' ->> 'name'), auth.jwt() ->> 'email'));
end;
$$;
grant execute on function public.decide_gate to authenticated;
revoke execute on function public.claim_phase, public.finish_phase,
                          public.apply_gate_decision from public, anon, authenticated;
