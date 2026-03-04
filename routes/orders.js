const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.post('/', async (req, res) => {
    const { studentName, phoneNumber, items } = req.body;
    const userId = req.session.userId || null;

    if (!items?.length) {
        return res.status(400).json({ error: 'Cart is empty' });
    }
    
    if (!studentName || !phoneNumber) {
        return res.status(400).json({ error: 'Student name and phone number are required' });
    }

    try {
        // Step 1: Pre-check stock for all items
        for (const item of items) {
            // Check bookstore inventory
            const storeBook = await db.get('SELECT id, stock, title FROM books WHERE title = ?', [item.name]);
            if (storeBook && storeBook.stock <= 0) {
                return res.status(400).json({ error: `Sorry, "${storeBook.title}" is out of stock!` });
            }
            
            // Check marketplace (P2P) inventory
            const marketBook = await db.get('SELECT id FROM books_for_sale WHERE book_name = ?', [item.name]);
            if (!storeBook && !marketBook) {
                return res.status(400).json({ error: `Book "${item.name}" no longer available.` });
            }
        }

        // Step 2: Create the order
        const orderResult = await db.run(
            'INSERT INTO orders (user_id, student_name, phone_number, status) VALUES (?, ?, ?, ?)',
            [userId, studentName, phoneNumber, 'processing']
        );
        
        const orderId = orderResult.lastID;

        // Step 3: Handle item decrementing/removal
        const itemInsertions = items.map(async (item) => {
            // Check if it's a store book
            const storeBook = await db.get('SELECT id FROM books WHERE title = ?', [item.name]);
            if (storeBook) {
                await db.run('INSERT INTO order_items (order_id, book_id, quantity) VALUES (?, ?, ?)', [orderId, storeBook.id, 1]);
                await db.run('UPDATE books SET stock = stock - 1 WHERE id = ?', [storeBook.id]);
                return;
            }

            // Check if it's a marketplace book
            const marketBook = await db.get('SELECT id FROM books_for_sale WHERE book_name = ?', [item.name]);
            if (marketBook) {
                // For marketplace items, we just mark as sold by removing from public list
                // (In a real app, we'd probably link it to another table, but for this simplified version we'll remove it)
                await db.run('DELETE FROM books_for_sale WHERE id = ?', [marketBook.id]);
            }
        });

        await Promise.all(itemInsertions);
        
        res.json({ message: 'Order placed successfully' });
    } catch (err) {
        console.error('Order processing error:', err);
        res.status(500).json({ error: 'Failed to process order' });
    }
});

module.exports = router;
