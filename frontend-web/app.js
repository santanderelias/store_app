// Frontend application logic will go here.
// This includes view switching, API interactions, data rendering, etc.

const API_BASE_URL = 'http://localhost:3000/api';
const TAX_RATE = 0.05;

// Global state variables
let allProducts = [];
let currentSaleItems = [];

// DOM Elements
const views = document.querySelectorAll('.view');
const loginView = document.getElementById('login-view');
const mainNav = document.querySelector('.navbar'); // Main navigation bar
const navLinks = document.querySelectorAll('.nav-link[data-view]');
const logoutButton = document.getElementById('logout-button');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

// POS View Elements
const posProductSearchInput = document.getElementById('pos-product-search');
const posSearchResultsDiv = document.getElementById('pos-search-results');
const posCurrentSaleTableBody = document.getElementById('pos-current-sale-body');
const posSubtotalSpan = document.getElementById('pos-subtotal');
const posTaxSpan = document.getElementById('pos-tax');
const posGrandTotalSpan = document.getElementById('pos-grand-total');
const posCompleteSaleBtn = document.getElementById('pos-complete-sale-btn');
const posMessageDiv = document.getElementById('pos-message');

// Inventory View Elements
const inventoryView = document.getElementById('inventory-view');
const inventoryAddProductBtn = document.getElementById('inventory-add-product-btn');
const inventoryMessageDiv = document.getElementById('inventory-message');
const inventoryProductsTableBody = document.getElementById('inventory-products-table-body');

// Product Add/Edit Modal Elements
const productFormModalEl = document.getElementById('product-form-modal');
const productForm = document.getElementById('product-form');
const productFormModalLabel = document.getElementById('productFormModalLabel');
const productIdInput = document.getElementById('product-id');
const productNameInput = document.getElementById('product-name');
const productDescriptionInput = document.getElementById('product-description');
const productPriceInput = document.getElementById('product-price');
const productQuantityInput = document.getElementById('product-quantity');
const productCategorySelect = document.getElementById('product-category');
const productSupplierSelect = document.getElementById('product-supplier');
const productLowStockInput = document.getElementById('product-low-stock');
const productFormErrorDiv = document.getElementById('product-form-error');

let productModalInstance; // To store the Bootstrap Modal instance for products

// Supplier View Elements
const suppliersView = document.getElementById('suppliers-view');
const supplierAddBtn = document.getElementById('supplier-add-btn');
const supplierMessageDiv = document.getElementById('supplier-message');
const suppliersTableBody = document.getElementById('suppliers-table-body');

// Supplier Add/Edit Modal Elements
const supplierFormModalEl = document.getElementById('supplier-form-modal');
const supplierForm = document.getElementById('supplier-form');
const supplierFormModalLabel = document.getElementById('supplierFormModalLabel');
const supplierIdInput = document.getElementById('supplier-id');
const supplierNameInput = document.getElementById('supplier-name');
const supplierContactInput = document.getElementById('supplier-contact');
const supplierFormErrorDiv = document.getElementById('supplier-form-error');

let supplierModalInstance; // To store the Bootstrap Modal instance for suppliers


// Global state for categories and suppliers
let allCategories = [];
let allSuppliers = [];


// Store references to specific nav items that might change visibility
const mainAppNavItems = document.querySelectorAll('.navbar-nav .nav-item'); // All items like POS, Inventory etc.

/**
 * Helper function to make authenticated API calls.
 * @param {string} url The URL to fetch.
 * @param {object} options Fetch options.
 * @returns {Promise<Response>} The fetch promise.
 */
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('authToken');
    options.headers = { ...options.headers }; // Ensure headers object exists

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (!options.headers['Content-Type'] && (options.method === 'POST' || options.method === 'PUT')) {
        options.headers['Content-Type'] = 'application/json';
    }


    const response = await fetch(url, options);

    if (response.status === 401 || response.status === 403) {
        // Handle unauthorized access
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        updateNavUI(false);
        showView('login-view');
        // Potentially throw an error or return a specific object to indicate failure
        throw new Error('Unauthorized');
    }
    return response;
}


/**
 * Shows the specified view and hides others.
 * Manages navbar visibility based on the active view.
 * @param {string} viewId The ID of the view to show.
 */
