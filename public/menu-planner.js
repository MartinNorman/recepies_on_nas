// Menu Planner Application
class MenuPlanner {
    constructor() {
        this.currentMenu = null;
        this.allRecipes = [];
        this.allMenus = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadRecipes();
        this.setDefaultDates();
    }

    bindEvents() {
        // Navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Menu form events
        document.getElementById('createMenuBtn').addEventListener('click', () => this.showMenuForm());
        document.getElementById('saveMenuBtn').addEventListener('click', () => this.createMenu());
        document.getElementById('cancelMenuBtn').addEventListener('click', () => this.hideMenuForm());
        
        // Menu actions
        document.getElementById('generateShoppingListBtn').addEventListener('click', () => this.generateShoppingList());
        document.getElementById('editMenuBtn').addEventListener('click', () => this.editMenu());
        document.getElementById('deleteMenuBtn').addEventListener('click', () => this.deleteMenu());
        document.getElementById('setActiveBtn').addEventListener('click', () => this.setActiveMenu());

        // Menu selector
        document.getElementById('menuSelect').addEventListener('change', (e) => this.selectMenu(e.target.value));

        // Shopping list modal
        document.getElementById('shoppingListModal').addEventListener('click', (e) => {
            if (e.target.id === 'shoppingListModal') {
                this.closeShoppingListModal();
            }
        });

        document.querySelector('#shoppingListModal .close').addEventListener('click', () => {
            this.closeShoppingListModal();
        });
    }

    switchTab(tabName) {
        // Update tab appearance
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Show/hide sections
        document.querySelector('.search-section').style.display = tabName === 'search' ? 'block' : 'none';
        document.querySelector('.browse-section').style.display = tabName === 'search' ? 'block' : 'none';
        document.querySelector('.results-section').style.display = tabName === 'search' ? 'block' : 'none';
        document.getElementById('menuSection').style.display = tabName === 'menu' ? 'block' : 'none';

        if (tabName === 'menu') {
            this.loadMenus();
        }
    }

    async loadRecipes() {
        try {
            const response = await fetch('/api/tables/names');
            if (!response.ok) throw new Error('Failed to fetch recipes');
            this.allRecipes = await response.json();
        } catch (error) {
            console.error('Error loading recipes:', error);
            this.showNotification('Error loading recipes', 'error');
        }
    }

    setDefaultDates() {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        document.getElementById('weekStartDate').value = startOfWeek.toISOString().split('T')[0];
        document.getElementById('weekEndDate').value = endOfWeek.toISOString().split('T')[0];
    }

    showMenuForm() {
        document.getElementById('menuForm').style.display = 'block';
        document.getElementById('menuGrid').style.display = 'none';
        this.setDefaultDates();
    }

    hideMenuForm() {
        document.getElementById('menuForm').style.display = 'none';
        document.getElementById('menuGrid').style.display = 'block';
    }

