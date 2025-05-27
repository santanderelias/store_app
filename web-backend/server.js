const express = require('express');
const {
  addUser, getUserByUsername, updateUser, deleteUser, // User functions
  addProduct, getAllProducts, getProductById, updateProduct, deleteProduct, // Product functions
  addCategory, getAllCategories, getProductsByCategory, // Category functions
  addSupplier, getAllSuppliers, getSupplierById, updateSupplier, deleteSupplier, // Supplier functions
  addSale, // POS function
  getSalesByDateRange, getPopularProducts, getCurrentStockValue, getTransactionSummary // Reporting functions
} = require('./database');
const bcrypt = require('bcrypt'); // Import bcrypt for password comparison
const jwt = require('jsonwebtoken'); // Import jsonwebtoken

// IMPORTANT: In a real application, use an environment variable for the JWT secret!
const JWT_SECRET = 'your-very-secure-and-secret-key-please-change-me';

const app = express();
const port = 3000;

app.use(express.json()); // Middleware to parse JSON bodies

app.get('/', (req, res) => {
  res.send('Hello World! This is the POS backend.');
});

// --- User Management API Routes ---

// POST /api/users/register - Register a new user
app.post('/api/users/register', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) { // Role is optional and defaults to 'user' in addUser
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const newUser = await addUser(username, password, role);
    res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
  } catch (error) {
    if (error.message && error.message.includes('SQLITE_CONSTRAINT')) { // Specific check for username conflict
      res.status(409).json({ message: 'Username already exists' });
    } else {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Error registering user' });
    }
  }
});

