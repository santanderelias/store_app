const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'store.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    createTables();
  }
});

function createTables() {
  const createCategoriesTable = `
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `;

  const createSuppliersTable = `
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      contact_info TEXT
    );
  `;

  const createProductsTable = `
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER,
      supplier_id INTEGER,
      low_stock_threshold INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories (id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    );
  `;

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user'))
    );
  `;

  const createSalesTable = `
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount REAL NOT NULL,
      promotion_id INTEGER,
      gift_card_payment_amount REAL DEFAULT 0, -- Added for tracking gift card payment
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (promotion_id) REFERENCES promotions (id) 
    );
  `;

  const createSaleItemsTable = `
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_sale REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
  `;

  const createPromotionsTable = `
    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed_amount', 'bogo')),
      value REAL NOT NULL,
      start_date DATETIME,
      end_date DATETIME
    );
  `;

  const createGiftCardsTable = `
    CREATE TABLE IF NOT EXISTS gift_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_number TEXT NOT NULL UNIQUE,
      balance REAL NOT NULL DEFAULT 0,
      issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiry_date DATETIME
    );
  `;

  db.serialize(() => {
    db.run(createCategoriesTable, handleError);
    db.run(createSuppliersTable, handleError);
    db.run(createProductsTable, handleError);
    db.run(createUsersTable, handleError);
    db.run(createSalesTable, handleError);
    db.run(createSaleItemsTable, handleError);
    db.run(createPromotionsTable, handleError);
    db.run(createGiftCardsTable, handleError);
  });
}

// Function to update a user's role and/or password
function updateUser(userId, { role, password }) {
  return new Promise((resolve, reject) => {
    if (!role && !password) {
      return reject(new Error('No update fields provided (role or password).'));
    }

    let sql = 'UPDATE users SET ';
    const params = [];

    if (role) {
      sql += 'role = ?';
      params.push(role);
    }

    if (password) {
      if (params.length > 0) sql += ', ';
      bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
          return reject(err);
        }
        sql += 'password_hash = ?';
        params.push(hash);
        sql += ' WHERE id = ?';
        params.push(userId);

        db.run(sql, params, function(err) {
          if (err) {
            return reject(err);
          }
          resolve({ changes: this.changes });
        });
      });
    } else { // Only role is being updated
      sql += ' WHERE id = ?';
      params.push(userId);
      db.run(sql, params, function(err) {
        if (err) {
          return reject(err);
        }
        resolve({ changes: this.changes });
      });
    }
  });
}

// Function to delete a user by ID
function deleteUser(userId) {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM users WHERE id = ?`;
    db.run(sql, [userId], function(err) {
      if (err) {
        return reject(err);
      }
      resolve({ changes: this.changes });
    });
  });
}

function handleError(err) {
  if (err) {
    console.error(err.message);
  }
}

const bcrypt = require('bcrypt');
const saltRounds = 10; // Or your preferred number of salt rounds

// Function to add a new user
function addUser(username, password, role = 'user') {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (err) {
        return reject(err);
      }
      const sql = `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`;
      db.run(sql, [username, hash, role], function(err) {
        if (err) {
          return reject(err);
        }
        resolve({ id: this.lastID });
      });
    });
  });
}

// Function to get a user by username
function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM users WHERE username = ?`;
    db.get(sql, [username], (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

// --- Product Functions ---
function addProduct(product) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO products (name, description, price, quantity, category_id, supplier_id, low_stock_threshold)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [product.name, product.description, product.price, product.quantity, product.category_id, product.supplier_id, product.low_stock_threshold], function(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, ...product });
    });
  });
}

function getAllProducts() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT p.*, c.name as category_name, s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getProductById(id) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT p.*, c.name as category_name, s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `;
    db.get(sql, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function updateProduct(id, product) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE products 
                 SET name = ?, description = ?, price = ?, quantity = ?, category_id = ?, supplier_id = ?, low_stock_threshold = ?
                 WHERE id = ?`;
    db.run(sql, [product.name, product.description, product.price, product.quantity, product.category_id, product.supplier_id, product.low_stock_threshold, id], function(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });
}

function deleteProduct(id) {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM products WHERE id = ?`;
    db.run(sql, [id], function(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });
}

