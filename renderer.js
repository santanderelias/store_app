const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    // --- Auth Elements ---
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const logoutButton = document.getElementById('logout-button');
    const registerMessage = document.getElementById('register-message');
    const loginMessage = document.getElementById('login-message');
    const welcomeMessage = document.getElementById('welcome-message');
    const authForms = document.getElementById('auth-forms');
    const mainContent = document.getElementById('main-content');

    // --- Inventory Management Elements ---
    const productFormModal = document.getElementById('product-form-modal');
    const productForm = document.getElementById('product-form');
    const productFormTitle = document.getElementById('product-form-title');
    const categoryMessage = document.getElementById('category-message');
    const productFormMessage = document.getElementById('product-form-message');
    const showAddProductFormButton = document.getElementById('show-add-product-form-button');
    const cancelProductFormButton = document.getElementById('cancel-product-form-button');
    const addCategoryForm = document.getElementById('add-category-form');
    const productsTableBody = document.getElementById('products-table-body');
    const categoriesList = document.getElementById('categories-list');
    const productCategorySelect = document.getElementById('product-category');
    const productSupplierSelect = document.getElementById('product-supplier');

    // --- Supplier Management Elements ---
    const supplierFormModal = document.getElementById('supplier-form-modal');
    const supplierForm = document.getElementById('supplier-form');
    const supplierFormTitle = document.getElementById('supplier-form-title');
    const showAddSupplierFormButton = document.getElementById('show-add-supplier-form-button');
    const cancelSupplierFormButton = document.getElementById('cancel-supplier-form-button');
    const supplierFormMessage = document.getElementById('supplier-form-message');
    const suppliersTableBody = document.getElementById('suppliers-table-body');
    
    // --- Promotion Management Elements ---
    const promotionFormModal = document.getElementById('promotion-form-modal');
    const promotionForm = document.getElementById('promotion-form');
    const promotionFormTitle = document.getElementById('promotion-form-title');
    const showAddPromotionFormButton = document.getElementById('show-add-promotion-form-button');
    const cancelPromotionFormButton = document.getElementById('cancel-promotion-form-button');
    const promotionFormMessage = document.getElementById('promotion-form-message');
    const promotionsTableBody = document.getElementById('promotions-table-body');
    const posPromotionSelect = document.getElementById('pos-promotion-select');
    let activePromotionsCache = {}; 

    // --- Gift Card Management Elements ---
    const issueGiftCardForm = document.getElementById('issue-gift-card-form');
    const generateGcNumberButton = document.getElementById('generate-gc-number-button');
    const issueGcMessage = document.getElementById('issue-gc-message');
    const giftCardsTableBody = document.getElementById('gift-cards-table-body');

    // --- POS Elements ---
    const posProductSearchInput = document.getElementById('pos-product-search');
    const posSearchResultsDiv = document.getElementById('pos-search-results');
    const posCurrentSaleBody = document.getElementById('pos-current-sale-body');
    const posSubtotalSpan = document.getElementById('pos-subtotal');
    const posTaxSpan = document.getElementById('pos-tax');
    const posDiscountInput = document.getElementById('pos-discount');
    const posPromotionDiscountAmountSpan = document.getElementById('pos-promotion-discount-amount');
    const posGrandTotalSpan = document.getElementById('pos-grand-total');
    const processSaleButton = document.getElementById('process-sale-button');
    const posMessage = document.getElementById('pos-message');
    const paymentMethodButtons = document.querySelectorAll('.payment-method-button');
    const posPaymentMethodInput = document.getElementById('pos-payment-method');
    const receiptModal = document.getElementById('receipt-modal');
    const closeReceiptModalButton = document.getElementById('close-receipt-modal-button');
    
    // POS Gift Card Elements
    const payWithGiftCardButton = document.getElementById('pay-with-gift-card-button');
    const giftCardPaymentArea = document.getElementById('gift-card-payment-area');
    const giftCardNumberInput = document.getElementById('gift-card-number-input');
    const verifyGiftCardButton = document.getElementById('verify-gift-card-button');
    const giftCardMessage = document.getElementById('gift-card-message');
    const giftCardAppliedAmountSpan = document.getElementById('gift-card-applied-amount');
    let currentVerifiedGiftCard = null; 
    let giftCardPaymentAmount = 0; // This will store the amount paid by gift card for the current sale

    let currentSaleItems = []; 
    const TAX_RATE = 0.05;

    // --- Auth Logic ---
    if (registerForm) {
        registerForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const username = document.getElementById('reg-username').value;
            const password = document.getElementById('reg-password').value;
            const role = document.getElementById('reg-role').value;
            ipcRenderer.send('register-user', { username, password, role });
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            ipcRenderer.send('login-user', { username, password });
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            if(authForms) authForms.style.display = 'block';
            if(mainContent) mainContent.style.display = 'none';
            if(welcomeMessage) welcomeMessage.textContent = '';
            if(loginMessage) loginMessage.textContent = '';
            if(registerMessage) registerMessage.textContent = '';
            currentSaleItems = []; 
            resetPOS();
            ipcRenderer.send('logout-user');
        });
    }

    ipcRenderer.on('register-reply', (event, arg) => {
        if(registerMessage) {
            if (arg.success) {
                registerMessage.textContent = 'Registration successful! You can now log in.';
                registerMessage.className = 'success-message';
                if(registerForm) registerForm.reset();
            } else {
                registerMessage.textContent = `Registration failed: ${arg.message}`;
                registerMessage.className = 'error-message';
            }
        }
    });

    ipcRenderer.on('login-reply', (event, arg) => {
        if(loginMessage){
            if (arg.success) {
                loginMessage.textContent = 'Login successful!';
                loginMessage.className = 'success-message';
                if(loginForm) loginForm.reset();
                if(authForms) authForms.style.display = 'none';
                if(mainContent) mainContent.style.display = 'block';
                if(welcomeMessage) welcomeMessage.textContent = `Welcome, ${arg.username}! (Role: ${arg.role})`;
                console.log('User logged in:', arg.username, 'Role:', arg.role);
                loadInventoryData();
                loadPromotions();
                loadGiftCards();
            } else {
                loginMessage.textContent = `Login failed: ${arg.message}`;
                loginMessage.className = 'error-message';
            }
        }
    });

    // --- Inventory Management Logic ---
    function openProductForm(mode = 'add', product = null) {
        if (!productForm) return;
        productForm.reset();
        if(productFormMessage) productFormMessage.textContent = '';
        const productIdField = document.getElementById('product-id');
        if(productIdField) productIdField.value = '';

        if (mode === 'edit' && product) {
            if(productFormTitle) productFormTitle.textContent = 'Edit Product';
            if(productIdField) productIdField.value = product.id;
            const productName = document.getElementById('product-name');
            if(productName) productName.value = product.name;
            const productDesc = document.getElementById('product-description');
            if(productDesc) productDesc.value = product.description || '';
            const productPrice = document.getElementById('product-price');
            if(productPrice) productPrice.value = product.price;
            const productQty = document.getElementById('product-quantity');
            if(productQty) productQty.value = product.quantity;
            const productCat = document.getElementById('product-category');
            if(productCat) productCat.value = product.category_id || '';
            const productSup = document.getElementById('product-supplier');
            if(productSup) productSup.value = product.supplier_id || '';
            const productLowStock = document.getElementById('product-low-stock');
            if(productLowStock) productLowStock.value = product.low_stock_threshold;
        } else {
            if(productFormTitle) productFormTitle.textContent = 'Add New Product';
        }
        if(productFormModal) productFormModal.style.display = 'flex';
        loadCategoriesIntoSelect(product ? product.category_id : null);
        loadSuppliersIntoSelect(product ? product.supplier_id : null);
    }

    function closeProductForm() {
        if(productFormModal) productFormModal.style.display = 'none';
    }

    if (showAddProductFormButton) showAddProductFormButton.addEventListener('click', () => openProductForm('add'));
    if (cancelProductFormButton) cancelProductFormButton.addEventListener('click', closeProductForm);

    if (productForm) {
        productForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const id = document.getElementById('product-id').value;
            const productData = {
                name: document.getElementById('product-name').value,
                description: document.getElementById('product-description').value,
                price: parseFloat(document.getElementById('product-price').value),
                quantity: parseInt(document.getElementById('product-quantity').value),
                category_id: parseInt(document.getElementById('product-category').value) || null,
                supplier_id: parseInt(document.getElementById('product-supplier').value) || null,
                low_stock_threshold: parseInt(document.getElementById('product-low-stock').value)
            };
            if (id) ipcRenderer.send('update-product', { id, ...productData });
            else ipcRenderer.send('add-product', productData);
        });
    }

    if (addCategoryForm) {
        addCategoryForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const categoryName = document.getElementById('category-name').value;
            if (categoryName) {
                ipcRenderer.send('add-category', { name: categoryName });
                addCategoryForm.reset();
            }
        });
    }

    function loadInventoryData() {
        ipcRenderer.send('get-products');
        ipcRenderer.send('get-categories');
        ipcRenderer.send('get-suppliers');
    }

    function loadCategoriesIntoSelect(selectedCategoryId = null) {
        if (!productCategorySelect) return;
        productCategorySelect.innerHTML = '<option value="">Select Category</option>';
        ipcRenderer.invoke('get-categories').then(categories => {
            if(categories){
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    if (selectedCategoryId && category.id === selectedCategoryId) option.selected = true;
                    productCategorySelect.appendChild(option);
                });
            }
        }).catch(err => console.error("Failed to load categories into select:", err));
    }

    function loadSuppliersIntoSelect(selectedSupplierId = null) {
        if (!productSupplierSelect) return;
        productSupplierSelect.innerHTML = '<option value="">Select Supplier (Optional)</option>';
        ipcRenderer.invoke('get-suppliers').then(suppliers => {
            if(suppliers){
                suppliers.forEach(supplier => {
                    const option = document.createElement('option');
                    option.value = supplier.id;
                    option.textContent = supplier.name;
                    if (selectedSupplierId && supplier.id === selectedSupplierId) option.selected = true;
                    productSupplierSelect.appendChild(option);
                });
            }
        }).catch(err => console.error("Failed to load suppliers into select:", err));
    }
    
    ipcRenderer.on('products-data', (event, products) => {
        if (!productsTableBody) return;
        productsTableBody.innerHTML = '';
        if(products){
            products.forEach(product => {
                const row = productsTableBody.insertRow();
                row.insertCell().textContent = product.name;
                row.insertCell().textContent = product.price;
                row.insertCell().textContent = product.quantity;
                row.insertCell().textContent = product.category_name || 'N/A';
                row.insertCell().textContent = product.supplier_name || 'N/A';
                const actionsCell = row.insertCell();
                const editButton = document.createElement('button');
                editButton.textContent = 'Edit';
                editButton.onclick = () => {
                    ipcRenderer.invoke('get-product-by-id', product.id).then(fullProduct => {
                         openProductForm('edit', fullProduct);
                    }).catch(err => {
                        console.error('Error fetching product for edit:', err);
                        if(productFormMessage) productFormMessage.textContent = 'Error fetching product details.';
                    });
                };
                actionsCell.appendChild(editButton);
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.style.marginLeft = '5px';
                deleteButton.onclick = () => {
                    if (confirm(`Are you sure you want to delete ${product.name}?`)) {
                        ipcRenderer.send('delete-product', product.id);
                    }
                };
                actionsCell.appendChild(deleteButton);
                if (product.quantity <= product.low_stock_threshold) row.style.backgroundColor = '#ffdddd';
            });
        }
    });

    ipcRenderer.on('categories-data', (event, categories) => {
        if (categoriesList) categoriesList.innerHTML = '';
        if (categories) {
            categories.forEach(category => {
                if (categoriesList) {
                    const listItem = document.createElement('li');
                    listItem.textContent = category.name;
                    listItem.style.padding = '5px 0';
                    listItem.style.borderBottom = '1px solid #eee';
                    categoriesList.appendChild(listItem);
                }
            });
        }
    });

    ipcRenderer.on('product-operation-success', (event, message) => {
        if(productFormMessage) {
            productFormMessage.textContent = message;
            productFormMessage.className = 'success-message';
        }
        loadInventoryData();
        setTimeout(() => {
            closeProductForm();
            if(productFormMessage) productFormMessage.textContent = '';
        }, 1500);
    });

    ipcRenderer.on('product-operation-error', (event, message) => {
        if(productFormMessage) {
            productFormMessage.textContent = message;
            productFormMessage.className = 'error-message';
        }
    });
    
    ipcRenderer.on('category-operation-success', (event, message) => {
        if(categoryMessage) {
            categoryMessage.textContent = message;
            categoryMessage.className = 'success-message';
        }
        loadInventoryData(); 
        loadCategoriesIntoSelect();
        setTimeout(() => {
            if(categoryMessage) categoryMessage.textContent = '';
        }, 1500);
    });

    ipcRenderer.on('category-operation-error', (event, message) => {
        if(categoryMessage) {
            categoryMessage.textContent = message;
            categoryMessage.className = 'error-message';
        }
    });

    // --- Supplier Management Logic ---
    function openSupplierForm(mode = 'add', supplier = null) {
        if (!supplierForm) return;
        supplierForm.reset();
        if(supplierFormMessage) supplierFormMessage.textContent = '';
        const supplierIdField = document.getElementById('supplier-id');
        if(supplierIdField) supplierIdField.value = '';

        if (mode === 'edit' && supplier) {
            if(supplierFormTitle) supplierFormTitle.textContent = 'Edit Supplier';
            if(supplierIdField) supplierIdField.value = supplier.id;
            const supplierNameField = document.getElementById('supplier-name');
            if(supplierNameField) supplierNameField.value = supplier.name;
            const supplierContactField = document.getElementById('supplier-contact');
            if(supplierContactField) supplierContactField.value = supplier.contact_info || '';
        } else {
            if(supplierFormTitle) supplierFormTitle.textContent = 'Add New Supplier';
        }
        if(supplierFormModal) supplierFormModal.style.display = 'flex';
    }

    function closeSupplierForm() {
        if(supplierFormModal) supplierFormModal.style.display = 'none';
    }

    if (showAddSupplierFormButton) showAddSupplierFormButton.addEventListener('click', () => openSupplierForm('add'));
    if (cancelSupplierFormButton) cancelSupplierFormButton.addEventListener('click', closeSupplierForm);
    
    if (supplierForm) {
        supplierForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const id = document.getElementById('supplier-id') ? document.getElementById('supplier-id').value : null;
            const supplierName = document.getElementById('supplier-name') ? document.getElementById('supplier-name').value : null;
            const supplierContact = document.getElementById('supplier-contact') ? document.getElementById('supplier-contact').value : null;
            if (!supplierName) {
                if(supplierFormMessage) supplierFormMessage.textContent = "Supplier name is required.";
                return;
            }
            const supplierData = { name: supplierName, contact_info: supplierContact };
            if (id) ipcRenderer.send('update-supplier', { id, ...supplierData });
            else ipcRenderer.send('add-supplier', supplierData);
        });
    }
    
    ipcRenderer.on('suppliers-data', (event, suppliers) => {
        if (suppliersTableBody) {
            suppliersTableBody.innerHTML = '';
            if(suppliers){
                suppliers.forEach(supplier => {
                    const row = suppliersTableBody.insertRow();
                    row.insertCell().textContent = supplier.name;
                    row.insertCell().textContent = supplier.contact_info || 'N/A';
                    const actionsCell = row.insertCell();
                    const editButton = document.createElement('button');
                    editButton.textContent = 'Edit';
                    editButton.onclick = () => {
                        ipcRenderer.invoke('get-supplier-by-id', supplier.id).then(fullSupplier => {
                            openSupplierForm('edit', fullSupplier);
                        }).catch(err => {
                            console.error('Error fetching supplier for edit:', err);
                            if(supplierFormMessage) supplierFormMessage.textContent = 'Error fetching supplier details.';
                        });
                    };
                    actionsCell.appendChild(editButton);
                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Delete';
                    deleteButton.style.marginLeft = '5px';
                    deleteButton.onclick = () => {
                        if (confirm(`Are you sure you want to delete supplier ${supplier.name}?`)) {
                            ipcRenderer.send('delete-supplier', supplier.id);
                        }
                    };
                    actionsCell.appendChild(deleteButton);
                });
            }
        }
    });

    ipcRenderer.on('supplier-operation-success', (event, message) => {
        if(supplierFormMessage) {
            supplierFormMessage.textContent = message;
            supplierFormMessage.className = 'success-message';
        }
        loadInventoryData(); 
        loadSuppliersIntoSelect(); 
        setTimeout(() => {
            closeSupplierForm();
            if(supplierFormMessage) supplierFormMessage.textContent = '';
        }, 1500);
    });

    ipcRenderer.on('supplier-operation-error', (event, message) => {
        if(supplierFormMessage) {
            supplierFormMessage.textContent = message;
            supplierFormMessage.className = 'error-message';
        }
    });

    // --- Promotion Management Logic ---
    function openPromotionForm(mode = 'add', promotion = null) {
        if (!promotionForm) return;
        promotionForm.reset();
        if(promotionFormMessage) promotionFormMessage.textContent = '';
        const promotionIdField = document.getElementById('promotion-id');
        if(promotionIdField) promotionIdField.value = '';

        if (mode === 'edit' && promotion) {
            if(promotionFormTitle) promotionFormTitle.textContent = 'Edit Promotion';
            if(promotionIdField) promotionIdField.value = promotion.id;
            const promoName = document.getElementById('promotion-name');
            if(promoName) promoName.value = promotion.name;
            const promoDesc = document.getElementById('promotion-description');
            if(promoDesc) promoDesc.value = promotion.description || '';
            const promoType = document.getElementById('promotion-type');
            if(promoType) promoType.value = promotion.type;
            const promoValue = document.getElementById('promotion-value');
            if(promoValue) promoValue.value = promotion.value;
            const promoStart = document.getElementById('promotion-start-date');
            if(promoStart) promoStart.value = promotion.start_date ? promotion.start_date.slice(0, 16) : '';
            const promoEnd = document.getElementById('promotion-end-date');
            if(promoEnd) promoEnd.value = promotion.end_date ? promotion.end_date.slice(0, 16) : '';
        } else {
            if(promotionFormTitle) promotionFormTitle.textContent = 'Add New Promotion';
        }
        if(promotionFormModal) promotionFormModal.style.display = 'flex';
    }

    function closePromotionForm() {
        if(promotionFormModal) promotionFormModal.style.display = 'none';
    }

    if (showAddPromotionFormButton) showAddPromotionFormButton.addEventListener('click', () => openPromotionForm('add'));
    if (cancelPromotionFormButton) cancelPromotionFormButton.addEventListener('click', closePromotionForm);

    if (promotionForm) {
        promotionForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const id = document.getElementById('promotion-id').value;
            const promotionData = {
                name: document.getElementById('promotion-name').value,
                description: document.getElementById('promotion-description').value,
                type: document.getElementById('promotion-type').value,
                value: parseFloat(document.getElementById('promotion-value').value),
                start_date: document.getElementById('promotion-start-date').value,
                end_date: document.getElementById('promotion-end-date').value,
            };
            if (!promotionData.start_date || !promotionData.end_date) {
                if(promotionFormMessage) promotionFormMessage.textContent = 'Start and End dates are required.';
                return;
            }
            if (new Date(promotionData.start_date) >= new Date(promotionData.end_date)) {
                 if(promotionFormMessage) promotionFormMessage.textContent = 'End date must be after start date.';
                return;
            }
            if (id) ipcRenderer.send('update-promotion', { id, ...promotionData });
            else ipcRenderer.send('add-promotion', promotionData);
        });
    }
    
    function loadPromotions() {
        ipcRenderer.invoke('get-all-promotions').then(promotions => {
            if(promotionsTableBody) {
                promotionsTableBody.innerHTML = '';
                if(promotions){
                    promotions.forEach(promo => {
                        const row = promotionsTableBody.insertRow();
                        row.insertCell().textContent = promo.name;
                        row.insertCell().textContent = promo.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        row.insertCell().textContent = promo.type.includes('percentage') ? `${promo.value}%` : `$${promo.value.toFixed(2)}`;
                        row.insertCell().textContent = new Date(promo.start_date).toLocaleString();
                        row.insertCell().textContent = new Date(promo.end_date).toLocaleString();
                        const actionsCell = row.insertCell();
                        const editButton = document.createElement('button');
                        editButton.textContent = 'Edit';
                        editButton.onclick = () => {
                            ipcRenderer.invoke('get-promotion-by-id', promo.id).then(fullPromo => {
                                openPromotionForm('edit', fullPromo);
                            }).catch(err => {
                                console.error('Error fetching promotion for edit:', err);
                                if(promotionFormMessage) promotionFormMessage.textContent = 'Error fetching promotion details.';
                            });
                        };
                        actionsCell.appendChild(editButton);
                        const deleteButton = document.createElement('button');
                        deleteButton.textContent = 'Delete';
                        deleteButton.style.marginLeft = '5px';
                        deleteButton.onclick = () => {
                            if (confirm(`Are you sure you want to delete promotion "${promo.name}"?`)) {
                                ipcRenderer.send('delete-promotion', promo.id);
                            }
                        };
                        actionsCell.appendChild(deleteButton);
                    });
                }
            }
        }).catch(err => console.error("Failed to load promotions:", err));

        ipcRenderer.invoke('get-active-promotions').then(promotions => {
            if(posPromotionSelect) {
                posPromotionSelect.innerHTML = '<option value="">None</option>';
                activePromotionsCache = {};
                if(promotions){
                    promotions.forEach(promo => {
                        const option = document.createElement('option');
                        option.value = promo.id;
                        option.textContent = `${promo.name} (${promo.type.includes('percentage') ? `${promo.value}% off` : `$${promo.value.toFixed(2)} off`})`;
                        posPromotionSelect.appendChild(option);
                        activePromotionsCache[promo.id] = promo;
                    });
                }
            }
        }).catch(err => console.error("Failed to load active promotions for POS:", err));
    }

    ipcRenderer.on('promotion-operation-success', (event, message) => {
        if(promotionFormMessage) {
            promotionFormMessage.textContent = message;
            promotionFormMessage.className = 'success-message';
        }
        loadPromotions();
        setTimeout(() => {
            closePromotionForm();
            if(promotionFormMessage) promotionFormMessage.textContent = '';
        }, 1500);
    });

    ipcRenderer.on('promotion-operation-error', (event, message) => {
        if(promotionFormMessage) {
            promotionFormMessage.textContent = message;
            promotionFormMessage.className = 'error-message';
        }
    });

    // --- Gift Card Management Logic ---
    if (generateGcNumberButton) {
        generateGcNumberButton.addEventListener('click', () => {
            const timestamp = Date.now();
            const randomNumber = Math.floor(Math.random() * 10000);
            const gcCardNumberField = document.getElementById('gc-card-number');
            if(gcCardNumberField) gcCardNumberField.value = `GC-${timestamp}-${randomNumber}`;
        });
    }

    if (issueGiftCardForm) {
        issueGiftCardForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const cardNumber = document.getElementById('gc-card-number').value;
            const balance = parseFloat(document.getElementById('gc-balance').value);
            const expiryDate = document.getElementById('gc-expiry-date').value;

            if (!cardNumber || !balance || !expiryDate) {
                if(issueGcMessage) issueGcMessage.textContent = 'All fields are required.';
                return;
            }
            if (new Date(expiryDate) < new Date().setHours(0,0,0,0)) {
                if(issueGcMessage) issueGcMessage.textContent = 'Expiry date cannot be in the past.';
                return;
            }

            ipcRenderer.invoke('issue-gift-card', { cardNumber, balance, expiryDate })
                .then(result => {
                    if (result.success) {
                        if(issueGcMessage) {
                            issueGcMessage.textContent = 'Gift card issued successfully!';
                            issueGcMessage.className = 'success-message';
                        }
                        issueGiftCardForm.reset();
                        loadGiftCards();
                    } else {
                        if(issueGcMessage) {
                            issueGcMessage.textContent = `Error: ${result.message}`;
                            issueGcMessage.className = 'error-message';
                        }
                    }
                })
                .catch(err => {
                    if(issueGcMessage) {
                        issueGcMessage.textContent = `Error: ${err.message}`;
                        issueGcMessage.className = 'error-message';
                    }
                });
        });
    }

    function loadGiftCards() {
        ipcRenderer.invoke('get-all-gift-cards').then(cards => {
            if (giftCardsTableBody) {
                giftCardsTableBody.innerHTML = '';
                if(cards){
                    cards.forEach(card => {
                        const row = giftCardsTableBody.insertRow();
                        row.insertCell().textContent = card.card_number;
                        row.insertCell().textContent = `$${card.balance.toFixed(2)}`;
                        row.insertCell().textContent = new Date(card.issue_date).toLocaleDateString();
                        row.insertCell().textContent = new Date(card.expiry_date).toLocaleDateString();
                        let status = "Active";
                        if (new Date(card.expiry_date) < new Date().setHours(0,0,0,0)) status = "Expired";
                        else if (card.balance <= 0) status = "Depleted";
                        row.insertCell().textContent = status;
                        if (status === "Expired") row.style.color = 'red';
                        else if (status === "Depleted") row.style.color = 'grey';
                    });
                }
            }
        }).catch(err => console.error("Failed to load gift cards:", err));
    }
    
    // --- POS Logic ---
    if (posProductSearchInput) {
        posProductSearchInput.addEventListener('input', () => {
            const searchTerm = posProductSearchInput.value.trim();
            if (searchTerm.length > 1) {
                ipcRenderer.invoke('search-products-for-pos', searchTerm).then(products => {
                    displayPOSSearchResults(products);
                }).catch(err => {
                    console.error("Error searching products for POS:", err);
                    if(posSearchResultsDiv) posSearchResultsDiv.innerHTML = '<p class="error-message">Error searching products.</p>';
                });
            } else {
                if(posSearchResultsDiv) posSearchResultsDiv.innerHTML = '';
            }
        });
    }

    function displayPOSSearchResults(products) {
        if (!posSearchResultsDiv) return;
        posSearchResultsDiv.innerHTML = '';
        if (!products || products.length === 0) {
            posSearchResultsDiv.innerHTML = '<p>No products found.</p>';
            return;
        }
        products.forEach(product => {
            if (product.quantity > 0) {
                const productDiv = document.createElement('div');
                productDiv.textContent = `${product.name} (Stock: ${product.quantity}, Price: $${product.price.toFixed(2)})`;
                productDiv.style.padding = '5px';
                productDiv.style.cursor = 'pointer';
                productDiv.onclick = () => addProductToSale(product);
                posSearchResultsDiv.appendChild(productDiv);
            }
        });
    }

    function addProductToSale(product) {
        if (product.quantity <= 0) {
            if(posMessage) posMessage.textContent = `${product.name} is out of stock.`;
            return;
        }
        const existingItem = currentSaleItems.find(item => item.product_id === product.id);
        if (existingItem) {
            if (existingItem.quantity < product.quantity) {
                existingItem.quantity++;
            } else {
                if(posMessage) posMessage.textContent = `Cannot add more ${product.name} than available in stock.`;
            }
        } else {
            currentSaleItems.push({ 
                product_id: product.id, 
                name: product.name, 
                quantity: 1, 
                price_at_sale: product.price,
                stock: product.quantity 
            });
        }
        if(posProductSearchInput) posProductSearchInput.value = '';
        if(posSearchResultsDiv) posSearchResultsDiv.innerHTML = '';
        renderCurrentSaleTable();
        updateSaleSummary();
    }

    function renderCurrentSaleTable() {
        if (!posCurrentSaleBody) return;
        posCurrentSaleBody.innerHTML = '';
        currentSaleItems.forEach((item, index) => {
            const row = posCurrentSaleBody.insertRow();
            row.insertCell().textContent = item.name;
            const qtyCell = row.insertCell();
            const qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.value = item.quantity;
            qtyInput.min = 1;
            qtyInput.max = item.stock;
            qtyInput.style.width = '50px';
            qtyInput.onchange = (e) => {
                const newQty = parseInt(e.target.value);
                if (newQty > item.stock) {
                    qtyInput.value = item.stock;
                    if(posMessage) posMessage.textContent = `Cannot sell more ${item.name} than available stock (${item.stock}).`;
                }
                item.quantity = Math.min(newQty, item.stock);
                renderCurrentSaleTable();
                updateSaleSummary();
            };
            qtyCell.appendChild(qtyInput);
            row.insertCell().textContent = `$${item.price_at_sale.toFixed(2)}`;
            row.insertCell().textContent = `$${(item.quantity * item.price_at_sale).toFixed(2)}`;
            const actionCell = row.insertCell();
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.onclick = () => {
                currentSaleItems.splice(index, 1);
                renderCurrentSaleTable();
                updateSaleSummary();
            };
            actionCell.appendChild(removeButton);
        });
    }

    function updateSaleSummary() {
        let subtotal = 0;
        currentSaleItems.forEach(item => {
            subtotal += item.quantity * item.price_at_sale;
        });

        const tax = subtotal * TAX_RATE;
        let manualDiscount = parseFloat(posDiscountInput ? posDiscountInput.value : 0) || 0;
        let promotionDiscountAmount = 0;
        const selectedPromotionId = posPromotionSelect ? posPromotionSelect.value : null;

        if (selectedPromotionId && activePromotionsCache[selectedPromotionId]) {
            const promo = activePromotionsCache[selectedPromotionId];
            if (promo.type === 'percentage_off_total') {
                promotionDiscountAmount = subtotal * (promo.value / 100);
            } else if (promo.type === 'fixed_amount_off_total') {
                promotionDiscountAmount = promo.value;
            }
            manualDiscount = 0; 
            if(posDiscountInput) posDiscountInput.value = '0'; 
            if(posDiscountInput) posDiscountInput.disabled = true;
        } else {
            if(posDiscountInput) posDiscountInput.disabled = false;
        }
        
        let totalDiscount = manualDiscount + promotionDiscountAmount;
        let grandTotalBeforeGiftCard = subtotal + tax - totalDiscount;
        if (grandTotalBeforeGiftCard < 0) grandTotalBeforeGiftCard = 0;
        
        let currentAppliedGiftCardPayment = 0; 
        if (currentVerifiedGiftCard && currentVerifiedGiftCard.balance > 0) {
             if (currentVerifiedGiftCard.balance >= grandTotalBeforeGiftCard) {
                currentAppliedGiftCardPayment = grandTotalBeforeGiftCard;
            } else {
                currentAppliedGiftCardPayment = currentVerifiedGiftCard.balance;
            }
        }
        giftCardPaymentAmount = currentAppliedGiftCardPayment;


        if(giftCardAppliedAmountSpan) giftCardAppliedAmountSpan.textContent = giftCardPaymentAmount.toFixed(2);
        
        const finalGrandTotal = grandTotalBeforeGiftCard - giftCardPaymentAmount;

        if(posSubtotalSpan) posSubtotalSpan.textContent = `$${subtotal.toFixed(2)}`;
        if(posTaxSpan) posTaxSpan.textContent = `$${tax.toFixed(2)}`;
        if(posPromotionDiscountAmountSpan) posPromotionDiscountAmountSpan.textContent = `$${promotionDiscountAmount.toFixed(2)}`;
        if(posGrandTotalSpan) posGrandTotalSpan.textContent = `$${finalGrandTotal.toFixed(2)}`;
    }
    
    if (posDiscountInput) posDiscountInput.addEventListener('input', () => {
        if(posPromotionSelect) posPromotionSelect.value = ""; 
        currentVerifiedGiftCard = null; 
        if(giftCardMessage) giftCardMessage.textContent = '';
        giftCardPaymentAmount = 0; 
        if(giftCardAppliedAmountSpan) giftCardAppliedAmountSpan.textContent = '0.00';
        updateSaleSummary();
    });
    if (posPromotionSelect) posPromotionSelect.addEventListener('change', () => {
        currentVerifiedGiftCard = null; 
        if(giftCardMessage) giftCardMessage.textContent = '';
        giftCardPaymentAmount = 0; 
        if(giftCardAppliedAmountSpan) giftCardAppliedAmountSpan.textContent = '0.00';
        updateSaleSummary();
    });


    if (paymentMethodButtons) {
        paymentMethodButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                if(posPaymentMethodInput && e.target.dataset.method) { 
                     posPaymentMethodInput.value = e.target.dataset.method;
                     paymentMethodButtons.forEach(btn => btn.style.backgroundColor = '');
                     e.target.style.backgroundColor = '#007bff';
                }
            });
        });
        paymentMethodButtons.forEach(btn => { 
            if(btn.dataset.method === "Cash" && posPaymentMethodInput) {
                 btn.style.backgroundColor = '#007bff';
                 posPaymentMethodInput.value = "Cash";
            } else {
                btn.style.backgroundColor = ''; 
            }
        });
    }

    if (processSaleButton) {
        processSaleButton.addEventListener('click', () => {
            if (currentSaleItems.length === 0 && giftCardPaymentAmount === 0) {
                if(posMessage) posMessage.textContent = 'Cannot process an empty sale.';
                return;
            }

            let subtotal = 0;
            currentSaleItems.forEach(item => { subtotal += item.quantity * item.price_at_sale; });
            const tax = subtotal * TAX_RATE;
            let manualDiscountVal = parseFloat(posDiscountInput ? posDiscountInput.value : 0) || 0;
            let promotionDiscountVal = 0;
            const selectedPromotionId = posPromotionSelect ? posPromotionSelect.value : null;
            if (selectedPromotionId && activePromotionsCache[selectedPromotionId]) {
                const promo = activePromotionsCache[selectedPromotionId];
                if (promo.type === 'percentage_off_total') promotionDiscountVal = subtotal * (promo.value / 100);
                else if (promo.type === 'fixed_amount_off_total') promotionDiscountVal = promo.value;
                manualDiscountVal = 0;
            }
            let totalDiscountVal = manualDiscountVal + promotionDiscountVal;
            let grandTotalBeforeGiftCardVal = subtotal + tax - totalDiscountVal;
            if (grandTotalBeforeGiftCardVal < 0) grandTotalBeforeGiftCardVal = 0;

            let finalGiftCardPaymentToProcess = 0;
            if (currentVerifiedGiftCard && currentVerifiedGiftCard.balance > 0) {
                if (currentVerifiedGiftCard.balance >= grandTotalBeforeGiftCardVal) {
                    finalGiftCardPaymentToProcess = grandTotalBeforeGiftCardVal;
                } else {
                    finalGiftCardPaymentToProcess = currentVerifiedGiftCard.balance;
                }
            } else {
                 finalGiftCardPaymentToProcess = 0; 
            }


            const saleData = {
                items: currentSaleItems.map(item => ({
                    product_id: item.product_id,
                    name: item.name, 
                    quantity: item.quantity,
                    price_at_sale: item.price_at_sale
                })),
                totalAmount: grandTotalBeforeGiftCardVal - finalGiftCardPaymentToProcess, 
                saleDate: new Date().toISOString(),
                paymentMethod: posPaymentMethodInput.value,
                promotionId: selectedPromotionId,
                giftCardPaymentAmount: finalGiftCardPaymentToProcess,
                giftCardIdToUpdate: currentVerifiedGiftCard ? currentVerifiedGiftCard.id : null
            };
            
            ipcRenderer.invoke('process-sale', saleData).then(result => {
                if (result.success) {
                    if(posMessage) {
                        posMessage.textContent = `Sale successful! Sale ID: ${result.saleId}`;
                        posMessage.className = 'success-message';
                         if(result.warning) posMessage.textContent += ` Warning: ${result.warning}`;
                    }
                    const receiptData = {
                        saleId: result.saleId,
                        date: saleData.saleDate,
                        items: saleData.items,
                        subtotal: subtotal,
                        tax: tax,
                        promoDiscount: promotionDiscountVal,
                        manualDiscount: manualDiscountVal,
                        giftCardPayment: finalGiftCardPaymentToProcess,
                        totalPaid: grandTotalBeforeGiftCardVal, 
                        amountDueByCashCard: saleData.totalAmount 
                    };
                    showReceipt(receiptData);
                    resetPOS();
                    loadInventoryData(); 
                    loadGiftCards(); 
                } else {
                    if(posMessage) {
                        posMessage.textContent = `Sale failed: ${result.message}`;
                        posMessage.className = 'error-message';
                    }
                }
            }).catch(err => {
                console.error("Error processing sale:", err);
                if(posMessage) {
                    posMessage.textContent = `Sale failed: ${err.message}`;
                    posMessage.className = 'error-message';
                }
            });
        });
    }

    function resetPOS() {
        currentSaleItems = [];
        if(posCurrentSaleBody) posCurrentSaleBody.innerHTML = '';
        if(posProductSearchInput) posProductSearchInput.value = '';
        if(posSearchResultsDiv) posSearchResultsDiv.innerHTML = '';
        if(posDiscountInput) {
            posDiscountInput.value = '0';
            posDiscountInput.disabled = false;
        }
        if(posPromotionSelect) posPromotionSelect.value = "";
        if(giftCardPaymentArea) giftCardPaymentArea.style.display = 'none';
        if(giftCardNumberInput) giftCardNumberInput.value = '';
        if(giftCardMessage) giftCardMessage.textContent = '';
        if(giftCardAppliedAmountSpan) giftCardAppliedAmountSpan.textContent = '0.00';
        currentVerifiedGiftCard = null;
        giftCardPaymentAmount = 0; 
        updateSaleSummary();
        setTimeout(() => {
            if(posMessage) {
                 posMessage.textContent = '';
                 posMessage.className = 'error-message'; 
            }
        }, 3000);
    }

    function showReceipt(data) {
        if (!receiptModal) return;
        const receiptSaleId = document.getElementById('receipt-sale-id');
        if(receiptSaleId) receiptSaleId.textContent = data.saleId;
        const receiptDate = document.getElementById('receipt-date');
        if(receiptDate) receiptDate.textContent = new Date(data.date).toLocaleString();
        
        const receiptItemsDiv = document.getElementById('receipt-items');
        if(receiptItemsDiv) receiptItemsDiv.innerHTML = '';
        if(data.items && receiptItemsDiv){
            data.items.forEach(item => {
                const p = document.createElement('p');
                p.textContent = `${item.name} - ${item.quantity} x $${item.price_at_sale.toFixed(2)} = $${(item.quantity * item.price_at_sale).toFixed(2)}`;
                receiptItemsDiv.appendChild(p);
            });
        }
        const receiptSubtotal = document.getElementById('receipt-subtotal');
        if(receiptSubtotal) receiptSubtotal.textContent = `$${data.subtotal.toFixed(2)}`;
        const receiptTax = document.getElementById('receipt-tax');
        if(receiptTax) receiptTax.textContent = `$${data.tax.toFixed(2)}`;
        const receiptPromoDiscount = document.getElementById('receipt-promo-discount');
        if(receiptPromoDiscount) receiptPromoDiscount.textContent = `$${data.promoDiscount.toFixed(2)}`;
        const receiptManualDiscount = document.getElementById('receipt-manual-discount');
        if(receiptManualDiscount) receiptManualDiscount.textContent = `$${data.manualDiscount.toFixed(2)}`;
        const receiptGiftCardPayment = document.getElementById('receipt-gift-card-payment');
        if(receiptGiftCardPayment) receiptGiftCardPayment.textContent = `$${data.giftCardPayment.toFixed(2)}`;
        const receiptTotalPaid = document.getElementById('receipt-total-paid'); 
        if(receiptTotalPaid) receiptTotalPaid.textContent = `$${data.totalPaid.toFixed(2)}`; 
        const receiptAmountDue = document.getElementById('receipt-amount-due'); 
        if(receiptAmountDue) receiptAmountDue.textContent = `$${data.amountDueByCashCard.toFixed(2)}`;
        
        if(receiptModal) receiptModal.style.display = 'flex';
    }

    if (closeReceiptModalButton) closeReceiptModalButton.addEventListener('click', () => {
        if(receiptModal) receiptModal.style.display = 'none';
    });

    // POS Gift Card Payment Logic
    if (payWithGiftCardButton) {
        payWithGiftCardButton.addEventListener('click', () => {
            if(giftCardPaymentArea) giftCardPaymentArea.style.display = giftCardPaymentArea.style.display === 'none' ? 'block' : 'none';
            if (giftCardPaymentArea && giftCardPaymentArea.style.display === 'none') { 
                currentVerifiedGiftCard = null;
                giftCardPaymentAmount = 0; 
                if(giftCardAppliedAmountSpan) giftCardAppliedAmountSpan.textContent = '0.00';
                if(giftCardMessage) giftCardMessage.textContent = '';
                if(giftCardNumberInput) giftCardNumberInput.value = '';
                updateSaleSummary();
            }
        });
    }

    if (verifyGiftCardButton) {
        verifyGiftCardButton.addEventListener('click', () => {
            const cardNumber = giftCardNumberInput ? giftCardNumberInput.value.trim() : '';
            if (!cardNumber) {
                if(giftCardMessage) giftCardMessage.textContent = 'Please enter a gift card number.';
                currentVerifiedGiftCard = null; 
                giftCardPaymentAmount = 0; 
                updateSaleSummary();
                return;
            }
            ipcRenderer.invoke('get-gift-card-by-number', cardNumber)
                .then(card => {
                    if (!card) {
                        if(giftCardMessage) giftCardMessage.textContent = 'Gift card not found.';
                        currentVerifiedGiftCard = null;
                    } else if (new Date(card.expiry_date) < new Date().setHours(0,0,0,0)) {
                        if(giftCardMessage) giftCardMessage.textContent = 'Gift card is expired.';
                        currentVerifiedGiftCard = null;
                    } else if (card.balance <= 0) {
                        if(giftCardMessage) giftCardMessage.textContent = 'Gift card has no balance.';
                        currentVerifiedGiftCard = null;
                    } else {
                        if(giftCardMessage) giftCardMessage.textContent = `Valid card. Balance: $${card.balance.toFixed(2)}`;
                        currentVerifiedGiftCard = card;
                    }
                    updateSaleSummary(); 
                })
                .catch(err => {
                    console.error('Error verifying gift card:', err);
                    if(giftCardMessage) giftCardMessage.textContent = 'Error verifying card.';
                    currentVerifiedGiftCard = null;
                    giftCardPaymentAmount = 0; 
                    updateSaleSummary();
                });
        });
    }

    // --- Reporting Logic ---
    const reportStartDateInput = document.getElementById('report-start-date');
    const reportEndDateInput = document.getElementById('report-end-date');
    const reportLimitInput = document.getElementById('report-limit');
    const reportContentDiv = document.getElementById('report-content');

    const generateSalesReportButton = document.getElementById('generate-sales-report-button');
    const generatePopularProductsButton = document.getElementById('generate-popular-products-button');
    const generateStockValueButton = document.getElementById('generate-stock-value-button');
    const generateTransactionSummaryButton = document.getElementById('generate-transaction-summary-button');

    // --- Offline Mode Elements & State ---
    const offlineIndicatorDiv = document.getElementById('offline-indicator');
    const toggleOnlineBtn = document.getElementById('toggle-online-btn');
    const syncSalesBtn = document.getElementById('sync-sales-btn');

    let appIsOnline = true;
    let productCache = {}; // In-memory cache, populated from localStorage on load
    let offlineSalesQueue = []; // In-memory queue, populated from localStorage on load
    const PRODUCT_CACHE_KEY = 'productCache';
    const OFFLINE_SALES_KEY = 'offlineSales';


    // --- Initialization ---
    async function initializeApp() {
        // Initial online status check
        try {
            appIsOnline = await ipcRenderer.invoke('get-online-status');
        } catch (error) {
            console.error("Error getting initial online status:", error);
            appIsOnline = false; // Assume offline if error
        }
        loadProductCache();
        loadOfflineSalesQueue();
        updateOnlineStatusUI();
        updateSyncButtonUI(); // Initial update for sync button
    }

    initializeApp(); // Call on DOMContentLoaded

    // --- Offline/Online Status Management ---
    if (toggleOnlineBtn) {
        toggleOnlineBtn.addEventListener('click', () => {
            ipcRenderer.send('toggle-online-status');
        });
    }

    ipcRenderer.on('online-status-changed', (event, newStatus) => {
        appIsOnline = newStatus;
        updateOnlineStatusUI();
        if (appIsOnline && offlineSalesQueue.length > 0) {
             // This event is now sent from main.js when it detects a transition to online
            // and there are pending sales.
            console.log("App is online and there are pending sales. Sync can be attempted.");
        }
    });
    
    ipcRenderer.on('can-sync-now', () => { // Sent from main when coming online with pending sales
        if(syncSalesBtn) syncSalesBtn.disabled = false;
        if(posMessage) posMessage.textContent = "Application is online. You can now sync pending sales.";
    });


    function updateOnlineStatusUI() {
        if (offlineIndicatorDiv) {
            offlineIndicatorDiv.style.display = appIsOnline ? 'none' : 'inline-block';
        }
        if (syncSalesBtn) {
            syncSalesBtn.disabled = !appIsOnline || offlineSalesQueue.length === 0;
        }
        // Example: Change border of POS section
        const posSection = document.getElementById('pos-section');
        if (posSection) {
            posSection.style.borderColor = appIsOnline ? '#eee' : 'red';
            posSection.style.borderWidth = appIsOnline ? '1px' : '2px';
        }
    }
    
    function updateSyncButtonUI() {
        if (syncSalesBtn) {
            syncSalesBtn.textContent = `Sync Pending Sales (${offlineSalesQueue.length})`;
            syncSalesBtn.style.display = offlineSalesQueue.length > 0 ? 'inline-block' : 'none';
            syncSalesBtn.disabled = !appIsOnline || offlineSalesQueue.length === 0;
        }
    }

    // --- Product Cache Management ---
    function loadProductCache() {
        try {
            const cached = localStorage.getItem(PRODUCT_CACHE_KEY);
            if (cached) {
                productCache = JSON.parse(cached);
                console.log("Product cache loaded from localStorage.");
            } else {
                productCache = {};
                console.log("No product cache found in localStorage. Will populate when online.");
            }
        } catch (e) {
            console.error("Error loading product cache from localStorage:", e);
            productCache = {};
        }
    }

    function saveProductCache() {
        try {
            localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(productCache));
            console.log("Product cache saved to localStorage.");
        } catch (e) {
            console.error("Error saving product cache to localStorage:", e);
        }
    }
    
    function updateProductCache(products) {
        if(!products || !Array.isArray(products)) return;
        products.forEach(p => {
            productCache[p.id] = { id: p.id, name: p.name, price: p.price, quantity: p.quantity };
        });
        saveProductCache();
    }

    // --- Offline Sales Queue (localStorage) ---
    function loadOfflineSalesQueue() {
        try {
            const storedSales = localStorage.getItem(OFFLINE_SALES_KEY);
            if (storedSales) {
                offlineSalesQueue = JSON.parse(storedSales);
            } else {
                offlineSalesQueue = [];
            }
        } catch (e) {
            console.error("Error loading offline sales queue from localStorage:", e);
            offlineSalesQueue = [];
        }
        updateSyncButtonUI();
    }

    function saveOfflineSaleToQueue(saleData) {
        offlineSalesQueue.push(saleData);
        try {
            localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(offlineSalesQueue));
        } catch (e) {
            console.error("Error saving offline sale to localStorage:", e);
            // Potentially handle quota exceeded error
        }
        updateSyncButtonUI();
    }
    
    function clearSuccessfullySyncedSalesFromQueue(syncedSaleIds) {
        if (!Array.isArray(syncedSaleIds)) return;
        offlineSalesQueue = offlineSalesQueue.filter(sale => !syncedSaleIds.includes(sale.sale_id_offline));
        try {
            localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(offlineSalesQueue));
        } catch (e) {
            console.error("Error updating offline sales queue in localStorage after sync:", e);
        }
        updateSyncButtonUI();
    }


    // --- Sync Offline Sales ---
    if (syncSalesBtn) {
        syncSalesBtn.addEventListener('click', async () => {
            if (!appIsOnline) {
                if(posMessage) posMessage.textContent = "Cannot sync while offline.";
                return;
            }
            if (offlineSalesQueue.length === 0) {
                if(posMessage) posMessage.textContent = "No sales to sync.";
                return;
            }

            if(posMessage) posMessage.textContent = "Syncing sales...";
            syncSalesBtn.disabled = true;

            try {
                // The actual sales data is already in main.js's JSON file.
                // This IPC call just triggers the main process to read its own JSON and process.
                const result = await ipcRenderer.invoke('sync-offline-sales'); 
                
                if(posMessage) posMessage.textContent = result.message;
                if(result.success) {
                    posMessage.className = 'success-message';
                    // Clear localStorage queue based on what main process successfully synced from its JSON
                    // For simplicity now, if main reports any success, we assume it cleared its JSON queue for those.
                    // A more robust approach would be for main to return IDs of synced sales.
                    // Assuming main process clears its JSON queue for successfully synced items.
                    // We need to update the renderer's view of the queue.
                    // Let's refine this: main.js should return the list of remaining (failed) sales.
                    // For now, if sync is generally successful and some failed, main.js updates its JSON.
                    // We need to re-fetch what's left in main's JSON or have main return remaining.
                    // The current main.js `sync-offline-sales` *does* rewrite its JSON with remaining sales.
                    // So, we should reload our renderer queue from main's queue.
                    // OR, even better, if main returns the list of successfully synced IDs.
                    // The current main.js `sync-offline-sales` returns counts and errors, not specific IDs.
                    // Let's assume for now: if main process says it synced X items, we remove the first X items from our *localStorage* queue.
                    // This is a simplification. A robust solution would use unique IDs.
                    
                    // The current `sync-offline-sales` in main.js *does* rewrite the JSON file with remaining sales.
                    // So, the most straightforward way is to re-load the queue from the (potentially updated) file via main.
                    // However, an IPC invoke cannot directly read files from main. Let's assume main handles its file.
                    // The renderer's localStorage queue needs to be updated based on sync result.
                    // For now, if main process reports success (even partial), we'll clear our localStorage queue.
                    // This is not ideal but matches the current main process logic of rewriting its own queue.
                    // A better flow: main returns array of successfully synced offline_sale_ids.
                    
                    // Given the current main.js implementation, we'll just re-read the main file via an IPC if needed,
                    // or trust the counts. For now, if syncCount > 0, let's clear the local one
                    // and rely on main having updated its source of truth.
                    // The main process now correctly only keeps failed sales in its JSON.
                    // So, we just need to update our local storage based on the result.
                    
                    // For now, let's just clear what the main process said it cleared.
                    // This needs a more robust solution where main returns IDs of what it processed from its own file.
                    // The current main process `sync-offline-sales` *does* rewrite `offline-sales.json` with remaining sales.
                    // So, we should reflect that. Simplest is to clear our local and re-fetch if possible, or just update count.

                    // Best approach with current main.js:
                    // Main process updates its JSON. Renderer's localStorage queue is a *temporary* offline holding.
                    // After sync attempt, clear localStorage and re-populate from main if needed, or just update counts.
                    
                    // If main.js handles its offline-sales.json correctly (keeps only failed ones),
                    // then the renderer's localStorage should also be updated to reflect this.
                    // The current IPC `sync-offline-sales` returns counts.
                    // We need a robust way to clear *only* the synced sales from localStorage.
                    // Let's assume main.js now handles its file perfectly. We need to update renderer's view.
                    // If the main.js sync process successfully processes some sales from `offline-sales.json`
                    // and then rewrites `offline-sales.json` with only the failed/remaining ones,
                    // then our `offlineSalesQueue` in renderer and its `localStorage` copy are now stale.
                    // We should clear our `localStorage.offlineSales` and then potentially ask main for its current list.
                    // For now, if sync had any success, we'll just clear our entire local queue and rely on future loads/status.
                    // This part is tricky without main returning the exact state of its queue or successfully synced IDs.

                    if (result.syncedCount > 0) {
                        // This is simplified. Ideally, main returns IDs of successfully synced sales.
                        // For now, if any were synced, assume the main JSON file is the source of truth.
                        // The renderer's localStorage is more of a temporary holding if main couldn't be reached at all.
                        // If main *was* reached and did a sync, its file is updated.
                        // We should clear our local one and next time, it will be populated from main's (if main exposes it).
                        // For now, just update based on counts.
                        const tempQueue = [...offlineSalesQueue];
                        const successfullySyncedIds = []; // This would ideally come from main.
                        // Simulate main returning successfully synced IDs for now by taking the first `syncedCount` items.
                        // THIS IS A HACK and needs main.js to return actual synced IDs.
                        for(let i=0; i < result.syncedCount && i < tempQueue.length; i++) {
                            if(tempQueue[i].sale_id_offline) {
                                successfullySyncedIds.push(tempQueue[i].sale_id_offline);
                            }
                        }
                        clearSuccessfullySyncedSalesFromQueue(successfullySyncedIds);

                        // If all synced, or some synced and some failed, the local storage needs to reflect only the truly remaining ones.
                        // The current main.js already updates its offline-sales.json to only contain failed ones.
                        // So, the renderer should update its queue to match this.
                        // Easiest for now: if sync was attempted, clear local and let it repopulate from main (if we add that feature)
                        // or just update counts.
                        // Let's assume main.js manages its own offline-sales.json perfectly.
                        // The renderer's localStorage is primarily for when main process itself is not available (app crash before save)
                        // or for UI display of pending count.
                        // After a sync attempt, we should update our queue from the main source of truth.
                        // For now, we'll just use the counts.
                        offlineSalesQueue = offlineSalesQueue.slice(result.syncedCount); // Highly simplified
                        localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(offlineSalesQueue));
                        updateSyncButtonUI();

                    }
                    if (result.failedCount > 0) {
                        posMessage.textContent += ` Some sales failed to sync: ${result.errors.map(e => e.saleIdOffline + ': ' + e.error).join(', ')}`;
                    }
                    loadInventoryData(); // Refresh stock
                } else {
                    posMessage.className = 'error-message';
                }
            } catch (error) {
                console.error('Error syncing sales:', error);
                if(posMessage) {
                    posMessage.textContent = `Error syncing sales: ${error.message}`;
                    posMessage.className = 'error-message';
                }
            } finally {
                syncSalesBtn.disabled = !appIsOnline || offlineSalesQueue.length === 0;
            }
        });
    }

    // --- Reporting Logic (Existing - ensure it's not broken by new additions) ---
    const generatePopularProductsButton = document.getElementById('generate-popular-products-button');
    const generateStockValueButton = document.getElementById('generate-stock-value-button');
    const generateTransactionSummaryButton = document.getElementById('generate-transaction-summary-button');
    const exportSalesSummaryCsvButton = document.getElementById('export-sales-summary-csv-button');
    const exportInventoryValuationCsvButton = document.getElementById('export-inventory-valuation-csv-button');


    if (generateSalesReportButton) {
        generateSalesReportButton.addEventListener('click', async () => {
            const startDate = reportStartDateInput.value;
            const endDate = reportEndDateInput.value;
            if (!startDate || !endDate) {
                if(reportContentDiv) reportContentDiv.innerHTML = '<p class="error-message">Please select both start and end dates for the sales report.</p>';
                return;
            }
            try {
                const sales = await ipcRenderer.invoke('get-sales-report', { startDate, endDate });
                displaySalesReport(sales);
            } catch (error) {
                console.error('Error generating sales report:', error);
                if(reportContentDiv) reportContentDiv.innerHTML = `<p class="error-message">Error generating sales report: ${error.message}</p>`;
            }
        });
    }

    if (generatePopularProductsButton) {
        generatePopularProductsButton.addEventListener('click', async () => {
            const startDate = reportStartDateInput.value;
            const endDate = reportEndDateInput.value;
            const limit = parseInt(reportLimitInput.value) || 5;
            if (!startDate || !endDate) {
                if(reportContentDiv) reportContentDiv.innerHTML = '<p class="error-message">Please select both start and end dates for popular products report.</p>';
                return;
            }
            try {
                const products = await ipcRenderer.invoke('get-popular-products-report', { startDate, endDate, limit });
                displayPopularProductsReport(products);
            } catch (error) {
                console.error('Error generating popular products report:', error);
                if(reportContentDiv) reportContentDiv.innerHTML = `<p class="error-message">Error generating popular products report: ${error.message}</p>`;
            }
        });
    }
    
    if (generateStockValueButton) {
        generateStockValueButton.addEventListener('click', async () => {
            try {
                const result = await ipcRenderer.invoke('get-stock-value-report');
                displayStockValueReport(result);
            } catch (error) {
                console.error('Error generating stock value report:', error);
                if(reportContentDiv) reportContentDiv.innerHTML = `<p class="error-message">Error generating stock value report: ${error.message}</p>`;
            }
        });
    }

    if (generateTransactionSummaryButton) {
        generateTransactionSummaryButton.addEventListener('click', async () => {
            const startDate = reportStartDateInput.value;
            const endDate = reportEndDateInput.value;
            if (!startDate || !endDate) {
                if(reportContentDiv) reportContentDiv.innerHTML = '<p class="error-message">Please select both start and end dates for the transaction summary.</p>';
                return;
            }
            try {
                const summary = await ipcRenderer.invoke('get-transaction-summary-report', { startDate, endDate });
                displayTransactionSummary(summary);
            } catch (error) {
                console.error('Error generating transaction summary:', error);
                if(reportContentDiv) reportContentDiv.innerHTML = `<p class="error-message">Error generating transaction summary: ${error.message}</p>`;
            }
        });
    }

    function displaySalesReport(sales) {
        if (!reportContentDiv) return;
        if (!sales || sales.length === 0) {
            reportContentDiv.innerHTML = '<p>No sales found for the selected date range.</p>';
            return;
        }
        let tableHtml = `
            <h4>Sales Report</h4>
            <table style="width:100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 8px;">Sale ID</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Date</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Cashier</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Total Items</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Promotion</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">GC Payment</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Final Amount</th>
                    </tr>
                </thead>
                <tbody>
        `;
        sales.forEach(sale => {
            tableHtml += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${sale.sale_id}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${new Date(sale.sale_date).toLocaleString()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${sale.cashier_name || 'N/A'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${sale.total_items || 0}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${sale.promotion_name || 'None'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">$${(sale.gift_card_payment_amount || 0).toFixed(2)}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">$${sale.total_amount.toFixed(2)}</td>
                </tr>
            `;
        });
        tableHtml += '</tbody></table>';
        reportContentDiv.innerHTML = tableHtml;
    }

    function displayPopularProductsReport(products) {
        if (!reportContentDiv) return;
        if (!products || products.length === 0) {
            reportContentDiv.innerHTML = '<p>No product sales data found for the selected date range.</p>';
            return;
        }
        let tableHtml = `
            <h4>Popular Products Report</h4>
            <table style="width:100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 8px;">Product Name</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Total Quantity Sold</th>
                    </tr>
                </thead>
                <tbody>
        `;
        products.forEach(product => {
            tableHtml += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${product.product_name}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${product.total_quantity_sold}</td>
                </tr>
            `;
        });
        tableHtml += '</tbody></table>';
        reportContentDiv.innerHTML = tableHtml;
    }

    function displayStockValueReport(result) {
        if (!reportContentDiv) return;
        const totalValue = result && result.total_stock_value ? result.total_stock_value.toFixed(2) : '0.00';
        reportContentDiv.innerHTML = `
            <h4>Current Stock Value Report</h4>
            <p><strong>Total Current Stock Value:</strong> $${totalValue}</p>
        `;
    }

    function displayTransactionSummary(summary) {
        if (!reportContentDiv || !summary) {
            if(reportContentDiv) reportContentDiv.innerHTML = '<p>No transaction summary data found for the selected date range.</p>';
            return;
        }
        // total_items_value_at_sale_price gives the sum of (qty * price_at_sale) which is pre-discounts, pre-tax.
        const totalPreDiscountRevenue = (summary.total_items_value_at_sale_price || 0);
        // net_revenue_recorded is (final total_amount paid by cash/card + gift_card_payment_amount), so it's after all discounts.
        const netRevenue = (summary.net_revenue_recorded || 0);
        // Estimated total discount (promotional + manual)
        // This is an estimation as percentage promotions are hard to track back accurately without storing applied discount value per sale.
        const estimatedTotalDiscounts = totalPreDiscountRevenue - netRevenue; 
        // Assuming 5% tax was applied on the net amount *before* it became final (e.g. on (totalPreDiscountRevenue - estimatedTotalDiscounts) / 1.05 * 0.05 )
        // For simplicity, we'll just show what we have directly.
        
        reportContentDiv.innerHTML = `
            <h4>Transaction Summary</h4>
            <p><strong>Total Transactions:</strong> ${summary.total_transactions || 0}</p>
            <p><strong>Total Value of Items Sold (at sale price):</strong> $${totalPreDiscountRevenue.toFixed(2)}</p>
            <p><strong>Total Fixed Promotional Discounts Applied:</strong> $${(summary.total_fixed_promo_discounts || 0).toFixed(2)}</p>
            <p><strong>Net Revenue Recorded (after all discounts, incl. GC payments):</strong> $${netRevenue.toFixed(2)}</p>
            <p><strong>Total Paid by Gift Cards:</strong> $${(summary.total_gift_card_payments || 0).toFixed(2)}</p>
            <p><strong>Total Paid by Other Methods (Cash/Card):</strong> $${(summary.gross_sales_amount || 0).toFixed(2)}</p>
            <p><em>Note: Percentage-based promotion discounts are implicitly included in the Net Revenue. Manual discounts are not explicitly tracked in this summary.</em></p>
        `;
    }

        verifyGiftCardButton.addEventListener('click', () => {
            const cardNumber = giftCardNumberInput ? giftCardNumberInput.value.trim() : '';
            if (!cardNumber) {
                if(giftCardMessage) giftCardMessage.textContent = 'Please enter a gift card number.';
                currentVerifiedGiftCard = null; 
                giftCardPaymentAmount = 0; 
                updateSaleSummary();
                return;
            }
            ipcRenderer.invoke('get-gift-card-by-number', cardNumber)
                .then(card => {
                    if (!card) {
                        if(giftCardMessage) giftCardMessage.textContent = 'Gift card not found.';
                        currentVerifiedGiftCard = null;
                    } else if (new Date(card.expiry_date) < new Date().setHours(0,0,0,0)) {
                        if(giftCardMessage) giftCardMessage.textContent = 'Gift card is expired.';
                        currentVerifiedGiftCard = null;
                    } else if (card.balance <= 0) {
                        if(giftCardMessage) giftCardMessage.textContent = 'Gift card has no balance.';
                        currentVerifiedGiftCard = null;
                    } else {
                        if(giftCardMessage) giftCardMessage.textContent = `Valid card. Balance: $${card.balance.toFixed(2)}`;
                        currentVerifiedGiftCard = card;
                    }
                    updateSaleSummary(); 
                })
                .catch(err => {
                    console.error('Error verifying gift card:', err);
                    if(giftCardMessage) giftCardMessage.textContent = 'Error verifying card.';
                    currentVerifiedGiftCard = null;
                    giftCardPaymentAmount = 0; 
                    updateSaleSummary();
                });
        });
    }
});