function showView(viewId) {
    // Reset POS state when navigating away from pos-view
    if (document.getElementById('pos-view').style.display === 'block' && viewId !== 'pos-view') {
        resetPOSState();
    }
    // Reset inventory messages when navigating away from inventory-view
    if (document.getElementById('inventory-view').style.display === 'block' && viewId !== 'inventory-view') {
        if(inventoryMessageDiv) inventoryMessageDiv.textContent = '';
    }
    // Reset supplier messages when navigating away from suppliers-view
    if (document.getElementById('suppliers-view').style.display === 'block' && viewId !== 'suppliers-view') {
        if(supplierMessageDiv) supplierMessageDiv.textContent = '';
    }


    views.forEach(view => {
        view.style.display = 'none';
    });
    const activeView = document.getElementById(viewId);
    if (activeView) {
        activeView.style.display = 'block';
    }

    // Hide main navbar if login view is active, show otherwise
    if (viewId === 'login-view') {
        if (mainNav) mainNav.style.display = 'none';
    } else {
        if (mainNav) mainNav.style.display = ''; // Or 'flex' or 'block' depending on navbar type
        
        // Specific actions when a view is shown
        if (viewId === 'pos-view') {
            if (allProducts.length === 0) loadProductsForPOS(); // Load products for POS
        } else if (viewId === 'inventory-view') {
            loadInventoryView(); // Load inventory data
        } else if (viewId === 'suppliers-view') {
            loadSuppliersView(); // Load suppliers data
        }
    }
}

/**
 * Updates the navigation UI based on login state.
 * @param {boolean} isLoggedIn True if the user is logged in, false otherwise.
 */
