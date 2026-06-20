-- Run once in bizchatdb after database/schema.sql.
-- Connect as bizchat_app. This script generates and returns a temporary
-- application password; record it from the first result grid.

BEGIN;

WITH credentials AS (
  SELECT encode(gen_random_bytes(12), 'hex') || 'Aa1!' AS temporary_password
), new_company AS (
  INSERT INTO companies (name, slug, country, timezone)
  VALUES ('iCON Systems', 'icon', 'India', 'Asia/Kolkata')
  RETURNING id, name, slug, country, timezone
), new_admin AS (
  INSERT INTO users (
    company_id,
    first_name,
    last_name,
    mobile_number,
    timezone,
    email,
    password_hash,
    role
  )
  SELECT
    company.id,
    'Manoj',
    'Chendran',
    '+966536547919',
    'Asia/Kolkata',
    'manojchendran@gmail.com',
    crypt(credentials.temporary_password, gen_salt('bf', 12)),
    'company_admin'
  FROM new_company company
  CROSS JOIN credentials
  RETURNING id, company_id, first_name, last_name, mobile_number, email, role
), new_department AS (
  INSERT INTO departments (company_id, name, created_by)
  SELECT admin.company_id, 'Management', admin.id
  FROM new_admin admin
  RETURNING id, company_id, name
), membership AS (
  INSERT INTO user_departments (user_id, department_id)
  SELECT admin.id, department.id
  FROM new_admin admin
  JOIN new_department department ON department.company_id = admin.company_id
  RETURNING user_id, department_id
)
SELECT
  company.name AS company,
  company.slug,
  admin.first_name || ' ' || admin.last_name AS admin_name,
  admin.mobile_number,
  admin.email,
  admin.role,
  department.name AS department,
  credentials.temporary_password
FROM credentials
CROSS JOIN new_company company
JOIN new_admin admin ON admin.company_id = company.id
JOIN new_department department ON department.company_id = company.id
JOIN membership ON membership.user_id = admin.id AND membership.department_id = department.id;

UPDATE companies company
SET created_by = app_user.id
FROM users app_user
WHERE company.slug = 'icon'
  AND app_user.company_id = company.id
  AND app_user.mobile_number = '+966536547919';

COMMIT;

SELECT
  company.name AS company,
  company.slug,
  company.country,
  company.timezone AS company_timezone,
  app_user.first_name || ' ' || app_user.last_name AS admin_name,
  app_user.mobile_number,
  app_user.email,
  app_user.role,
  department.name AS department
FROM companies company
JOIN users app_user ON app_user.company_id = company.id
JOIN user_departments membership ON membership.user_id = app_user.id
JOIN departments department ON department.id = membership.department_id
WHERE company.slug = 'icon';
