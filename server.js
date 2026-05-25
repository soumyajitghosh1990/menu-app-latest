const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL Connection configuration using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/menu_db'
});

// API endpoint to fetch menu items
app.get('/api/menu', async (req, res) => {
  try {
    const result = await pool.query('SELECT item_name, rate FROM menu ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection error' });
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
  console.log(\`App running on port \${port}\`);
});