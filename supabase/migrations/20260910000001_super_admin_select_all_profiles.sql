create policy "profiles: select superadmin"
on public.profiles for select
using (public.is_jards_super_admin());
