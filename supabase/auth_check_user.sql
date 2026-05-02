-- Status zu einem Login (im SQL-Editor ausführen).
-- E-Mail unten anpassen, dann ausführen.

select
  id,
  email,
  email_confirmed_at,
  banned_until,
  created_at
from auth.users
where lower(email) = lower('deine-adresse@beispiel.de');