// POST /api/users/login - Login a user
app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    bcrypt.compare(password, user.password_hash, (err, result) => {
      if (err) {
        console.error('Login error - bcrypt.compare:', err);
        return res.status(500).json({ message: 'Error logging in' });
      }
      if (result) {
        // Passwords match - Create JWT
        const payload = { id: user.id, username: user.username, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
          message: 'Login successful',
          token: token, // The generated JWT
          user: { id: user.id, username: user.username, role: user.role },
        });
      } else {
        // Passwords don't match
        res.status(401).json({ message: 'Invalid credentials' });
      }
    });
  } catch (error) {
    console.error('Login error - getUserByUsername:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// GET /api/users/:username - Get user details (protected)
app.get('/api/users/:username', authenticateToken, async (req, res) => {
  const { username } = req.params;
  const authenticatedUser = req.user;

  // Authorization: User can access their own details or admin can access any
  if (authenticatedUser.username !== username && authenticatedUser.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource.' });
  }

  try {
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Exclude password_hash from the response
    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error(`Error getting user ${username}:`, error);
    res.status(500).json({ message: 'Error retrieving user' });
  }
});

// PUT /api/users/:targetUsername - Update user details (protected)
app.put('/api/users/:targetUsername', authenticateToken, async (req, res) => {
  const { targetUsername } = req.params;
  const { role, password } = req.body;
  const authenticatedUser = req.user;

  // Authorization checks
  const isSelf = authenticatedUser.username === targetUsername;
  const isAdmin = authenticatedUser.role === 'admin';

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to update this user.' });
  }

  if (!isAdmin && role && role !== authenticatedUser.role) { // Non-admin trying to change their own or someone else's role
    return res.status(403).json({ message: 'Forbidden: You are not authorized to change user roles.' });
  }
  
  if (isSelf && role && role !== authenticatedUser.role) { // User trying to change their own role
      return res.status(403).json({ message: 'Forbidden: Users cannot change their own role.' });
  }


  try {
    const targetUser = await getUserByUsername(targetUsername);
    if (!targetUser) {
      return res.status(404).json({ message: 'User to update not found' });
    }

    const updateData = {};
    if (role) { // Role can be updated by admin
        if(isAdmin) {
            updateData.role = role;
        } else if (isSelf && role !== targetUser.role) { // user trying to change their own role
            return res.status(403).json({ message: 'Forbidden: Users cannot change their own role.' });
        } else if (isSelf) {
            // a user is "updating" their role to the same role they already have, this is fine.
            updateData.role = role;
        }
    }
    if (password) { // Password can be updated by self or admin
      updateData.password = password;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    const result = await updateUser(targetUser.id, updateData);
    if (result.changes > 0) {
      const updatedUser = await getUserByUsername(targetUsername); // Fetch updated details
      const { password_hash, ...userWithoutPassword } = updatedUser;
      res.json({ message: 'User updated successfully', user: userWithoutPassword });
    } else {
      res.status(404).json({ message: 'User not found or no changes made' }); // Should be caught by targetUser check ideally
    }
  } catch (error) {
    console.error(`Error updating user ${targetUsername}:`, error);
    if (error.message.includes('No update fields provided')) {
        return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error updating user' });
  }
});

// DELETE /api/users/:targetUsername - Delete a user (protected, admin only)
app.delete('/api/users/:targetUsername', authenticateToken, async (req, res) => {
  const { targetUsername } = req.params;
  const authenticatedUser = req.user;

  // Authorization: Admin only
  if (authenticatedUser.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Only admins can delete users.' });
  }

  try {
    const targetUser = await getUserByUsername(targetUsername);
    if (!targetUser) {
      return res.status(404).json({ message: 'User to delete not found' });
    }

    // Optional: Prevent admin from deleting themselves
    if (authenticatedUser.id === targetUser.id) {
      return res.status(400).json({ message: 'Bad Request: Admins cannot delete themselves.' });
    }

    const result = await deleteUser(targetUser.id);
    if (result.changes > 0) {
      res.json({ message: `User ${targetUsername} deleted successfully` });
    } else {
      res.status(404).json({ message: 'User not found for deletion (no changes made)' }); // Should be caught by targetUser check
    }
  } catch (error) {
    console.error(`Error deleting user ${targetUsername}:`, error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});
// --- End User Management API Routes ---

// --- JWT Authentication Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  if (token == null) {
    return res.sendStatus(401); // Unauthorized - no token
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // Forbidden - token is invalid
    }
    req.user = user; // Add decoded user payload to request object
    next(); // Proceed to the next middleware or route handler
  });
}
// --- End JWT Authentication Middleware ---

// --- Protected Test Route ---
app.get('/api/protected-test', authenticateToken, (req, res) => {
  res.json({
    message: 'You have accessed a protected route!',
    user: req.user
  });
});
// --- End Protected Test Route ---

// --- Inventory Management API Routes ---
// POST /api/products - Add a new product
app.post('/api/products', authenticateToken, async (req, res) => {
  const { name, price, quantity, description, category_id, supplier_id, low_stock_threshold } = req.body;

  if (!name || typeof price !== 'number' || typeof quantity !== 'number') {
    return res.status(400).json({ message: 'Name, price, and quantity are required and must be of correct types.' });
  }

  try {
    const productData = { name, price, quantity, description, category_id, supplier_id, low_stock_threshold };
    const newProduct = await addProduct(productData);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: 'Error adding product' });
  }
});

// GET /api/products - Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await getAllProducts();
    res.json(products);
  } catch (error) {
    console.error('Error getting all products:', error);
    res.status(500).json({ message: 'Error retrieving products' });
  }
});

// GET /api/products/:id - Get a single product by ID
app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const product = await getProductById(id);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error(`Error getting product ${id}:`, error);
    res.status(500).json({ message: 'Error retrieving product' });
  }
});

// PUT /api/products/:id - Update a product
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, price, quantity, description, category_id, supplier_id, low_stock_threshold } = req.body;

  if (!name || typeof price !== 'number' || typeof quantity !== 'number') {
    return res.status(400).json({ message: 'Name, price, and quantity are required and must be of correct types.' });
  }

  try {
    const productData = { name, price, quantity, description, category_id, supplier_id, low_stock_threshold };
    const result = await updateProduct(id, productData);
    if (result.changes > 0) {
      const updatedProduct = await getProductById(id); // Fetch the updated product
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found or no changes made' });
    }
  } catch (error) {
    console.error(`Error updating product ${id}:`, error);
    res.status(500).json({ message: 'Error updating product' });
  }
});

