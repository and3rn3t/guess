import { type Env } from './_helpers'

/**
 * @deprecated Sunset 2027-01-01. Use /api/v2/stats for aggregate statistics.
 */
const gone = (): Response =>
  new Response(
    JSON.stringify({ error: 'This endpoint has been removed. Use /api/v2/stats instead.' }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        Deprecation: 'true',
        Sunset: 'Wed, 01 Jan 2027 00:00:00 GMT',
      },
    },
  )

export const onRequestGet: PagesFunction<Env> = () => gone()
export const onRequestPost: PagesFunction<Env> = () => gone()
