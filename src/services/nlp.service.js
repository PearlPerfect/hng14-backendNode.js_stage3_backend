// Country name → ISO code map (covers common names in queries)
const COUNTRY_MAP = {
  'nigeria': 'NG', 'niger': 'NE', 'ghana': 'GH', 'kenya': 'KE',
  'angola': 'AO', 'ethiopia': 'ET', 'tanzania': 'TZ', 'uganda': 'UG',
  'cameroon': 'CM', 'senegal': 'SN', 'mali': 'ML', 'zambia': 'ZM',
  'zimbabwe': 'ZW', 'mozambique': 'MZ', 'madagascar': 'MG',
  'ivory coast': 'CI', 'côte d\'ivoire': 'CI', 'benin': 'BJ',
  'togo': 'TG', 'rwanda': 'RW', 'somalia': 'SO', 'sudan': 'SD',
  'south africa': 'ZA', 'egypt': 'EG', 'morocco': 'MA', 'algeria': 'DZ',
  'tunisia': 'TN', 'libya': 'LY', 'usa': 'US', 'united states': 'US',
  'uk': 'GB', 'united kingdom': 'GB', 'france': 'FR', 'germany': 'DE',
  'canada': 'CA', 'brazil': 'BR', 'india': 'IN', 'china': 'CN',
  'japan': 'JP', 'australia': 'AU', 'mexico': 'MX', 'argentina': 'AR',
  'colombia': 'CO', 'chile': 'CL', 'peru': 'PE', 'venezuela': 'VE',
  'russia': 'RU', 'ukraine': 'UA', 'poland': 'PL', 'spain': 'ES',
  'italy': 'IT', 'portugal': 'PT', 'netherlands': 'NL', 'belgium': 'BE',
  'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI',
  'switzerland': 'CH', 'austria': 'AT', 'greece': 'GR', 'turkey': 'TR',
  'indonesia': 'ID', 'pakistan': 'PK', 'bangladesh': 'BD',
  'philippines': 'PH', 'vietnam': 'VN', 'thailand': 'TH',
  'myanmar': 'MM', 'malaysia': 'MY', 'singapore': 'SG',
  'south korea': 'KR', 'north korea': 'KP', 'iran': 'IR', 'iraq': 'IQ',
  'saudi arabia': 'SA', 'uae': 'AE', 'united arab emirates': 'AE',
  'israel': 'IL', 'jordan': 'JO', 'lebanon': 'LB', 'syria': 'SY',
  'guinea': 'GN', 'sierra leone': 'SL', 'liberia': 'LR',
  'burkina faso': 'BF', 'chad': 'TD', 'central african republic': 'CF',
  'congo': 'CG', 'democratic republic of congo': 'CD', 'drc': 'CD',
  'gabon': 'GA', 'equatorial guinea': 'GQ', 'namibia': 'NA',
  'botswana': 'BW', 'lesotho': 'LS', 'swaziland': 'SZ', 'eswatini': 'SZ',
  'malawi': 'MW', 'eritrea': 'ER', 'djibouti': 'DJ', 'comoros': 'KM',
};

function parseQuery(q) {
  if (!q || typeof q !== 'string' || q.trim() === '') return null;

  const text = q.toLowerCase().trim();
  const filters = {};

  // ── gender ──
  if (/\bmales?\b/.test(text) && !/\bfemales?\b/.test(text)) {
    filters.gender = 'male';
  } else if (/\bfemales?\b/.test(text) && !/\bmales?\b/.test(text)) {
    filters.gender = 'female';
  }
  // "male and female" or "men and women" → no gender filter

  // ── age group keywords ──
  if (/\bchildren\b|\bchild\b|\bkids?\b/.test(text)) {
    filters.age_group = 'child';
  } else if (/\bteenagers?\b|\bteens?\b/.test(text)) {
    filters.age_group = 'teenager';
  } else if (/\badults?\b/.test(text)) {
    filters.age_group = 'adult';
  } else if (/\bseniors?\b|\belderly\b|\bold people\b/.test(text)) {
    filters.age_group = 'senior';
  }

  // "young" maps to ages 16–24 (not a stored age_group)
  if (/\byoung\b/.test(text) && !filters.age_group) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  // ── explicit age expressions ──
  // "above N" / "over N" / "older than N"
  const aboveMatch = text.match(/(?:above|over|older than)\s+(\d+)/);
  if (aboveMatch) filters.min_age = parseInt(aboveMatch[1]);

  // "below N" / "under N" / "younger than N"
  const belowMatch = text.match(/(?:below|under|younger than)\s+(\d+)/);
  if (belowMatch) filters.max_age = parseInt(belowMatch[1]);

  // "between N and M"
  const betweenMatch = text.match(/between\s+(\d+)\s+and\s+(\d+)/);
  if (betweenMatch) {
    filters.min_age = parseInt(betweenMatch[1]);
    filters.max_age = parseInt(betweenMatch[2]);
  }

  // "aged N" / "age N"
  const agedMatch = text.match(/aged?\s+(\d+)/);
  if (agedMatch) {
    filters.min_age = parseInt(agedMatch[1]);
    filters.max_age = parseInt(agedMatch[1]);
  }

  // ── country ──
  // Try multi-word country names first (longest match wins)
  const sortedCountries = Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length);
  for (const name of sortedCountries) {
    if (text.includes(name)) {
      filters.country_id = COUNTRY_MAP[name];
      break;
    }
  }

  // If no country name matched, try 2-letter ISO code: "from NG", "in US"
  if (!filters.country_id) {
    const isoMatch = text.match(/(?:from|in)\s+([a-z]{2})\b/);
    if (isoMatch) filters.country_id = isoMatch[1].toUpperCase();
  }

  // If nothing was parsed at all, return null (uninterpretable)
  if (Object.keys(filters).length === 0) return null;

  return filters;
}

module.exports = { parseQuery };