// DELETE /api/products/:id - Delete a product
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
   // Authorization: For now, allow any authenticated user. Add admin check if needed.
  // if (req.user.role !== 'admin') {
  //   return res.status(403).json({ message: 'Forbidden: Only admins can delete products.' });
  // }
  try {
    const result = await deleteProduct(id);
    if (result.changes > 0) {
      res.json({ message: 'Product deleted successfully' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error(`Error deleting product ${id}:`, error);
    // Check for SQLITE_CONSTRAINT_FOREIGNKEY error if product is part of a sale_item
    if (error.message && error.message.includes('SQLITE_CONSTRAINT_FOREIGNKEY')) {
        return res.status(409).json({ message: 'Cannot delete product: It is referenced in existing sales records. Consider archiving or disabling the product instead.' });
    }
    res.status(500).json({ message: 'Error deleting product' });
  }
});
// --- End Inventory Management API Routes ---

// --- Category Management API Routes ---
// POST /api/categories - Add a new category
app.post('/api/categories', authenticateToken, async (req, res) => {
  const { name } = req.body;
  const authenticatedUser = req.user;

  if (authenticatedUser.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Only admins can add categories.' });
  }

  if (!name) {
    return res.status(400).json({ message: 'Category name is required.' });
  }

  try {
    const newCategory = await addCategory(name);
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error adding category:', error);
    if (error.message && error.message.includes('SQLITE_CONSTRAINT_UNIQUE')) { // Check for unique constraint
      return res.status(409).json({ message: 'Category name already exists.' });
    }
    res.status(500).json({ message: 'Error adding category.' });
  }
});

// GET /api/categories - Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await getAllCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error getting all categories:', error);
    res.status(500).json({ message: 'Error retrieving categories.' });
  }
});

// GET /api/categories/:id/products - Get products by category ID
app.get('/api/categories/:id/products', async (req, res) => {
    const { id } = req.params;
    try {
        // First, check if category exists (optional, but good practice)
        // const category = await getCategoryById(id); // Assuming you'd create this function
        // if (!category) {
        //   return res.status(404).json({ message: 'Category not found' });
        // }
        const products = await getProductsByCategory(id);
        if (products && products.length > 0) {
            res.json(products);
        } else {
            // If category exists but has no products, or if category doesn't exist
            // The current getProductsByCategory won't distinguish, so we might need getCategoryById
            res.status(404).json({ message: 'No products found for this category or category does not exist.' });
        }
    } catch (error) {
        console.error(`Error getting products for category ${id}:`, error);
        res.status(500).json({ message: 'Error retrieving products for category.' });
    }
});
// --- End Category Management API Routes ---

// --- Supplier Management API Routes ---
// POST /api/suppliers - Add a new supplier
app.post('/api/suppliers', authenticateToken, async (req, res) => {
  const { name, contact_info } = req.body;
  const authenticatedUser = req.user;

  if (authenticatedUser.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Only admins can add suppliers.' });
  }

  if (!name) {
    return res.status(400).json({ message: 'Supplier name is required.' });
  }

  try {
    const newSupplier = await addSupplier({ name, contact_info });
    res.status(201).json(newSupplier);
  } catch (error) {
    console.error('Error adding supplier:', error);
    if (error.message && error.message.includes('SQLITE_CONSTRAINT_UNIQUE')) {
      return res.status(409).json({ message: 'Supplier name already exists.' });
    }
    res.status(500).json({ message: 'Error adding supplier.' });
  }
});

// GET /api/suppliers - Get all suppliers
app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const suppliers = await getAllSuppliers();
    res.json(suppliers);
  } catch (error) {
    console.error('Error getting all suppliers:', error);
    res.status(500).json({ message: 'Error retrieving suppliers.' });
  }
});

