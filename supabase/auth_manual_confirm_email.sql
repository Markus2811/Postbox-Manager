-- E-Mail als bestätigt markieren (wenn keine Bestätigungs-Mail ankommt / Login blockiert).
-- Adresse unten anpassen. Im SQL-Editor ausführen.
-- Alternative: Dashboard → Authentication → Users → Nutzer → Confirm.

update auth.users
set
  email_confirmed_at = now()
where lower(email) = lower('deine-adresse@beispiel.de')
  and email_confirmed_at is null;
