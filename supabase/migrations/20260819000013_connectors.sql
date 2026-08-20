-- Connectors, n8n-style: the owner configures a tool's credentials in the web,
-- the secret lands in Vault, the client's tools flag flips true, and the engine
-- exports the env vars into the phase session. Secret values never touch
-- audit_log, activity_events or any readable table.

-- one secret per (client, tool): a JSON object {ENV_VAR: value}
create function public.set_connector(p_client uuid, p_tool text, p_secrets jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare c clients%rowtype; v_secret_id uuid;
begin
  select * into c from clients where id = p_client;
  if c.id is null then raise exception 'no such client'; end if;
  if public.org_role(c.org_id) is distinct from 'owner' then
    raise exception 'only the owner can configure connectors';
  end if;
  if p_secrets is null or p_secrets = '{}'::jsonb then
    raise exception 'no credentials given';
  end if;

  select secret_id into v_secret_id from credentials
   where client_id = p_client and tool = p_tool;
  if v_secret_id is null then
    v_secret_id := vault.create_secret(p_secrets::text, null, c.slug || '/' || p_tool);
    insert into credentials (org_id, client_id, tool, secret_id)
    values (c.org_id, p_client, p_tool, v_secret_id);
  else
    perform vault.update_secret(v_secret_id, p_secrets::text);
  end if;

  update clients set tools = coalesce(tools, '{}'::jsonb) || jsonb_build_object(p_tool, true)
   where id = p_client;
  insert into audit_log (org_id, actor, actor_name, action, subject)
  values (c.org_id, auth.uid(),
          coalesce(auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email'),
          'set_connector', jsonb_build_object('client', c.slug, 'tool', p_tool));
end;
$$;

create function public.unset_connector(p_client uuid, p_tool text)
returns void language plpgsql security definer set search_path = public as $$
declare c clients%rowtype; v_secret_id uuid;
begin
  select * into c from clients where id = p_client;
  if c.id is null then raise exception 'no such client'; end if;
  if public.org_role(c.org_id) is distinct from 'owner' then
    raise exception 'only the owner can configure connectors';
  end if;
  delete from credentials where client_id = p_client and tool = p_tool
    returning secret_id into v_secret_id;
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
  update clients set tools = coalesce(tools, '{}'::jsonb) || jsonb_build_object(p_tool, false)
   where id = p_client;
  insert into audit_log (org_id, actor, actor_name, action, subject)
  values (c.org_id, auth.uid(),
          coalesce(auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email'),
          'unset_connector', jsonb_build_object('client', c.slug, 'tool', p_tool));
end;
$$;

-- the engine's read: every connected tool's env vars, merged. service_role only.
create function public.engine_credentials(p_client uuid)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(kv.key, kv.value), '{}'::jsonb)
  from credentials cr
  join vault.decrypted_secrets s on s.id = cr.secret_id,
  lateral jsonb_each_text(s.decrypted_secret::jsonb) kv
  where cr.client_id = p_client;
$$;

revoke all on function public.set_connector(uuid, text, jsonb),
              public.unset_connector(uuid, text),
              public.engine_credentials(uuid) from public;
grant execute on function public.set_connector(uuid, text, jsonb),
                          public.unset_connector(uuid, text) to authenticated;
grant execute on function public.engine_credentials(uuid) to service_role;
