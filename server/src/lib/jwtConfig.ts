/**
 * Shared JWT secret config.
 * Throws on import if JWT_SECRET is not set — fail fast at startup, not at first request.
 */

const JWT_SECRET_STR = process.env.JWT_SECRET;

if (!JWT_SECRET_STR) {
    throw new Error('JWT_SECRET environment variable is not set. Refusing to start.');
}

export const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STR);
