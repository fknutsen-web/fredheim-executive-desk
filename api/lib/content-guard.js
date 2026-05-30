// api/lib/content-guard.js
// Anti-circumvention scanning for all free-text fields. Recruiters and
// candidates may not embed contact information or identifying company details
// in free text — that would let parties bypass the paid introduction and
// destroy marketplace revenue + confidentiality.
//
// Usage:
//   const { guardFreeText } = require('./lib/content-guard');
//   const r = guardFreeText(text);
//   if (!r.ok) return res.status(422).json({ error: r.message, violations: r.violations });

// Known maritime/industrial companies whose names must not appear in free text
// (extend via the second arg to guardFreeText / scanCompanies).
const FLAGGED_COMPANIES = [
  'cobelfret', 'oldendorff', 'berge bulk', 'pacific basin', 'dnv', 'abs',
  'bureau veritas', 'lloyd', 'maersk', 'msc', 'cma cgm', 'hapag', 'eagle bulk',
  'star bulk', 'genco', 'diana shipping', 'navios', 'klaveness', 'norden',
];

const PATTERNS = [
  { type: 'email',    re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi },
  { type: 'url',      re: /\b(?:https?:\/\/|www\.)[^\s]+/gi },
  { type: 'domain',   re: /\b[a-z0-9-]+\.(?:com|net|org|io|co|biz|info|maritime|shipping)\b/gi },
  { type: 'linkedin', re: /\b(?:linkedin\.com\/[^\s]+|in\/[a-z0-9-]{3,})/gi },
  { type: 'whatsapp', re: /\bwhats\s?app\b|\bwa\.me\/[0-9]+/gi },
  { type: 'telegram', re: /\b(?:telegram|t\.me\/[a-z0-9_]+|@[a-z0-9_]{4,})\b/gi },
  // Phone: 7+ digits possibly separated by space/.-()+ — catches intl formats.
  { type: 'phone',    re: /(?:\+?\d[\s().-]?){7,}\d/g },
  { type: 'social',   re: /\b(?:instagram|twitter|x\.com|facebook|fb\.com|signal|skype|wechat)\b/gi },
];

function scanContactInfo(text) {
  if (!text || typeof text !== 'string') return [];
  const found = [];
  for (const p of PATTERNS) {
    const matches = text.match(p.re);
    if (matches) for (const m of matches) found.push({ type: p.type, match: m.trim() });
  }
  return found;
}

function scanCompanies(text, extra = []) {
  if (!text || typeof text !== 'string') return [];
  const haystack = text.toLowerCase();
  const list = [...FLAGGED_COMPANIES, ...extra.map(s => String(s).toLowerCase())];
  const found = [];
  for (const c of list) {
    if (!c) continue;
    const re = new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(haystack)) found.push({ type: 'company', match: c });
  }
  return found;
}

// Combined guard. Returns { ok, violations, message }. ok=false => block submit.
const BLOCK_MESSAGE =
  'Contact information and company identifiers are not permitted until an introduction has been completed. Please remove emails, phone numbers, websites, social handles, and company names.';

function guardFreeText(text, { companies = [] } = {}) {
  const violations = [...scanContactInfo(text), ...scanCompanies(text, companies)];
  return { ok: violations.length === 0, violations, message: violations.length ? BLOCK_MESSAGE : null };
}

// Guard several named fields at once. Returns { ok, fieldViolations, message }.
function guardFields(fields = {}, opts = {}) {
  const fieldViolations = {};
  for (const [name, value] of Object.entries(fields)) {
    const r = guardFreeText(value, opts);
    if (!r.ok) fieldViolations[name] = r.violations;
  }
  const ok = Object.keys(fieldViolations).length === 0;
  return { ok, fieldViolations, message: ok ? null : BLOCK_MESSAGE };
}

module.exports = {
  FLAGGED_COMPANIES,
  BLOCK_MESSAGE,
  scanContactInfo,
  scanCompanies,
  guardFreeText,
  guardFields,
};
