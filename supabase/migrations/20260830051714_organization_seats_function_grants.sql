-- Supabase pode conceder EXECUTE explicitamente a anon/authenticated por
-- privilegios padrao. Revogamos cada papel, alem de PUBLIC.

revoke all on function public.add_organization_member_with_seat(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.reserve_organization_invitation(uuid, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.add_organization_member_with_seat(uuid, uuid, text)
  to service_role;
grant execute on function public.reserve_organization_invitation(uuid, text, text, uuid)
  to service_role;

revoke all on function public.accept_my_organization_invitations()
  from public, anon;
grant execute on function public.accept_my_organization_invitations()
  to authenticated, service_role;
