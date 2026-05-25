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


// HTML Frontend (Single Page UI with Admin Controls)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Menu Management Dashboard</title>
        <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; background: #f4f6f8; color: #333; }
            h1 { text-align: center; color: #2c3e50; margin-bottom: 30px; }
            h2 { color: #34495e; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-top: 0; }
            
            /* Dashboard Grid Layout */
            .dashboard { display: grid; grid-template-columns: 1fr 1.5fr; gap: 30px; }
            @media (max-width: 768px) { .dashboard { grid-template-columns: 1fr; } }
            
            .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            
            /* Form Styling */
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 0.9rem; }
            input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 1rem; }
            
            /* Buttons */
            button { width: 100%; padding: 12px; border: none; border-radius: 4px; font-weight: bold; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
            .btn-primary { background-color: #27ae60; color: white; }
            .btn-primary:hover { background-color: #219653; }
            .btn-delete { background-color: #e74c3c; color: white; padding: 6px 12px; width: auto; font-size: 0.85rem; border-radius: 3px; }
            .btn-delete:hover { background-color: #c0392b; }
            
            /* Table Styling */
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
            th { background-color: #f8f9fa; font-weight: 600; color: #666; }
            .rate { text-align: right; font-weight: 600; }
            .action-col { text-align: center; width: 80px; }
            
            .error-msg { color: #e74c3c; font-size: 0.85rem; margin-top: 5px; display: none; }
        </style>
    </head>
    <body>
        <h1>Menu Management Dashboard</h1>
        
        <div class="dashboard">
            <div class="card">
                <h2>Add New Item</h2>
                <form id="menu-form">
                    <div class="form-group">
                        <label for="itemName">Item Name</label>
                        <input type="text" id="itemName" placeholder="e.g., Kesar Pista Chai" required>
                        <div id="duplicate-error" class="error-msg">This item already exists.</div>
                    </div>
                    <div class="form-group">
                        <label for="itemRate">Rate (₹)</label>
                        <input type="number" id="itemRate" step="0.01" min="0" placeholder="0.00" required>
                    </div>
                    <button type="submit" class="btn-primary">Add to Menu</button>
                </form>
            </div>
            
            <div class="card">
                <h2>Live Menu (2-Column)</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Menu Item</th>
                            <th style="text-align: right;">Rate</th>
                            <th class="action-col">Action</th>
                        </tr>
                    </thead>
                    <tbody id="menu-body">
                        <tr><td colspan="3" style="text-align:center;">Loading menu items...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <script>
            const menuBody = document.getElementById('menu-body');
            const menuForm = document.getElementById('menu-form');
            const duplicateError = document.getElementById('duplicate-error');

            // 1. Fetch and render menu items dynamically
            function loadMenu() {
                fetch('/api/menu')
                    .then(res => res.json())
                    .then(data => {
                        if (data.error) {
                            menuBody.innerHTML = '<tr><td colspan="3" style="color:red; text-align:center;">Error loading database lines.</td></tr>';
                            return;
                        }
                        if (data.length === 0) {
                            menuBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">Menu is empty. Add items using the control panel.</td></tr>';
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

            // 2. Handle Form Submission (Create Item via POST)
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
                    if (res.status === 409) {
                        duplicateError.style.display = 'block';
                        throw new Error('Duplicate key entry');
                    }
                    if (!res.ok) throw new Error('Server error');
                    return res.json();
                })
                .then(() => {
                    menuForm.reset();
                    loadMenu(); // Refresh table view instantly
                })
                .catch(err => console.error('Creation failed:', err));
            });

            // 3. Handle Deletion via DELETE endpoint
            function deleteItem(id) {
                if (!confirm('Are you sure you want to remove this item?')) return;

                fetch(\`/api/menu/\${id}\`, { method: 'DELETE' })
                    .then(res => {
                        if (!res.ok) throw new Error('Deletion failed');
                        return res.json();
                    })
                    .then(() => {
                        loadMenu(); // Refresh table view instantly
                    })
                    .catch(err => console.error(err));
            }

            // Run initial load on boot
            loadMenu();
        </script>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});