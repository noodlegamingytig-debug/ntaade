import { useState } from 'react'
import { resolveImageUrl } from '../../lib/imageUrl'

export function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0)

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-brand-gray-100 text-sm text-brand-gray-400">
        No photos yet
      </div>
    )
  }

  return (
    <div>
      <div className="aspect-square w-full overflow-hidden rounded-lg bg-brand-gray-100">
        <img
          src={resolveImageUrl(images[active])}
          alt={alt}
          className="h-full w-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActive(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 ${
                i === active ? 'border-brand-red' : 'border-transparent'
              }`}
            >
              <img src={resolveImageUrl(src)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
