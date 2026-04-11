const express = require('express');
const serverless = require('serverless-http');
const session = require('express-session');

const app = express();

// Config
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'campus_book_exchange_secret_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

// Auth middleware (inline to avoid path issues in serverless)
const requireLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Please log in' });
};

const requireAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
};

// ============ INLINE ROUTES (to avoid path resolution issues in serverless) ============

// --- In-Memory Database for Serverless ---
const bcrypt = require('bcryptjs');

// In-memory data store (resets on cold start, seeded with defaults)
let users = [];
let books = [];
let orders = [];
let orderItems = [];
let sellRequests = [];
let booksForSale = [];
let nextId = { users: 1, books: 1, orders: 1, orderItems: 1, sellRequests: 1, booksForSale: 1 };

const INITIAL_BOOKS = [
    { title: 'Java Programming', price: 350, stock: 10 },
    { title: 'Database Management System', price: 300, stock: 10 },
    { title: 'Web Development Basics', price: 250, stock: 10 },
    { title: 'Computer Graphics', price: 250, stock: 10 },
    { title: 'Data Structures in C', price: 280, stock: 10 },
    { title: 'Operating System Concepts', price: 400, stock: 10 },
    { title: 'Computer Networks', price: 320, stock: 10 },
    { title: 'Software Engineering', price: 270, stock: 10 },
    { title: 'Python Programming', price: 290, stock: 10 },
    { title: 'Artificial Intelligence Basics', price: 450, stock: 10 },
    { title: 'Cyber Security Fundamentals', price: 380, stock: 10 }
];

// Seed data on cold start
async function seedData() {
    if (users.length === 0) {
        const hash = await bcrypt.hash('1234', 10);
        users.push({
            id: nextId.users++,
            name: 'System Admin',
            email: 'admin@demo.com',
            password_hash: hash,
            role: 'admin',
            created_at: new Date().toISOString()
        });
    }
    if (books.length === 0) {
        for (const book of INITIAL_BOOKS) {
            books.push({
                id: nextId.books++,
                title: book.title,
                price: book.price,
                stock: book.stock
            });
        }
    }
}

// Run seed immediately
seedData();

// --- AUTH ROUTES ---
const authRouter = express.Router();

authRouter.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'All fields are required' });

    const existing = users.find(u => u.email === email);
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const user = {
            id: nextId.users++,
            name, email,
            password_hash: hash,
            role: 'client',
            created_at: new Date().toISOString()
        };
        users.push(user);
        res.json({ message: 'Account created successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create account' });
    }
});

authRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = users.find(u => u.email === email && u.role === 'client');
        if (!user) return res.status(400).json({ error: 'Invalid email or password' });
        if (!user.password_hash) return res.status(500).json({ error: 'Database integrity error' });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ error: 'Invalid email or password' });

        req.session.user = { id: user.id, email: user.email, role: user.role, name: user.name };
        res.json({ message: 'Login success', user: req.session.user });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

authRouter.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = users.find(u => u.email === email && u.role === 'admin');
        if (!user) return res.status(400).json({ error: 'Invalid admin credentials' });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ error: 'Invalid admin credentials' });

        req.session.user = { id: user.id, email: user.email, role: user.role, name: user.name };
        res.json({ message: 'Admin login success', user: req.session.user });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

authRouter.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

authRouter.get('/me', (req, res) => {
    if (req.session.user) return res.json(req.session.user);
    res.status(401).json({ error: 'Not authenticated' });
});

// --- BOOKS ROUTES ---
const booksRouter = express.Router();

