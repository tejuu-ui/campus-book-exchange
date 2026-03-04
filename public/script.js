/* === API COMMUNICATION === */
async function apiPost(url, payload) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        return { ok: false, data: { error: 'Network error' } };
    }
}

async function apiGet(url) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        return { ok: false, data: { error: 'Network error' } };
    }
}

/* === AUTHENTICATION CONTROLLERS === */
const Auth = {
    // Client Signup
    async signupUser(name, email, password) {
        const { ok, data } = await apiPost('/api/signup', { name, email, password });
        const msg = document.getElementById("signupMessage");
        if (ok) {
            msg.style.color = '#10b981';
            msg.innerText = "Signup success! Login now.";
            msg.style.display = "block";
        } else {
            msg.innerText = data.error;
            msg.style.display = "block";
        }
    },

    // Client Login
    async loginUser(email, password) {
        const { ok, data } = await apiPost('/api/login', { email, password });
        if (ok) {
            window.location.href = "/client/dashboard";
        } else {
            const msg = document.getElementById("loginMessage");
            msg.innerText = data.error;
            msg.style.display = "block";
        }
    },

    // Admin Login
    async adminLogin(email, password) {
        const { ok, data } = await apiPost('/api/admin/login', { email, password });
        if (ok) {
            window.location.href = "/admin/dashboard";
        } else {
            const msg = document.getElementById("adminLoginMessage");
            msg.innerText = data.error;
            msg.style.display = "block";
        }
    },

    // Global Logout
    async logoutUser() {
        await apiPost('/api/logout', {});
        window.location.href = window.location.pathname.startsWith('/admin') ? '/admin' : '/';
    }
};

/* === CART MANAGEMENT === */
const Cart = {
    getItems: () => JSON.parse(localStorage.getItem("cart")) || [],
    save: (items) => localStorage.setItem("cart", JSON.stringify(items)),
    clear: () => localStorage.removeItem("cart"),
    
    add(name, price) {
        const items = this.getItems();
        items.push({ name, price });
        this.save(items);
        alert(`${name} added to cart!`);
    },
    
    remove(index) {
        const items = this.getItems();
        items.splice(index, 1);
        this.save(items);
        location.reload();
    },
    
    calculateTotal: () => Cart.getItems().reduce((total, item) => total + item.price, 0)
};

/* === STORE & CATALOGUE === */
const Store = {
    async loadBooks() {
        const { ok, data } = await apiGet('/api/books');
        const container = document.getElementById("book-list");
        if (!container) return;

        if (ok) {
            Renderer.renderBooks(data);
        } else {
            container.innerHTML = `<p style="color: #ef4444;">Failed to load books: ${data.error}</p>`;
        }
    }
};

/* === UI RENDERERS === */
const Renderer = {
    renderBooks(books) {
        const container = document.getElementById("book-list");
        if (!container) return;
        
        if (books.length === 0) {
            container.innerHTML = '<p>No books available yet.</p>';
            return;
        }

        container.innerHTML = books.map(book => `
            <div class="card" data-name="${book.title}">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                <h3>${book.title}</h3>
                <p style="font-weight: 700; color: #2d3748; font-size: 1.25rem;">₹${book.price}</p>
                <p style="font-size: 0.875rem; color: #718096; margin-bottom: 1rem;">
                    ${book.type === 'marketplace' ? 'Type: Peer Marketplace' : `Stock: ${book.stock}`}
                </p>
                <button onclick="Cart.add('${book.title}', ${book.price})" style="width: 100%; padding: 10px; border-radius: 8px;">Add to Cart</button>
            </div>
        `).join('');
    },

    renderCart() {
        const container = document.getElementById("cart-items");
        if (!container) return;

        const items = Cart.getItems();
        if (items.length === 0) {
            container.innerHTML = '<p>Your cart is empty.</p>';
            document.getElementById("total").innerText = "Total: ₹0";
            return;
        }

        container.innerHTML = items.map((item, index) => `
            <div class="card" style="width: 100%; max-width: 600px; display: flex; justify-content: space-between; align-items: center; text-align: left; padding: 1rem;">
                <div>
                    <h3 style="margin: 0;">${item.name}</h3>
                    <p style="margin: 5px 0 0; color: #718096;">Price: ₹${item.price}</p>
                </div>
                <button onclick="Cart.remove(${index})" style="background: #fee2e2; color: #ef4444; border: none; padding: 8px 12px; border-radius: 6px; font-weight: 600;">Remove</button>
            </div>
        `).join('');

        document.getElementById("total").innerText = `Total: ₹${Cart.calculateTotal()}`;
    }
};

