const express = require('express');
const session = require('express-session');
const path = require('path');
const { requireLogin, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = 5000;

// Config
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'production_secret_key_8822',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/sellRequests')); // Clients can POST /api/sell-request
app.use('/api/admin', require('./routes/admin'));
app.use('/api/books', require('./routes/books'));
app.use('/api/orders', require('./routes/orders'));

// View Routing Logic
app.use(express.static(path.join(__dirname, 'public')));

// Marketplace
app.get('/books', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'books.html'));
});

// Client Routes
app.get('/client/dashboard', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client-dashboard.html'));
});

// Admin Routes
app.get('/admin', (req, res) => {
    // If already logged in as admin, go to dashboard
    if (req.session.user && req.session.user.role === 'admin') return res.redirect('/admin/dashboard');
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/dashboard', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Start
app.listen(PORT, () => {
    console.log(`🚀 Production Server: http://localhost:${PORT}`);
});
