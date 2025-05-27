const { app, BrowserWindow, ipcMain } = require('electron');
const dbSetup = require('./database'); // Initialize database
const { addUser, getUserByUsername } = require('./database');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

let currentUser = null; // To store the current logged-in user's info
let isOnline = true; // Flag to simulate online/offline status
const offlineSalesPath = path.join(app.getPath('userData'), 'offline-sales.json');

// Ensure offline sales file exists
try {
    if (!fs.existsSync(offlineSalesPath)) {
        fs.writeFileSync(offlineSalesPath, JSON.stringify([]));
    }
} catch (error) {
    console.error("Failed to initialize offline sales file:", error);
}

function readOfflineSales() {
    try {
        const data = fs.readFileSync(offlineSalesPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading offline sales:", error);
        return []; // Return empty array on error
    }
}

function writeOfflineSales(salesArray) {
    try {
        fs.writeFileSync(offlineSalesPath, JSON.stringify(salesArray, null, 2));
    } catch (error) {
        console.error("Error writing offline sales:", error);
    }
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1000, // Increased width for better layout
    height: 700, // Increased height
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // Required for ipcRenderer in preload script if you use one, but for direct use in renderer.js it's fine like this for now
    }
  });

  win.loadFile('index.html');
  // win.webContents.openDevTools(); // Optional: Open DevTools for debugging
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handler for user registration
ipcMain.on('register-user', (event, { username, password, role }) => {
  addUser(username, password, role, (err, user) => {
    if (err) {
      event.reply('register-reply', { success: false, message: err.message });
    } else {
      event.reply('register-reply', { success: true, userId: user.id });
    }
  });
});

// IPC handler for user login
ipcMain.on('login-user', (event, { username, password }) => {
  getUserByUsername(username, (err, user) => {
    if (err) {
      event.reply('login-reply', { success: false, message: 'Database error.' });
      return;
    }
    if (!user) {
      event.reply('login-reply', { success: false, message: 'User not found.' });
      return;
    }
    bcrypt.compare(password, user.password_hash, (err, result) => {
      if (err) {
        event.reply('login-reply', { success: false, message: 'Error comparing passwords.' });
        return;
      }
      if (result) {
        currentUser = { username: user.username, role: user.role, id: user.id };
        event.reply('login-reply', { success: true, username: user.username, role: user.role });
      } else {
        event.reply('login-reply', { success: false, message: 'Incorrect password.' });
      }
    });
  });
});

// IPC handler for user logout
ipcMain.on('logout-user', (event) => {
    currentUser = null;
    // Potentially more cleanup if needed
    console.log('User logged out');
    // No explicit reply needed unless the renderer expects one
});

// --- Inventory and Category IPC Handlers ---
const { 
    addProduct, getAllProducts, getProductById, updateProduct, deleteProduct, 
    addCategory, getAllCategories,
    // Supplier Functions
    addSupplier, getAllSuppliers, getSupplierById, updateSupplier, deleteSupplier,
    // Promotion Functions
    addPromotion, getAllPromotions, getActivePromotions, getPromotionById, updatePromotion, deletePromotion,
    // Gift Card Functions
    issueGiftCard, getGiftCardByNumber, updateGiftCardBalance, getAllGiftCards,
    // Reporting Functions
    getSalesByDateRange, getPopularProducts, getCurrentStockValue, getTransactionSummary, getInventoryForExport
} = require('./database');
const { dialog } = require('electron'); // For save dialog

// Products
ipcMain.on('add-product', (event, productData) => {
    addProduct(productData, (err, result) => {
        if (err) {
            console.error('Error adding product:', err);
            event.reply('product-operation-error', 'Failed to add product: ' + err.message);
        } else {
            event.reply('product-operation-success', 'Product added successfully!');
            // Optionally, send updated product list or just confirm success
        }
    });
});


// --- CSV Export IPC Handlers ---

