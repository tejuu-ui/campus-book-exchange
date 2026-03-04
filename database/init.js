const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

const SALT_ROUNDS = 10;

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

const runQuery = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, (err) => err ? reject(err) : resolve());
});

const getQuery = (query, params = []) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
});

async function initialize() {
    console.log('--- Central Database Initialization Started ---');
    try {
        // 1. Users Table
        await runQuery(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password_hash TEXT,
            role TEXT CHECK(role IN ('client','admin')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. Books Table
        await runQuery(`CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            price REAL,
            stock INTEGER DEFAULT 0
        )`);

        // 3. Orders Table
        await runQuery(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            student_name TEXT,
            phone_number TEXT,
            status TEXT DEFAULT 'processing',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // 4. Order Items Table
        await runQuery(`CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            book_id INTEGER,
            quantity INTEGER DEFAULT 1,
            FOREIGN KEY(order_id) REFERENCES orders(id),
            FOREIGN KEY(book_id) REFERENCES books(id)
        )`);

        // 5. Sell Requests Table
        await runQuery(`CREATE TABLE IF NOT EXISTS sell_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id INTEGER,
            seller_name TEXT,
            seller_phone TEXT,
            book_name TEXT,
            price INTEGER,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(seller_id) REFERENCES users(id)
        )`);

        // 6. Books for Sale Table (Approved Marketplace)
        await runQuery(`CREATE TABLE IF NOT EXISTS books_for_sale (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id INTEGER,
            book_name TEXT,
            price INTEGER,
            seller_phone TEXT,
            seller_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(seller_id) REFERENCES users(id)
        )`);

        console.log('✅ Tables localized in project root.');

        // 7. Seed Admin
        const admin = await getQuery('SELECT id FROM users WHERE email = ?', ['admin@demo.com']);
        if (!admin) {
            const hash = await bcrypt.hash('1234', SALT_ROUNDS);
            await runQuery(
                'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                ['System Admin', 'admin@demo.com', hash, 'admin']
            );
            console.log('👤 Admin user initialized: admin@demo.com / 1234');
        }

        // 6. Seed Books
        const bookCountRow = await getQuery('SELECT COUNT(*) AS count FROM books');
        if (bookCountRow.count === 0) {
            for (const book of INITIAL_BOOKS) {
                await runQuery('INSERT INTO books (title, price, stock) VALUES (?, ?, ?)', [book.title, book.price, book.stock]);
            }
            console.log(`📚 Seeded ${INITIAL_BOOKS.length} books into inventory.`);
        }

        console.log('--- Initialization Successful ---');
    } catch (err) {
        console.error('❌ Initialization failed:', err);
    } finally {
        db.close();
    }
}

initialize();
