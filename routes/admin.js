const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

/**
 * GET /api/admin/users
 * Returns list of all users and high-level stats
 */
router.get('/users', async (req, res) => {
    try {
        const users = await db.all('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
        
        // Calculate stats
        const stats = {
            total: users.length,
            clients: users.filter(u => u.role === 'client').length,
            admins: users.filter(u => u.role === 'admin').length
        };

        res.json({ stats, users });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', async (req, res) => {
    try {
        const result = await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

/**
 * GET /api/admin/orders
 * Returns list of all orders with items
 */
router.get('/orders', async (req, res) => {
    try {
        const orders = await db.all('SELECT * FROM orders ORDER BY created_at DESC');
        // Join with items (simplified for now)
        for (let order of orders) {
            order.items = await db.all(`
                SELECT b.title 
                FROM order_items oi 
                JOIN books b ON oi.book_id = b.id 
                WHERE oi.order_id = ?`, [order.id]);
        }
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

/**
 * PATCH /api/admin/orders/:id/status
 */
router.patch('/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Status updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

/**
 * GET /api/admin/sell-requests
 */
router.get('/sell-requests', async (req, res) => {
    try {
        const requests = await db.all('SELECT * FROM sell_requests ORDER BY created_at DESC');
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch sell requests' });
    }
});

/**
 * PUT /api/admin/sell-requests/:id/approve
 */
router.put('/sell-requests/:id/approve', async (req, res) => {
    try {
        const request = await db.get('SELECT * FROM sell_requests WHERE id = ?', [req.params.id]);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        
        // 1. Update status
        await db.run('UPDATE sell_requests SET status = ? WHERE id = ?', ['approved', req.params.id]);
        
        // 2. Move to marketplace
        await db.run(
            'INSERT INTO books_for_sale (seller_id, book_name, price, seller_phone, seller_name) VALUES (?, ?, ?, ?, ?)',
            [request.seller_id, request.book_name, request.price, request.seller_phone, request.seller_name]
        );
        
        res.json({ message: 'Request approved and moved to marketplace' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Approval failed' });
    }
});

/**
 * PUT /api/admin/sell-requests/:id/reject
 */
router.put('/sell-requests/:id/reject', async (req, res) => {
    try {
        await db.run('UPDATE sell_requests SET status = ? WHERE id = ?', ['rejected', req.params.id]);
        res.json({ message: 'Request rejected' });
    } catch (err) {
        res.status(500).json({ error: 'Rejection failed' });
    }
});

module.exports = router;

