import { CATEGORIES } from '@/lib/catalog';

// A CSS-drawn fabric swatch in the outfit's colours. Keeps the prototype
// free of external images while still telling outfits apart at a glance.
export default function Swatch({ listing }) {
  const cat = CATEGORIES[listing.category] || { label: 'Outfit', pattern: 'sheen' };
  const [a, b] = listing.colors;
  return (
    <div className={`swatch swatch-${cat.pattern}`} style={{ '--a': a, '--b': b }} role="img" aria-label={`${cat.label} in ${listing.title}`}>
      <span className="swatch-label">{cat.label}</span>
      {listing.source === 'local' && <span className="swatch-label swatch-new">Your listing</span>}
    </div>
  );
}
