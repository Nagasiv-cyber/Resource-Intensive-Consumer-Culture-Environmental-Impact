// Server-side validation shared by every API route. Never trust the client.
import { AREAS } from './areas.js';
import { SIZES, OCCASIONS, STYLES, CATEGORIES, GENDERS } from './catalog.js';
import { isIsoDate } from './dates.js';

const HEX = /^#[0-9a-f]{6}$/i;
const clean = (s, max) => String(s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const inEnum = (v, obj) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(obj, v);
const areaIds = new Set(AREAS.map((a) => a.id));

// Cleans a parsed/edited query. Unknown or invalid values become null
// instead of throwing, so one bad field never breaks the search.
export function sanitizeQuery(q = {}) {
  const budget = Number(q.budget);
  return {
    occasion: inEnum(q.occasion, OCCASIONS) ? q.occasion : null,
    size: SIZES.includes(q.size) ? q.size : null,
    budget: Number.isFinite(budget) && budget >= 50 && budget <= 100000 ? Math.round(budget) : null,
    date: isIsoDate(q.date) ? q.date : null,
    areaId: areaIds.has(q.areaId) ? q.areaId : null,
    gender: q.gender === 'women' || q.gender === 'men' ? q.gender : null,
    styles: Array.isArray(q.styles) ? [...new Set(q.styles.filter((s) => inEnum(s, STYLES)))].slice(0, 5) : [],
    categories: Array.isArray(q.categories) ? [...new Set(q.categories.filter((c) => inEnum(c, CATEGORIES)))].slice(0, 5) : [],
  };
}

export function validateListing(input = {}) {
  const errors = {};
  const title = clean(input.title, 80);
  if (title.length < 4) errors.title = 'Give the outfit a name of at least 4 characters.';
  if (!inEnum(input.category, CATEGORIES)) errors.category = 'Pick a category.';
  if (!inEnum(input.gender, GENDERS)) errors.gender = 'Pick who it fits.';
  const sizes = Array.isArray(input.sizes) ? SIZES.filter((s) => input.sizes.includes(s)) : [];
  if (!sizes.length) errors.sizes = 'Select at least one size.';
  const occasions = Array.isArray(input.occasions) ? Object.keys(OCCASIONS).filter((o) => input.occasions.includes(o)) : [];
  if (!occasions.length) errors.occasions = 'Select at least one occasion.';
  const styles = Array.isArray(input.styles) ? Object.keys(STYLES).filter((s) => input.styles.includes(s)) : [];
  const price = Math.round(Number(input.price));
  if (!Number.isFinite(price) || price < 50 || price > 20000) errors.price = 'Rental price must be between ₹50 and ₹20,000.';
  const deposit = Math.round(Number(input.deposit));
  if (!Number.isFinite(deposit) || deposit < 0 || deposit > 50000) errors.deposit = 'Deposit must be between ₹0 and ₹50,000.';
  const retailPrice = Math.round(Number(input.retailPrice) || 0);
  if (!areaIds.has(input.areaId)) errors.areaId = 'Pick your area.';
  const lenderName = clean(input.lenderName, 40);
  if (lenderName.length < 2) errors.lenderName = 'Enter your name.';
  const colors = Array.isArray(input.colors) && input.colors.length === 2 && input.colors.every((c) => HEX.test(c))
    ? input.colors : ['#1E2A5A', '#E9A21B'];
  const id = typeof input.id === 'string' && /^local-[a-z0-9-]{4,40}$/.test(input.id) ? input.id : null;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    listing: {
      id: id || `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      title, category: input.category, gender: input.gender, sizes, occasions,
      styles: styles.length ? styles : ['minimal'], colors, price, deposit,
      retailPrice: retailPrice > 0 ? retailPrice : price * 10,
      areaId: input.areaId,
      lender: { name: lenderName, verified: false },
      bookedDates: [],
      source: 'local',
    },
  };
}
