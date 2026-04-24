import { useState } from 'react'
import { cn } from '@/lib/utils'

interface CharacterImageProps {
  src?: string | null
  name: string
  /** Rendered size in pixels (width and height). Defaults to 40. */
  size?: number
  className?: string
}

/**
 * Round character portrait with:
 * - Shimmer skeleton while loading
 * - Initial-letter avatar fallback when the image is missing or broken
 */
export function CharacterImage({ src, name, size = 40, className }: Readonly<CharacterImageProps>) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  const initial = name.trim().charAt(0).toUpperCase()

  const showImage = src && !errored
  const showFallback = !showImage
  const showSkeleton = showImage && !loaded

  return (
    <div
      className={cn('relative shrink-0 rounded-full overflow-hidden', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Shimmer skeleton while the image is loading */}
      {showSkeleton && (
        <div className="absolute inset-0 rounded-full bg-accent/10 animate-shimmer" />
      )}

      {/* Initial-letter avatar — shown when no image or on error */}
      {showFallback && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-primary/20 text-primary font-semibold select-none"
          style={{ fontSize: size * 0.4 }}
        >
          {initial}
        </div>
      )}

      {/* Actual image */}
      {showImage && (
        <img
          src={src}
          alt={name}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          loading="lazy"
        />
      )}
    </div>
  )
}
