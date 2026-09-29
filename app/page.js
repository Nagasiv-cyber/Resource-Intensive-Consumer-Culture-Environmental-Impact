'use client';
import { useEffect, useState } from 'react';
import ResultCard from '@/components/ResultCard';
import BookingDialog from '@/components/BookingDialog';
import { AREAS, getArea } from '@/lib/areas';
import { SIZES, OCCASIONS, STYLES, CATEGORIES } from '@/lib/catalog';
import { formatDate } from '@/lib/dates';
import { getMyListings, getRequests, saveRequest, localTodayIso } from '@/lib/storage';

const MAX = 500;
const EXAMPLES = [
  "Cousin's sangeet in Anna Nagar next Saturday, size M, under ₹900, nothing too loud",
  'Placement interview tomorrow near REC, men, size L, budget 500',
  'Ethnic day at college on Friday, saree, I am medium',
  'Pre-wedding photoshoot in Adyar, lehenga, 1k',
];

const EMPTY_FILTERS = { occasion: '', size: '', budget: '', date: '', areaId: '', gender: '' };

function toFilters(q) {
  return {
    occasion: q.occasion || '', size: q.size || '', budget: q.budget ?? '',
    date: q.date || '', areaId: q.areaId || '', gender: q.gender || '',
  };
}

export default function FindPage() {
  const [text, setText] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [extras, setExtras] = useState({ styles: [], categories: [] });
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');
  const [renting, setRenting] = useState(null);
  const [requested, setRequested] = useState([]);
  const [toast, setToast] = useState('');
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(localTodayIso());
    setRequested(getRequests().map((r) => r.listingId));
    runSearch({ filters: {} }); // show nearby outfits before the first search
  }, []);

  async function runSearch(payload) {
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, today: localTodayIso(), extraListings: getMyListings() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Search failed (${res.status}).`);
      setData(json);
      setFilters(toFilters(json.query));
      setExtras({ styles: json.query.styles, categories: json.query.categories });
      setStatus('done');
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'You seem to be offline. Check your connection and try again.' : e.message);
      setStatus('error');
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!text.trim()) {
      setError('Describe your occasion first, or tap one of the examples.');
      setStatus('error');
      return;
    }
    runSearch({ text });
  }

  function onRefine(e) {
    e.preventDefault();
    runSearch({
      filters: {
        ...filters,
        budget: filters.budget === '' ? null : Number(filters.budget),
        ...extras,
      },
    });
  }

  function setF(k, v) {
    setFilters((f) => ({ ...f, [k]: v }));
  }

  function confirmRent(result, eventDate) {
    saveRequest({ listingId: result.listing.id, eventDate, at: Date.now() });
    setRequested((r) => [...r, result.listing.id]);
    setRenting(null);
    setToast(`Request sent to ${result.listing.lender.name} for ${formatDate(eventDate)}.`);
    setTimeout(() => setToast(''), 5000);
  }

  const q = data?.query;

  return (
    <div className="wrap">
      <section className="hero">
        <form onSubmit={onSubmit}>
          <label htmlFor="occasion-input">What&apos;s the occasion?</label>
          <p className="sub">
            Tell us the event, your size, your budget and roughly where you are. We&apos;ll find outfits people nearby are lending, free on your date.
          </p>
          <div className="search-box">
            <textarea
              id="occasion-input"
              value={text}
              maxLength={MAX}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit(e); }}
              placeholder="Friend's wedding reception in T. Nagar this Sunday, size S, around ₹600"
            />
            <div className="search-actions">
              <span className="count">{text.length}/{MAX}</span>
              <button className="btn" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Finding outfits…' : 'Find outfits'}
              </button>
            </div>
          </div>
        </form>
        <div className="examples">
          <span>Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip-btn" onClick={() => { setText(ex); runSearch({ text: ex }); }}>
              {ex.length > 44 ? ex.slice(0, 42) + '…' : ex}
            </button>
          ))}
        </div>
      </section>

      {toast && <div className="success" role="status">{toast}</div>}

      {status === 'error' && (
        <div className="state error" role="alert">{error}</div>
      )}

      {q && (
        <form className="refine" onSubmit={onRefine}>
          <h2>{data.parser === 'none' ? 'Narrow it down' : 'Here\'s what we understood. Change anything and update.'}</h2>
          <div className="refine-grid">
            <label className="field">Occasion
              <select value={filters.occasion} onChange={(e) => setF('occasion', e.target.value)}>
                <option value="">Any</option>
                {Object.entries(OCCASIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field">Size
              <select value={filters.size} onChange={(e) => setF('size', e.target.value)}>
                <option value="">Any</option>
                {SIZES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="field">Budget (₹)
              <input type="number" min="50" max="100000" step="50" value={filters.budget} onChange={(e) => setF('budget', e.target.value)} placeholder="Any" />
            </label>
            <label className="field">Event date
              <input type="date" min={today} value={filters.date} onChange={(e) => setF('date', e.target.value)} />
            </label>
            <label className="field">Near
              <select value={filters.areaId} onChange={(e) => setF('areaId', e.target.value)}>
                <option value="">REC Thandalam (default)</option>
                {AREAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="field">For
              <select value={filters.gender} onChange={(e) => setF('gender', e.target.value)}>
                <option value="">Anyone</option>
                <option value="women">Women</option>
                <option value="men">Men</option>
              </select>
            </label>
          </div>
          {(extras.styles.length > 0 || extras.categories.length > 0) && (
            <div className="tags">
              {extras.styles.map((s) => <span className="tag" key={s}>{STYLES[s]}</span>)}
              {extras.categories.map((c) => <span className="tag" key={c}>{CATEGORIES[c].label}</span>)}
            </div>
          )}
          <div className="refine-foot">
            <span className="parser-note">
              {data.parser === 'ai' ? 'Read by AI, checked by rules.' : data.parser === 'rules' ? 'Read by our built-in parser.' : 'Using your filters.'}
            </span>
            <button className="btn btn-ghost" type="submit" disabled={status === 'loading'}>Update results</button>
          </div>
        </form>
      )}

      {status === 'loading' && (
        <div className="grid" aria-busy="true" aria-label="Loading results">
          {[0, 1, 2].map((i) => <div className="skeleton" key={i} />)}
        </div>
      )}

      {status === 'done' && data && (
        data.results.length ? (
          <section>
            <div className="results-head">
              <h2>{data.parser === 'none' && !Object.values(filters).some(Boolean) ? 'Outfits near you' : `Top ${data.results.length} matches`}</h2>
              <p>
                Near {getArea(q.areaId)?.name || 'REC Thandalam'}
                {q.date && `, free on ${formatDate(q.date)}`}
                {data.excluded.unavailable > 0 && `. ${data.excluded.unavailable} hidden as already booked.`}
              </p>
            </div>
            <div className="grid">
              {data.results.map((r) => (
                <ResultCard key={r.listing.id} result={r} requested={requested.includes(r.listing.id)} onRent={setRenting} />
              ))}
            </div>
          </section>
        ) : (
          <div className="state">
            <h2>No outfits match all of that yet</h2>
            <p>
              {data.excluded.unavailable > 0 ? `${data.excluded.unavailable} outfits are booked around your date. ` : ''}
              Try a different date, clear the size, or set &quot;For&quot; to Anyone, then update.
            </p>
          </div>
        )
      )}

      {renting && (
        <BookingDialog
          result={renting}
          date={q?.date}
          today={today || localTodayIso()}
          onClose={() => setRenting(null)}
          onConfirm={confirmRent}
        />
      )}
    </div>
  );
}
