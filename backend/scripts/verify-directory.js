import jwt from 'jsonwebtoken';
import { pool, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';

try {
  const result = await pool.query(
    `SELECT u.id, u.company_id, u.role
     FROM users u
     JOIN companies c ON c.id = u.company_id
     WHERE c.slug = $1 AND u.first_name = $2 AND u.status = 'active'
     ORDER BY u.created_at DESC
     LIMIT 1`,
    ['icon', 'Mrudul']
  );
  const user = result.rows[0];
  if (!user) throw new Error('Active Mrudul account was not found');

  const token = jwt.sign(
    { sub: user.id, companyId: user.company_id, role: user.role },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '2m' }
  );
  const response = await fetch('http://127.0.0.1:5001/api/users/directory', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  console.log(JSON.stringify({
    status: response.status,
    requesterRole: user.role,
    people: data.users?.map((person) => ({
      name: [person.first_name, person.last_name].filter(Boolean).join(' '),
      departments: person.department_names,
    })),
    error: data.error,
  }, null, 2));
} finally {
  await closeDatabase();
}
