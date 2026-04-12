'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProductCard from '@/components/ProductCard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PRODUCT_TYPES = [
  { label: 'All Types', value: '' },
  { label: 'T-Shirts', value: 't-shirt' },
  { label: 'Hoodies', value: 'hoodie' },
  { label: 'Stickers', value: 'sticker' },
  { label: 'Mugs', value: 'mug' },
  { label: 'Phone Cases', value: 'phone-case' },
  { label: 'Wall Art', value: 'wall-art' },
  { label: 'Tote Bags', value: 'tote-bag' },
  { label: 'Posters', value: 'poster' },
];

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Most Popular', value: 'popular' },
  { label: 'Price: Low to High', value: 'price-low' },
  { label: 'Price: High to Low', value: 'price-high' },
];

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="container-page py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-surface-200 rounded w-1/3 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-square bg-surface-200 rounded-xl mb-2" />
                <div className="h-4 bg-surface-200 rounded w-3/4 mb-1" />
                <div className="h-3 bg-surface-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const productType = searchParams.get('type') || '';
  const sort = searchParams.get('sort') || 'newest';
  const page = parseInt(searchParams.get('page') || '1');

  const buildUrl = useCallback((overrides = {}) => {
    const params = new URLSearchParams();
    const q = overrides.q !== undefined ? overrides.q : query;
    const cat = overrides.category !== undefined ? overrides.category : category;
    const type = overrides.type !== undefined ? overrides.type : productType;
    const s = overrides.sort !== undefined ? overrides.sort : sort;
    const p = overrides.page !== undefined ? overrides.page : 1;
    if (q) params.set('q', q);
    if (cat) params.set('category', cat);
    if (type) params.set('type', type);
    if (s && s !== 'newest') params.set('sort', s);
    if (p > 1) params.set('page', p);
    return `/search?${params.toString()}`;
  }, [query, category, productType, sort]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/categories`);
        if (res.ok) {
          const json = await res.json();
          setCategories(json.data || []);
        }
      } catch { /* ignore */ }
    }
    loadCategories();
  }, []);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set('search', query);
        if (category) params.set('category', category);
        if (productType) params.set('productType', productType);
        params.set('sort', sort);
        params.set('page', page);
        params.set('limit', 20);

        const res = await fetch(`${API_BASE}/api/v1/products?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setProducts(json.data || []);
          setMeta(json.meta || { total: 0, page: 1, totalPages: 1 });
        }
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [query, category, productType, sort, page]);

  return (
    <div className="container-page py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-surface-900">
          {query ? `Results for "${query}"` : 'Explore All Designs'}
        </h1>
        {!loading && (
          <p className="text-surface-500 mt-1">{meta.total} designs found</p>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters sidebar */}
        <aside className="lg:w-56 shrink-0">
          <div className="space-y-6">
            {/* Search input */}
            <div>
              <label className="text-sm font-semibold text-surface-700 mb-2 block">Search</label>
              <input
                type="text"
                defaultValue={query}
                placeholder="Search designs..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    router.push(buildUrl({ q: e.target.value, page: 1 }));
                  }
                }}
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Category filter */}
            <div>
              <label className="text-sm font-semibold text-surface-700 mb-2 block">Category</label>
              <select
                value={category}
                onChange={(e) => router.push(buildUrl({ category: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Product type filter */}
            <div>
              <label className="text-sm font-semibold text-surface-700 mb-2 block">Product Type</label>
              <div className="space-y-1">
                {PRODUCT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => router.push(buildUrl({ type: type.value, page: 1 }))}
                    className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors
                      ${productType === type.value
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-surface-600 hover:bg-surface-50'
                      }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="text-sm font-semibold text-surface-700 mb-2 block">Sort By</label>
              <select
                value={sort}
                onChange={(e) => router.push(buildUrl({ sort: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        {/* Results grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 md:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-surface-200 rounded-xl mb-2" />
                  <div className="h-4 bg-surface-200 rounded w-3/4 mb-1" />
                  <div className="h-3 bg-surface-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 md:gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  {page > 1 && (
                    <button
                      onClick={() => router.push(buildUrl({ page: page - 1 }))}
                      className="px-4 py-2 rounded-lg border border-surface-200 text-sm font-medium
                                 text-surface-600 hover:bg-surface-50 transition-colors"
                    >
                      Previous
                    </button>
                  )}
                  <span className="text-sm text-surface-500 px-4">
                    Page {meta.page} of {meta.totalPages}
                  </span>
                  {page < meta.totalPages && (
                    <button
                      onClick={() => router.push(buildUrl({ page: page + 1 }))}
                      className="px-4 py-2 rounded-lg border border-surface-200 text-sm font-medium
                                 text-surface-600 hover:bg-surface-50 transition-colors"
                    >
                      Next
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🔍</div>
              <h2 className="text-xl font-bold text-surface-900 mb-2">No designs found</h2>
              <p className="text-surface-500">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
