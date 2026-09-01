-- Keep privileged ledger access out of the exposed public schema.
alter function public.tibaldo_app_sync_housekeeping_row(text,text,jsonb) set schema private;
alter function private.tibaldo_app_sync_housekeeping_row(text,text,jsonb) security definer;
alter function private.tibaldo_app_sync_housekeeping_row(text,text,jsonb) set search_path='';

create function public.tibaldo_app_sync_housekeeping_row(
  source_identity text, payload_hash text, canonical_row jsonb
) returns jsonb language sql volatile security invoker set search_path='' as $$
  select private.tibaldo_app_sync_housekeeping_row($1,$2,$3)
$$;

revoke all on function private.tibaldo_app_sync_housekeeping_row(text,text,jsonb) from public,anon;
revoke all on function public.tibaldo_app_sync_housekeeping_row(text,text,jsonb) from public,anon;
grant execute on function private.tibaldo_app_sync_housekeeping_row(text,text,jsonb) to authenticated;
grant execute on function public.tibaldo_app_sync_housekeeping_row(text,text,jsonb) to authenticated;
