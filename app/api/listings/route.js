import { NextResponse } from 'next/server';
import { validateListing } from '@/lib/validate';
import { rateLimit, clientKey } from '@/lib/rateLimit';

// POST /api/listings — validates a new outfit listing and returns the
// normalised record. Prototype note: persistence happens in the lender's
// browser; a production build would write to a database here.
export async function POST(request) {
  if (!rateLimit('list:' + clientKey(request), { limit: 10 })) {
    return NextResponse.json({ error: 'Too many listings at once. Wait a minute.' }, { status: 429 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const result = validateListing(body);
  if (!result.ok) return NextResponse.json({ error: 'Some fields need fixing.', fields: result.errors }, { status: 422 });
  return NextResponse.json({ listing: result.listing }, { status: 201 });
}
