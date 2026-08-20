-- Owner CRUD: deletion, always cascading, always audited.
-- A deleted run must take its metrics with it — a number whose origin
-- document is gone violates house rule 1 by construction.

alter table public.metrics drop constraint metrics_run_id_fkey;
alter table public.metrics
  add constraint metrics_run_id_fkey
  foreign key (run_id) references public.job_runs(id) on delete cascade;

create function public.delete_run(p_run uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r job_runs%rowtype; v_wf text;
begin
  select * into r from job_runs where id = p_run;
  if r.id is null then raise exception 'no such run'; end if;
  if public.org_role(r.org_id) is distinct from 'owner' then
    raise exception 'only the owner can delete a run';
  end if;
  select workflow_id into v_wf from jobs where id = r.job_id;
  delete from job_runs where id = p_run;
  -- a job with no runs left is an empty shell
  delete from jobs j where j.id = r.job_id
    and not exists (select 1 from job_runs where job_id = j.id);
  insert into audit_log (org_id, actor, actor_name, action, subject)
  values (r.org_id, auth.uid(),
          coalesce(auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email'),
          'delete_run',
          jsonb_build_object('run', p_run, 'workflow', v_wf, 'run_key', r.run_key));
end;
$$;

create function public.delete_client(p_client uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c clients%rowtype;
begin
  select * into c from clients where id = p_client;
  if c.id is null then raise exception 'no such client'; end if;
  if public.org_role(c.org_id) is distinct from 'owner' then
    raise exception 'only the owner can delete an account';
  end if;
  delete from clients where id = p_client;
  insert into audit_log (org_id, actor, actor_name, action, subject)
  values (c.org_id, auth.uid(),
          coalesce(auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email'),
          'delete_client', jsonb_build_object('client', c.slug, 'name', c.name));
end;
$$;

revoke all on function public.delete_run(uuid), public.delete_client(uuid) from public;
grant execute on function public.delete_run(uuid), public.delete_client(uuid) to authenticated;