// --- Category Functions ---
function addCategory(name) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO categories (name) VALUES (?)`;
    db.run(sql, [name], function(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, name });
    });
  });
}

function getAllCategories() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM categories ORDER BY name`;
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getProductsByCategory(categoryId) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT p.*, c.name as category_name, s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.category_id = ?
    `;
    db.all(sql, [categoryId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// --- Supplier Functions ---
function addSupplier(supplierData) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO suppliers (name, contact_info) VALUES (?, ?)`;
    db.run(sql, [supplierData.name, supplierData.contact_info], function(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, ...supplierData });
    });
  });
}

function getAllSuppliers() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM suppliers ORDER BY name`;
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getSupplierById(id) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM suppliers WHERE id = ?`;
    db.get(sql, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function updateSupplier(id, supplierData) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE suppliers SET name = ?, contact_info = ? WHERE id = ?`;
    db.run(sql, [supplierData.name, supplierData.contact_info, id], function(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });
}

function deleteSupplier(id) {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM suppliers WHERE id = ?`;
    db.run(sql, [id], function(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });
}

module.exports = {
  db,
  createTables,
  addUser, // Promisified
  getUserByUsername, // Promisified
  updateUser, // Promisified
  deleteUser, // Promisified
  addProduct, // Promisified
  getAllProducts, // Promisified
  getProductById, // Promisified
  updateProduct, // Promisified
  deleteProduct, // Promisified
  addCategory, // Promisified
  getAllCategories, // Promisified
  getProductsByCategory, // Promisified
  // --- Supplier Functions ---
  addSupplier, // Promisified
  getAllSuppliers, // Promisified
  getSupplierById, // Promisified
  updateSupplier, // Promisified
  deleteSupplier, // Promisified
  // --- POS Functions ---
  addSale, // Keep as callback for now
  // --- Promotion Functions ---
  addPromotion,
  getAllPromotions,
  getActivePromotions,
  getPromotionById,
  updatePromotion,
  deletePromotion,
  // --- Gift Card Functions ---
  issueGiftCard,
  getGiftCardByNumber,
  updateGiftCardBalance,
  getAllGiftCards,
  // --- Reporting Functions ---
  getSalesByDateRange,
  getPopularProducts,
  getCurrentStockValue,
  getTransactionSummary
};

