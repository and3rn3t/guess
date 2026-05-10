export const MOBILE_CHARACTER_CATEGORIES = [
  'video-games',
  'movies',
  'anime',
  'comics',
  'books',
  'cartoons',
  'tv-shows',
  'pop-culture'
] as const;

export type MobileCharacterCategory = (typeof MOBILE_CHARACTER_CATEGORIES)[number];

export const MOBILE_CATEGORY_LABELS: Record<MobileCharacterCategory, string> = {
  'video-games': 'Video Games',
  movies: 'Movies',
  anime: 'Anime',
  comics: 'Comics',
  books: 'Books',
  cartoons: 'Cartoons',
  'tv-shows': 'TV Shows',
  'pop-culture': 'Pop Culture'
};
