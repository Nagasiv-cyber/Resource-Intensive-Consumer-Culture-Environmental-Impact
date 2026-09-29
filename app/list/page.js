'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Swatch from '@/components/Swatch';
import { AREAS, getArea } from '@/lib/areas';
import { SIZES, OCCASIONS, STYLES, CATEGORIES, GENDERS } from '@/lib/catalog';
import { getMyListings, saveMyListing, removeMyListing } from '@/lib/storage';

const INITIAL = {
  title: '', category: '', gender: '', sizes: [], occasions: [], styles: [],
  price: '', deposit: '', retailPrice: '', areaId: '', lenderName: '',
  colors: ['#1E2A5A', '#E9A21B'],
};

export default function ListPage() {
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [mine, setMine] = useState([]);
  const [formError, setFormError] = useState('');

  useEffect(() => setMine(getMyListings()), []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k, v) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));
  const setColor = (i, v) => setForm((f) => ({ ...f, colors: f.colors.map((c, j) => (j === i ? v : c)) }));

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError('');
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 422) {
        setErrors(json.fields || {});
        setFormError('Some fields need fixing before you can list.');
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Listing failed. Try again.');
      if (!saveMyListing(json.listing)) throw new Error('Your browser blocked saving. Allow site storage and try again.');
      setDone(json.listing);
      setMine(getMyListings());
      setForm(INITIAL);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setFormError(err.message === 'Failed to fetch' ? 'You seem to be offline. Try again when connected.' : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function onRemove(id) {
    removeMyListing(id);
    setMine(getMyListings());
  }

  const Err = ({ k }) => (errors[k] ? <span className="field-error">{errors[k]}</span> : null);

  return (
    <div className="wrap page">
      <h1>Lend an outfit you&apos;ve worn once</h1>
      <p className="lead">
        That lehenga from your cousin&apos;s wedding can earn its cost back. List it once, and people near you who need it for their own occasion will find it.
      </p>

      {done && (
        <div className="success" role="status">
          <strong>Listed.</strong> People searching near {getArea(done.areaId)?.name} can now find &quot;{done.title}&quot;.{' '}
          <Link href="/">Search for it yourself</Link>.
        </div>
      )}

      <form className="form" onSubmit={onSubmit} noValidate>
        <label className="field">What is it?
          <input value={form.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder="Wine velvet lehenga with gold border" />
          <Err k="title" />
        </label>

        <div className="form-row">
          <label className="field">Category
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Choose</option>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <Err k="category" />
          </label>
          <label className="field">Fits
            <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">Choose</option>
              {Object.entries(GENDERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Err k="gender" />
          </label>
        </div>

        <fieldset>
          <legend>Sizes it fits</legend>
          <div className="checks">
            {SIZES.map((s) => (
              <label className="check" key={s}><input type="checkbox" checked={form.sizes.includes(s)} onChange={() => toggle('sizes', s)} />{s}</label>
            ))}
          </div>
          <Err k="sizes" />
        </fieldset>

        <fieldset>
          <legend>Good for</legend>
          <div className="checks">
            {Object.entries(OCCASIONS).map(([k, v]) => (
              <label className="check" key={k}><input type="checkbox" checked={form.occasions.includes(k)} onChange={() => toggle('occasions', k)} />{v}</label>
            ))}
          </div>
          <Err k="occasions" />
        </fieldset>

        <fieldset>
          <legend>Look (optional)</legend>
          <div className="checks">
            {Object.entries(STYLES).map(([k, v]) => (
              <label className="check" key={k}><input type="checkbox" checked={form.styles.includes(k)} onChange={() => toggle('styles', k)} />{v}</label>
            ))}
          </div>
        </fieldset>

        <div className="form-row">
          <label className="field">Rental price per occasion (₹)
            <input type="number" min="50" max="20000" value={form.price} onChange={(e) => set('price', e.target.value)} />
            <Err k="price" />
          </label>
          <label className="field">Refundable deposit (₹)
            <input type="number" min="0" max="50000" value={form.deposit} onChange={(e) => set('deposit', e.target.value)} />
            <Err k="deposit" />
          </label>
          <label className="field">What you paid (₹, optional)
            <input type="number" min="0" value={form.retailPrice} onChange={(e) => set('retailPrice', e.target.value)} />
          </label>
        </div>

        <div className="form-row">
          <label className="field">Your area
            <select value={form.areaId} onChange={(e) => set('areaId', e.target.value)}>
              <option value="">Choose</option>
              {AREAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <Err k="areaId" />
          </label>
          <label className="field">Your name
            <input value={form.lenderName} maxLength={40} onChange={(e) => set('lenderName', e.target.value)} />
            <Err k="lenderName" />
          </label>
        </div>

        <div className="form-row">
          <label className="field">Main colour<input type="color" value={form.colors[0]} onChange={(e) => setColor(0, e.target.value)} /></label>
          <label className="field">Border colour<input type="color" value={form.colors[1]} onChange={(e) => setColor(1, e.target.value)} /></label>
          <div style={{ borderRadius: 8, overflow: 'hidden' }}>
            <Swatch listing={{ ...form, category: form.category || 'saree', title: form.title || 'your outfit' }} />
          </div>
        </div>

        {formError && <p className="field-error" role="alert">{formError}</p>}
        <div><button className="btn" type="submit" disabled={submitting}>{submitting ? 'Listing…' : 'List this outfit'}</button></div>
      </form>

      {mine.length > 0 && (
        <section className="my-list">
          <h2>Your listings</h2>
          <p className="meta">Saved in this browser for the prototype.</p>
          <ul>
            {mine.map((l) => (
              <li key={l.id}>
                <span>{l.title} | ₹{l.price} | {getArea(l.areaId)?.name}</span>
                <button className="btn btn-ghost" onClick={() => onRemove(l.id)}>Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