function updateNavUI(isLoggedIn) {
    if (isLoggedIn) {
        logoutButton.style.display = 'block';
        mainAppNavItems.forEach(item => item.style.display = 'list-item'); // Show main app navigation
        // Potentially hide a "Login" link if it existed
    } else {
        logoutButton.style.display = 'none';
        mainAppNavItems.forEach(item => item.style.display = 'none'); // Hide main app navigation when logged out
        // Potentially show a "Login" link
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Login Form Submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            if (loginError) loginError.textContent = ''; // Clear previous errors

            try {
                const response = await fetch(`${API_BASE_URL}/users/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('currentUser', JSON.stringify(data.user));
                    updateNavUI(true);
                    showView('pos-view'); // Default view after login
                } else {
                    if (loginError) loginError.textContent = data.message || 'Login failed. Please try again.';
                }
            } catch (error) {
                console.error('Login request error:', error);
                if (loginError) loginError.textContent = 'An error occurred. Please try again later.';
            }
        });
    }

    // Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            updateNavUI(false);
            showView('login-view');
        });
    }

    // Navigation Links
    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const viewId = link.dataset.view;
            if (viewId) {
                // Check if user is trying to access a view that requires auth
                const token = localStorage.getItem('authToken');
                if (!token && viewId !== 'login-view') {
                    showView('login-view'); // Redirect to login if not authenticated
                } else {
                    showView(viewId);
                }
            }
        });
    });

    // POS Product Search Input Listener
    if (posProductSearchInput) {
        posProductSearchInput.addEventListener('input', () => {
            const searchTerm = posProductSearchInput.value.toLowerCase();
            if (searchTerm.length < 2) {
                if(posSearchResultsDiv) posSearchResultsDiv.innerHTML = '';
                return;
            }
            const filteredProducts = allProducts.filter(product =>
                product.name.toLowerCase().includes(searchTerm) ||
                product.id.toString().includes(searchTerm)
            );
            displayPOSSearchResults(filteredProducts);
        });
    }

    // POS Complete Sale Button Listener
    if (posCompleteSaleBtn) {
        posCompleteSaleBtn.addEventListener('click', async () => {
            if (posMessageDiv) { // Clear previous messages
                posMessageDiv.textContent = '';
                posMessageDiv.className = 'mt-3'; // Reset classes
            }

            // Input Validation: Check if currentSaleItems is empty
            if (currentSaleItems.length === 0) {
                if (posMessageDiv) {
                    posMessageDiv.textContent = 'Cannot complete an empty sale.';
                    posMessageDiv.className = 'alert alert-danger mt-3';
                }
                return;
            }

            // Calculate subtotal directly from currentSaleItems
            let subtotal = 0;
            currentSaleItems.forEach(item => {
                subtotal += item.price_at_sale * item.quantity;
            });
            subtotal = parseFloat(subtotal.toFixed(2)); // Ensure two decimal places

            // Construct saleData payload
            const saleData = {
                items: currentSaleItems.map(item => ({
                    product_id: item.id, // Assuming 'id' on the item in currentSaleItems is the product_id
                    quantity: item.quantity,
                    price_at_sale: item.price_at_sale,
                })),
                totalAmount: subtotal, // This is the subtotal (pre-tax)
                paymentMethod: "Cash", // Hardcoded as per requirement
            };

            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/sales`, {
                    method: 'POST',
                    body: JSON.stringify(saleData),
                    // Content-Type is handled by fetchWithAuth for JSON body
                });

                if (response.ok) { // Typically 201 for POST success
                    const saleConfirmation = await response.json();
                    if (posMessageDiv) {
                        posMessageDiv.textContent = `Sale completed successfully! Sale ID: ${saleConfirmation.saleId}. Grand Total: $${saleConfirmation.grandTotal.toFixed(2)}`;
                        posMessageDiv.className = 'alert alert-success mt-3';
                    }
                    resetPOSState();
                    await loadProductsForPOS(); // Refresh product list for updated stock
                } else {
                    // Handle non-2xx responses (e.g., 400, 409, 500)
                    const errorData = await response.json();
                    if (posMessageDiv) {
                        posMessageDiv.textContent = errorData.message || 'Error completing sale. Please try again.';
                        posMessageDiv.className = 'alert alert-danger mt-3';
                    }
                }
            } catch (error) {
                console.error('Complete Sale API call error:', error);
                if (posMessageDiv) {
                    // Check if it's an 'Unauthorized' error from fetchWithAuth
                    if (error.message === 'Unauthorized') {
                         posMessageDiv.textContent = 'Session expired or unauthorized. Please login again.';
                    } else {
                        posMessageDiv.textContent = 'A network error occurred or the server could not be reached. Please try again.';
                    }
                    posMessageDiv.className = 'alert alert-danger mt-3';
                }
            }
        });
    }

    // Inventory Add Product Button Listener
    if (inventoryAddProductBtn) {
        inventoryAddProductBtn.addEventListener('click', () => {
            openProductFormModal(); // Open modal in "Add" mode
        });
    }
    
    // Product Form Submit Listener
    if (productForm) {
        productForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (productFormErrorDiv) productFormErrorDiv.textContent = '';

            const formData = {
                name: productNameInput.value.trim(),
                description: productDescriptionInput.value.trim(),
                price: parseFloat(productPriceInput.value),
                quantity: parseInt(productQuantityInput.value, 10),
                category_id: productCategorySelect.value ? parseInt(productCategorySelect.value, 10) : null,
                supplier_id: productSupplierSelect.value ? parseInt(productSupplierSelect.value, 10) : null,
                low_stock_threshold: parseInt(productLowStockInput.value, 10)
            };

            const currentProductId = productIdInput.value;
            let response;
            let method = currentProductId ? 'PUT' : 'POST';
            let url = currentProductId ? `${API_BASE_URL}/products/${currentProductId}` : `${API_BASE_URL}/products`;

            try {
                response = await fetchWithAuth(url, {
                    method: method,
                    body: JSON.stringify(formData)
                });

                const resultData = await response.json();

                if (response.ok) {
                    if (inventoryMessageDiv) {
                         inventoryMessageDiv.textContent = `Product ${currentProductId ? 'updated' : 'added'} successfully.`;
                         inventoryMessageDiv.className = 'alert alert-success mb-3';
                    }
                    getProductModalInstance().hide();
                    loadInventoryView(); // Refresh table
                    loadProductsForPOS(); // Also refresh products for POS view
                } else {
                    if (productFormErrorDiv) productFormErrorDiv.textContent = resultData.message || `Error ${currentProductId ? 'updating' : 'adding'} product.`;
                }
            } catch (error) {
                console.error('Product form submission error:', error);
                if (productFormErrorDiv) productFormErrorDiv.textContent = 'An unexpected error occurred. Please try again.';
            }
        });
    }

    // Supplier Add Button Listener
    if (supplierAddBtn) {
        supplierAddBtn.addEventListener('click', () => {
            openSupplierFormModal();
        });
    }

    // Supplier Form Submit Listener
    if (supplierForm) {
        supplierForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (supplierFormErrorDiv) supplierFormErrorDiv.textContent = '';

            const supplierData = {
                name: supplierNameInput.value.trim(),
                contact_info: supplierContactInput.value.trim()
            };
            const currentSupplierId = supplierIdInput.value;
            let method = currentSupplierId ? 'PUT' : 'POST';
            let url = currentSupplierId ? `${API_BASE_URL}/suppliers/${currentSupplierId}` : `${API_BASE_URL}/suppliers`;

            try {
                const response = await fetchWithAuth(url, {
                    method: method,
                    body: JSON.stringify(supplierData)
                });
                const resultData = await response.json();

                if (response.ok) {
                    if (supplierMessageDiv) {
                        supplierMessageDiv.textContent = `Supplier ${currentSupplierId ? 'updated' : 'added'} successfully.`;
                        supplierMessageDiv.className = 'alert alert-success mb-3';
                    }
                    getSupplierModalInstance().hide();
                    loadSuppliersView();
                    loadInventoryView(); // Refresh inventory in case supplier changes affect product form dropdowns
                } else {
                     if (supplierFormErrorDiv) supplierFormErrorDiv.textContent = resultData.message || `Error ${currentSupplierId ? 'updating' : 'adding'} supplier.`;
                }
            } catch (error) {
                console.error('Supplier form submission error:', error);
                if (supplierFormErrorDiv) supplierFormErrorDiv.textContent = 'An unexpected error occurred. Please try again.';
            }
        });
    }

    // Initial UI setup
    const token = localStorage.getItem('authToken');
    if (token) {
        updateNavUI(true);
        showView('pos-view'); // Default view for logged-in users
    } else {
        updateNavUI(false);
        showView('login-view');
    }
    
    // Initialize the modal instances once
    if (productFormModalEl) {
        productModalInstance = new bootstrap.Modal(productFormModalEl);
    }
    if (supplierFormModalEl) {
        supplierModalInstance = new bootstrap.Modal(supplierFormModalEl);
    }
});

