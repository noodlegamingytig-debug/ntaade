-- Restrict signups to Ashesi University email addresses at the database
-- level (not just in the UI), so this can't be bypassed by calling the
-- Supabase Auth API directly.

create or replace function public.enforce_ashesi_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or new.email !~* '@ashesi\.edu\.gh$' then
    raise exception 'Only @ashesi.edu.gh email addresses may sign up.'
      using errcode = '42501'; -- insufficient_privilege
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_ashesi_email_trigger on auth.users;

create trigger enforce_ashesi_email_trigger
  before insert on auth.users
  for each row
  execute function public.enforce_ashesi_email();
