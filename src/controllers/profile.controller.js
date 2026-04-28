const profileService = require('../services/profile.service');
const { parseQuery }  = require('../services/nlp.service');

function toCsv(rows) {
  const header = 'id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at';
  const lines  = rows.map(r =>
    [r.id, r.name, r.gender, r.gender_probability, r.age, r.age_group, r.country_id, r.country_name, r.country_probability, r.created_at].join(',')
  );
  return [header, ...lines].join('\n');
}

async function getAll(req, res, next) {
  try {
    const result = await profileService.getAllProfiles(req.query, '/api/profiles');
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
}

async function search(req, res, next) {
  try {
    const { q, page, limit } = req.query;
    if (!q || !q.trim()) return res.status(400).json({ status: 'error', message: 'Missing or empty query parameter: q' });
    const filters = parseQuery(q);
    if (!filters) return res.status(400).json({ status: 'error', message: 'Unable to interpret query' });
    const result = await profileService.searchProfiles(filters, { page, limit }, '/api/profiles/search');
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
}

async function exportCsv(req, res, next) {
  try {
    const rows = await profileService.exportProfiles(req.query);
    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="profiles_${ts}.csv"`);
    res.send(toCsv(rows));
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const profile = await profileService.getProfileById(req.params.id);
    if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found' });
    res.json({ status: 'success', data: profile });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ status: 'error', message: 'Name is required' });
    const result = await profileService.createProfile(name.trim());
    if (result.alreadyExists) return res.status(200).json({ status: 'success', message: 'Profile already exists', data: result.data });
    res.status(201).json({ status: 'success', data: result.data });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const deleted = await profileService.deleteProfile(req.params.id);
    if (!deleted) return res.status(404).json({ status: 'error', message: 'Profile not found' });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { getAll, search, exportCsv, getOne, create, remove };