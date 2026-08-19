-- The UI writes INTENT; the engine materializes phases from the git method.
-- request_run creates the job+run; a worker expands runs that have no phases.

create function public.request_run(p_client uuid, p_workflow text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  cl clients%rowtype;
  v_job uuid;
  v_run uuid;
  v_key text := 'main';
begin
  select * into cl from clients where id = p_client;
  if cl.id is null then raise exception 'no such client'; end if;
  if not public.is_staff(cl.org_id) then
    raise exception 'only staff can start work';
  end if;
  -- the one preflight the DB can do itself; the rest happens at expansion
  if p_workflow = 'website-audit' and coalesce(trim(cl.website), '') = '' then
    raise exception 'this client has no website — the website audit comes entirely from it';
  end if;

  insert into jobs (org_id, client_id, workflow_id)
  values (cl.org_id, cl.id, p_workflow)
  on conflict (client_id, workflow_id) do update set workflow_id = excluded.workflow_id
  returning id into v_job;

  if exists (select 1 from job_runs where job_id = v_job and status = 'active') then
    raise exception 'this job already has an active run';
  end if;
  if exists (select 1 from job_runs where job_id = v_job and run_key = 'main') then
    v_key := to_char(now(), 'YYYYMMDD-HH24MISS');
  end if;

  insert into job_runs (job_id, org_id, client_id, run_key)
  values (v_job, cl.org_id, cl.id, v_key)
  returning id into v_run;

  insert into audit_log (org_id, actor, actor_name, action, subject)
  values (cl.org_id, auth.uid(),
          coalesce(auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email'),
          'request_run', jsonb_build_object('client', cl.slug, 'workflow', p_workflow));
  return v_run;
end;
$$;
grant execute on function public.request_run(uuid, text) to authenticated, service_role;

-- job_runs can be abandoned by the engine when expansion preflight fails
grant execute on function public.request_run to service_role;