// --- Reporting Functions ---
function getSalesByDateRange(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        s.id as sale_id,
      s.sale_date,
      u.username as cashier_name,
      p.name as promotion_name,
      s.total_amount,
      s.gift_card_payment_amount,
      (SELECT SUM(si.quantity) FROM sale_items si WHERE si.sale_id = s.id) as total_items
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN promotions promo ON s.promotion_id = promo.id
    WHERE DATE(s.sale_date) BETWEEN DATE(?) AND DATE(?)
    ORDER BY s.sale_date DESC;
  `;
  /*
    Sales Summary Export Columns: 
    SaleID, Date, Time, 
    TotalAmount (Original total before GC payment, but after discounts), 
    TaxAmount (0 for now), 
    DiscountAmount (Promotional + Manual - this is tricky as manual is not stored, and promo % is not stored as value), 
    GiftCardPaymentAmount, 
    FinalAmount (Cash/Card payment part), 
    CashierName, 
    PromotionApplied (Name or ID).

    Current sales.total_amount is FinalAmount (paid by cash/card).
    OriginalTotal = sales.total_amount + sales.gift_card_payment_amount.
    DiscountAmount: This is complex. The current schema doesn't store the *value* of the discount applied.
    Promotions table stores promo value/percentage, but not the calculated discount for each sale.
    Manual discount is not stored.
    For this CSV, DiscountAmount will be an estimation or focus on promo value if fixed.
    Let's assume TotalAmount in CSV = (total_items_value_at_sale_price before any discount)
    Then DiscountAmount = TotalAmount - (FinalAmount + GiftCardPaymentAmount)
    TaxAmount is still 0.
  */
  // Simplified: total_amount is amount after discounts, before GC. So FinalAmount for CSV.
  // Original Total for CSV (before GC) = total_amount + gift_card_payment_amount
  // For DiscountAmount: We need a way to calculate the pre-discount total.
  // Let's retrieve sum of (si.quantity * p_original.price) for original pre-sale price,
  // or sum of (si.quantity * si.price_at_sale) for total value of items at the time of sale (which might already have some product-level discounts).
  // For simplicity, let's provide what's directly available or easily derived.
  // We will enhance this query to better match CSV requirements.

  const enhancedSql = `
    SELECT 
      s.id as SaleID,
      DATE(s.sale_date) as Date,
      TIME(s.sale_date) as Time,
      (s.total_amount + s.gift_card_payment_amount) as TotalAmount, -- Represents total value of sale after discounts
      0 as TaxAmount, -- Tax not explicitly stored
      -- For DiscountAmount: (Original Price Sum) - (TotalAmount from above)
      -- This requires knowing original prices. For now, let's calculate based on price_at_sale vs promotions.
      -- This is still complex. Let's calculate a simplified discount if a promotion was applied.
      CASE 
        WHEN promo.id IS NOT NULL THEN
          CASE promo.type
            WHEN 'fixed_amount_off_total' THEN promo.value
            WHEN 'percentage_off_total' THEN 
              -- This is an approximation, as the base for percentage is not stored directly with sale.
              -- We'd need sum of items at original price *before* this promo was applied.
              -- For now, let's calculate it based on the TotalAmount (which is post-discount).
              -- (TotalAmount / (1 - promo.value/100)) * (promo.value/100) -- this is complex
              -- Simpler: just state promo value if fixed, or a placeholder for percentage.
              (SELECT SUM(si.quantity * si.price_at_sale) FROM sale_items si WHERE si.sale_id = s.id) * (promo.value / 100.0)
            ELSE 0 
          END
        ELSE 0 
      END as DiscountAmount, -- Simplified: only direct promotion value if fixed, or % of items_total_value_at_sale
      s.gift_card_payment_amount as GiftCardPaymentAmount,
      s.total_amount as FinalAmount, -- This is the amount paid by cash/card
      u.username as CashierName,
      promo.name as PromotionApplied
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN promotions promo ON s.promotion_id = promo.id
    WHERE DATE(s.sale_date) BETWEEN DATE(?) AND DATE(?)
    ORDER BY s.sale_date DESC;
  `;
    db.all(enhancedSql, [startDate, endDate], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getInventoryForExport(callback) { // Stays as callback for now, or update in a separate step
  const sql = `
    SELECT
      p.id as ProductID,
      p.name as ProductName,
      c.name as CategoryName,
      s.name as SupplierName,
      p.quantity as QuantityInStock,
      p.price as UnitPrice, -- Using current selling price as 'PurchasePrice' is not available
      (p.quantity * p.price) as TotalValue
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    ORDER BY p.name;
  `;
  db.all(sql, [], callback);
}


function getPopularProducts(startDate, endDate, limit) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        p.name as product_name,
      SUM(si.quantity) as total_quantity_sold
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    WHERE DATE(s.sale_date) BETWEEN DATE(?) AND DATE(?)
    GROUP BY p.id, p.name
    ORDER BY total_quantity_sold DESC
    LIMIT ?;
  `;
    db.all(sql, [startDate, endDate, limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getCurrentStockValue() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT SUM(price * quantity) as total_stock_value FROM products WHERE quantity > 0;`;
    db.get(sql, [], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// For TransactionSummary, we need to calculate discounts.
// This assumes discounts are implicitly part of total_amount logic or need explicit calculation.
// Let's assume sales.total_amount is the final amount after all discounts and taxes.
// For a more detailed discount breakdown, we would need to store discount amounts per sale or promotion type.
// This version will sum total_amount and gift_card_payment_amount.
// A 5% tax is assumed to be included in the total_amount and sale_items.price_at_sale if applicable.
function getTransactionSummary(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        COUNT(s.id) as total_transactions,
      SUM(s.total_amount) as gross_sales_amount, -- This is amount after gift card payment for cash/card part
      SUM(s.gift_card_payment_amount) as total_gift_card_payments,
      (SUM(s.total_amount) + SUM(s.gift_card_payment_amount)) as total_revenue_before_final_payment_method, 
      -- To get total discounts, we need original subtotal vs final total_amount (excluding tax part for accuracy)
      -- This is complex without storing pre-discount subtotal or explicit discount amounts.
      -- For now, we'll focus on what's directly available or easily derivable.
      -- Assuming tax is 5% of (Subtotal - PromotionDiscount - ManualDiscount)
      -- Let's calculate an estimated total_revenue and then estimate tax from that.
      -- For simplicity, this summary will provide total revenue and count. Detailed tax/discount needs schema change or more complex logic.
      (SELECT SUM(si.quantity * si.price_at_sale) 
       FROM sale_items si 
       JOIN sales s_join ON si.sale_id = s_join.id 
       WHERE DATE(s_join.sale_date) BETWEEN DATE(?) AND DATE(?)) as total_items_value_at_sale_price,

      (SELECT SUM(promo.value) 
        FROM sales s_promo 
        JOIN promotions promo ON s_promo.promotion_id = promo.id 
        WHERE DATE(s_promo.sale_date) BETWEEN DATE(?) AND DATE(?) AND promo.type = 'fixed_amount_off_total') as total_fixed_promo_discounts,
      
      -- Percentage discounts are harder to sum directly without knowing the subtotal they applied to.
      -- This summary will be simplified.
      SUM(s.total_amount + s.gift_card_payment_amount) as net_revenue_recorded
    FROM sales s
    WHERE DATE(s.sale_date) BETWEEN DATE(?) AND DATE(?);
  `;
    // Parameters for SQL query. Note the repetition for sub-queries.
    db.get(sql, [startDate, endDate, startDate, endDate, startDate, endDate], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// --- Gift Card Functions ---
function issueGiftCard(cardNumber, balance, expiryDate, callback) {
  const sql = `INSERT INTO gift_cards (card_number, balance, expiry_date) VALUES (?, ?, ?)`;
  db.run(sql, [cardNumber, balance, expiryDate], function(err) {
    if (err) return callback(err);
    callback(null, { id: this.lastID });
  });
}

function getGiftCardByNumber(cardNumber, callback) {
  const sql = `SELECT * FROM gift_cards WHERE card_number = ?`;
  db.get(sql, [cardNumber], callback);
}

function updateGiftCardBalance(giftCardId, newBalance, callback) {
  const sql = `UPDATE gift_cards SET balance = ? WHERE id = ?`;
  db.run(sql, [newBalance, giftCardId], function(err) {
    if (err) return callback(err);
    callback(null, { changes: this.changes });
  });
}

function getAllGiftCards(callback) {
  const sql = `SELECT * FROM gift_cards ORDER BY issue_date DESC`;
  db.all(sql, [], callback);
}
// Optional: deleteGiftCard - for now, let cards expire or be depleted.

// --- Promotion Functions ---
function addPromotion(promotion, callback) {
  const sql = `INSERT INTO promotions (name, description, type, value, start_date, end_date) 
               VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [promotion.name, promotion.description, promotion.type, promotion.value, promotion.start_date, promotion.end_date], function(err) {
    if (err) return callback(err);
    callback(null, { id: this.lastID });
  });
}

function getAllPromotions(callback) {
  const sql = `SELECT * FROM promotions ORDER BY start_date DESC`;
  db.all(sql, [], callback);
}

function getActivePromotions(callback) {
  const currentDate = new Date().toISOString();
  const sql = `SELECT * FROM promotions WHERE start_date <= ? AND end_date >= ? ORDER BY name`;
  db.all(sql, [currentDate, currentDate], callback);
}

function getPromotionById(id, callback) {
  const sql = `SELECT * FROM promotions WHERE id = ?`;
  db.get(sql, [id], callback);
}

function updatePromotion(id, promotion, callback) {
  const sql = `UPDATE promotions 
               SET name = ?, description = ?, type = ?, value = ?, start_date = ?, end_date = ?
               WHERE id = ?`;
  db.run(sql, [promotion.name, promotion.description, promotion.type, promotion.value, promotion.start_date, promotion.end_date, id], function(err) {
    if (err) return callback(err);
    callback(null, { changes: this.changes });
  });
}

function deletePromotion(id, callback) {
  // First, check if any sales are associated with this promotion.
  // If so, we might want to prevent deletion or nullify the promotion_id in sales.
  // For simplicity, we'll prevent deletion for now if it's used.
  db.get("SELECT 1 FROM sales WHERE promotion_id = ?", [id], (err, row) => {
    if (err) return callback(err);
    if (row) {
      return callback(new Error("Cannot delete promotion: It is associated with existing sales."));
    }
    const sql = `DELETE FROM promotions WHERE id = ?`;
    db.run(sql, [id], function(err) {
      if (err) return callback(err);
      callback(null, { changes: this.changes });
    });
  });
}

// --- POS Functions ---
// Function to add a sale and update product quantities (transaction)
// Updated to include promotion_id and gift_card_payment_amount
function addSale(userId, saleDate, totalAmount, items, promotionId, giftCardPaymentAmount) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION;", (err) => {
        if (err) return reject(err);

        const saleSql = `INSERT INTO sales (user_id, sale_date, total_amount, promotion_id, gift_card_payment_amount) VALUES (?, ?, ?, ?, ?)`;
        db.run(saleSql, [userId, saleDate, totalAmount, promotionId, giftCardPaymentAmount], function(err) {
          if (err) {
            db.run("ROLLBACK;", () => reject(err));
            return;
          }
          const saleId = this.lastID;

          const itemSql = `INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)`;
          const updateStockSql = `UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?`;

          let itemsProcessedSuccessfully = 0;
          let rollbackError = null; // To store error that triggers rollback

          items.forEach((item, index) => {
            if (rollbackError) return; // Stop processing if a rollback has been triggered

            // First, try to update stock
            db.run(updateStockSql, [item.quantity, item.product_id, item.quantity], function(updateErr) {
              if (rollbackError) return; // Already handling a rollback

              if (updateErr) {
                rollbackError = updateErr;
                db.run("ROLLBACK;", () => reject(updateErr));
                return;
              }
              if (this.changes === 0) {
                rollbackError = new Error(`Insufficient stock for product ID ${item.product_id} or product not found.`);
                db.run("ROLLBACK;", () => reject(rollbackError));
                return;
              }

              // If stock update was successful, insert sale item
              db.run(itemSql, [saleId, item.product_id, item.quantity, item.price_at_sale], (itemErr) => {
                if (rollbackError) return; // Already handling a rollback

                if (itemErr) {
                  rollbackError = itemErr;
                  db.run("ROLLBACK;", () => reject(itemErr));
                  return;
                }
                itemsProcessedSuccessfully++;
                if (itemsProcessedSuccessfully === items.length) {
                  db.run("COMMIT;", (commitErr) => {
                    if (commitErr) {
                      db.run("ROLLBACK;", () => reject(commitErr)); // Should ideally not happen if commit is called correctly
                    } else {
                      resolve(saleId);
                    }
                  });
                }
              });
            });
          });
          // Handle case where items array is empty (though server-side validation should prevent this)
          if (items.length === 0 && !rollbackError) {
             db.run("COMMIT;", (commitErr) => { // Commit sale if no items (e.g. a sale for a service not tracked by product ID)
                if (commitErr) {
                    db.run("ROLLBACK;", () => reject(commitErr));
                } else {
                    resolve(saleId);
                }
            });
          }
        });
      });
    });
  });
}