function escapeCsvValue(value) {
    if (value == null) return ''; // Handle null or undefined by returning an empty string
    const stringValue = String(value);
    // If the value contains a comma, double quote, or newline, enclose it in double quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        // Escape existing double quotes by doubling them
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

ipcMain.handle('export-sales-summary-csv', async (event, { startDate, endDate }) => {
    try {
        const sales = await new Promise((resolve, reject) => {
            getSalesByDateRange(startDate, endDate, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        if (!sales || sales.length === 0) {
            return { success: false, message: 'No sales data to export for the selected range.' };
        }

        const header = ['SaleID', 'Date', 'Time', 'TotalAmount', 'TaxAmount', 'DiscountAmount', 'GiftCardPaymentAmount', 'FinalAmount', 'CashierName', 'PromotionApplied'];
        const csvRows = [header.join(',')];

        sales.forEach(sale => {
            const row = [
                escapeCsvValue(sale.SaleID),
                escapeCsvValue(sale.Date),
                escapeCsvValue(sale.Time),
                escapeCsvValue(sale.TotalAmount.toFixed(2)),
                escapeCsvValue(sale.TaxAmount.toFixed(2)), // Assuming TaxAmount is part of the sale object
                escapeCsvValue(sale.DiscountAmount.toFixed(2)), // Assuming DiscountAmount is part of the sale object
                escapeCsvValue(sale.GiftCardPaymentAmount.toFixed(2)),
                escapeCsvValue(sale.FinalAmount.toFixed(2)),
                escapeCsvValue(sale.CashierName),
                escapeCsvValue(sale.PromotionApplied)
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const defaultFileName = `sales_summary_${startDate}_to_${endDate}.csv`;
        const { filePath } = await dialog.showSaveDialog({
            title: 'Save Sales Summary CSV',
            defaultPath: defaultFileName,
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });

        if (filePath) {
            fs.writeFileSync(filePath, csvContent);
            return { success: true, message: `Sales summary exported to ${filePath}` };
        } else {
            return { success: false, message: 'Export cancelled by user.' };
        }
    } catch (error) {
        console.error('Error exporting sales summary:', error);
        return { success: false, message: `Error exporting sales summary: ${error.message}` };
    }
});

ipcMain.handle('export-inventory-valuation-csv', async () => {
    try {
        const inventory = await new Promise((resolve, reject) => {
            getInventoryForExport((err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        if (!inventory || inventory.length === 0) {
            return { success: false, message: 'No inventory data to export.' };
        }
        
        const header = ['ProductID', 'ProductName', 'CategoryName', 'SupplierName', 'QuantityInStock', 'UnitPrice', 'TotalValue'];
        const csvRows = [header.join(',')];

        inventory.forEach(item => {
            const row = [
                escapeCsvValue(item.ProductID),
                escapeCsvValue(item.ProductName),
                escapeCsvValue(item.CategoryName),
                escapeCsvValue(item.SupplierName),
                escapeCsvValue(item.QuantityInStock),
                escapeCsvValue(item.UnitPrice.toFixed(2)),
                escapeCsvValue(item.TotalValue.toFixed(2))
            ];
            csvRows.push(row.join(','));
        });
        
        const csvContent = csvRows.join('\n');
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const defaultFileName = `inventory_valuation_${currentDate}.csv`;
        const { filePath } = await dialog.showSaveDialog({
            title: 'Save Inventory Valuation CSV',
            defaultPath: defaultFileName,
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });

        if (filePath) {
            fs.writeFileSync(filePath, csvContent);
            return { success: true, message: `Inventory valuation exported to ${filePath}` };
        } else {
            return { success: false, message: 'Export cancelled by user.' };
        }
    } catch (error) {
        console.error('Error exporting inventory valuation:', error);
        return { success: false, message: `Error exporting inventory valuation: ${error.message}` };
    }
});

// --- POS IPC Handlers ---
ipcMain.handle('search-products-for-pos', async (event, searchTerm) => {
    return new Promise((resolve, reject) => {
        // Using a simple LIKE query for product name and also checking ID
        const sql = `
            SELECT id, name, price, quantity 
            FROM products 
            WHERE (name LIKE ? OR id = ?) AND quantity > 0 
            ORDER BY name
            LIMIT 10 
        `; // Limit results for performance
        const searchPattern = `%${searchTerm}%`;
        const searchId = /^\d+$/.test(searchTerm) ? parseInt(searchTerm) : -1; // Check if searchTerm is a valid number for ID search

        dbSetup.db.all(sql, [searchPattern, searchId], (err, products) => {
            if (err) {
                console.error('Error searching products for POS:', err);
                reject(err);
            } else {
                resolve(products);
            }
        });
    });
});

ipcMain.handle('process-sale', async (event, saleData) => {
    return new Promise((resolve, reject) => {
        if (!isOnline) {
            // OFFLINE: Save to local queue
            if (!currentUser || !currentUser.id) { // Still need user for offline record
                return resolve({ success: false, message: "User not identified for offline sale." });
            }
            const offlineSale = {
                ...saleData,
                userId: currentUser.id, // Add current user ID to the sale data
                sale_id_offline: `offline_${Date.now()}_${Math.floor(Math.random() * 1000)}`, // Unique offline ID
                status: 'pending_sync'
            };
            const offlineSales = readOfflineSales();
            offlineSales.push(offlineSale);
            writeOfflineSales(offlineSales);
            console.log('Sale processed OFFLINE and saved to queue.', offlineSale.sale_id_offline);
            // Note: Stock for offline sales is assumed to be managed/checked on the renderer side against cached quantities.
            // Main process doesn't try to update DB stock here for offline.
            return resolve({ success: true, saleId: offlineSale.sale_id_offline, offline: true, message: "Sale saved offline." });
        }

        // ONLINE: Process as before
        if (!currentUser || !currentUser.id) {
            return reject(new Error("User not logged in. Cannot process sale."));
        }
        const { items, totalAmount, saleDate } = saleData;

        if (!items || items.length === 0 || !items.every(item => item.product_id && item.quantity > 0 && item.price_at_sale >= 0)) {
            return resolve({ success: false, message: "Invalid sale items data." });
        }
        
        const { giftCardIdToUpdate, giftCardPaymentAmount: gcPaymentAmount } = saleData;

        dbSetup.addSale(currentUser.id, saleDate, totalAmount, items, saleData.promotionId, gcPaymentAmount, (err, saleId) => {
            if (err) {
                console.error('Error processing sale in main.js addSale (online):', err);
                // Check for specific DB connection errors to suggest offline mode
                if (err.message.includes("SQLITE_BUSY") || err.message.includes("SQLITE_ERROR")) { // Example error checks
                    return resolve({ success: false, message: `Database error: ${err.message}. Consider going offline.`, offerOffline: true });
                }
                return resolve({ success: false, message: err.message });
            }
            
            if (giftCardIdToUpdate && gcPaymentAmount > 0) {
                getGiftCardById(giftCardIdToUpdate, (gcErr, card) => { 
                    if (gcErr) {
                        console.error('Error fetching gift card for balance update (online):', gcErr);
                        return resolve({ success: true, saleId: saleId, warning: 'Sale processed but failed to update gift card balance.' });
                    }
                    if (!card) {
                         return resolve({ success: true, saleId: saleId, warning: 'Sale processed but gift card not found for balance update.' });
                    }
                    const newBalance = card.balance - gcPaymentAmount;
                    updateGiftCardBalance(giftCardIdToUpdate, newBalance, (updateErr) => {
                        if (updateErr) {
                            console.error('Error updating gift card balance (online):', updateErr);
                            return resolve({ success: true, saleId: saleId, warning: 'Sale processed but failed to update gift card balance post-deduction.' });
                        }
                        resolve({ success: true, saleId: saleId });
                    });
                });
            } else {
                resolve({ success: true, saleId: saleId });
            }
        });
    });
});

// --- Gift Card IPC Handlers ---
ipcMain.handle('issue-gift-card', async (event, { cardNumber, balance, expiryDate }) => {
    return new Promise((resolve) => {
        // Check for card number uniqueness first
        getGiftCardByNumber(cardNumber, (err, existingCard) => {
            if (err) {
                console.error("Error checking gift card uniqueness:", err);
                return resolve({ success: false, message: "Database error checking card uniqueness." });
            }
            if (existingCard) {
                return resolve({ success: false, message: "Gift card number already exists." });
            }
            issueGiftCard(cardNumber, balance, expiryDate, (issueErr, result) => {
                if (issueErr) {
                    console.error('Error issuing gift card:', issueErr);
                    return resolve({ success: false, message: 'Failed to issue gift card: ' + issueErr.message });
                }
                resolve({ success: true, id: result.id });
            });
        });
    });
});

ipcMain.handle('get-gift-card-by-number', async (event, cardNumber) => {
    return new Promise((resolve, reject) => {
        getGiftCardByNumber(cardNumber, (err, card) => {
            if (err) {
                console.error('Error getting gift card by number:', err);
                reject(err);
            } else {
                resolve(card); // card can be null if not found, handled by renderer
            }
        });
    });
});

ipcMain.handle('get-all-gift-cards', async () => {
    return new Promise((resolve, reject) => {
        getAllGiftCards((err, cards) => {
            if (err) {
                console.error('Error getting all gift cards:', err);
                reject(err);
            } else {
                resolve(cards);
            }
        });
    });
});

// Note: update-gift-card-balance is not directly exposed via IPC for manual updates.
// It's used internally by process-sale. If manual adjustment is needed, a separate IPC handler could be made.

// --- Online Status IPC Handlers ---
ipcMain.on('toggle-online-status', (event) => {
    isOnline = !isOnline;
    console.log(`Application is now ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    event.reply('online-status-changed', isOnline); // Inform renderer of status change
    // Optionally, trigger sync attempt if coming online and pending sales exist
    if (isOnline) {
        const offlineSales = readOfflineSales();
        if (offlineSales.length > 0) {
            // Inform renderer that sync can be attempted
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('can-sync-now', true);
            });
        }
    }
});

ipcMain.handle('get-online-status', async () => {
    return isOnline;
});

ipcMain.handle('sync-offline-sales', async () => {
    if (!isOnline) {
        return { success: false, message: "Cannot sync while offline." };
    }

    const offlineSales = readOfflineSales();
    if (offlineSales.length === 0) {
        return { success: true, message: "No offline sales to sync.", syncedCount: 0, failedCount: 0, errors: [] };
    }

    let syncedCount = 0;
    let failedCount = 0;
    const errors = [];
    const remainingSales = [];

    for (const sale of offlineSales) {
        // Reconstruct data for dbSetup.addSale, ensuring all necessary fields are present
        // The sale object from offline queue should already have userId
        const { items, totalAmount, saleDate, promotionId, giftCardPaymentAmount, userId, giftCardIdToUpdate } = sale;
        
        // It's crucial that `totalAmount` here is the final amount to be paid by cash/card,
        // and `giftCardPaymentAmount` is the amount covered by the gift card.
        // The sum of these two should be the grand total of the sale after all discounts.

        try {
            const saleId = await new Promise((resolve, reject) => {
                dbSetup.addSale(userId, saleDate, totalAmount, items, promotionId, giftCardPaymentAmount, (err, id) => {
                    if (err) return reject(err);
                    resolve(id);
                });
            });

            // If sale sync is successful and a gift card was used, update its balance
            if (giftCardIdToUpdate && giftCardPaymentAmount > 0) {
                await new Promise((resolve, reject) => {
                    getGiftCardById(giftCardIdToUpdate, (gcErr, card) => {
                        if (gcErr) return reject(new Error(`Fetching GC for sync failed: ${gcErr.message}`));
                        if (!card) return reject(new Error(`Gift card ${giftCardIdToUpdate} not found during sync.`));
                        
                        const newBalance = card.balance - giftCardPaymentAmount;
                        if (newBalance < 0) return reject(new Error(`Gift card ${card.card_number} would have negative balance after sync.`));

                        updateGiftCardBalance(giftCardIdToUpdate, newBalance, (updateErr) => {
                            if (updateErr) return reject(new Error(`Updating GC balance for sync failed: ${updateErr.message}`));
                            resolve();
                        });
                    });
                });
            }
            syncedCount++;
            console.log(`Offline sale ${sale.sale_id_offline || 'unknown_id'} synced successfully as Sale ID: ${saleId}`);
        } catch (error) {
            console.error(`Failed to sync offline sale ${sale.sale_id_offline || 'unknown_id'}:`, error);
            failedCount++;
            errors.push({ saleIdOffline: sale.sale_id_offline || 'unknown_id', error: error.message });
            remainingSales.push(sale); // Keep failed sale in the queue
        }
    }

    writeOfflineSales(remainingSales); // Update the offline sales file with only the ones that failed
    return { 
        success: true, 
        message: `Sync attempt completed. Synced: ${syncedCount}, Failed: ${failedCount}.`,
        syncedCount, 
        failedCount, 
        errors 
    };
});

// --- Reporting IPC Handlers ---
ipcMain.handle('get-sales-report', async (event, { startDate, endDate }) => {
    return new Promise((resolve, reject) => {
        getSalesByDateRange(startDate, endDate, (err, sales) => {
            if (err) {
                console.error('Error getting sales report:', err);
                reject(err);
            } else {
                resolve(sales);
            }
        });
    });
});

ipcMain.handle('get-popular-products-report', async (event, { startDate, endDate, limit }) => {
    return new Promise((resolve, reject) => {
        getPopularProducts(startDate, endDate, limit || 10, (err, products) => { // Default limit to 10
            if (err) {
                console.error('Error getting popular products report:', err);
                reject(err);
            } else {
                resolve(products);
            }
        });
    });
});

ipcMain.handle('get-stock-value-report', async () => {
    return new Promise((resolve, reject) => {
        getCurrentStockValue((err, result) => {
            if (err) {
                console.error('Error getting stock value report:', err);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
});

ipcMain.handle('get-transaction-summary-report', async (event, { startDate, endDate }) => {
    return new Promise((resolve, reject) => {
        getTransactionSummary(startDate, endDate, (err, summary) => {
            if (err) {
                console.error('Error getting transaction summary report:', err);
                reject(err);
            } else {
                resolve(summary);
            }
        });
    });
});

// --- Promotion IPC Handlers ---
ipcMain.on('add-promotion', (event, promoData) => {
    addPromotion(promoData, (err, result) => {
        if (err) {
            console.error('Error adding promotion:', err);
            event.reply('promotion-operation-error', 'Failed to add promotion: ' + err.message);
        } else {
            event.reply('promotion-operation-success', 'Promotion added successfully!');
        }
    });
});

ipcMain.handle('get-all-promotions', async () => {
    return new Promise((resolve, reject) => {
        getAllPromotions((err, promotions) => {
            if (err) reject(err);
            else resolve(promotions);
        });
    });
});

ipcMain.handle('get-active-promotions', async () => {
    return new Promise((resolve, reject) => {
        getActivePromotions((err, promotions) => {
            if (err) reject(err);
            else resolve(promotions);
        });
    });
});

ipcMain.handle('get-promotion-by-id', async (event, id) => {
    return new Promise((resolve, reject) => {
        getPromotionById(id, (err, promotion) => {
            if (err) reject(err);
            else resolve(promotion);
        });
    });
});

ipcMain.on('update-promotion', (event, { id, ...promoData }) => {
    updatePromotion(id, promoData, (err, result) => {
        if (err) {
            console.error('Error updating promotion:', err);
            event.reply('promotion-operation-error', 'Failed to update promotion: ' + err.message);
        }  else if (result.changes === 0) {
            event.reply('promotion-operation-error', 'Failed to update promotion: No such promotion found or no data changed.');
        } else {
            event.reply('promotion-operation-success', 'Promotion updated successfully!');
        }
    });
});

ipcMain.on('delete-promotion', (event, id) => {
    deletePromotion(id, (err, result) => {
        if (err) {
            console.error('Error deleting promotion:', err);
            event.reply('promotion-operation-error', 'Failed to delete promotion: ' + err.message);
        } else if (result.changes === 0) {
            event.reply('promotion-operation-error', 'Failed to delete promotion: No such promotion found.');
        }else {
            event.reply('promotion-operation-success', 'Promotion deleted successfully!');
        }
    });
});

// --- Supplier IPC Handlers ---
ipcMain.on('add-supplier', (event, supplierData) => {
    addSupplier(supplierData, (err, result) => {
        if (err) {
            console.error('Error adding supplier:', err);
            event.reply('supplier-operation-error', 'Failed to add supplier: ' + err.message);
        } else {
            event.reply('supplier-operation-success', 'Supplier added successfully!');
        }
    });
});

ipcMain.handle('get-suppliers', async (event) => {
    return new Promise((resolve, reject) => {
        getAllSuppliers((err, suppliers) => {
            if (err) {
                console.error('Error getting suppliers:', err);
                reject(err);
            } else {
                resolve(suppliers);
            }
        });
    });
});

ipcMain.handle('get-supplier-by-id', async (event, supplierId) => {
    return new Promise((resolve, reject) => {
        getSupplierById(supplierId, (err, supplier) => {
            if (err) {
                console.error('Error getting supplier by ID:', err);
                reject(err);
            } else {
                resolve(supplier);
            }
        });
    });
});

ipcMain.on('update-supplier', (event, { id, ...supplierData }) => {
    updateSupplier(id, supplierData, (err, result) => {
        if (err) {
            console.error('Error updating supplier:', err);
            event.reply('supplier-operation-error', 'Failed to update supplier: ' + err.message);
        } else if (result.changes === 0) {
            event.reply('supplier-operation-error', 'Failed to update supplier: No such supplier found or no data changed.');
        } else {
            event.reply('supplier-operation-success', 'Supplier updated successfully!');
        }
    });
});

ipcMain.on('delete-supplier', (event, supplierId) => {
    deleteSupplier(supplierId, (err, result) => {
        if (err) {
            console.error('Error deleting supplier:', err);
            event.reply('supplier-operation-error', 'Failed to delete supplier: ' + err.message);
        } else if (result.changes === 0) {
            event.reply('supplier-operation-error', 'Failed to delete supplier: No such supplier found.');
        } else {
            // Check if any products are associated with this supplier
            // This is a simplified check. In a real app, you might want to prevent deletion or reassign products.
            dbSetup.db.all("SELECT 1 FROM products WHERE supplier_id = ?", [supplierId], (err, rows) => {
                if (err) {
                    console.error('Error checking products for supplier:', err);
                    event.reply('supplier-operation-error', 'Error during supplier deletion integrity check.');
                    return;
                }
                if (rows && rows.length > 0) {
                     event.reply('supplier-operation-error', `Cannot delete supplier: Products are still associated with this supplier. Please reassign them first.`);
                } else {
                    event.reply('supplier-operation-success', 'Supplier deleted successfully!');
                }
            });
        }
    });
});

ipcMain.on('get-products', (event) => {
    getAllProducts((err, products) => {
        if (err) {
            console.error('Error getting products:', err);
            event.reply('products-data', []); // Send empty array on error
        } else {
            event.reply('products-data', products);
        }
    });
});

ipcMain.handle('get-product-by-id', async (event, productId) => {
    return new Promise((resolve, reject) => {
        getProductById(productId, (err, product) => {
            if (err) {
                console.error('Error getting product by ID:', err);
                reject(err);
            } else {
                resolve(product);
            }
        });
    });
});

ipcMain.on('update-product', (event, { id, ...productData }) => {
    updateProduct(id, productData, (err, result) => {
        if (err) {
            console.error('Error updating product:', err);
            event.reply('product-operation-error', 'Failed to update product: ' + err.message);
        } else if (result.changes === 0) {
            event.reply('product-operation-error', 'Failed to update product: No such product found or no data changed.');
        } 
        else {
            event.reply('product-operation-success', 'Product updated successfully!');
        }
    });
});

ipcMain.on('delete-product', (event, productId) => {
    deleteProduct(productId, (err, result) => {
        if (err) {
            console.error('Error deleting product:', err);
            event.reply('product-operation-error', 'Failed to delete product: ' + err.message);
        } else if (result.changes === 0) {
            event.reply('product-operation-error', 'Failed to delete product: No such product found.');
        } else {
            event.reply('product-operation-success', 'Product deleted successfully!');
        }
    });
});

// Categories
ipcMain.on('add-category', (event, categoryData) => {
    addCategory(categoryData.name, (err, result) => {
        if (err) {
            console.error('Error adding category:', err);
            event.reply('category-operation-error', 'Failed to add category: ' + err.message);
        } else {
            event.reply('category-operation-success', 'Category added successfully!');
        }
    });
});

ipcMain.handle('get-categories', async (event) => { // Using handle for renderer to await response
    return new Promise((resolve, reject) => {
        getAllCategories((err, categories) => {
            if (err) {
                console.error('Error getting categories:', err);
                reject(err); // Reject promise on error
            } else {
                resolve(categories); // Resolve promise with categories
            }
        });
    });
});