/**
 * Gets the Bootstrap Modal instance for the product form.
 * @returns {bootstrap.Modal} The modal instance.
 */
function getProductModalInstance() {
    if (!productModalInstance && productFormModalEl) {
        productModalInstance = new bootstrap.Modal(productFormModalEl);
    }
    return productModalInstance;
}

/**
 * Gets the Bootstrap Modal instance for the supplier form.
 * @returns {bootstrap.Modal} The modal instance.
 */
function getSupplierModalInstance() {
    if (!supplierModalInstance && supplierFormModalEl) {
        supplierModalInstance = new bootstrap.Modal(supplierFormModalEl);
    }
    return supplierModalInstance;
}


// --- POS Specific Functions ---

/**
 * Loads all products from the backend for POS search.
 */
async function loadProductsForPOS() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/products`);
        if (!response.ok) {
            console.warn(`Failed to load products for POS: ${response.statusText}`); // Use warn as this might not always be critical
            allProducts = []; // Ensure it's empty on error but don't necessarily block UI
            return;
        }
        allProducts = await response.json();
        if (posMessageDiv) posMessageDiv.textContent = ''; // Clear any previous messages
    } catch (error) {
        console.error('Error loading products for POS:', error);
        // Don't show error in posMessageDiv here as it might be for general errors.
        // Inventory view will handle its own product loading errors.
        allProducts = []; // Ensure it's empty on error
    }
}

/**
 * Displays product search results in the POS view.
 * @param {Array<object>} products Array of product objects to display.
 */
function displayPOSSearchResults(products) {
    if (!posSearchResultsDiv) return;
    posSearchResultsDiv.innerHTML = ''; // Clear previous results

    if (products.length === 0) {
        posSearchResultsDiv.innerHTML = '<p class="list-group-item">No products found.</p>';
        return;
    }

    products.forEach(product => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action';
        item.textContent = `${product.name} - $${product.price.toFixed(2)} (Stock: ${product.quantity})`;
        item.dataset.productId = product.id;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            addProductToSale(product);
        });
        posSearchResultsDiv.appendChild(item);
    });
}

/**
 * Adds a product to the current sale or increments its quantity.
 * @param {object} product The product object to add.
 */
function addProductToSale(product) {
    const existingItem = currentSaleItems.find(item => item.id === product.id);

    if (existingItem) {
        if (existingItem.quantity < product.quantity) { // Check against available stock
            existingItem.quantity++;
        } else {
            if (posMessageDiv) {
                posMessageDiv.textContent = `Cannot add more ${product.name}. Stock limit reached.`;
                posMessageDiv.className = 'alert alert-warning mt-3';
                setTimeout(() => { if(posMessageDiv) posMessageDiv.textContent = ''; }, 3000);
            }
        }
    } else {
        if (product.quantity > 0) { // Check if product is in stock
            currentSaleItems.push({ ...product, quantity: 1, price_at_sale: product.price });
        } else {
             if (posMessageDiv) {
                posMessageDiv.textContent = `${product.name} is out of stock.`;
                posMessageDiv.className = 'alert alert-warning mt-3';
                setTimeout(() => { if(posMessageDiv) posMessageDiv.textContent = ''; }, 3000);
            }
        }
    }
    renderCurrentSaleTable();
    updatePOSSummary();
    if (posProductSearchInput) posProductSearchInput.value = '';
    if (posSearchResultsDiv) posSearchResultsDiv.innerHTML = '';
}

/**
 * Renders the current sale items in the table.
 */
function renderCurrentSaleTable() {
    if (!posCurrentSaleTableBody) return;
    posCurrentSaleTableBody.innerHTML = ''; // Clear existing rows

    currentSaleItems.forEach((item, index) => {
        const row = posCurrentSaleTableBody.insertRow();
        row.insertCell().textContent = item.name;

        const qtyCell = row.insertCell();
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.className = 'form-control form-control-sm pos-item-qty-input';
        qtyInput.value = item.quantity;
        qtyInput.min = 1;
        qtyInput.dataset.index = index; // Store index for easy update
        qtyInput.addEventListener('change', (e) => {
            const newQuantity = parseInt(e.target.value, 10);
            const itemIndex = parseInt(e.target.dataset.index, 10);
            const productInSale = currentSaleItems[itemIndex];
            const originalProduct = allProducts.find(p => p.id === productInSale.id);

            if (newQuantity > 0 && originalProduct && newQuantity <= originalProduct.quantity) {
                productInSale.quantity = newQuantity;
            } else if (newQuantity > originalProduct.quantity) {
                qtyInput.value = productInSale.quantity; // Revert to old quantity
                 if (posMessageDiv) {
                    posMessageDiv.textContent = `Cannot set quantity for ${originalProduct.name} above stock limit (${originalProduct.quantity}).`;
                    posMessageDiv.className = 'alert alert-warning mt-3';
                    setTimeout(() => { if(posMessageDiv) posMessageDiv.textContent = ''; }, 3000);
                }
            } else { // newQuantity is 0 or less, or invalid
                qtyInput.value = productInSale.quantity; // Revert
            }
            renderCurrentSaleTable(); // Re-render to update totals if needed
            updatePOSSummary();
        });
        qtyCell.appendChild(qtyInput);

        row.insertCell().textContent = `$${item.price_at_sale.toFixed(2)}`;
        row.insertCell().textContent = `$${(item.price_at_sale * item.quantity).toFixed(2)}`;

        const actionsCell = row.insertCell();
        const removeButton = document.createElement('button');
        removeButton.className = 'btn btn-danger btn-sm';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => {
            currentSaleItems.splice(index, 1); // Remove item from array
            renderCurrentSaleTable();
            updatePOSSummary();
        });
        actionsCell.appendChild(removeButton);
    });
}

/**
 * Calculates and updates the sale summary (subtotal, tax, grand total).
 */
function updatePOSSummary() {
    let subtotal = 0;
    currentSaleItems.forEach(item => {
        subtotal += item.price_at_sale * item.quantity;
    });

    const taxAmount = subtotal * TAX_RATE;
    const grandTotal = subtotal + taxAmount;

    if (posSubtotalSpan) posSubtotalSpan.textContent = `$${subtotal.toFixed(2)}`;
    if (posTaxSpan) posTaxSpan.textContent = `$${taxAmount.toFixed(2)}`;
    if (posGrandTotalSpan) posGrandTotalSpan.textContent = `$${grandTotal.toFixed(2)}`;
}

/**
 * Resets the POS view state.
 */
function resetPOSState() {
    currentSaleItems = [];
    if (posProductSearchInput) posProductSearchInput.value = '';
    if (posSearchResultsDiv) posSearchResultsDiv.innerHTML = '';
    if (posCurrentSaleTableBody) posCurrentSaleTableBody.innerHTML = '';
    if (posMessageDiv) posMessageDiv.textContent = '';
    updatePOSSummary(); // Resets summary to $0.00
}

// --- Inventory Specific Functions ---

/**
 * Loads data for the inventory view (products, categories, suppliers).
 */
async function loadInventoryView() {
    if(inventoryMessageDiv) inventoryMessageDiv.textContent = ''; // Clear previous messages
    try {
        const [productsResponse, categoriesResponse, suppliersResponse] = await Promise.all([
            fetchWithAuth(`${API_BASE_URL}/products`),
            fetchWithAuth(`${API_BASE_URL}/categories`),
            fetchWithAuth(`${API_BASE_URL}/suppliers`)
        ]);

        if (!productsResponse.ok) throw new Error(`Failed to load products: ${productsResponse.statusText}`);
        if (!categoriesResponse.ok) throw new Error(`Failed to load categories: ${categoriesResponse.statusText}`);
        if (!suppliersResponse.ok) throw new Error(`Failed to load suppliers: ${suppliersResponse.statusText}`);

        const products = await productsResponse.json();
        allCategories = await categoriesResponse.json();
        allSuppliers = await suppliersResponse.json();
        
        // Update allProducts global cache if it's used by POS and needs to be consistent
        // or decide if inventory should use its own local copy. For now, let's update global:
        allProducts = products; 

        renderProductsTable(products);

    } catch (error) {
        console.error('Error loading inventory data:', error);
        if (inventoryMessageDiv) {
            inventoryMessageDiv.textContent = 'Error loading inventory data. Please try again.';
            inventoryMessageDiv.className = 'alert alert-danger mb-3';
        }
        if (inventoryProductsTableBody) inventoryProductsTableBody.innerHTML = '<tr><td colspan="6">Could not load products.</td></tr>';
    }
}

/**
 * Helper function to populate select dropdowns.
 * @param {HTMLSelectElement} selectElement The select element to populate.
 * @param {Array<object>} items Array of items to populate with.
 * @param {string} valueField The field name for the option value.
 * @param {string} textField The field name for the option text.
 * @param {string} defaultOptionText Text for the default, disabled option.
 */
function populateSelectWithOptions(selectElement, items, valueField = 'id', textField = 'name', defaultOptionText = 'Select...') {
    if (!selectElement) return;
    selectElement.innerHTML = ''; // Clear existing options

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = defaultOptionText;
    defaultOption.disabled = true;
    defaultOption.selected = true;
    selectElement.appendChild(defaultOption);

    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueField];
        option.textContent = item[textField];
        selectElement.appendChild(option);
    });
}

/**
 * Opens the product form modal for adding or editing a product.
 * @param {object|null} product Product object to edit, or null to add.
 */
function openProductFormModal(product = null) {
    if (!productForm) return;
    productForm.reset(); // Clear form fields
    if (productFormErrorDiv) productFormErrorDiv.textContent = '';
    if (productIdInput) productIdInput.value = ''; // Clear hidden ID

    // Populate category and supplier dropdowns
    populateSelectWithOptions(productCategorySelect, allCategories, 'id', 'name', 'Select Category');
    populateSelectWithOptions(productSupplierSelect, allSuppliers, 'id', 'name', 'Select Supplier');
    
    const modal = getProductModalInstance();

    if (product) {
        // Edit mode
        if (productFormModalLabel) productFormModalLabel.textContent = 'Edit Product';
        if (productIdInput) productIdInput.value = product.id;
        if (productNameInput) productNameInput.value = product.name;
        if (productDescriptionInput) productDescriptionInput.value = product.description || '';
        if (productPriceInput) productPriceInput.value = product.price;
        if (productQuantityInput) productQuantityInput.value = product.quantity;
        if (productCategorySelect) productCategorySelect.value = product.category_id || '';
        if (productSupplierSelect) productSupplierSelect.value = product.supplier_id || '';
        if (productLowStockInput) productLowStockInput.value = product.low_stock_threshold || 0;
    } else {
        // Add mode
        if (productFormModalLabel) productFormModalLabel.textContent = 'Add Product';
    }
    if(modal) modal.show();
}

/**
 * Renders the products table in the inventory view.
 * @param {Array<object>} products Array of product objects.
 */
function renderProductsTable(products) {
    if (!inventoryProductsTableBody) return;
    inventoryProductsTableBody.innerHTML = ''; // Clear existing rows

    if (products.length === 0) {
        inventoryProductsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No products found.</td></tr>';
        return;
    }

    products.forEach(product => {
        const row = inventoryProductsTableBody.insertRow();
        row.insertCell().textContent = product.name;
        
        const category = allCategories.find(c => c.id === product.category_id);
        row.insertCell().textContent = category ? category.name : 'N/A';
        
        row.insertCell().textContent = `$${product.price.toFixed(2)}`;
        
        const quantityCell = row.insertCell();
        quantityCell.textContent = product.quantity;
        if (product.quantity <= product.low_stock_threshold) {
            const badge = document.createElement('span');
            badge.className = `ms-2 badge ${product.quantity === 0 ? 'bg-danger' : 'bg-warning'}`;
            badge.textContent = product.quantity === 0 ? 'Out of Stock' : 'Low Stock';
            quantityCell.appendChild(badge);
        }
        
        row.insertCell().textContent = product.low_stock_threshold;

        const actionsCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.className = 'btn btn-sm btn-outline-primary me-2';
        editButton.textContent = 'Edit';
        editButton.dataset.productId = product.id;
        editButton.addEventListener('click', async () => {
            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/products/${product.id}`);
                if (!response.ok) throw new Error('Failed to fetch product details for editing.');
                const productDetails = await response.json();
                openProductFormModal(productDetails);
            } catch (error) {
                console.error('Error fetching product for edit:', error);
                if(inventoryMessageDiv) {
                    inventoryMessageDiv.textContent = 'Error fetching product details. Please try again.';
                    inventoryMessageDiv.className = 'alert alert-danger mb-3';
                }
            }
        });

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-sm btn-outline-danger';
        deleteButton.textContent = 'Delete';
        deleteButton.dataset.productId = product.id;
        deleteButton.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
                try {
                    const response = await fetchWithAuth(`${API_BASE_URL}/products/${product.id}`, { method: 'DELETE' });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to delete product.');
                    }
                    if(inventoryMessageDiv) {
                        inventoryMessageDiv.textContent = `Product "${product.name}" deleted successfully.`;
                        inventoryMessageDiv.className = 'alert alert-success mb-3';
                    }
                    loadInventoryView(); // Refresh table
                    loadProductsForPOS(); // Also refresh products for POS view
                } catch (error) {
                    console.error('Error deleting product:', error);
                     if(inventoryMessageDiv) {
                        inventoryMessageDiv.textContent = error.message || 'Error deleting product. Please try again.';
                        inventoryMessageDiv.className = 'alert alert-danger mb-3';
                    }
                }
            }
        });

        actionsCell.appendChild(editButton);
        actionsCell.appendChild(deleteButton);
    });
}

