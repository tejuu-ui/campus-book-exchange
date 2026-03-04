const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', async (req, res) => {
    try {
        // We combine the standard bookstore inventory AND the public marketplace approved listings
        // We alias columns to be consistent (title, price, stock)
        const sql = `
            SELECT id, title, price, stock, 'store' as type, NULL as seller_name, NULL as seller_phone
            FROM books
            UNION ALL
            SELECT id, book_name as title, price, 1 as stock, 'marketplace' as type, seller_name, seller_phone
            FROM books_for_sale
            ORDER BY type DESC, id DESC
        `;
        const books = await db.all(sql);
        res.json(books);
    } catch (err) {
        console.error('Books fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch catalog' });
    }
});

module.exports = router;
