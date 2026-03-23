/**
 * Auth middleware - verifies JWT from httpOnly cookie and attaches req.user.
 * Use on routes that require login. Returns 401 if token missing or invalid.
 */
import jwt from 'jsonwebtoken';

const accessSecret = process.env.JWT_ACCESS_SECRET;
if (!accessSecret) {
  console.warn('JWT_ACCESS_SECRET not set - auth will fail');
}

export function authMiddleware(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const decoded = jwt.verify(token, accessSecret);
    req.user = { id: decoded.userId, role: decoded.role, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional: require a specific role. Use after authMiddleware.
 * Example: router.get('/admin-only', authMiddleware, roleMiddleware('admin'), handler)
 */
export function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
