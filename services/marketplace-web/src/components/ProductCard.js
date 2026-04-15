'use client';

import Link from 'next/link';
import { getProductImage } from '@/lib/productImages';

const TYPE_LABELS = {
  't-shirt': 'T-Shirt',
  'hoodie': 'Hoodie',
  'sticker': 'Sticker',
  'mug': 'Mug',
  'phone-case': 'Phone Case',
  'wall-art': 'Wall Art',
  'poster': 'Poster',
  'tote-bag': 'Tote Bag',
};

export default function ProductCard({ product }) {
  const { slug, title, price, productType } = product;
  const displayArtist = product.artistName || product.artist?.name;
  const imageUrl = getProductImage(product);
  const typeLabel = TYPE_LABELS[productType] || productType;

  return (
    <Link href={`/product/${slug}`} className="group block">
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300">
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
          {typeLabel && (
            <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full shadow-sm">
              {typeLabel}
            </span>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 line-clamp-1 text-sm">
            {title}
          </h3>
          {displayArtist && (
            <p className="text-xs text-gray-400 mt-1">by {displayArtist}</p>
          )}
          <p className="text-base font-bold text-gray-900 mt-2">
            ${typeof price === 'number' ? price.toFixed(2) : price}
          </p>
        </div>
      </div>
    </Link>
  );
}
