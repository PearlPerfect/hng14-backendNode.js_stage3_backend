const pool = require('../config/db');
const uuidv7 = require('../utils/uuidv7');
const { getAgeGroup, getTopCountry } = require('../utils/classify');
const { fetchGenderize, fetchAgify, fetchNationalize } = require('./external.service');

const VALID_SORT  = ['age', 'created_at', 'gender_probability'];
const VALID_ORDER = ['asc', 'desc'];

function buildWhere(filters, start = 1) {
  const conds = [], params = [];
  let i = start;
  if (filters.gender)      { conds.push(`LOWER(gender) = LOWER($${i++})`);      params.push(filters.gender); }
  if (filters.age_group)   { conds.push(`LOWER(age_group) = LOWER($${i++})`);   params.push(filters.age_group); }
  if (filters.country_id)  { conds.push(`LOWER(country_id) = LOWER($${i++})`);  params.push(filters.country_id); }
  if (filters.min_age !== undefined)                { conds.push(`age >= $${i++}`);                    params.push(Number(filters.min_age)); }
  if (filters.max_age !== undefined)                { conds.push(`age <= $${i++}`);                    params.push(Number(filters.max_age)); }
  if (filters.min_gender_probability !== undefined) { conds.push(`gender_probability >= $${i++}`);     params.push(Number(filters.min_gender_probability)); }
  if (filters.min_country_probability !== undefined){ conds.push(`country_probability >= $${i++}`);    params.push(Number(filters.min_country_probability)); }
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

function buildLinks(baseUrl, page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  const qs = (p) => `${baseUrl}?page=${p}&limit=${limit}`;
  return {
    self: qs(page),
    next: page < totalPages ? qs(page + 1) : null,
    prev: page > 1 ? qs(page - 1) : null,
  };
}

async function getAllProfiles(query, baseUrl = '/api/profiles') {
  const { gender, age_group, country_id, min_age, max_age, min_gender_probability, min_country_probability, sort_by = 'created_at', order = 'asc', page = 1, limit = 10 } = query;

  const sortField = VALID_SORT.includes(sort_by) ? sort_by : 'created_at';
  const sortOrder = VALID_ORDER.includes(order?.toLowerCase()) ? order.toUpperCase() : 'ASC';
  const pageNum   = Math.max(1, parseInt(page) || 1);
  const limitNum  = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset    = (pageNum - 1) * limitNum;

  const { where, params } = buildWhere({ gender, age_group, country_id, min_age, max_age, min_gender_probability, min_country_probability });

  const countRes = await pool.query(`SELECT COUNT(*) FROM profiles ${where}`, params);
  const total    = parseInt(countRes.rows[0].count);

  const dataRes = await pool.query(
    `SELECT * FROM profiles ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limitNum, offset]
  );

  return {
    total,
    total_pages: Math.ceil(total / limitNum),
    page: pageNum,
    limit: limitNum,
    links: buildLinks(baseUrl, pageNum, limitNum, total),
    data: dataRes.rows,
  };
}

async function searchProfiles(filters, query, baseUrl = '/api/profiles/search') {
  const pageNum  = Math.max(1, parseInt(query.page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(query.limit) || 10));
  const offset   = (pageNum - 1) * limitNum;

  const { where, params } = buildWhere(filters);

  const countRes = await pool.query(`SELECT COUNT(*) FROM profiles ${where}`, params);
  const total    = parseInt(countRes.rows[0].count);

  const dataRes  = await pool.query(
    `SELECT * FROM profiles ${where} ORDER BY created_at ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limitNum, offset]
  );

  return {
    total,
    total_pages: Math.ceil(total / limitNum),
    page: pageNum,
    limit: limitNum,
    links: buildLinks(baseUrl, pageNum, limitNum, total),
    data: dataRes.rows,
  };
}

async function exportProfiles(query) {
  const { gender, age_group, country_id, min_age, max_age, min_gender_probability, min_country_probability, sort_by = 'created_at', order = 'asc' } = query;
  const sortField = VALID_SORT.includes(sort_by) ? sort_by : 'created_at';
  const sortOrder = VALID_ORDER.includes(order?.toLowerCase()) ? order.toUpperCase() : 'ASC';
  const { where, params } = buildWhere({ gender, age_group, country_id, min_age, max_age, min_gender_probability, min_country_probability });
  const result = await pool.query(`SELECT * FROM profiles ${where} ORDER BY ${sortField} ${sortOrder}`, params);
  return result.rows;
}

async function getProfileById(id) {
  const r = await pool.query('SELECT * FROM profiles WHERE id=$1', [id]);
  return r.rows[0] || null;
}

async function createProfile(name) {
  const existing = await pool.query('SELECT * FROM profiles WHERE LOWER(name)=LOWER($1)', [name]);
  if (existing.rows.length > 0) return { alreadyExists: true, data: existing.rows[0] };

  const [genderData, agifyData, nationalizeData] = await Promise.all([
    fetchGenderize(name), fetchAgify(name), fetchNationalize(name),
  ]);

  const topCountry = getTopCountry(nationalizeData.countries);
  const profile = {
    id: uuidv7(), name: name.toLowerCase(),
    gender: genderData.gender, gender_probability: genderData.gender_probability,
    sample_size: genderData.sample_size, age: agifyData.age,
    age_group: getAgeGroup(agifyData.age),
    country_id: topCountry.country_id, country_name: topCountry.country_name || '',
    country_probability: topCountry.probability, created_at: new Date().toISOString(),
  };

  await pool.query(
    `INSERT INTO profiles (id,name,gender,gender_probability,sample_size,age,age_group,country_id,country_name,country_probability,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [profile.id, profile.name, profile.gender, profile.gender_probability, profile.sample_size, profile.age, profile.age_group, profile.country_id, profile.country_name, profile.country_probability, profile.created_at]
  );
  return { alreadyExists: false, data: profile };
}

async function deleteProfile(id) {
  const r = await pool.query('DELETE FROM profiles WHERE id=$1', [id]);
  return r.rowCount > 0;
}

module.exports = { getAllProfiles, searchProfiles, exportProfiles, getProfileById, createProfile, deleteProfile };