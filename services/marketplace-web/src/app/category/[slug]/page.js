'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const CATEGORY_GRADIENTS = {
  't-shirts': 'from-violet-500 to-indigo-600',
  'hoodies': 'from-blue-500 to-cyan-500',
  'stickers': 'from-pink-500 to-rose-500',
  'mugs': 'from-amber-400 to-orange-500',
  'phone-cases': 'from-emerald-500 to-teal-500',
  'wall-art': 'from-fuchsia-500 to-purple-600',
  'tote-bags': 'from-sky-400 to-blue-500',
  'posters': 'from-red-400 to-pink-500',
};

const SORT_OPTIONS = [
  { label: 'Most Popular', value: 'popular' },
  { label: 'Newest', value: 'newest' },
];

export default function CategoryPage({ params }) {
  const router = useRouter();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1 });
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({ sort, page, limit: 20 });
        const res = await fetch(`${API_BASE}/api/v1/categories/${params.slug}?${queryParams}`);
        if (!res.ok) throw new Error('Category not found');
        const json = await res.json();
        setCategory(json.data);
        setProducts(json.data.products || []);
        setMeta(json.meta || { total: 0, page: 1 });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.slug, sort, page]);

  const gradient = CATEGORY_GRADIENTS[params.slug] || 'from-gray-500 to-gray-600';

  if (error) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold text-surface-900 mb-2">Category Not Found</h1>
        <p className="text-surface-500 mb-6">{error}</p>
        <Link href="/" className="btn-primary">Back to Home</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Hero banner */}
      <div className={`bg-gradient-to-r ${gradient} py-16 md:py-20`}>
        <div className="container-page text-center text-white">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {category?.name || params.slug.replace('-', ' ')}
          </h1>
          <p className="text-white/70">
            {category?.description || `Browse all ${params.slug.replace('-', ' ')} designs`}
          </p>
          {meta.total > 0 && (
            <p className="text-white/50 text-sm mt-2">{meta.total} designs</p>
          )}
        </div>
      </div>

      <div className="container-page py-8">
        {/* Sort bar */}
        <div className="flex items-center justify-between mb-6">
          <nav className="flex items-center gap-2 text-sm text-surface-400">
            <Link href="/" className="hover:text-brand-600">Home</Link>
            <span>/</span>
            <span className="text-surface-700 capitalize">{category?.name || params.slug.replace('-', ' ')}</span>
          </nav>

          <div className="flex items-center gap-2">
            <label className="text-sm text-surface-500">Sort:</label>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border border-surface-200 rounded-lg text-sm bg-white
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Products grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-surface-200 rounded-xl mb-2" />
                <div className="h-4 bg-surface-200 rounded w-3/4 mb-1" />
                <div className="h-3 bg-surface-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Pagination */}
            {meta.total > 20 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                {page > 1 && (
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    className="px-4 py-2 rounded-lg border border-surface-200 text-sm font-medium
                               text-surface-600 hover:bg-surface-50"
                  >
                    Previous
                  </button>
                )}
                <span className="text-sm text-surface-500 px-4">
                  Page {meta.page} of {Math.ceil(meta.total / 20)}
                </span>
                {page < Math.ceil(meta.total / 20) && (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="px-4 py-2 rounded-lg border border-surface-200 text-sm font-medium
                               text-surface-600 hover:bg-surface-50"
                  >
                    Next
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎨</div>
            <h2 className="text-xl font-bold text-surface-900 mb-2">No designs in this category yet</h2>
            <p className="text-surface-500">Check back soon for new designs.</p>
          </div>
        )}
      </div>
    </div>
  );
}
