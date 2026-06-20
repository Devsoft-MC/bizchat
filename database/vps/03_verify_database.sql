SELECT current_database() AS database_name, current_user AS connected_user;

SELECT count(*) AS public_table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT name, slug, country, timezone, status
FROM companies
ORDER BY name;

SELECT
  company.slug,
  app_user.first_name,
  app_user.last_name,
  app_user.mobile_number,
  app_user.timezone,
  app_user.email,
  app_user.role,
  app_user.status
FROM users app_user
JOIN companies company ON company.id = app_user.company_id
ORDER BY company.slug, app_user.first_name, app_user.last_name;