// GET /api/suppliers/:id - Get a supplier by ID
app.get('/api/suppliers/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const supplier = await getSupplierById(id);
    if (supplier) {
      res.json(supplier);
    } else {
      res.status(404).json({ message: 'Supplier not found.' });
    }
  } catch (error) {
    console.error(`Error getting supplier ${id}:`, error);
    res.status(500).json({ message: 'Error retrieving supplier.' });
  }
});

// PUT /api/suppliers/:id - Update a supplier
app.put('/api/suppliers/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, contact_info } = req.body;
  const authenticatedUser = req.user;

  if (authenticatedUser.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Only admins can update suppliers.' });
  }

  if (!name && !contact_info) { // Ensure at least one field is being updated
      return res.status(400).json({ message: 'Supplier name or contact info is required for update.' });
  }
  
  const currentSupplier = await getSupplierById(id);
  if (!currentSupplier) {
      return res.status(404).json({ message: 'Supplier not found for update.' });
  }

  // Prepare data for update, only including fields that are actually being changed
  const supplierData = {
      name: name || currentSupplier.name, // Use new name if provided, else keep current
      contact_info: contact_info !== undefined ? contact_info : currentSupplier.contact_info // Use new contact_info if provided (even if empty string), else keep current
  };


  try {
    const result = await updateSupplier(id, supplierData);
    if (result.changes > 0) {
      const updatedSupplier = await getSupplierById(id);
      res.json(updatedSupplier);
    } else {
      // This case might be redundant if getSupplierById check is thorough
      // or if the data provided is identical to existing data.
      res.status(404).json({ message: 'Supplier not found or no changes made.' });
    }
  } catch (error) {
    console.error(`Error updating supplier ${id}:`, error);
    if (error.message && error.message.includes('SQLITE_CONSTRAINT_UNIQUE') && name) {
      return res.status(409).json({ message: 'Supplier name already exists.' });
    }
    res.status(500).json({ message: 'Error updating supplier.' });
  }
});

// DELETE /api/suppliers/:id - Delete a supplier
app.delete('/api/suppliers/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const authenticatedUser = req.user;

  if (authenticatedUser.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Only admins can delete suppliers.' });
  }

  try {
    const result = await deleteSupplier(id);
    if (result.changes > 0) {
      res.json({ message: 'Supplier deleted successfully.' });
    } else {
      res.status(404).json({ message: 'Supplier not found.' });
    }
  } catch (error) {
    console.error(`Error deleting supplier ${id}:`, error);
    if (error.message && error.message.includes('SQLITE_CONSTRAINT_FOREIGNKEY')) {
      return res.status(409).json({ message: 'Cannot delete supplier: It is associated with existing products. Please reassign or delete those products first.' });
    }
    res.status(500).json({ message: 'Error deleting supplier.' });
  }
});
// --- End Supplier Management API Routes ---

