// Server-only data access for Supabase. Never import this from a client
// component: it uses the secret service-role key.
import { createClient } from '@supabase/supabase-js';
import { addDays } from './dates.js';

let client = null;

export function isDbEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getDb() {
  if (!isDbEnabled()) return null;
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// Supabase returns { data, error }; turn errors into thrown exceptions so
// every route handles failures in one catch block.
function unwrap({ data, error }) {
  if (error) throw new Error(`Database error: ${error.message}`);
  return data;
}

// ---------- mapping between database rows and app objects ----------

export function rowToListing(row, viewerHash = null) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    gender: row.gender,
    sizes: row.sizes,
    occasions: row.occasions,
    styles: row.styles,
    colors: row.colors,
    price: row.price,
    deposit: row.deposit,
    retailPrice: row.retail_price,
    areaId: row.area_id,
    lender: { name: row.lender_name, verified: false },
    bookedDates: [],
    source: 'community',
    mine: Boolean(viewerHash && row.owner_hash === viewerHash),
  };
}

export function listingToRow(l, ownerHash) {
  return {
    id: l.id,
    title: l.title,
    category: l.category,
    gender: l.gender,
    sizes: l.sizes,
    occasions: l.occasions,
    styles: l.styles,
    colors: l.colors,
    price: l.price,
    deposit: l.deposit,
    retail_price: l.retailPrice,
    area_id: l.areaId,
    lender_name: l.lender.name,
    owner_hash: ownerHash,
  };
}

// What a request looks like to the person viewing it. Contact details are
// only revealed to the lender once they accept.
export function rowToRequest(row, viewer) {
  const isLender = viewer === 'lender';
  return {
    id: row.id,
    listingId: row.listing_id,
    listing: row.listing_snapshot,
    eventDate: row.event_date,
    status: row.status,
    createdAt: row.created_at,
    borrowerName: row.borrower_name,
    borrowerContact: isLender && row.status === 'accepted' ? row.borrower_contact : null,
  };
}

// Adds accepted-request dates to each listing's bookedDates.
export function applyBookings(listings, bookingRows) {
  const byListing = new Map();
  for (const r of bookingRows) {
    if (!byListing.has(r.listing_id)) byListing.set(r.listing_id, []);
    byListing.get(r.listing_id).push(r.event_date);
  }
  return listings.map((l) =>
    byListing.has(l.id) ? { ...l, bookedDates: [...l.bookedDates, ...byListing.get(l.id)] } : l,
  );
}

// ---------- listings ----------

export async function fetchCommunityListings(db, viewerHash) {
  const rows = unwrap(await db.from('listings').select('*').order('created_at', { ascending: false }).limit(500));
  return rows.map((r) => rowToListing(r, viewerHash));
}

export async function fetchListingsByOwner(db, ownerHash) {
  const rows = unwrap(await db.from('listings').select('*').eq('owner_hash', ownerHash).order('created_at', { ascending: false }));
  return rows.map((r) => rowToListing(r, ownerHash));
}

export async function fetchListingRow(db, id) {
  const rows = unwrap(await db.from('listings').select('*').eq('id', id).limit(1));
  return rows[0] || null;
}

export async function insertListing(db, listing, ownerHash) {
  const rows = unwrap(await db.from('listings').insert(listingToRow(listing, ownerHash)).select());
  return rowToListing(rows[0], ownerHash);
}

export async function deleteListing(db, id, ownerHash) {
  const rows = unwrap(await db.from('listings').delete().eq('id', id).eq('owner_hash', ownerHash).select('id'));
  return rows.length > 0;
}

// ---------- requests ----------

// Accepted bookings that can still affect availability (recent or upcoming).
export async function fetchAcceptedBookings(db, todayIso, listingId = null) {
  let q = db.from('requests').select('listing_id, event_date').eq('status', 'accepted').gte('event_date', addDays(todayIso, -3));
  if (listingId) q = q.eq('listing_id', listingId);
  return unwrap(await q);
}

export async function insertRequest(db, row) {
  const rows = unwrap(await db.from('requests').insert(row).select());
  return rows[0];
}

export async function findOpenRequest(db, { listingId, borrowerHash, eventDate }) {
  const rows = unwrap(await db.from('requests').select('id')
    .eq('listing_id', listingId).eq('borrower_hash', borrowerHash).eq('event_date', eventDate)
    .in('status', ['pending', 'accepted']).limit(1));
  return rows[0] || null;
}

export async function fetchRequestsByBorrower(db, borrowerHash) {
  return unwrap(await db.from('requests').select('*').eq('borrower_hash', borrowerHash).order('event_date', { ascending: true }).limit(100));
}

export async function fetchRequestsForOwner(db, ownerHash) {
  return unwrap(await db.from('requests').select('*').eq('listing_owner_hash', ownerHash).neq('status', 'cancelled').order('event_date', { ascending: true }).limit(200));
}

export async function fetchRequest(db, id) {
  const rows = unwrap(await db.from('requests').select('*').eq('id', id).limit(1));
  return rows[0] || null;
}

// Only moves a request if it is still in the expected status, so two quick
// clicks (or two devices) can't both change it.
export async function updateRequestStatus(db, id, fromStatus, toStatus) {
  const rows = unwrap(await db.from('requests')
    .update({ status: toStatus, updated_at: new Date().toISOString() })
    .eq('id', id).eq('status', fromStatus).select());
  return rows[0] || null;
}

export async function declineRequests(db, ids) {
  if (!ids.length) return;
  unwrap(await db.from('requests').update({ status: 'declined', updated_at: new Date().toISOString() }).in('id', ids).eq('status', 'pending').select('id'));
}

export async function fetchPendingForListing(db, listingId) {
  return unwrap(await db.from('requests').select('id, event_date').eq('listing_id', listingId).eq('status', 'pending'));
}
