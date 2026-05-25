const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON payloads
app.use(express.json());

// PostgreSQL Connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/menu_db'
});

// 1. GET: Fetch all menu items (Existing)
app.get('/api/menu', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, item_name, rate FROM menu ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection error' });
  }
});

// 2. POST: Create a new menu item
app.post('/api/menu', async (req, res) => {
  const { item_name, rate } = req.body;
  if (!item_name || rate === undefined) {
    return res.status(400).json({ error: 'Item name and rate are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO menu (item_name, rate) VALUES ($1, $2) RETURNING *',
      [item_name, rate]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation error code in Postgres
      return res.status(409).json({ error: 'An item with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3. PUT: Update an existing item's price or name by ID
app.put('/api/menu/:id', async (req, res) => {
  const { id } = req.params;
  const { item_name, rate } = req.body;

  if (!item_name || rate === undefined) {
    return res.status(400).json({ error: 'Item name and rate are required' });
  }

  try {
    const result = await pool.query(
      'UPDATE menu SET item_name = $1, rate = $2 WHERE id = $3 RETURNING *',
      [item_name, rate, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 4. DELETE: Remove a menu item by ID
app.delete('/api/menu/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM menu WHERE id = $1 RETURNING *', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully', deleted_item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});


// --- SECURITY MIDDLEWARE FOR ADMIN ACCESS ---
const basicAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    return res.status(401).send('Authentication required.');
  }

  // Parse the Base64 encoded credentials string (username:password)
  const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const username = auth[0];
  const password = auth[1];

  // Secure Credentials Configuration (Change these to your preferred values!)
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'SuperSecurePassword123'; 

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    next(); // Credentials match, proceed to the admin page
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    return res.status(401).send('Invalid credentials.');
  }
};

// 1. PUBLIC ROUTE: Read-Only Menu View
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Our Menu</title>
        <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; background: #f4f6f8; color: #333; }
            h1 { text-align: center; color: #2c3e50; margin-bottom: 30px; }
            .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 16px 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
            th { background-color: #f8f9fa; font-weight: 600; color: #666; }
            .rate { text-align: right; font-weight: 600; color: #2e7d32; }
        </style>
    </head>
    <body>
        <h1>Agapastala's Today's Menu</h1>
        <div class="card">
            <table>
                <thead>
                    <tr>
                        <th>Menu Item</th>
                        <th style="text-align: right;">Rate</th>
                    </tr>
                </thead>
                <tbody id="menu-body">
                    <tr><td colspan="2" style="text-align:center;">Loading delicious options...</td></tr>
                </tbody>
            </table>
        </div>

        <script>
            fetch('/api/menu')
                .then(res => res.json())
                .then(data => {
                    const tbody = document.getElementById('menu-body');
                    if (data.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#999;">No items on the menu today.</td></tr>';
                        return;
                    }
                    tbody.innerHTML = data.map(row => \`
                        <tr>
                            <td>\${row.item_name}</td>
                            <td class="rate">₹\${parseFloat(row.rate).toFixed(2)}</td>
                        </tr>
                    \`).join('');
                });
        </script>
    </body>
    </html>
  `);
});

// 2. PRIVATE ROUTE: Secured Dashboard (Protected by basicAuth middleware)
app.get('/admin', basicAuth, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Menu Management</title>
        <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; background: #f4f6f8; color: #333; }
            h1 { text-align: center; color: #2c3e50; margin-bottom: 30px; }
            h2 { color: #34495e; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-top: 0; }
            .dashboard { display: grid; grid-template-columns: 1fr 1.5fr; gap: 30px; }
            @media (max-width: 768px) { .dashboard { grid-template-columns: 1fr; } }
            .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 0.9rem; }
            input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 1rem; }
            button { width: 100%; padding: 12px; border: none; border-radius: 4px; font-weight: bold; font-size: 1rem; cursor: pointer; }
            .btn-primary { background-color: #27ae60; color: white; }
            .btn-primary:hover { background-color: #219653; }
            .btn-delete { background-color: #e74c3c; color: white; padding: 6px 12px; width: auto; font-size: 0.85rem; border-radius: 3px; }
            .btn-delete:hover { background-color: #c0392b; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
            th { background-color: #f8f9fa; font-weight: 600; color: #666; }
            .rate { text-align: right; font-weight: 600; }
            .action-col { text-align: center; width: 80px; }
            .error-msg { color: #e74c3c; font-size: 0.85rem; margin-top: 5px; display: none; }
        </style>
    </head>
    <body>
        <h1>Admin Control Panel</h1>
        
        <div class="dashboard">
            <div class="card">
                <h2>Add New Item</h2>
                <form id="menu-form">
                    <div class="form-group">
                        <label for="itemName">Item Name</label>
                        <input type="text" id="itemName" required>
                        <div id="duplicate-error" class="error-msg">This item already exists.</div>
                    </div>
                    <div class="form-group">
                        <label for="itemRate">Rate (₹)</label>
                        <input type="number" id="itemRate" step="0.01" min="0" required>
                    </div>
                    <button type="submit" class="btn-primary">Add to Menu</button>
                </form>
            </div>
            
            <div class="card">
                <h2>Live Menu Items</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Menu Item</th>
                            <th style="text-align: right;">Rate</th>
                            <th class="action-col">Action</th>
                        </tr>
                    </thead>
                    <tbody id="menu-body">
                        <tr><td colspan="3" style="text-align:center;">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <script>
            const menuBody = document.getElementById('menu-body');
            const menuForm = document.getElementById('menu-form');
            const duplicateError = document.getElementById('duplicate-error');

            function loadMenu() {
                fetch('/api/menu')
                    .then(res => res.json())
                    .then(data => {
                        if (data.length === 0) {
                            menuBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">Menu is empty.</td></tr>';
                            return;
                        }
                        menuBody.innerHTML = data.map(row => \`
                            <tr>
                                <td>\${row.item_name}</td>
                                <td class="rate">₹\${parseFloat(row.rate).toFixed(2)}</td>
                                <td class="action-col">
                                    <button class="btn-delete" onclick="deleteItem(\${row.id})">Delete</button>
                                </td>
                            </tr>
                        \`).join('');
                    });
            }

            menuForm.addEventListener('submit', function(e) {
                e.preventDefault();
                duplicateError.style.display = 'none';
                const item_name = document.getElementById('itemName').value.trim();
                const rate = parseFloat(document.getElementById('itemRate').value);

                fetch('/api/menu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ item_name, rate })
                })
                .then(res => {
                    if (res.status === 409) { duplicateError.style.display = 'block'; throw new Error('Duplicate'); }
                    return res.json();
                })
                .then(() => { menuForm.reset(); loadMenu(); });
            });

            function deleteItem(id) {
                if (!confirm('Delete this item?')) return;
                fetch(\`/api/menu/\${id}\`, { method: 'DELETE' }).then(() => loadMenu());
            }

            loadMenu();
        </script>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});