// --- POS API Routes ---
// POST /api/sales - Process a new sale
app.post('/api/sales', authenticateToken, async (req, res) => {
  const { items, totalAmount: subtotalFromRequest, paymentMethod } = req.body; // totalAmount is now subtotalFromRequest
  const userId = req.user.id;
  const username = req.user.username;
  const saleDate = new Date().toISOString();

  // Request Body Validation
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Items array is required and must not be empty.' });
  }
  for (const item of items) {
    if (typeof item.product_id !== 'number' || typeof item.quantity !== 'number' || item.quantity <= 0 || typeof item.price_at_sale !== 'number' || item.price_at_sale < 0) {
      return res.status(400).json({ message: 'Each item must have product_id (number), quantity (positive number), and price_at_sale (number >= 0).' });
    }
  }
  // Validate subtotalFromRequest (formerly totalAmount)
  if (typeof subtotalFromRequest !== 'number' || subtotalFromRequest < 0) {
    return res.status(400).json({ message: 'Subtotal (totalAmount from request) must be a number greater than or equal to 0.' });
  }
  if (typeof paymentMethod !== 'string' || paymentMethod.trim() === '') {
    return res.status(400).json({ message: 'Payment method must be a non-empty string.' });
  }

  try {
    // Calculate Tax and Grand Total
    const taxRate = 0.05; // 5% tax rate
    const calculatedTaxAmount = parseFloat((subtotalFromRequest * taxRate).toFixed(2));
    const calculatedGrandTotal = parseFloat((subtotalFromRequest + calculatedTaxAmount).toFixed(2));

    // promotionId is null, giftCardPaymentAmount is 0 as per current scope
    // Use calculatedGrandTotal for the amount stored in the database
    const saleId = await addSale(userId, saleDate, calculatedGrandTotal, items, null, 0);

    res.status(201).json({
      saleId: saleId,
      saleDate: saleDate,
      itemsProcessed: items,
      subtotal: subtotalFromRequest, // The original amount from request (pre-tax)
      taxAmount: calculatedTaxAmount,
      grandTotal: calculatedGrandTotal,
      totalAmountPaid: calculatedGrandTotal, // What the customer actually paid
      paymentMethod: paymentMethod,
      cashierId: userId,
      cashierUsername: username
    });

  } catch (error) {
    console.error('Error processing sale:', error);
    if (error.message && error.message.toLowerCase().includes('insufficient stock')) {
      return res.status(409).json({ message: error.message });
    }
    // For other SQLITE_CONSTRAINT errors (e.g. product_id not found in products table due to FK)
    if (error.message && error.message.includes('SQLITE_CONSTRAINT')) {
        return res.status(400).json({ message: `Database constraint failed. Ensure products exist and stock is sufficient. Details: ${error.message}` });
    }
    res.status(500).json({ message: 'Error processing sale.' });
  }
});
// --- End POS API Routes ---

// --- Reporting API Routes ---
// GET /api/reports/sales - Get sales report by date range
app.get('/api/reports/sales', authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'startDate and endDate query parameters are required.' });
  }
  // Basic date validation (can be more robust)
  if (isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
      return res.status(400).json({ message: 'Invalid date format for startDate or endDate.' });
  }

  try {
    const salesData = await getSalesByDateRange(startDate, endDate);
    res.json(salesData);
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ message: 'Error generating sales report.' });
  }
});

// GET /api/reports/popular-products - Get popular products report
app.get('/api/reports/popular-products', authenticateToken, async (req, res) => {
  const { startDate, endDate, limit = 5 } = req.query; // Default limit to 5

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'startDate and endDate query parameters are required.' });
  }
  if (isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
      return res.status(400).json({ message: 'Invalid date format for startDate or endDate.' });
  }
  const numLimit = parseInt(limit, 10);
  if (isNaN(numLimit) || numLimit <= 0) {
      return res.status(400).json({ message: 'Limit must be a positive number.' });
  }


  try {
    const popularProducts = await getPopularProducts(startDate, endDate, numLimit);
    res.json(popularProducts);
  } catch (error) {
    console.error('Error generating popular products report:', error);
    res.status(500).json({ message: 'Error generating popular products report.' });
  }
});

// GET /api/reports/stock-value - Get current total stock value
app.get('/api/reports/stock-value', authenticateToken, async (req, res) => {
  try {
    const stockValue = await getCurrentStockValue();
    res.json(stockValue || { total_stock_value: 0 }); // Return 0 if null (no stock)
  } catch (error) {
    console.error('Error generating stock value report:', error);
    res.status(500).json({ message: 'Error generating stock value report.' });
  }
});

// GET /api/reports/transaction-summary - Get transaction summary
app.get('/api/reports/transaction-summary', authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'startDate and endDate query parameters are required.' });
  }
   if (isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
      return res.status(400).json({ message: 'Invalid date format for startDate or endDate.' });
  }

  try {
    const summary = await getTransactionSummary(startDate, endDate);
    res.json(summary);
  } catch (error) {
    console.error('Error generating transaction summary:', error);
    res.status(500).json({ message: 'Error generating transaction summary.' });
  }
});
// --- End Reporting API Routes ---

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