/* === GLOBAL SEARCH === */
function searchBooks() {
    const input = document.getElementById("search").value.toLowerCase();
    const cards = document.querySelectorAll("#book-list .card");
    cards.forEach(card => {
        const name = card.getAttribute("data-name").toLowerCase();
        card.style.display = name.includes(input) ? "block" : "none";
    });
}

/* === ADMIN MANAGEMENT === */
async function loadUsersForAdmin() {
    const res = await fetch('/api/admin/users');
    if (!res.ok) {
        if (res.status === 403 || res.status === 401) window.location.href = '/admin';
        return;
    }
    
    const { stats, users } = await res.json();
    
    // Update Stats
    document.getElementById('stat-total').innerText = stats.total;
    document.getElementById('stat-clients').innerText = stats.clients;
    document.getElementById('stat-admins').innerText = stats.admins;

    // Render Table
    const tbody = document.getElementById('user-table-body');
    if (!tbody) return;

    tbody.innerHTML = users.map(user => `
        <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 1rem;">${user.id}</td>
            <td style="padding: 1rem; font-weight: 600;">${user.name}</td>
            <td style="padding: 1rem;">${user.email}</td>
            <td style="padding: 1rem;">
                <span style="background: ${user.role === 'admin' ? '#fee2e2' : '#dcfce7'}; color: ${user.role === 'admin' ? '#ef4444' : '#10b981'}; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">
                    ${user.role.toUpperCase()}
                </span>
            </td>
            <td style="padding: 1rem; color: #718096; font-size: 0.875rem;">${new Date(user.created_at).toLocaleDateString()}</td>
            <td style="padding: 1rem;">
                ${user.role !== 'admin' ? `<button onclick="deleteUser(${user.id})" style="background: none; color: #ef4444; border: none; cursor: pointer; font-weight: 600;">Delete</button>` : ''}
            </td>
        </tr>
    `).join('');
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) loadUsersForAdmin();
    else alert('Failed to delete user');
}

/* === ORDER DISPATCH MANAGEMENT === */
async function loadOrdersForDispatch() {
    const res = await fetch('/api/admin/orders');
    if (!res.ok) return;

    const orders = await res.json();
    const container = document.getElementById('dispatch-list');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 2rem; background: white; border-radius: 12px;">No orders found in queue.</p>';
        return;
    }

    container.innerHTML = orders.map(order => `
        <div class="stat-card" style="margin-bottom: 1.5rem; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <div>
                    <h3 style="margin: 0; color: #2d3748;">Order #${order.id}</h3>
                    <p style="margin: 5px 0; font-weight: 600;">👤 ${order.student_name}</p>
                    <p style="margin: 2px 0; font-size: 0.875rem; color: #718096;">📞 ${order.phone_number}</p>
                </div>
                <span style="background: ${getStatusColor(order.status)}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
                    ${order.status.toUpperCase()}
                </span>
            </div>
            
            <div style="border-top: 1px solid #edf2f7; border-bottom: 1px solid #edf2f7; padding: 1rem 0; margin: 1rem 0;">
                <p style="font-size: 0.875rem; color: #4a5568; margin-bottom: 0.5rem; font-weight: 600;">Books ordered:</p>
                <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.9rem;">
                    ${order.items.map(item => `<li>${item.title}</li>`).join('')}
                </ul>
            </div>

            <div style="display: flex; gap: 10px;">
                <button onclick="updateOrderStatus(${order.id}, 'completed')" style="background: #10b981; font-size: 0.8rem;">Mark Completed</button>
                <button onclick="updateOrderStatus(${order.id}, 'cancelled')" style="background: #ef4444; font-size: 0.8rem;">Cancel Order</button>
            </div>
        </div>
    `).join('');
}

function getStatusColor(status) {
    switch(status) {
        case 'completed': return '#10b981';
        case 'cancelled': return '#ef4444';
        default: return '#667eea';
    }
}

