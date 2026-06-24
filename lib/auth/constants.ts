// Tiny dependency-free module so Edge runtime (middleware) can import the
// session cookie name without dragging Node crypto / mock stores along.

export const SESSION_COOKIE = "toroai_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
