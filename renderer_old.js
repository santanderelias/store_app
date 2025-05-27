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
});