    async createMenu() {
        const name = document.getElementById('menuName').value.trim();
        const startDate = document.getElementById('weekStartDate').value;
        const endDate = document.getElementById('weekEndDate').value;

        if (!name || !startDate || !endDate) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        const isEditing = this.currentMenu && document.getElementById('saveMenuBtn').textContent === 'Update Menu';
        const url = isEditing ? `/api/menus/${this.currentMenu.id}` : '/api/menus';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    week_start_date: startDate,
                    week_end_date: endDate
                })
            });

            if (!response.ok) throw new Error(`Failed to ${isEditing ? 'update' : 'create'} menu`);

            const menu = await response.json();
            this.currentMenu = menu;
            
            // Refresh the menu list and selector
            await this.loadMenus();
            this.hideMenuForm();
            this.showNotification(`Menu ${isEditing ? 'updated' : 'created'} successfully!`, 'success');
            
            // Reset button text
            document.getElementById('saveMenuBtn').textContent = 'Create Menu';
        } catch (error) {
            console.error(`Error ${isEditing ? 'updating' : 'creating'} menu:`, error);
            this.showNotification(`Failed to ${isEditing ? 'update' : 'create'} menu`, 'error');
        }
    }

    async loadMenus() {
        try {
            const response = await fetch('/api/menus');
            if (!response.ok) throw new Error('Failed to fetch menus');
            this.allMenus = await response.json();
            
            this.populateMenuSelector();
            
            if (this.allMenus.length > 0) {
                // Select the most recent menu by default
                const mostRecentMenu = this.allMenus[0];
                this.selectMenu(mostRecentMenu.id);
            } else {
                this.showMenuForm();
            }
        } catch (error) {
            console.error('Error loading menus:', error);
            this.showNotification('Error loading menus', 'error');
        }
    }

    populateMenuSelector() {
        const select = document.getElementById('menuSelect');
        select.innerHTML = '';
        
        if (this.allMenus.length === 0) {
            select.innerHTML = '<option value="">No menus available</option>';
            return;
        }
        
        this.allMenus.forEach(menu => {
            const option = document.createElement('option');
            option.value = menu.id;
            const activeIndicator = menu.active ? ' ⭐ ACTIVE' : '';
            option.textContent = `${menu.name} (${this.formatDateRange(menu.week_start_date, menu.week_end_date)})${activeIndicator}`;
            select.appendChild(option);
        });
    }

    async selectMenu(menuId) {
        if (!menuId) return;
        
        const menu = this.allMenus.find(m => m.id == menuId);
        if (!menu) return;
        
        try {
            const response = await fetch(`/api/menus/${menuId}`);
            if (!response.ok) throw new Error('Failed to fetch menu details');
            const menuDetails = await response.json();
            
            this.currentMenu = menuDetails;
            this.displayMenu(menuDetails);
        } catch (error) {
            console.error('Error loading menu details:', error);
            this.showNotification('Error loading menu details', 'error');
        }
    }

    formatDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }

    async displayMenu(menu) {
        document.getElementById('currentMenuName').textContent = menu.name;
        document.getElementById('menuGrid').style.display = 'block';
        document.getElementById('menuForm').style.display = 'none';
        document.getElementById('generateShoppingListBtn').style.display = 'inline-block';
        
        // Show/hide Set as Active button based on whether this menu is already active
        const setActiveBtn = document.getElementById('setActiveBtn');
        if (menu.active) {
            setActiveBtn.style.display = 'none';
            setActiveBtn.innerHTML = '<i class="fas fa-check"></i> Active';
        } else {
            setActiveBtn.style.display = 'inline-block';
            setActiveBtn.innerHTML = '<i class="fas fa-star"></i> Set as Active';
        }

        // Set the correct menu in the selector
        document.getElementById('menuSelect').value = menu.id;

        // Clear existing content
        for (let i = 0; i < 7; i++) {
            document.getElementById(`day-${i}`).innerHTML = '';
        }

        // Load menu items
        try {
            const response = await fetch(`/api/menus/${menu.id}`);
            if (!response.ok) throw new Error('Failed to fetch menu details');
            const menuDetails = await response.json();
            
            this.currentMenu = menuDetails;
            this.renderMenuItems(menuDetails.items);
        } catch (error) {
            console.error('Error loading menu details:', error);
        }
    }

    renderMenuItems(items) {
        // Group items by day
        const itemsByDay = {};
        items.forEach(item => {
            if (!itemsByDay[item.day_of_week]) {
                itemsByDay[item.day_of_week] = [];
            }
            itemsByDay[item.day_of_week].push(item);
        });

        // Render each day
        for (let day = 0; day < 7; day++) {
            const dayContent = document.getElementById(`day-${day}`);
            
            if (itemsByDay[day] && itemsByDay[day].length > 0) {
                dayContent.innerHTML = itemsByDay[day].map(item => {
                    const imagePath = `/images/${item.recipe_id}.jpg`;
                    return `
                    <div class="recipe-card-small" data-item-id="${item.id}" data-recipe-id="${item.recipe_id}">
                        <img 
                            class="recipe-image-small" 
                            src="${imagePath}" 
                            alt="${item.recipe_name}"
                            loading="lazy"
                            onerror="this.onerror=null; this.style.display='none';"
                        >
                        <div class="recipe-card-small-content">
                            <h5>${item.recipe_name}</h5>
                            <p>${item.meal_type}</p>
                        </div>
                        <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); menuPlanner.removeMenuItem(${item.id})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                }).join('');
                
                // Add click event listeners to recipe cards
                dayContent.querySelectorAll('.recipe-card-small').forEach(card => {
                    card.addEventListener('click', (e) => {
                        // Don't open recipe if clicking the remove button
                        if (e.target.closest('.btn-danger')) {
                            return;
                        }
                        const recipeId = card.dataset.recipeId;
                        if (recipeId && window.app) {
                            window.app.showRecipeDetail(recipeId);
                        }
                    });
                });
            } else {
                dayContent.innerHTML = `
                    <button class="add-recipe-btn" onclick="menuPlanner.showRecipeSelector(${day})">
                        <i class="fas fa-plus"></i> Add Recipe
                    </button>
                `;
            }
        }
    }

    showRecipeSelector(dayOfWeek) {
        // Check if a menu is selected
        if (!this.currentMenu) {
            this.showNotification('Please select or create a menu first', 'error');
            return;
        }
        
        // Store the day selection for when a recipe is selected
        this.pendingDaySelection = {
            dayOfWeek: dayOfWeek,
            dayName: this.getDayName(dayOfWeek),
            menuId: this.currentMenu.id
        };
        
        // Store in sessionStorage as backup
        sessionStorage.setItem('pendingDaySelection', JSON.stringify(this.pendingDaySelection));
        
        // Switch to Search tab
        this.switchTab('search');
        
        // Show notification to guide user
        if (window.app) {
            window.app.showNotification(`Select a recipe to add to ${this.pendingDaySelection.dayName}`, 'info');
        }
    }

    async addRecipeToDay(dayOfWeek, recipeId) {
        try {
            const response = await fetch(`/api/menus/${this.currentMenu.id}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    day_of_week: dayOfWeek,
                    recipe_id: recipeId,
                    meal_type: 'dinner'
                })
            });

            if (!response.ok) throw new Error('Failed to add recipe to menu');

            this.showNotification('Recipe added to menu!', 'success');
            // Reload menu data from server
            await this.selectMenu(this.currentMenu.id);
        } catch (error) {
            console.error('Error adding recipe to menu:', error);
            this.showNotification('Failed to add recipe to menu', 'error');
        }
    }

    async removeMenuItem(itemId) {
        try {
            const response = await fetch(`/api/menus/${this.currentMenu.id}/items/${itemId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to remove recipe from menu');

            this.showNotification('Recipe removed from menu!', 'success');
            // Reload menu data from server
            await this.selectMenu(this.currentMenu.id);
        } catch (error) {
            console.error('Error removing recipe from menu:', error);
            this.showNotification('Failed to remove recipe from menu', 'error');
        }
    }

    async generateShoppingList() {
        try {
            const response = await fetch(`/api/menus/${this.currentMenu.id}/shopping-list`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: `${this.currentMenu.name} - Shopping List`
                })
            });

            if (!response.ok) throw new Error('Failed to generate shopping list');

            const shoppingList = await response.json();
            this.displayShoppingList(shoppingList);
        } catch (error) {
            console.error('Error generating shopping list:', error);
            this.showNotification('Failed to generate shopping list', 'error');
        }
    }

    displayShoppingList(shoppingList) {
        const modal = document.getElementById('shoppingListModal');
        const content = document.getElementById('shoppingListContent');
        
        content.innerHTML = `
            <div class="shopping-list">
                <h3>Shopping List</h3>
                <div class="shopping-list-items">
                    ${shoppingList.map(item => `
                        <div class="shopping-list-item ${item.complete ? 'purchased' : ''}" data-item-id="${item.id}">
                            <input type="checkbox" ${item.complete ? 'checked' : ''} 
                                   onchange="menuPlanner.togglePurchased('${item.id}', this.checked)">
                            <div class="ingredient-info">
                                <div class="ingredient-name">${item.name}</div>
                            </div>
                            <div class="item-actions">
                                <button class="btn btn-small btn-primary" onclick="menuPlanner.editItem('${item.id}', '${item.name}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-small btn-danger" onclick="menuPlanner.deleteItem('${item.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="add-item-section">
                    <button class="btn btn-primary" onclick="menuPlanner.showAddItemForm()">
                        <i class="fas fa-plus"></i> Add Item
                    </button>
                    <button class="btn btn-secondary" onclick="menuPlanner.syncToHomeAssistant()">
                        <i class="fas fa-home"></i> Sync to Home Assistant
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'block';
    }

    async togglePurchased(itemId, isPurchased) {
        try {
            const response = await fetch(`/api/shopping-lists/items/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    complete: isPurchased
                })
            });

            if (!response.ok) throw new Error('Failed to update item status');

            // Update UI
            const item = document.querySelector(`[data-item-id="${itemId}"]`);
            if (isPurchased) {
                item.classList.add('purchased');
            } else {
                item.classList.remove('purchased');
            }
        } catch (error) {
            console.error('Error updating item status:', error);
            this.showNotification('Failed to update item status', 'error');
        }
    }

    async deleteItem(itemId) {
        try {
            const response = await fetch(`/api/shopping-lists/items/${itemId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete item');

            // Remove item from UI
            const item = document.querySelector(`[data-item-id="${itemId}"]`);
            item.remove();

            this.showNotification('Item deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting item:', error);
            this.showNotification('Failed to delete item', 'error');
        }
    }

    editItem(itemId, currentName) {
        const item = document.querySelector(`[data-item-id="${itemId}"]`);
        const ingredientInfo = item.querySelector('.ingredient-info');
        const itemActions = item.querySelector('.item-actions');
        
        // Create edit form
        const editForm = document.createElement('div');
        editForm.className = 'edit-form';
        editForm.innerHTML = `
            <input type="text" value="${currentName}" class="edit-input" id="editInput-${itemId}">
            <div class="edit-actions">
                <button class="btn btn-small btn-success" onclick="menuPlanner.saveEdit('${itemId}')">
                    <i class="fas fa-check"></i>
                </button>
                <button class="btn btn-small btn-secondary" onclick="menuPlanner.cancelEdit('${itemId}', '${currentName}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Replace content with edit form
        ingredientInfo.style.display = 'none';
        itemActions.style.display = 'none';
        item.appendChild(editForm);
        
        // Focus on input
        document.getElementById(`editInput-${itemId}`).focus();
    }

    async saveEdit(itemId) {
        const input = document.getElementById(`editInput-${itemId}`);
        const newName = input.value.trim();
        
        if (!newName) {
            this.showNotification('Item name cannot be empty', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/shopping-lists/items/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newName
                })
            });

            if (!response.ok) throw new Error('Failed to update item');

            // Update UI
            const item = document.querySelector(`[data-item-id="${itemId}"]`);
            const ingredientInfo = item.querySelector('.ingredient-info');
            const itemActions = item.querySelector('.item-actions');
            const editForm = item.querySelector('.edit-form');
            
            // Update the displayed name with the new value
            const nameElement = ingredientInfo.querySelector('.ingredient-name');
            if (nameElement) {
                nameElement.textContent = newName;
                // Force a reflow to ensure the DOM is updated
                nameElement.offsetHeight;
            }
            
            ingredientInfo.style.display = 'block';
            itemActions.style.display = 'block';
            editForm.remove();
            
            this.showNotification('Item updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating item:', error);
            this.showNotification('Failed to update item', 'error');
        }
    }

    cancelEdit(itemId, originalName) {
        const item = document.querySelector(`[data-item-id="${itemId}"]`);
        const ingredientInfo = item.querySelector('.ingredient-info');
        const itemActions = item.querySelector('.item-actions');
        const editForm = item.querySelector('.edit-form');
        
        ingredientInfo.style.display = 'block';
        itemActions.style.display = 'block';
        editForm.remove();
    }

    showAddItemForm() {
        const addItemSection = document.querySelector('.add-item-section');
        addItemSection.innerHTML = `
            <div class="add-item-form">
                <input type="text" placeholder="Item name (e.g., milk 1 liter)" class="add-input" id="addItemInput">
                <div class="add-actions">
                    <button class="btn btn-success" onclick="menuPlanner.addItem()">
                        <i class="fas fa-check"></i> Add
                    </button>
                    <button class="btn btn-secondary" onclick="menuPlanner.cancelAddItem()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('addItemInput').focus();
    }

    async addItem() {
        const input = document.getElementById('addItemInput');
        const itemName = input.value.trim();
        
        if (!itemName) {
            this.showNotification('Item name cannot be empty', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/shopping-lists/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: itemName
                })
            });

            if (!response.ok) throw new Error('Failed to add item');

            const newItem = await response.json();
            
            // Add item to UI
            const shoppingListItems = document.querySelector('.shopping-list-items');
            const newItemElement = document.createElement('div');
            newItemElement.className = 'shopping-list-item';
            newItemElement.setAttribute('data-item-id', newItem.id);
            newItemElement.innerHTML = `
                <input type="checkbox" onchange="menuPlanner.togglePurchased('${newItem.id}', this.checked)">
                <div class="ingredient-info">
                    <div class="ingredient-name">${newItem.name}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-small btn-primary" onclick="menuPlanner.editItem('${newItem.id}', '${newItem.name}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-small btn-danger" onclick="menuPlanner.deleteItem('${newItem.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            shoppingListItems.appendChild(newItemElement);
            
            // Reset add form
            this.cancelAddItem();
            this.showNotification('Item added successfully!', 'success');
        } catch (error) {
            console.error('Error adding item:', error);
            this.showNotification('Failed to add item', 'error');
        }
    }

    cancelAddItem() {
        const addItemSection = document.querySelector('.add-item-section');
        addItemSection.innerHTML = `
            <button class="btn btn-primary" onclick="menuPlanner.showAddItemForm()">
                <i class="fas fa-plus"></i> Add Item
            </button>
            <button class="btn btn-secondary" onclick="menuPlanner.syncToHomeAssistant()">
                <i class="fas fa-home"></i> Sync to Home Assistant
            </button>
        `;
    }

    async syncToHomeAssistant() {
        console.log('syncToHomeAssistant() called');
        try {
            // Get items currently displayed on the page
            const displayedItems = [];
            const itemElements = document.querySelectorAll('.shopping-list-item');
            itemElements.forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                // Only sync unchecked (unpurchased) items
                if (!checkbox.checked) {
                    // Check if item is currently being edited - read from edit input if so
                    const editInput = item.querySelector('.edit-input');
                    if (editInput) {
                        // Item is being edited - use the value from the edit input
                        const editedValue = editInput.value.trim();
                        if (editedValue) {
                            displayedItems.push(editedValue);
                        }
                    } else {
                        // Item is not being edited - read from the displayed name
                        const nameElement = item.querySelector('.ingredient-name');
                        if (nameElement) {
                            displayedItems.push(nameElement.textContent.trim());
                        }
                    }
                }
            });

            console.log('Items to sync from UI:', displayedItems);

            if (displayedItems.length === 0) {
                this.showNotification('No unpurchased items to sync', 'info');
                return;
            }

            console.log('Sending POST to /api/shopping-lists/ha/sync');
            const response = await fetch('/api/shopping-lists/ha/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ items: displayedItems })
            });

            console.log('Response status:', response.status);
            const result = await response.json();
            console.log('Response data:', result);

            if (!response.ok) {
                throw new Error(result.error || 'Failed to sync');
            }

            if (result.itemsSynced > 0) {
                this.showNotification(`Synced ${result.itemsSynced} items to Home Assistant!`, 'success');

                // Clear the shopping list after successful sync
                if (result.errors === 0) {
                    const shoppingListItems = document.querySelector('.shopping-list-items');
                    if (shoppingListItems) {
                        shoppingListItems.innerHTML = '';
                    }
                    this.showNotification('Shopping list cleared after successful sync', 'info');
                }
            } else {
                this.showNotification('No items to sync', 'info');
            }

            if (result.errors > 0) {
                console.warn('Some items failed to sync:', result.errorDetails);
            }
        } catch (error) {
            console.error('Error syncing to Home Assistant:', error);
            this.showNotification(error.message || 'Failed to sync to Home Assistant', 'error');
        }
    }

    closeShoppingListModal() {
        document.getElementById('shoppingListModal').style.display = 'none';
    }

    editMenu() {
        if (!this.currentMenu) return;
        
        // Show the menu form with current values
        document.getElementById('menuForm').style.display = 'block';
        document.getElementById('menuGrid').style.display = 'none';
        
        // Populate form with current menu data
        document.getElementById('menuName').value = this.currentMenu.name;
        document.getElementById('weekStartDate').value = this.currentMenu.week_start_date;
        document.getElementById('weekEndDate').value = this.currentMenu.week_end_date;
        
        // Change button text to indicate editing
        document.getElementById('saveMenuBtn').textContent = 'Update Menu';
    }

    async deleteMenu() {
        if (!this.currentMenu) return;
        
        if (!confirm(`Are you sure you want to delete "${this.currentMenu.name}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/menus/${this.currentMenu.id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to delete menu');
            
            this.showNotification('Menu deleted successfully!', 'success');
            
            // Refresh the menu list
            await this.loadMenus();
        } catch (error) {
            console.error('Error deleting menu:', error);
            this.showNotification('Failed to delete menu', 'error');
        }
    }

    async setActiveMenu() {
        if (!this.currentMenu) return;
        
        try {
            const response = await fetch(`/api/menus/${this.currentMenu.id}/active`, {
                method: 'PUT'
            });
            
            if (!response.ok) throw new Error('Failed to set active menu');
            
            this.showNotification('Menu set as active!', 'success');
            
            // Refresh the menu list to update active indicators
            await this.loadMenus();
        } catch (error) {
            console.error('Error setting active menu:', error);
            this.showNotification('Failed to set active menu', 'error');
        }
    }

    getDayName(dayOfWeek) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayOfWeek];
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}

// Initialize menu planner when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.menuPlanner = new MenuPlanner();
});

