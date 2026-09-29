import { NextResponse } from 'next/server';
import { parseQuery } from '@/lib/parser';
import { refineWithLlm, mergeQueries } from '@/lib/llm';
import { sanitizeQuery, validateListing } from '@/lib/validate';
import { rankListings } from '@/lib/scoring';
import { getSeedListings } from '@/lib/listings';
import { isIsoDate, todayIst } from '@/lib/dates';
import { rateLimit, clientKey } from '@/lib/rateLimit';

const MAX_TEXT = 500;
const MAX_EXTRA = 20;

const fail = (status, error) => NextResponse.json({ error }, { status });

// POST /api/match
// Body: { text?: string, filters?: object, today?: "YYYY-MM-DD", extraListings?: object[] }
// - text: free-text description of the occasion (parsed into fields)
// - filters: explicit field values from the refine bar; these override parsing
export async function POST(request) {
  if (!rateLimit(clientKey(request))) return fail(429, 'Too many searches. Wait a minute and try again.');

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'Request body must be valid JSON.');
  }
  if (!body || typeof body !== 'object') return fail(400, 'Request body must be an object.');

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length > MAX_TEXT) return fail(400, `Keep the description under ${MAX_TEXT} characters.`);
  if (!text && !body.filters) return fail(400, 'Describe your occasion or choose some filters.');

  const today = isIsoDate(body.today) ? body.today : todayIst();

  try {
    let query = sanitizeQuery({});
    let parser = 'none';
    if (text) {
      const rules = sanitizeQuery(parseQuery(text, today));
      const ai = await refineWithLlm(text, today);
      query = mergeQueries(rules, ai ? sanitizeQuery(ai) : null);
      parser = ai ? 'ai' : 'rules';
    }
    if (body.filters && typeof body.filters === 'object') {
      const f = sanitizeQuery(body.filters);
      for (const k of Object.keys(f)) {
        if (k in body.filters) query[k] = f[k];
      }
    }
    if (query.date && query.date < today) query.date = null;

    const extra = Array.isArray(body.extraListings)
      ? body.extraListings.slice(0, MAX_EXTRA).map(validateListing).filter((r) => r.ok).map((r) => r.listing)
      : [];
    const listings = [...extra, ...getSeedListings(today)];
    const { results, excluded, considered } = rankListings(listings, query);

    return NextResponse.json({ query, parser, today, results, excluded, considered });
  } catch (err) {
    console.error('match failed', err);
    return fail(500, 'Matching failed on our side. Try again.');
  }
}
