const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireLogin } = require('../middleware/auth');

/**
 * POST /api/sell-request
 * Allows a client to submit a book for sale. Admin must approve before it appears in public list.
 */
router.post('/sell-request', requireLogin, async (req, res) => {
    const { bookName, price, phoneNumber } = req.body;
    const user = req.session.user; // seller_id, seller_name from session

    if (!bookName || !price || !phoneNumber) {
        return res.status(400).json({ error: 'All fields (Book Name, Price, Phone) are required' });
    }

    try {
        await db.run(
            'INSERT INTO sell_requests (seller_id, seller_name, seller_phone, book_name, price, status) VALUES (?, ?, ?, ?, ?, ?)',
            [user.id, user.name, phoneNumber, bookName, price, 'pending']
        );
        res.json({ message: 'Sale request sent! Waiting for admin approval.' });
    } catch (err) {
        console.error('Sale Request Error:', err);
        res.status(500).json({ error: 'Failed to process sale request' });
    }
});

/**
 * GET /api/my-listings
 * Returns books submitted by the current user (both pending and approved)
 */
router.get('/my-listings', requireLogin, async (req, res) => {
    const userId = req.session.user.id;
    try {
        const pending = await db.all('SELECT *, "pending" as source FROM sell_requests WHERE seller_id = ?', [userId]);
        const approved = await db.all('SELECT *, "marketplace" as source FROM books_for_sale WHERE seller_id = ?', [userId]);
        res.json([...pending, ...approved]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch your listings' });
    }
});

/**
 * DELETE /api/my-listings/:id/:source
 * Allows a user to delete their own listing (from either pending or approved)
 */
router.delete('/my-listings/:id/:source', requireLogin, async (req, res) => {
    const userId = req.session.user.id;
    const { id, source } = req.params;
    
    try {
        const table = source === 'pending' ? 'sell_requests' : 'books_for_sale';
        
        // Verify ownership
        const listing = await db.get(`SELECT * FROM ${table} WHERE id = ? AND seller_id = ?`, [id, userId]);
        if (!listing) return res.status(403).json({ error: 'Unauthorized or listing not found' });
        
        await db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
        res.json({ message: 'Listing removed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Deletion failed' });
    }
});

module.exports = router;
