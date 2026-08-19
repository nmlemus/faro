-- members_read referenced org_members inside its own policy -> infinite
-- recursion -> the app's membership lookup failed silently and every user
-- looked like a client_viewer. Non-recursive: you see your own rows; staff
-- see the org's rows via the SECURITY DEFINER helper.
drop policy members_read on org_members;
create policy members_read on org_members for select using (
  user_id = auth.uid() or public.is_staff(org_id));
