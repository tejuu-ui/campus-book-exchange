const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');

// Client Signup
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'All fields are required' });

    try {
        const hash = await bcrypt.hash(password, 10);
        await db.run(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, email, hash, 'client']
        );
        res.json({ message: 'Account created successfully' });
    } catch (err) {
        res.status(400).json({ error: 'Email already exists' });
    }
});

// Client Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE email = ? AND role = ?', [email, 'client']);
        if (!user) {
            console.warn(`Login attempt failed: User not found (${email})`);
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        if (!user.password_hash) {
            console.error(`Database Error: user ${email} has no password_hash`);
            return res.status(500).json({ error: 'Database integrity error' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            console.warn(`Login attempt failed: Wrong password (${email})`);
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        req.session.user = { id: user.id, email: user.email, role: user.role, name: user.name };
        res.json({ message: 'Login success', user: req.session.user });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin Login
router.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE email = ? AND role = ?', [email, 'admin']);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(400).json({ error: 'Invalid admin credentials' });
        }

        req.session.user = { id: user.id, email: user.email, role: user.role, name: user.name };
        res.json({ message: 'Admin login success', user: req.session.user });
    } catch (err) {
        console.error('Admin Login Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

// GET /api/me
router.get('/me', (req, res) => {
    if (req.session.user) return res.json(req.session.user);
    res.status(401).json({ error: 'Not authenticated' });
});

module.exports = router;
