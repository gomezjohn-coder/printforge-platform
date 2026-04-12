import Link from 'next/link';

const GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-pink-500 to-rose-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-400 to-amber-500',
  'from-indigo-500 to-blue-600',
  'from-fuchsia-500 to-pink-500',
  'from-sky-400 to-blue-500',
];

function getGradient(id) {
  if (!id) return GRADIENTS[0];
  const hash = typeof id === 'string'
    ? id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    : 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

export default function ProductCard({ product }) {
  const gradient = getGradient(product.id);
  const price = parseFloat(product.price).toFixed(2);

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="card-hover rounded-xl overflow-hidden bg-white border border-surface-100">
        {/* Image placeholder */}
        <div className={`aspect-square bg-gradient-to-br ${gradient} relative overflow-hidden`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/80 text-5xl font-bold uppercase tracking-widest select-none">
              {product.title?.[0] || 'P'}
            </span>
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          {/* Product type badge */}
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm text-xs
                           font-medium text-surface-700 rounded-full capitalize">
            {product.productType?.replace('-', ' ') || 'Product'}
          </span>
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-sm font-semibold text-surface-900 line-clamp-2 group-hover:text-brand-600 transition-colors">
            {product.title}
          </h3>
          {product.artist && (
            <p className="text-xs text-surface-500 mt-0.5">
              by {product.artist.name}
            </p>
          )}
          <p className="text-base font-bold text-surface-900 mt-1.5">
            ${price}
          </p>
        </div>
      </div>
    </Link>
  );
}
