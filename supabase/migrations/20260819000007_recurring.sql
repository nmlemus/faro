-- Scheduling is a staff decision, recorded like every other one.
create function public.schedule_job(p_client uuid, p_workflow text, p_cadence text)
returns void language plpgsql security definer set search_path = public as $$
declare cl clients%rowtype;
begin
  select * into cl from clients where id = p_client;
  if cl.id is null then raise exception 'no such client'; end if;
  if not public.is_staff(cl.org_id) then raise exception 'only staff can schedule work'; end if;
  if p_cadence is not null and p_cadence not in ('weekly','monthly') then
    raise exception 'cadence must be weekly, monthly, or null to stop';
  end if;
  insert into jobs (org_id, client_id, workflow_id, recurring)
  values (cl.org_id, cl.id, p_workflow, p_cadence)
  on conflict (client_id, workflow_id) do update set recurring = excluded.recurring;
  insert into audit_log (org_id, actor, actor_name, action, subject)
  values (cl.org_id, auth.uid(),
          coalesce(auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email'),
          'schedule_job',
          jsonb_build_object('client', cl.slug, 'workflow', p_workflow, 'cadence', p_cadence));
end;
$$;
grant execute on function public.schedule_job(uuid, text, text) to authenticated, service_role;
