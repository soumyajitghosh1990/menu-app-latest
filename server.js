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

// HTML Frontend (Single Page UI)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Menu</title>
        <style>
            body { font-family: sans-serif; max-width: 500px; margin: 40px auto; padding: 0 20px; background: #f9f9f9; }
            h1 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:hover { background-color: #f5f5f5; }
            .rate { text-align: right; }
        </style>
    </head>
    <body>
        <h1>Menu</h1>
        <table>
            <thead>
                <tr>
                    <th>Menu Item</th>
                    <th style="text-align: right;">Rate</th>
                </tr>
            </thead>
            <tbody id="menu-body">
                <tr><td colspan="2" style="text-align:center;">Loading menu...</td></tr>
            </tbody>
        </table>

        <script>
            fetch('/api/menu')
                .then(res => res.json())
                .then(data => {
                    const tbody = document.getElementById('menu-body');
                    if (data.error) {
                        tbody.innerHTML = '<tr><td colspan="2" style="color:red; text-align:center;">Error loading menu</td></tr>';
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

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});