booksRouter.get('/', async (req, res) => {
    try {
        const storeBooks = books.map(b => ({
            id: b.id, title: b.title, price: b.price, stock: b.stock,
            type: 'store', seller_name: null, seller_phone: null
        }));
        const marketBooks = booksForSale.map(b => ({
            id: b.id, title: b.book_name, price: b.price, stock: 1,
            type: 'marketplace', seller_name: b.seller_name, seller_phone: b.seller_phone
        }));
        res.json([...storeBooks, ...marketBooks]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch catalog' });
    }
});

// --- ORDERS ROUTES ---
const ordersRouter = express.Router();

ordersRouter.post('/', async (req, res) => {
    const { studentName, phoneNumber, items } = req.body;
    const userId = (req.session && req.session.user) ? req.session.user.id : null;

    if (!items || !items.length) return res.status(400).json({ error: 'Cart is empty' });
    if (!studentName || !phoneNumber) return res.status(400).json({ error: 'Student name and phone number are required' });

    try {
        for (const item of items) {
            const storeBook = books.find(b => b.title === item.name);
            if (storeBook && storeBook.stock <= 0) {
                return res.status(400).json({ error: `Sorry, "${storeBook.title}" is out of stock!` });
            }
            const marketBook = booksForSale.find(b => b.book_name === item.name);
            if (!storeBook && !marketBook) {
                return res.status(400).json({ error: `Book "${item.name}" no longer available.` });
            }
        }

        const order = {
            id: nextId.orders++,
            user_id: userId,
            student_name: studentName,
            phone_number: phoneNumber,
            status: 'processing',
            created_at: new Date().toISOString(),
            items: []
        };

        for (const item of items) {
            const storeBook = books.find(b => b.title === item.name);
            if (storeBook) {
                const oi = { id: nextId.orderItems++, order_id: order.id, book_id: storeBook.id, quantity: 1 };
                orderItems.push(oi);
                order.items.push({ title: storeBook.title });
                storeBook.stock -= 1;
            } else {
                const marketBook = booksForSale.find(b => b.book_name === item.name);
                if (marketBook) {
                    booksForSale = booksForSale.filter(b => b.id !== marketBook.id);
                }
            }
        }

        orders.push(order);
        res.json({ message: 'Order placed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process order' });
    }
});

// --- SELL REQUESTS ROUTES ---
const sellRequestsRouter = express.Router();

sellRequestsRouter.post('/sell-request', requireLogin, async (req, res) => {
    const { bookName, price, phoneNumber } = req.body;
    const user = req.session.user;

    if (!bookName || !price || !phoneNumber) {
        return res.status(400).json({ error: 'All fields (Book Name, Price, Phone) are required' });
    }

    try {
        sellRequests.push({
            id: nextId.sellRequests++,
            seller_id: user.id,
            seller_name: user.name,
            seller_phone: phoneNumber,
            book_name: bookName,
            price: price,
            status: 'pending',
            created_at: new Date().toISOString()
        });
        res.json({ message: 'Sale request sent! Waiting for admin approval.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process sale request' });
    }
});

sellRequestsRouter.get('/my-listings', requireLogin, async (req, res) => {
    const userId = req.session.user.id;
    try {
        const pending = sellRequests.filter(r => r.seller_id === userId).map(r => ({ ...r, source: 'pending' }));
        const approved = booksForSale.filter(b => b.seller_id === userId).map(b => ({ ...b, source: 'marketplace' }));
        res.json([...pending, ...approved]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch your listings' });
    }
});

sellRequestsRouter.delete('/my-listings/:id/:source', requireLogin, async (req, res) => {
    const userId = req.session.user.id;
    const { id, source } = req.params;
    const numId = parseInt(id);

    try {
        if (source === 'pending') {
            const idx = sellRequests.findIndex(r => r.id === numId && r.seller_id === userId);
            if (idx === -1) return res.status(403).json({ error: 'Unauthorized or listing not found' });
            sellRequests.splice(idx, 1);
        } else {
            const idx = booksForSale.findIndex(b => b.id === numId && b.seller_id === userId);
            if (idx === -1) return res.status(403).json({ error: 'Unauthorized or listing not found' });
            booksForSale.splice(idx, 1);
        }
        res.json({ message: 'Listing removed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Deletion failed' });
    }
});

// --- ADMIN ROUTES ---
const adminRouter = express.Router();
adminRouter.use(requireAdmin);

adminRouter.get('/users', async (req, res) => {
    try {
        const safeUsers = users.map(u => ({
            id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at
        }));
        const stats = {
            total: safeUsers.length,
            clients: safeUsers.filter(u => u.role === 'client').length,
            admins: safeUsers.filter(u => u.role === 'admin').length
        };
        res.json({ stats, users: safeUsers });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

adminRouter.delete('/users/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    users.splice(idx, 1);
    res.json({ message: 'User deleted successfully' });
});

adminRouter.get('/orders', async (req, res) => {
    try {
        const result = orders.map(order => {
            const items = orderItems
                .filter(oi => oi.order_id === order.id)
                .map(oi => {
                    const book = books.find(b => b.id === oi.book_id);
                    return { title: book ? book.title : 'Unknown Book' };
                });
            return { ...order, items };
        });
        res.json(result.reverse());
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

adminRouter.patch('/orders/:id/status', async (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const order = orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.status = status;
    res.json({ message: 'Status updated' });
});

adminRouter.get('/sell-requests', async (req, res) => {
    try {
        res.json([...sellRequests].reverse());
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch sell requests' });
    }
});

adminRouter.put('/sell-requests/:id/approve', async (req, res) => {
    const id = parseInt(req.params.id);
    const request = sellRequests.find(r => r.id === id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    request.status = 'approved';
    booksForSale.push({
        id: nextId.booksForSale++,
        seller_id: request.seller_id,
        book_name: request.book_name,
        price: request.price,
        seller_phone: request.seller_phone,
        seller_name: request.seller_name,
        created_at: new Date().toISOString()
    });

    res.json({ message: 'Request approved and moved to marketplace' });
});

adminRouter.put('/sell-requests/:id/reject', async (req, res) => {
    const id = parseInt(req.params.id);
    const request = sellRequests.find(r => r.id === id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    request.status = 'rejected';
    res.json({ message: 'Request rejected' });
});

// Mount routes
app.use('/api', authRouter);
app.use('/api', sellRequestsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/books', booksRouter);
app.use('/api/orders', ordersRouter);

// Export handler
module.exports.handler = serverless(app);