async function updateOrderStatus(id, status) {
    const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (res.ok) loadOrdersForDispatch();
    else alert('Failed to update order status');
}

/* === MARKETPLACE & SELL REQUESTS === */
const Marketplace = {
    // Client Side: Submit Request
    async submitSellRequest() {
        const payload = {
            bookName: document.getElementById('sell-book-name').value,
            price: parseInt(document.getElementById('sell-book-price').value),
            phoneNumber: document.getElementById('sell-phone').value
        };

        const { ok, data } = await apiPost('/api/sell-request', payload);
        const msg = document.getElementById('sell-message');
        if (ok) {
            msg.style.color = '#10b981';
            msg.innerText = data.message;
            setTimeout(() => location.reload(), 1500);
        } else {
            msg.style.color = '#ef4444';
            msg.innerText = data.error;
        }
    },

    // Admin Side: Load All Requests
    async loadSellRequestsForAdmin() {
        const res = await fetch('/api/admin/sell-requests');
        if (!res.ok) return;

        const requests = await res.json();
        const tbody = document.getElementById('sell-requests-body');
        if (!tbody) return;

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">No pending requests found.</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(req => `
            <tr style="border-bottom: 1px solid #edf2f7;">
                <td style="padding: 1rem;">${req.id}</td>
                <td style="padding: 1rem; font-weight: 600;">${req.seller_name}</td>
                <td style="padding: 1rem;">${req.seller_phone}</td>
                <td style="padding: 1rem;">${req.book_name}</td>
                <td style="padding: 1rem; font-weight:600;">₹${req.price}</td>
                <td style="padding: 1rem;">
                    <span style="background: ${getStatusColor(req.status)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">
                        ${req.status.toUpperCase()}
                    </span>
                </td>
                <td style="padding: 1rem; font-size: 0.8rem;">${new Date(req.created_at).toLocaleDateString()}</td>
                <td style="padding: 1rem; display: flex; gap: 8px;">
                    ${req.status === 'pending' ? `
                        <button onclick="approveSellRequest(${req.id})" style="background: #10b981; font-size: 0.7rem; padding: 4px 8px;">Approve</button>
                        <button onclick="rejectSellRequest(${req.id})" style="background: #ef4444; font-size: 0.7rem; padding: 4px 8px;">Reject</button>
                    ` : '<span style="color:#718096; font-size: 0.8rem;">Processed</span>'}
                </td>
            </tr>
        `).join('');
    },

    // Admin Action: Approve
    async approveSellRequest(id) {
        if (!confirm('Approve this book for the marketplace?')) return;
        const res = await fetch(`/api/admin/sell-requests/${id}/approve`, { method: 'PUT' });
        if (res.ok) this.loadSellRequestsForAdmin();
        else alert('Approval failed');
    },

    // Admin Action: Reject
    async rejectSellRequest(id) {
        if (!confirm('Reject this sale request?')) return;
        const res = await fetch(`/api/admin/sell-requests/${id}/reject`, { method: 'PUT' });
        if (res.ok) this.loadSellRequestsForAdmin();
        else alert('Rejection failed');
    },

    // Public Side: Load Market Books
    async loadMarketplaceBooks() {
        const { ok, data } = await apiGet('/api/books');
        const container = document.getElementById("marketplace-list");
        if (!container) return;

        if (ok) {
            // Filter to only show marketplace (student) books on this specific page
            const marketBooks = data.filter(b => b.type === 'marketplace');
            
            if (marketBooks.length === 0) {
                container.innerHTML = '<div style="width:100%; text-align:center; padding: 2rem;">No approved student books for sale yet.</div>';
                return;
            }
            container.innerHTML = marketBooks.map(book => `
                <div class="card" style="text-align: left; padding: 1.5rem; width: 280px;">
                    <span style="background: #edf2f7; padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700;">PUBLIC MARKET</span>
                    <h3 style="margin: 10px 0 5px;">${book.title}</h3>
                    <p style="font-size: 1.5rem; font-weight: 800; color: #2d3748; margin-bottom: 10px;">₹${book.price}</p>
                    
                    <div style="border-top: 1px solid #edf2f7; padding-top: 10px; margin-top: 10px;">
                        <p style="margin: 0; font-size: 0.8rem; color: #718096;">Seller: <b>${book.seller_name || 'Community Member'}</b></p>
                        <p style="margin: 5px 0 0; font-size: 0.8rem; color: #667eea; cursor: pointer;">📞 ${book.seller_phone || 'Contact for details'}</p>
                    </div>
                </div>
            `).join('');
        }
    },

    // Client Side: Load listings owned by me
    async loadMyListings() {
        const tbody = document.getElementById('my-listings-body');
        if (!tbody) return;

        const { ok, data } = await apiGet('/api/my-listings');
        if (!ok) return;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: #718096;">You haven\'t listed any books yet.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(item => {
            const name = item.book_name || item.title;
            const statusLabel = item.source === 'pending' ? 'PENDING APPROVAL' : 'LIVE ON MARKET';
            const statusColor = item.source === 'pending' ? '#ecc94b' : '#10b981';
            
            return `
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 1rem; font-weight: 600;">${name}</td>
                    <td style="padding: 1rem;">₹${item.price}</td>
                    <td style="padding: 1rem;">
                        <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">
                            ${statusLabel}
                        </span>
                    </td>
                    <td style="padding: 1rem;">
                        <button onclick="deleteMyListing(${item.id}, '${item.source}')" style="background: #fee2e2; color: #ef4444; font-size: 0.75rem; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // Client Side: Delete my own listing
    async deleteMyListing(id, source) {
        if (!confirm('Are you sure you want to remove this listing?')) return;
        const res = await fetch(`/api/my-listings/${id}/${source}`, { method: 'DELETE' });
        if (res.ok) {
            this.loadMyListings();
            if (source === 'marketplace') Store.loadBooks(); // Refresh marketplace list too
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to delete listing');
        }
    }
};

/* === MODAL LOGIC === */
function toggleSellModal(show) {
    const modal = document.getElementById('sell-modal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
}

function toggleMyListingsModal(show) {
    const modal = document.getElementById('my-listings-modal');
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
        if (show) Marketplace.loadMyListings(); // Refresh when opening
    }
}

/* === INITIALIZATION === */
document.addEventListener('DOMContentLoaded', () => {
    // Page-specific loaders
    if (document.getElementById("book-list")) Store.loadBooks();
    if (document.getElementById("marketplace-list")) Marketplace.loadMarketplaceBooks();
    if (document.getElementById("cart-items")) Renderer.renderCart();
    if (document.getElementById("sell-requests-body")) Marketplace.loadSellRequestsForAdmin();
    if (document.getElementById("my-listings-body")) Marketplace.loadMyListings();

    // Form Event Listeners
    const clientLoginForm = document.getElementById('loginForm');
    if (clientLoginForm) {
        clientLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            Auth.loginUser(
                document.getElementById('login-email').value,
                document.getElementById('login-password').value
            );
        });
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            Auth.signupUser(
                document.getElementById('signup-name').value,
                document.getElementById('signup-email').value,
                document.getElementById('signup-password').value
            );
        });
    }

    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            Auth.adminLogin(
                document.getElementById('admin-email').value,
                document.getElementById('admin-password').value
            );
        });
    }

    // Checkout Form
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
        studentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                studentName: document.getElementById('studentName').value,
                phoneNumber: document.getElementById('phoneNumber').value,
                items: Cart.getItems()
            };

            const { ok, data } = await apiPost('/api/orders', payload);
            const msg = document.getElementById('message');
            if (ok) {
                Cart.clear();
                msg.style.color = '#10b981';
                msg.innerText = 'Order placed successfully! Redirecting...';
                setTimeout(() => window.location.href = '/client/dashboard', 2000);
            } else {
                msg.style.color = '#ef4444';
                msg.innerText = data.error || 'Failed to place order';
            }
        });
    }
});

// Export to window
Object.assign(window, {
    logoutUser: Auth.logoutUser,
    loadUsersForAdmin,
    deleteUser,
    loadOrdersForDispatch,
    updateOrderStatus,
    submitSellRequest: () => Marketplace.submitSellRequest(),
    approveSellRequest: (id) => Marketplace.approveSellRequest(id),
    rejectSellRequest: (id) => Marketplace.rejectSellRequest(id),
    deleteMyListing: (id, source) => Marketplace.deleteMyListing(id, source),
    toggleSellModal,
    toggleMyListingsModal,
    Cart,
    Store,
    searchBooks
});