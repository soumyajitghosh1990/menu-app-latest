CREATE TABLE IF NOT EXISTS menu (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    rate NUMERIC(10, 2) NOT NULL
);

INSERT INTO menu (item_name, rate) VALUES 
('Classic Milk Chai', 25.00),
('Masala Chai', 30.00),
('Ginger Mint Chai', 35.00)
ON CONFLICT DO NOTHING;