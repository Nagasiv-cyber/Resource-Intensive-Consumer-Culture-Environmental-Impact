// Browser storage helpers. Storage can be disabled or full, so every call is
// guarded and falls back to an empty value instead of crashing the page.
const KEYS = { listings: 'onewear:listings', requests: 'onewear:requests' };

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    const val = raw ? JSON.parse(raw) : [];
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const getMyListings = () => read(KEYS.listings);
export const saveMyListing = (l) => write(KEYS.listings, [l, ...getMyListings()].slice(0, 20));
export const removeMyListing = (id) => write(KEYS.listings, getMyListings().filter((l) => l.id !== id));
export const getRequests = () => read(KEYS.requests);
export const saveRequest = (r) => write(KEYS.requests, [r, ...getRequests()].slice(0, 50));

export function localTodayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
