/**
 * Auth Middleware
 */
const requireLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    // For API requests, return JSON
    if (req.originalUrl.startsWith('/api')) {
        return res.status(401).json({ error: 'Unauthorized: Please log in' });
    }
    // For browser requests, redirect to client login (root)
    res.redirect('/');
};

const requireAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    if (req.originalUrl.startsWith('/api')) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    res.redirect('/admin');
};

module.exports = {
    requireLogin,
    requireAdmin
};
