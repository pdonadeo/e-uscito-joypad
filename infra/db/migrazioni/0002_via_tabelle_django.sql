-- MIGRAZIONE 0002: via le tabelle di Django
--
-- Senza CASCADE: se qualcosa di inatteso dipende da queste tabelle (una vista, una FK),
-- la migrazione fallisce e va in rollback, e il DB resta com'era.
-- Le FK di django_admin_log, auth_user_groups e auth_user_user_permissions verso
-- auth_user spariscono con le loro tabelle.

DROP TABLE IF EXISTS backoffice_discordmessage, django_admin_log, django_content_type, django_migrations, django_session, auth_group_permissions, auth_user_groups, auth_user_user_permissions, auth_group, auth_permission;
