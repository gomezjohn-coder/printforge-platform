const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    next: { revalidate: 60 },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message || `API error: ${res.status}`);
  }

  return res.json();
}

// ── Products ──────────────────────────────────────────────

export async function getProducts(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.category) query.set('category', params.category);
  if (params.productType) query.set('productType', params.productType);
  if (params.artist) query.set('artist', params.artist);
  if (params.sort) query.set('sort', params.sort);
  if (params.search) query.set('search', params.search);
  const qs = query.toString();
  return fetchAPI(`/api/v1/products${qs ? `?${qs}` : ''}`);
}

export async function getFeaturedProducts() {
  return fetchAPI('/api/v1/products/featured');
}

export async function getProduct(slug) {
  return fetchAPI(`/api/v1/products/${slug}`);
}

// ── Artists ───────────────────────────────────────────────

export async function getArtists(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.sort) query.set('sort', params.sort);
  const qs = query.toString();
  return fetchAPI(`/api/v1/artists${qs ? `?${qs}` : ''}`);
}

export async function getArtist(slug) {
  return fetchAPI(`/api/v1/artists/${slug}`);
}

// ── Categories ────────────────────────────────────────────

export async function getCategories() {
  return fetchAPI('/api/v1/categories');
}

export async function getCategory(slug, params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.sort) query.set('sort', params.sort);
  const qs = query.toString();
  return fetchAPI(`/api/v1/categories/${slug}${qs ? `?${qs}` : ''}`);
}

// ── Search ────────────────────────────────────────────────

export async function search(query, params = {}) {
  return getProducts({ ...params, search: query });
}