// --- Supplier Specific Functions ---

/**
 * Loads data for the suppliers view.
 */
async function loadSuppliersView() {
    if(supplierMessageDiv) supplierMessageDiv.textContent = '';

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const isAdmin = currentUser && currentUser.role === 'admin';
    if (supplierAddBtn) supplierAddBtn.style.display = isAdmin ? 'block' : 'none';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/suppliers`);
        if (!response.ok) {
            throw new Error(`Failed to load suppliers: ${response.statusText}`);
        }
        const suppliers = await response.json();
        allSuppliers = suppliers; // Update global cache, might be useful for product form
        renderSuppliersTable(suppliers);
    } catch (error) {
        console.error('Error loading suppliers:', error);
        if (supplierMessageDiv) {
            supplierMessageDiv.textContent = 'Error loading suppliers. Please try again.';
            supplierMessageDiv.className = 'alert alert-danger mb-3';
        }
        if (suppliersTableBody) suppliersTableBody.innerHTML = '<tr><td colspan="3">Could not load suppliers.</td></tr>';
    }
}

/**
 * Renders the suppliers table in the suppliers view.
 * @param {Array<object>} suppliers Array of supplier objects.
 */
function renderSuppliersTable(suppliers) {
    if (!suppliersTableBody) return;
    suppliersTableBody.innerHTML = '';

    if (suppliers.length === 0) {
        suppliersTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No suppliers found.</td></tr>';
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const isAdmin = currentUser && currentUser.role === 'admin';

    suppliers.forEach(supplier => {
        const row = suppliersTableBody.insertRow();
        row.insertCell().textContent = supplier.name;
        row.insertCell().textContent = supplier.contact_info || 'N/A';

        const actionsCell = row.insertCell();
        if (isAdmin) {
            const editButton = document.createElement('button');
            editButton.className = 'btn btn-sm btn-outline-primary me-2';
            editButton.textContent = 'Edit';
            editButton.dataset.supplierId = supplier.id;
            editButton.addEventListener('click', async () => {
                try {
                    const response = await fetchWithAuth(`${API_BASE_URL}/suppliers/${supplier.id}`);
                    if (!response.ok) throw new Error('Failed to fetch supplier details.');
                    const supplierDetails = await response.json();
                    openSupplierFormModal(supplierDetails);
                } catch (error) {
                     console.error('Error fetching supplier for edit:', error);
                    if(supplierMessageDiv) {
                        supplierMessageDiv.textContent = 'Error fetching supplier details. Please try again.';
                        supplierMessageDiv.className = 'alert alert-danger mb-3';
                    }
                }
            });

            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-sm btn-outline-danger';
            deleteButton.textContent = 'Delete';
            deleteButton.dataset.supplierId = supplier.id;
            deleteButton.addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete supplier "${supplier.name}"?`)) {
                    try {
                        const response = await fetchWithAuth(`${API_BASE_URL}/suppliers/${supplier.id}`, { method: 'DELETE' });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || 'Failed to delete supplier.');
                        }
                        if(supplierMessageDiv) {
                            supplierMessageDiv.textContent = `Supplier "${supplier.name}" deleted successfully.`;
                            supplierMessageDiv.className = 'alert alert-success mb-3';
                        }
                        loadSuppliersView(); // Refresh table
                         loadInventoryView(); // Also refresh inventory products if suppliers dropdown needs update
                    } catch (error) {
                        console.error('Error deleting supplier:', error);
                        if(supplierMessageDiv) {
                            supplierMessageDiv.textContent = error.message || 'Error deleting supplier. Please try again.';
                            supplierMessageDiv.className = 'alert alert-danger mb-3';
                        }
                    }
                }
            });
            actionsCell.appendChild(editButton);
            actionsCell.appendChild(deleteButton);
        } else {
            actionsCell.textContent = 'N/A'; // Or an empty string
        }
    });
}

/**
 * Opens the supplier form modal for adding or editing a supplier.
 * @param {object|null} supplier Supplier object to edit, or null to add.
 */
function openSupplierFormModal(supplier = null) {
    if (!supplierForm) return;
    supplierForm.reset();
    if (supplierFormErrorDiv) supplierFormErrorDiv.textContent = '';
    if (supplierIdInput) supplierIdInput.value = '';

    const modal = getSupplierModalInstance();
    if (supplier) {
        if (supplierFormModalLabel) supplierFormModalLabel.textContent = 'Edit Supplier';
        if (supplierIdInput) supplierIdInput.value = supplier.id;
        if (supplierNameInput) supplierNameInput.value = supplier.name;
        if (supplierContactInput) supplierContactInput.value = supplier.contact_info || '';
    } else {
        if (supplierFormModalLabel) supplierFormModalLabel.textContent = 'Add Supplier';
    }
    if(modal) modal.show();
}
