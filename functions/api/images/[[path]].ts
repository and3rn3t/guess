import type { Env } from './_helpers'

/**
 * Serve character images from R2.
 * GET /api/images/:characterId/:size (thumb.webp or profile.webp)
 *
 * Includes cache headers for Cloudflare CDN (1 year, immutable).
 */
export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path
  if (!path) {
    return new Response('Not Found', { status: 404 })
  }

  // Validate path shape: {characterId}/{size}.webp
  const match = path.match(/^([\w-]+)\/(thumb|profile)\.webp$/)
  if (!match) {
    return new Response('Not Found', { status: 404 })
  }

  const key = `characters/${path}`
  const object = await env.GUESS_IMAGES.get(key)

  if (!object) {
    return new Response('Not Found', { status: 404 })
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': object.httpEtag,
    },
  })
}
