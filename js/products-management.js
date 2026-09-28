(function() {
  // --- Elements ---
  const modal = document.getElementById('addProductModal');
  const modalContent = document.getElementById('addProductModalContent');
  const modalTitle = document.getElementById('modalTitle');
  const openBtn = document.getElementById('openAddModalBtn');
  const closeBtn = document.getElementById('closeAddModalBtn');
  const cancelBtn = document.getElementById('cancelAddModalBtn');
  const saveBtn = document.getElementById('saveProductBtn');
  const tableBody = document.getElementById('productTableBody');
  const productsTable = document.getElementById('productsTable');
  
  const toast = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMessage');
  
  // Search & Filter Elements
  const searchInput = document.getElementById('catalogSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const categorySelect = document.getElementById('categoryFilterSelect');
  const filterDropdownToggle = document.getElementById('filterDropdownToggle');
  const filterDropdownMenu = document.getElementById('filterDropdownMenu');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const applyFiltersBtn = document.getElementById('applyFiltersBtn');
  const statusTabs = document.querySelectorAll('.status-tab');
  const noProductsFound = document.getElementById('noProductsFound');
  const tableShowingCount = document.getElementById('tableShowingCount');
  const resetSearchFromEmpty = document.getElementById('resetSearchFromEmpty');
  const kpiTotalProducts = document.getElementById('kpiTotalProducts');
  const API_BASE_URL = 'http://localhost:3000';

  // View Mode Elements
  const tableViewBtn = document.getElementById('tableViewBtn');
  const gridViewBtn = document.getElementById('gridViewBtn');
  let isGridView = false;

  // Image Upload Elements
  const imageInput = document.getElementById('productImageInput');
  const uploadPrompt = document.getElementById('uploadPrompt');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const imagePreview = document.getElementById('imagePreview');
  const previewFileName = document.getElementById('previewFileName');
  const removeImageBtn = document.getElementById('removeImageBtn');

  // Editing State
  let editingRowId = null;
  const DEFAULT_IMG = "https://lh3.googleusercontent.com/aida-public/AB6AXuA7BSfkQh2CgmBAUoEKsRVfzfV9kitJQyax6BSC7RCXkKTlyjQHwYTdoJ7tUGNc830jM61wt3CE-f0iWheOB1fw2UcAG37_zt5eGOrm7SluJEU7A8TCGAGLOKAZZElFpt1MnIRj1zGWCpUXf1aEf-7wURynlvu5GcEK7xa7lsAJDSCJFSd8UsrbCbE1WC5YtgPu2tr2z2qNEEKvq7cw3D_YRoJBrjg0gO_U5JIV9i9NR-VZhMeoMHHv";
  let currentSelectedImage = DEFAULT_IMG;
  let activeStatusFilter = 'all';

  // --- Toast Notification Helper ---
  function showToast(message) {
    if (!toast) return;
    toastMsg.textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
  }

  // --- Generic Custom Modal Handlers ---
  function openCustomModal(modalId) {
    const m = document.getElementById(modalId);
    if(m) {
        m.classList.remove('opacity-0', 'pointer-events-none');
        m.classList.add('opacity-100', 'pointer-events-auto');
        m.querySelector('.modal-content').classList.remove('scale-95');
        m.querySelector('.modal-content').classList.add('scale-100');
    }
  }

  function closeCustomModal(modalElem) {
    modalElem.classList.remove('opacity-100', 'pointer-events-auto');
    modalElem.classList.add('opacity-0', 'pointer-events-none');
    modalElem.querySelector('.modal-content').classList.remove('scale-100');
    modalElem.querySelector('.modal-content').classList.add('scale-95');
  }

  document.querySelectorAll('.close-custom-modal-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
          closeCustomModal(e.target.closest('.fixed'));
      });
  });

  // --- Modal Logic for Add/Edit Product ---
  function toggleModal(open, isEdit = false) {
    if (open) {
      if (!isEdit) {
        document.getElementById('newProductForm').reset();
        editingRowId = null;
        modalTitle.textContent = "Add New Formulation";
        resetImageUpload();
      }
      modal.classList.remove('opacity-0', 'pointer-events-none');
      modal.classList.add('opacity-100', 'pointer-events-auto');
      modalContent.classList.remove('scale-95');
      modalContent.classList.add('scale-100');
    } else {
      modal.classList.remove('opacity-100', 'pointer-events-auto');
      modal.classList.add('opacity-0', 'pointer-events-none');
      modalContent.classList.remove('scale-100');
      modalContent.classList.add('scale-95');
    }
  }

  function resetImageUpload() {
    imageInput.value = '';
    currentSelectedImage = DEFAULT_IMG;
    imagePreview.src = '';
    uploadPrompt.classList.remove('hidden');
    imagePreviewContainer.classList.add('hidden');
  }

  if (openBtn) openBtn.addEventListener('click', () => toggleModal(true));
  if (closeBtn) closeBtn.addEventListener('click', () => toggleModal(false));
  if (cancelBtn) cancelBtn.addEventListener('click', () => toggleModal(false));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) toggleModal(false);
  });

  // --- Image Preview Handler ---
  if (imageInput) {
    imageInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          currentSelectedImage = evt.target.result;
          imagePreview.src = currentSelectedImage;
          previewFileName.textContent = file.name;
          uploadPrompt.classList.add('hidden');
          imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      resetImageUpload();
    });
  }

  // --- HTML Builder Helpers ---
  function buildPriceHtml(price, discount) {
    if (discount > 0) {
      const discountedPrice = Math.round(price * (1 - (discount / 100)));
      return `
        <div class="flex flex-col">
          <div class="flex items-center gap-xs">
            <span class="font-label-md text-label-md text-charcoal font-semibold">₦${discountedPrice.toLocaleString()}</span>
            <span class="text-[11px] font-bold px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container">-${discount}%</span>
          </div>
          <span class="font-body-sm text-body-sm text-on-surface-variant line-through">₦${price.toLocaleString()}</span>
        </div>
      `;
    }
    return `
      <span class="font-label-md text-label-md text-charcoal font-semibold">₦${price.toLocaleString()}</span>
      <span class="block font-label-sm text-label-sm text-on-surface-variant">Standard MSRP</span>
    `;
  }

  function buildStockHtml(stock) {
    if (stock === 0) {
      return `
        <div class="flex items-center gap-xs">
          <div class="w-2 h-2 rounded-full bg-error-red"></div>
          <span class="font-body-sm text-body-sm text-error-red font-medium">0 units</span>
        </div>
        <span class="font-label-sm text-label-sm text-error-red block mt-0.5 font-semibold">Out of Stock</span>
      `;
    } else if (stock <= 15) {
      return `
        <div class="flex items-center gap-xs">
          <div class="w-2 h-2 rounded-full bg-warning-amber"></div>
          <span class="font-body-sm text-body-sm text-muted-terracotta font-medium">${stock} units</span>
        </div>
        <span class="font-label-sm text-label-sm text-muted-terracotta block mt-0.5 font-semibold">Low Stock Alert</span>
      `;
    }
    return `
      <div class="flex items-center gap-xs">
        <div class="w-2 h-2 rounded-full bg-success-green"></div>
        <span class="font-body-sm text-body-sm text-charcoal font-medium">${stock} units</span>
      </div>
      <span class="font-label-sm text-label-sm text-secondary block mt-0.5">In Stock</span>
    `;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function productRowStatus(product) {
    if (product.status === 'DRAFT') return 'draft';
    if (product.stockQuantity === 0) return 'out-of-stock';
    return product.stockQuantity <= 15 ? 'low-stock' : 'in-stock';
  }

  function createProductRow(product) {
    const price = product.priceKobo / 100;
    const discount = product.discountPercent || 0;
    const row = document.createElement('tr');
    row.className = isGridView
      ? 'product-row transition-colors flex flex-col border border-soft-border rounded-xl p-sm shadow-sm bg-surface-container-lowest gap-sm'
      : 'product-row hover:bg-surface-container/50 transition-colors';
    row.dataset.id = product.id;
    row.dataset.category = product.category;
    row.dataset.status = productRowStatus(product);
    row.dataset.price = price;
    row.dataset.stock = product.stockQuantity;
    row.dataset.hasPromo = discount > 0 ? 'true' : 'false';
    const imageUrl = product.imageUrl || DEFAULT_IMG;
    const statusBadge = product.status === 'ACTIVE'
      ? '<span class="px-sm py-xs bg-secondary-container text-on-secondary-container rounded-lg font-label-sm text-label-sm font-semibold">Active</span>'
      : '<span class="px-sm py-xs bg-surface-container-high text-on-surface-variant rounded-lg font-label-sm text-label-sm font-semibold">Draft</span>';

    row.innerHTML = `
      <td class="py-md px-md"><div class="flex flex-col gap-xs w-full"><div class="flex items-center gap-sm"><img alt="${escapeHtml(product.name)}" class="w-20 h-20 rounded-xl object-cover shadow-sm flex-shrink-0 border border-soft-border ${product.stockQuantity === 0 ? 'grayscale' : ''}" src="${escapeHtml(imageUrl)}"/><span class="product-title font-body-md text-body-md text-charcoal font-semibold">${escapeHtml(product.name)}</span></div><span class="product-desc font-body-sm text-body-sm text-on-surface-variant line-clamp-2">${escapeHtml(product.description || '')}</span></div></td>
      <td class="py-md px-md"><span class="px-sm py-xs bg-surface-container-high rounded-lg text-charcoal font-label-sm text-label-sm font-medium">${escapeHtml(product.category)}</span></td>
      <td class="py-md px-md">${buildPriceHtml(price, discount)}</td>
      <td class="py-md px-md">${buildStockHtml(product.stockQuantity)}</td>
      <td class="py-md px-md">${statusBadge}</td>
      <td class="py-md px-md text-right"><div class="flex items-center gap-xs actions-div justify-end"><button class="edit-row-btn p-xs rounded-lg hover:bg-surface-container text-on-surface-variant" title="Edit Product Details"><span class="material-symbols-outlined text-[18px]">edit</span></button><button class="restock-row-btn p-xs rounded-lg hover:bg-surface-container text-on-surface-variant" title="Restock 25 Units"><span class="material-symbols-outlined text-[18px]">inventory</span></button><button class="p-xs rounded-lg hover:bg-surface-container text-on-surface-variant" title="Manage Promo"><span class="material-symbols-outlined text-[18px]">percent</span></button><button class="delete-row-btn p-xs rounded-lg hover:bg-surface-container text-muted-terracotta" title="Archive Product"><span class="material-symbols-outlined text-[18px]">archive</span></button></div></td>`;

    if (isGridView) row.querySelectorAll('td').forEach((cell) => cell.classList.add('block', 'py-xs', 'px-0'));
    return row;
  }

  async function loadVendorProducts() {
    tableBody.replaceChildren();
    const token = localStorage.getItem('glamoraToken');
    let user;
    try { user = JSON.parse(localStorage.getItem('glamoraUser') || 'null'); } catch { user = null; }
    if (!token || !user) {
      sessionStorage.setItem('glamoraReturnTo', 'products-management.html');
      window.location.href = 'Auth/login.html';
      return;
    }
    if (String(user.role || '').toUpperCase() !== 'VENDOR') {
      window.location.href = 'customer-dashboard.html';
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/vendor/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        localStorage.removeItem('glamoraToken');
        localStorage.removeItem('glamoraUser');
        sessionStorage.setItem('glamoraReturnTo', 'products-management.html');
        window.location.href = 'Auth/login.html';
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load products.');
      tableBody.replaceChildren(...data.products.map(createProductRow));
      updateProductCounts();
      filterTableRows();
    } catch (error) {
      showToast(error.message || 'Could not load products.');
    }
  }

  async function updateVendorProduct(productId, payload) {
    const response = await fetch(`${API_BASE_URL}/api/vendor/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('glamoraToken')}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not update product.');
    return data.product;
  }

  // --- Add / Edit Product Form Submission ---
  if (saveBtn) {
    saveBtn.addEventListener('click', async function() {
      const name = document.getElementById('newProductName').value.trim();
      const category = document.getElementById('newProductCategory').value;
      const price = parseFloat(document.getElementById('newProductPrice').value);
      const discount = parseFloat(document.getElementById('newProductDiscount').value) || 0;
      const stock = parseInt(document.getElementById('newProductStock').value, 10) || 0;
      const desc = document.getElementById('newProductDesc').value.trim() || 'Custom salon botanical formulation';
      const status = document.getElementById('newProductStatus').value;

      if (!name || isNaN(price)) {
        alert('Please enter a product name and valid retail price.');
        return;
      }

      const token = localStorage.getItem('glamoraToken');
      const isEditing = Boolean(editingRowId);
      const payload = {
        name,
        category,
        description: desc,
        priceKobo: Math.round(price * 100),
        discountPercent: Math.round(discount),
        stockQuantity: stock,
        status: status === 'Active' ? 'ACTIVE' : 'DRAFT',
        ...(currentSelectedImage.startsWith('http') ? { imageUrl: currentSelectedImage } : {}),
      };
      try {
        const response = await fetch(`${API_BASE_URL}/api/vendor/products${isEditing ? `/${encodeURIComponent(editingRowId)}` : ''}`, {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not save product.');
        editingRowId = data.product.id;
      } catch (error) {
        showToast(error.message || 'Could not save product.');
        return;
      }
      toggleModal(false);
      editingRowId = null;
      await loadVendorProducts();
      showToast(isEditing ? `"${name}" updated successfully!` : `"${name}" published successfully!`);
    });
  }

  // --- Interactive Specific Context Row Targeting ---
  let rowActionTarget = null;
  let currentMarketingTarget = null;

  // --- Table Row Actions (Edit, Delete, Apply Promo, Restock) ---
  tableBody.addEventListener('click', async function(e) {
    const deleteBtn = e.target.closest('.delete-row-btn');
    if (deleteBtn) {
      rowActionTarget = deleteBtn.closest('.product-row');
      const title = rowActionTarget.querySelector('.product-title').textContent;
      document.getElementById('deleteConfirmMessage').textContent = `Are you sure you want to remove "${title}" from your product catalog?`;
      openCustomModal('deleteConfirmModal');
    }

    const restockBtn = e.target.closest('.restock-row-btn');
    if (restockBtn) {
      const row = restockBtn.closest('.product-row');
      try {
        await updateVendorProduct(row.dataset.id, { stockQuantity: 25 });
      } catch (error) {
        showToast(error.message || 'Could not update stock.');
        return;
      }
      row.dataset.stock = "25";
      row.dataset.status = row.dataset.status === 'draft' ? 'draft' : 'in-stock';
      
      const stockCell = row.querySelector('td:nth-child(4)');
      stockCell.innerHTML = buildStockHtml(25);
      
      // Update grayscale image if it was out of stock
      const img = row.querySelector('img');
      img.classList.remove('grayscale');
      const overlay = row.querySelector('.bg-charcoal\\/20');
      if(overlay) overlay.remove();

      const title = row.querySelector('.product-title').textContent;
      showToast(`Restocked 25 units for "${title}"`);
      updateProductCounts();
      filterTableRows();
    }

    const updateStockBtn = e.target.closest('[title="Update Stock Levels"]');
    if (updateStockBtn) {
        rowActionTarget = updateStockBtn.closest('.product-row');
        document.getElementById('modalStockInput').value = rowActionTarget.dataset.stock;
        openCustomModal('updateStockModal');
    }

    const applyPromoBtn = e.target.closest('[title="Apply Promo"]') || e.target.closest('[title="Manage Promo"]');
    if (applyPromoBtn) {
        rowActionTarget = applyPromoBtn.closest('.product-row');
        document.getElementById('modalProductPromoInput').value = rowActionTarget.dataset.hasPromo === 'true' ? '15' : '';
        openCustomModal('applyPromoModal');
    }

    const editBtn = e.target.closest('.edit-row-btn');
    if (editBtn) {
      const row = editBtn.closest('.product-row');
      editingRowId = row.dataset.id;
      
      modalTitle.textContent = "Edit Product Details";
      document.getElementById('newProductName').value = row.querySelector('.product-title').textContent;
      document.getElementById('newProductDesc').value = row.querySelector('.product-desc').textContent;
      document.getElementById('newProductPrice').value = row.dataset.price;
      document.getElementById('newProductCategory').value = row.dataset.category;
      document.getElementById('newProductStock').value = row.dataset.stock;
      document.getElementById('newProductStatus').value = row.dataset.status === 'draft' ? 'Draft' : 'Active';
      
      document.getElementById('newProductDiscount').value = row.dataset.hasPromo === 'true' ? '15' : '';

      const imgSrc = row.querySelector('img').src;
      if(imgSrc) {
        currentSelectedImage = imgSrc;
        imagePreview.src = currentSelectedImage;
        uploadPrompt.classList.add('hidden');
        imagePreviewContainer.classList.remove('hidden');
      }

      toggleModal(true, true);
    }
  });

  // --- Confirm Handlers for Row Operations ---
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
      if(!rowActionTarget) return;
      const title = rowActionTarget.querySelector('.product-title').textContent;
      try {
        const response = await fetch(`${API_BASE_URL}/api/vendor/products/${encodeURIComponent(rowActionTarget.dataset.id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('glamoraToken')}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not archive product.');
      } catch (error) {
        showToast(error.message || 'Could not archive product.');
        return;
      }
      rowActionTarget.remove();
      closeCustomModal(document.getElementById('deleteConfirmModal'));
      updateProductCounts();
      filterTableRows();
      showToast(`"${title}" successfully deleted.`);
  });

  document.getElementById('confirmUpdateStock').addEventListener('click', async () => {
      if(!rowActionTarget) return;
      const newStock = parseInt(document.getElementById('modalStockInput').value, 10) || 0;
      try {
        await updateVendorProduct(rowActionTarget.dataset.id, { stockQuantity: newStock });
      } catch (error) {
        showToast(error.message || 'Could not update stock.');
        return;
      }
      rowActionTarget.dataset.stock = newStock;
      rowActionTarget.dataset.status = rowActionTarget.dataset.status === 'draft'
        ? 'draft'
        : (newStock === 0 ? 'out-of-stock' : (newStock <= 15 ? 'low-stock' : 'in-stock'));
      const stockCell = rowActionTarget.querySelector('td:nth-child(4)');
      stockCell.innerHTML = buildStockHtml(newStock);

      const img = rowActionTarget.querySelector('img');
      if (newStock === 0) {
          img.classList.add('grayscale');
          if(!rowActionTarget.querySelector('.bg-charcoal\\/20')) {
               const overlay = document.createElement('span');
               overlay.className = "absolute inset-0 bg-charcoal/20 rounded-xl flex items-center justify-center";
               overlay.innerHTML = `<span class="material-symbols-outlined text-white text-[16px]">visibility_off</span>`;
               img.parentElement.classList.add('relative');
               img.parentElement.appendChild(overlay);
          }
      } else {
          img.classList.remove('grayscale');
          const overlay = rowActionTarget.querySelector('.bg-charcoal\\/20');
          if(overlay) overlay.remove();
      }

      closeCustomModal(document.getElementById('updateStockModal'));
      updateProductCounts();
      filterTableRows();
      showToast('Inventory limits successfully updated!');
  });

  document.getElementById('confirmApplyPromo').addEventListener('click', async () => {
      if(!rowActionTarget) return;
      const discount = parseFloat(document.getElementById('modalProductPromoInput').value) || 0;
      const price = parseFloat(rowActionTarget.dataset.price);
      try {
        await updateVendorProduct(rowActionTarget.dataset.id, { discountPercent: Math.round(discount) });
      } catch (error) {
        showToast(error.message || 'Could not update discount.');
        return;
      }
      rowActionTarget.dataset.hasPromo = discount > 0 ? 'true' : 'false';
      const priceCell = rowActionTarget.querySelector('td:nth-child(3)');
      priceCell.innerHTML = buildPriceHtml(price, discount);

      closeCustomModal(document.getElementById('applyPromoModal'));
      showToast(discount > 0 ? `Promo applied to product!` : `Promo removed from product.`);
      filterTableRows();
  });

  // --- Add Campaign & Promo Modals ---
  const addNewCampaignBtn = document.getElementById('addNewCampaignBtn');
  const addNewPromoBtn = document.getElementById('addNewPromoBtn');
  const marketingContainer = document.getElementById('marketingContainer');

  if (addNewCampaignBtn) {
    addNewCampaignBtn.addEventListener('click', () => {
      document.getElementById('modalCampaignName').value = '';
      document.getElementById('modalCampaignDiscount').value = '';
      openCustomModal('campaignModal');
    });
  }

  document.getElementById('confirmAddCampaign').addEventListener('click', () => {
      const name = document.getElementById('modalCampaignName').value || 'Storewide Event';
      const discount = document.getElementById('modalCampaignDiscount').value || '10';
      const template = document.getElementById('activeCampaignBanner');
      if (template) {
          const clone = template.cloneNode(true);
          clone.removeAttribute('id');
          clone.querySelector('h2').textContent = `${name}: ${discount}% OFF`;
          clone.querySelector('.font-headline-md').textContent = `${discount}% Tier`;
          marketingContainer.insertBefore(clone, marketingContainer.firstChild);
          closeCustomModal(document.getElementById('campaignModal'));
          showToast('New Campaign Deployed!');
      }
  });

  if (addNewPromoBtn) {
    addNewPromoBtn.addEventListener('click', () => {
      const template = document.getElementById('promoCardTemplate');
      if (template) {
        const clone = template.cloneNode(true);
        clone.removeAttribute('id');
        marketingContainer.appendChild(clone);
        showToast('New Promo Creator Panel Added');
      }
    });
  }

  // --- Marketing Delegation (Since campaigns/promos are duplicated, use delegation) ---
  document.addEventListener('change', (e) => {
    if (e.target.matches('.campaign-toggle')) {
      const card = e.target.closest('.campaign-card');
      if (!e.target.checked) {
        card.classList.add('opacity-50');
        showToast('Campaign temporarily paused');
      } else {
        card.classList.remove('opacity-50');
        showToast('Campaign active and live');
      }
    }
  });

  document.addEventListener('click', (e) => {
    // Copy Promo
    const copyBtn = e.target.closest('.copy-promo-btn');
    if (copyBtn) {
      const input = copyBtn.previousElementSibling;
      navigator.clipboard.writeText(input.value).then(() => {
        showToast(`Copied code: ${input.value}`);
      });
    }

    // Deploy Campaign
    const deployBtn = e.target.closest('.deploy-campaign-btn');
    if (deployBtn) {
      showToast('Promotion launched across selected apothecary lines!');
    }

    // Adjust Discount Button
    const adjustBtn = e.target.closest('.adjust-discount-btn');
    if (adjustBtn) {
        currentMarketingTarget = adjustBtn.closest('.campaign-card');
        document.getElementById('modalAdjustDiscountInput').value = '';
        openCustomModal('adjustDiscountModal');
    }

    // Extend Duration Button
    const extendBtn = e.target.closest('.extend-duration-btn');
    if (extendBtn) {
        currentMarketingTarget = extendBtn.closest('.campaign-card');
        document.getElementById('modalExtendDaysInput').value = '';
        openCustomModal('extendDurationModal');
    }

    // Discount Rate Preset Buttons
    if (e.target.matches('.discount-rate-buttons button')) {
      const container = e.target.closest('.discount-rate-buttons');
      container.querySelectorAll('button').forEach(b => {
        b.className = "flex-1 py-xs rounded-lg font-label-sm text-label-sm bg-surface-container text-charcoal hover:bg-surface-container-high font-semibold border border-soft-border transition-colors";
      });
      e.target.className = "flex-1 py-xs rounded-lg font-label-sm text-label-sm bg-charcoal text-on-primary font-semibold transition-colors";
      showToast(`Target discount set to ${e.target.dataset.discount}`);
    }
  });

  // --- Confirm Adjust / Extend ---
  document.getElementById('confirmAdjustDiscount').addEventListener('click', () => {
     if(!currentMarketingTarget) return;
     const val = document.getElementById('modalAdjustDiscountInput').value || 15;
     currentMarketingTarget.querySelector('h2').textContent = currentMarketingTarget.querySelector('h2').textContent.replace(/\d+%/, `${val}%`);
     currentMarketingTarget.querySelector('.font-headline-md').textContent = `${val}% Tier`;
     closeCustomModal(document.getElementById('adjustDiscountModal'));
     showToast(`Discount metric adjusted to ${val}%`);
  });

  document.getElementById('confirmExtendDuration').addEventListener('click', () => {
     if(!currentMarketingTarget) return;
     const days = document.getElementById('modalExtendDaysInput').value || 7;
     const metrics = currentMarketingTarget.querySelectorAll('.font-headline-md');
     if(metrics.length >= 2) metrics[1].textContent = `${days} Days`; 
     closeCustomModal(document.getElementById('extendDurationModal'));
     showToast(`Campaign timeline extended by ${days} days!`);
  });


  // --- View Toggle (Grid vs Table) ---
  if (tableViewBtn && gridViewBtn) {
    tableViewBtn.addEventListener('click', () => {
      isGridView = false;
      // Button Styles
      tableViewBtn.classList.replace('text-on-surface-variant', 'bg-surface-container-lowest');
      tableViewBtn.classList.add('shadow-sm', 'text-charcoal');
      gridViewBtn.classList.replace('bg-surface-container-lowest', 'text-on-surface-variant');
      gridViewBtn.classList.remove('shadow-sm', 'text-charcoal');

      // Table adjustments
      productsTable.classList.remove('block');
      productsTable.classList.add('w-full', 'text-left');
      productsTable.querySelector('thead').classList.remove('hidden');
      
      // Remove wider spaced grid classes
      productTableBody.classList.remove('grid', 'grid-cols-1', 'lg:grid-cols-2', 'gap-sm', 'p-sm');
      productTableBody.classList.add('divide-y', 'divide-soft-border');

      const rows = productTableBody.querySelectorAll('.product-row');
      rows.forEach(row => {
        row.classList.remove('flex', 'flex-col', 'border', 'border-soft-border', 'rounded-xl', 'p-sm', 'shadow-sm', 'bg-surface-container-lowest', 'gap-sm');
        row.classList.add('hover:bg-surface-container/50');
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
          cell.classList.remove('block', 'py-xs', 'px-0');
          cell.classList.add('py-md', 'px-md');
        });
        const actionCell = row.querySelector('td:last-child');
        actionCell.classList.add('text-right');
        const actionDiv = actionCell.querySelector('.actions-div');
        actionDiv.classList.add('justify-end');
        actionDiv.classList.remove('justify-start');
      });
    });

    gridViewBtn.addEventListener('click', () => {
      isGridView = true;
      // Button Styles
      gridViewBtn.classList.replace('text-on-surface-variant', 'bg-surface-container-lowest');
      gridViewBtn.classList.add('shadow-sm', 'text-charcoal');
      tableViewBtn.classList.replace('bg-surface-container-lowest', 'text-on-surface-variant');
      tableViewBtn.classList.remove('shadow-sm', 'text-charcoal');

      // Table adjustments
      productsTable.classList.add('block');
      productsTable.classList.remove('w-full', 'text-left');
      productsTable.querySelector('thead').classList.add('hidden');

      // Add wider columns layout (2 cols on lg) with smaller gap space (gap-sm) to allow more horizontal description text space
      productTableBody.classList.add('grid', 'grid-cols-1', 'lg:grid-cols-2', 'gap-sm', 'p-sm');
      productTableBody.classList.remove('divide-y', 'divide-soft-border');

      const rows = productTableBody.querySelectorAll('.product-row');
      rows.forEach(row => {
        row.classList.add('flex', 'flex-col', 'border', 'border-soft-border', 'rounded-xl', 'p-sm', 'shadow-sm', 'bg-surface-container-lowest', 'gap-sm');
        row.classList.remove('hover:bg-surface-container/50');
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
          cell.classList.add('block', 'py-xs', 'px-0');
          cell.classList.remove('py-md', 'px-md');
        });
        const actionCell = row.querySelector('td:last-child');
        actionCell.classList.remove('text-right');
        const actionDiv = actionCell.querySelector('.actions-div');
        actionDiv.classList.remove('justify-end');
        actionDiv.classList.add('justify-start');
      });
    });
  }

  // --- Search & Filter Logic ---
  function updateProductCounts() {
    const rows = Array.from(document.querySelectorAll('.product-row'));
    const total = rows.length;
    if (kpiTotalProducts) kpiTotalProducts.textContent = total;
    
    const inStock = rows.filter(r => r.dataset.status === 'in-stock').length;
    const lowStock = rows.filter(r => r.dataset.status === 'low-stock').length;
    const outOfStock = rows.filter(r => r.dataset.status === 'out-of-stock').length;
    const draft = rows.filter(r => r.dataset.status === 'draft').length;

    statusTabs.forEach(tab => {
      const status = tab.dataset.status;
      if (status === 'all') tab.innerHTML = `All Products (<span class="tab-count">${total}</span>)`;
      if (status === 'in-stock') tab.innerHTML = `In Stock (${inStock})`;
      if (status === 'low-stock') tab.innerHTML = `Low Stock (${lowStock})`;
      if (status === 'out-of-stock') tab.innerHTML = `Out of Stock (${outOfStock})`;
      if (status === 'draft') tab.innerHTML = `Drafts (${draft})`;
    });
  }

  function filterTableRows() {
    const query = (searchInput.value || '').toLowerCase().trim();
    const selectedCat = categorySelect.value;
    const promoOnly = document.getElementById('filterPromoOnly') ? document.getElementById('filterPromoOnly').checked : false;

    if (query.length > 0) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    const rows = Array.from(document.querySelectorAll('.product-row'));
    let visibleCount = 0;

    rows.forEach(row => {
      const title = row.querySelector('.product-title').textContent.toLowerCase();
      const desc = row.querySelector('.product-desc').textContent.toLowerCase();
      const category = row.dataset.category;
      const status = row.dataset.status;
      const hasPromo = row.dataset.hasPromo === 'true';

      let matchesSearch = title.includes(query) || desc.includes(query);
      let matchesCategory = selectedCat === 'all' || category === selectedCat;
      let matchesStatus = activeStatusFilter === 'all' || status === activeStatusFilter;
      let matchesPromo = !promoOnly || hasPromo;

      if (matchesSearch && matchesCategory && matchesStatus && matchesPromo) {
        row.style.display = '';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });

    if (visibleCount === 0) {
      noProductsFound.classList.remove('hidden');
      noProductsFound.classList.add('flex');
      tableShowingCount.textContent = 'Showing 0 products';
    } else {
      noProductsFound.classList.add('hidden');
      noProductsFound.classList.remove('flex');
      tableShowingCount.textContent = `Showing ${visibleCount} of ${rows.length} apothecary products`;
    }
  }

  if (searchInput) searchInput.addEventListener('input', filterTableRows);
  if (categorySelect) categorySelect.addEventListener('change', filterTableRows);

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      filterTableRows();
    });
  }

  // Status Tab Filtering
  statusTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      statusTabs.forEach(t => {
        t.classList.remove('bg-charcoal', 'text-on-primary', 'shadow-sm', 'font-semibold');
        t.classList.add('bg-surface-container', 'text-charcoal', 'border', 'border-soft-border');
      });
      this.classList.add('bg-charcoal', 'text-on-primary', 'shadow-sm', 'font-semibold');
      this.classList.remove('bg-surface-container', 'text-charcoal', 'border', 'border-soft-border');
      activeStatusFilter = this.dataset.status;
      filterTableRows();
    });
  });

  // Filter Dropdown Toggle
  if (filterDropdownToggle && filterDropdownMenu) {
    filterDropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      filterDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!filterDropdownMenu.contains(e.target) && e.target !== filterDropdownToggle) {
        filterDropdownMenu.classList.add('hidden');
      }
    });
  }

  // Apply Sorting from dropdown
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', function() {
      const sortRadio = document.querySelector('input[name="sortOption"]:checked');
      const sortValue = sortRadio ? sortRadio.value : 'default';

      // (Sorting logic omitted for brevity as per instructions)
      filterTableRows();
      filterDropdownMenu.classList.add('hidden');
    });
  }

  loadVendorProducts();
})();

/**
 * Switch role logic between Vendor and Customer dashboard.
 */
function switchRole(role) {
  if (role === 'customer') {
    window.location.href = 'vendor customer dashboard.html';
  } else if (role === 'vendor') {
    console.log("Already on Vendor Dashboard");
  }
}

/**
 * Mobile Sidebar Drawer Navigation Toggle
 */
function toggleMobileSidebar() {
  const sidebar = document.getElementById("mobile-sidebar");
  if (sidebar) {
    sidebar.classList.toggle("hidden");
  }
}

/** 3. Role Switcher */
function initRoleToggle() {
    const vendorBtn = document.getElementById('role-vendor');
    const customerBtn = document.getElementById('role-customer');
    
    // Vendor is inherently active here, so we just setup redirect for customer
    if(customerBtn) {
        customerBtn.addEventListener('click', () => {
            window.location.href = 'customer-dashboard.html';
        });
    }
}
