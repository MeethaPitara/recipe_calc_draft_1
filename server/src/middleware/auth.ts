/**
 * JWT Authentication Middleware
 * Verifies the Bearer token and attaches user info to req.
 */

import { jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';
import { JWT_SECRET } from '../lib/jwtConfig.js';

export interface AuthUser {
    id: string;
    email: string;
    role?: string;
}

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

/**
 * Middleware: verifies JWT and sets req.user.
 * Returns 401 if token is missing or invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Authorization required. Send Bearer <token> header.' });
            return;
        }

        const token = authHeader.split(' ')[1];
        const { payload } = await jwtVerify(token, JWT_SECRET);

        if (!payload.sub || !payload.email) {
            res.status(401).json({ error: 'Invalid token payload.' });
            return;
        }

        req.user = {
            id: payload.sub,
            email: payload.email as string,
            role: payload.role as string | undefined,
        };

        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

/**
 * Optional auth: sets req.user if valid token, but doesn't fail.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { payload } = await jwtVerify(token, JWT_SECRET);
            if (payload.sub && payload.email) {
                req.user = {
                    id: payload.sub,
                    email: payload.email as string,
                    role: payload.role as string | undefined,
                };
            }
        }
    } catch {
        // Silently ignore invalid tokens for optional auth
    }
    next();
}
