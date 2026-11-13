/** Paths on the ball API (relative to `environment.ballApiEndpoint`). */
export const BALL_API = {
  /** Searchable, filterable, sortable, paged list. */
  balls: 'balls',
  /** One ball in all its weights (or one weight with `weight`). */
  ball: (ballId: string) => `balls/${encodeURIComponent(ballId)}`,
  /** Balls with a similar expected reaction to the given ball. */
  similar: (ballId: string) => `balls/${encodeURIComponent(ballId)}/similar`,
  brands: 'brands',
  cores: 'cores',
  coverstocks: 'coverstocks',
} as const;

/** Page size for the balls list. */
export const BALL_PAGE_SIZE = 50;

/** Ids or names per lookup request (each can match up to five weights). */
export const BALL_LOOKUP_CHUNK = 40;
