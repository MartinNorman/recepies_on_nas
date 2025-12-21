// Application State
let addedIngredients = [];
let allRecipes = [];
let currentPage = 1;
let totalPages = 1;

// DOM Elements
const ingredientInput = document.getElementById('ingredientInput');
const addIngredientBtn = document.getElementById('addIngredientBtn');
const suggestions = document.getElementById('suggestions');
const addedIngredientsContainer = document.getElementById('addedIngredients');
const matchAllCheckbox = document.getElementById('matchAllCheckbox');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');
const quickSearchInput = document.getElementById('quickSearchInput');
const quickSearchBtn = document.getElementById('quickSearchBtn');
const browseBtn = document.getElementById('browseBtn');
const typeFilterButtons = document.getElementById('typeFilterButtons');
const resultsSection = document.getElementById('resultsSection');
const resultsTitle = document.getElementById('resultsTitle');
const searchResults = document.getElementById('searchResults');
const browseResults = document.getElementById('browseResults');
const recipeModal = document.getElementById('recipeModal');
const recipeDetail = document.getElementById('recipeDetail');
const loadingSpinner = document.getElementById('loadingSpinner');
const notification = document.getElementById('notification');

class RecipeSearchApp {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateIngredientsDisplay();
        this.loadInitialData();
    }

    bindEvents() {
        // Ingredient input events
        ingredientInput.addEventListener('input', this.handleIngredientInput.bind(this));
        ingredientInput.addEventListener('keypress', this.handleIngredientKeypress.bind(this));
        addIngredientBtn.addEventListener('click', this.addIngredient.bind(this));
        
        // Search events
        searchBtn.addEventListener('click', this.searchByIngredients.bind(this));
        clearBtn.addEventListener('click', this.clearIngredients.bind(this));
        
        // Quick search events
        quickSearchBtn.addEventListener('click', this.quickSearch.bind(this));
        quickSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.quickSearch();
        });
        
        // Browse events
        browseBtn.addEventListener('click', this.browseRecipes.bind(this));
        
        // Filter buttons for Kött, Fisk, Fågel
        const filterKottBtn = document.getElementById('filterKottBtn');
        const filterFiskBtn = document.getElementById('filterFiskBtn');
        const filterFagelBtn = document.getElementById('filterFagelBtn');
        
        if (filterKottBtn) {
            filterKottBtn.addEventListener('click', () => {
                this.browseRecipesByType('Kött');
                this.setFilterButtonActive(filterKottBtn);
            });
        }
        
        if (filterFiskBtn) {
            filterFiskBtn.addEventListener('click', () => {
                this.browseRecipesByType('Fisk');
                this.setFilterButtonActive(filterFiskBtn);
            });
        }
        
        if (filterFagelBtn) {
            filterFagelBtn.addEventListener('click', () => {
                this.browseRecipesByType('Fågel');
                this.setFilterButtonActive(filterFagelBtn);
            });
        }
        
        // Modal events
        document.querySelector('.close').addEventListener('click', this.closeModal.bind(this));
        window.addEventListener('click', (e) => {
            if (e.target === recipeModal) this.closeModal();
        });
        
        // Click outside to close suggestions
        document.addEventListener('click', (e) => {
            if (!ingredientInput.contains(e.target) && !suggestions.contains(e.target)) {
                suggestions.classList.remove('show');
            }
        });
    }

    async loadInitialData() {
        try {
            await this.fetchAllRecipes();
            this.createTypeFilterButtons();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Error loading recipes', 'error');
        }
    }

    async fetchAllRecipes() {
        try {
            // Fetch all recipes (we'll get the first page, but for type filters we need all)
            // For now, fetch without pagination to get all recipes for type filtering
            const response = await fetch('/api/tables/names?page=1&limit=1000');
        if (!response.ok) throw new Error('Failed to fetch recipes');
            const data = await response.json();
            
            // Handle both old format (array) and new format (object with recipes property)
            if (Array.isArray(data)) {
                allRecipes = data;
            } else {
                allRecipes = data.recipes || [];
            }
        } catch (error) {
            console.error('Error fetching all recipes:', error);
            allRecipes = [];
        }
    }

    getAvailableTypes() {
        // Always start with standard Swedish recipe categories
        const standardCategories = ['Förrätt', 'Varmrätt', 'Efterrätt', 'Drink'];
        let types = [...standardCategories];
        
        // Extract unique types from recipes
        // Ensure allRecipes is an array
        if (!Array.isArray(allRecipes)) {
            allRecipes = [];
        }
        
        // Get types from recipes and add them if not already in standard categories
        const recipeTypes = [...new Set(allRecipes.map(recipe => recipe.type).filter(Boolean))];
        recipeTypes.forEach(type => {
            // Remove "Drinkar" if present (we use "Drink" instead)
            if (type === 'Drinkar') {
                return; // Skip Drinkar
            }
            // Replace "Dryck" with "Drink"
            if (type === 'Dryck') {
                if (!types.includes('Drink')) {
                    // Drink is already in standardCategories, so this won't add it again
                }
                return; // Skip Dryck
            }
            // Add type if not already in the list
            if (!types.includes(type)) {
                types.push(type);
            }
        });
        
        // Sort types alphabetically
        types.sort();
        
        console.log('Available types:', types);
        return types;
    }

    createTypeFilterButtons() {
        const types = this.getAvailableTypes();
        console.log('Creating type filter buttons for types:', types);
        console.log('typeFilterButtons element:', typeFilterButtons);
        
        if (types.length === 0) {
            console.warn('No types found, clearing buttons');
            typeFilterButtons.innerHTML = '';
            return;
        }

        // Create buttons for each type
        const buttonsHTML = types.map(type => `
            <button class="btn btn-secondary type-filter-btn" data-type="${type}">
                <i class="fas fa-filter"></i> ${type}
            </button>
        `).join('');
        
        console.log('Generated buttons HTML:', buttonsHTML);
        typeFilterButtons.innerHTML = buttonsHTML;

        // Add click handlers
        const buttons = typeFilterButtons.querySelectorAll('.type-filter-btn');
        console.log('Found buttons:', buttons.length);
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                this.browseRecipesByType(type);
                this.setFilterButtonActive(btn);
            });
        });
    }

    populateTypeRadioButtons(selectedType = '') {
        const radioGroup = document.getElementById('recipeTypeRadioGroup');
        if (!radioGroup) return;
        
        const types = this.getAvailableTypes();
        
        radioGroup.innerHTML = types.map(type => `
            <label class="radio-option">
                <input type="radio" name="recipeType" value="${type}" ${type === selectedType ? 'checked' : ''}>
                <span>${type}</span>
            </label>
        `).join('');
    }

    async handleIngredientInput() {
        const query = ingredientInput.value.trim().toLowerCase();
        
        if (query.length < 2) {
            suggestions.classList.remove('show');
            return;
        }

        try {
            const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Failed to fetch suggestions');
            
            const suggestions = await response.json();
            this.displaySuggestions(suggestions);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }

    displaySuggestions(suggestionsData) {
        suggestions.innerHTML = '';
        
        if (suggestionsData.length === 0) {
            suggestions.innerHTML = '<div class="suggestion-item">No ingredients found</div>';
        } else {
            suggestionsData.forEach(ingredient => {
                const suggestionEl = document.createElement('div');
                suggestionEl.className = 'suggestion-item';
                suggestionEl.textContent = ingredient;
                suggestionEl.addEventListener('click', () => {
                    ingredientInput.value = ingredient;
                    this.addIngredient();
                });
                suggestions.appendChild(suggestionEl);
            });
        }
        
        suggestions.classList.add('show');
    }

    handleIngredientKeypress(e) {
        if (e.key === 'Enter') {
            this.addIngredient();
        }
    }

    addIngredient() {
        const ingredient = ingredientInput.value.trim().toLowerCase();
        
        if (!ingredient) {
            this.showNotification('Please enter an ingredient name', 'error');
            return;
        }

        if (addedIngredients.includes(ingredient)) {
            this.showNotification('Ingredient already added', 'error');
            return;
        }

        addedIngredients.push(ingredient);
        ingredientInput.value = '';
        suggestions.classList.remove('show');
        this.updateIngredientsDisplay();
        this.updateSearchButtonState();
    }

    removeIngredient(ingredient) {
        const index = addedIngredients.indexOf(ingredient);
        if (index > -1) {
            addedIngredients.splice(index, 1);
            this.updateIngredientsDisplay();
            this.updateSearchButtonState();
        }
    }

    updateIngredientsDisplay() {
        if (addedIngredients.length === 0) {
            addedIngredientsContainer.innerHTML = '<span class="empty-state">No ingredients added yet</span>';
            return;
        }

        addedIngredientsContainer.innerHTML = addedIngredients.map(ingredient => `
            <div class="ingredient-tag">
                ${ingredient}
                <button class="remove" onclick="app.removeIngredient('${ingredient}')" title="Remove ingredient">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    updateSearchButtonState() {
        searchBtn.disabled = addedIngredients.length === 0;
        searchBtn.style.opacity = addedIngredients.length === 0 ? '0.5' : '1';
    }

    clearIngredients() {
        addedIngredients = [];
        this.updateIngredientsDisplay();
        this.updateSearchButtonState();
        resultsSection.style.display = 'none';
    }

    async searchByIngredients() {
        if (addedIngredients.length === 0) {
            this.showNotification('Please add at least one ingredient', 'error');
            return;
        }

        this.showLoading(true);
        
        try {
            const matchAll = matchAllCheckbox.checked;
            const response = await fetch('/api/search/by-ingredients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ingredients: addedIngredients,
                    matchAll
                })
            });

           if (!response.ok) throw new Error('Search failed');

            const data = await response.json();
            this.displaySearchResults(data.results, data.query);
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error('Search error:', error);
            this.showNotification('Search failed. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displaySearchResults(recipes, query) {
        const matchTypeText = query.matchAll ? 'containing all' : 'containing any';
        const searchTermText = query.ingredients.length === 1 ? 'ingredient' : 'ingredients';
        
        resultsTitle.innerHTML = `
            <i class="fas fa-search"></i> 
            Found ${recipes.length} recipe${recipes.length !== 1 ? 's' : ''} containing ${matchTypeText} 
            ${searchTermText}: ${query.ingredients.join(', ')}
        `;

        if (recipes.length === 0) {
            searchResults.innerHTML = '<div class="empty-state">No recipes found matching your criteria</div>';
            return;
        }

        searchResults.innerHTML = recipes.map(recipe => this.createRecipeCard(recipe)).join('');
        this.bindRecipeCardEvents();
    }

    async quickSearch() {
        const query = quickSearchInput.value.trim();
        
        if (!query) {
            this.showNotification('Please enter a search term', 'error');
            return;
        }

        this.showLoading(true);
        
        try {
            const response = await fetch(`/api/search/recipes?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search failed');

            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                this.displayQuickSearchresults(data.results, query);
            } else {
                // Remove results-grid class to allow proper layout
                browseResults.classList.remove('results-grid');
                browseResults.innerHTML = '<div class="empty-state">No recipes found</div>';
            }
            
            browseResults.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error('Quick search error:', error);
            this.showNotification('Search failed. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayQuickSearchresults(recipes, query) {
        // Remove results-grid class to allow proper layout
        browseResults.classList.remove('results-grid');
        browseResults.innerHTML = `
            <h3>Search results for "${query}" (${recipes.length} found):</h3>
            <div class="results-grid">
                ${recipes.map(recipe => this.createRecipeCard(recipe)).join('')}
            </div>
        `;
        this.bindRecipeCardEvents();
    }

    setFilterButtonActive(activeButton) {
        // Clear active state from all filter buttons (both static and dynamic)
        document.querySelectorAll('.type-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        // Set the clicked button as active
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    async browseRecipes(page = 1) {
        // Clear active state from all filter buttons
        document.querySelectorAll('.type-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Remove results-grid class to allow proper layout
        browseResults.classList.remove('results-grid');
        browseResults.innerHTML = '<div class="empty-state">Loading all recipes...</div>';
        currentPage = page;

        try {
            const response = await fetch(`/api/tables/names?page=${page}&limit=15`);
            const responseData = await response.json();
            
            if (!response.ok) {
                console.error('API Error:', response.status, responseData);
                throw new Error(responseData.details || responseData.error || `Failed to fetch recipes: ${response.status}`);
            }

            // Handle both old format (array) and new format (object with recipes property)
            let recipes, pagination;
            if (Array.isArray(responseData)) {
                // Old format - array of recipes
                recipes = responseData;
                pagination = {
                    page: 1,
                    limit: 15,
                    total: recipes.length,
                    totalPages: 1,
                    hasNext: false,
                    hasPrev: false
                };
            } else {
                // New format - object with recipes and pagination
                recipes = responseData.recipes || [];
                pagination = responseData.pagination || {};
            }
            
            totalPages = pagination.totalPages || 1;
            console.log('Fetched recipes:', recipes.length, 'Page:', page, 'Total:', pagination.total);
            console.log('Response data:', responseData);

            if (recipes.length === 0) {
                // Remove results-grid class to allow proper layout
                browseResults.classList.remove('results-grid');
                browseResults.innerHTML = `
                    <div class="empty-state">
                        <p>No recipes found in database.</p>
                        <p>Database is connected but empty. Add some recipes to get started!</p>
                        <p style="font-size: 0.8em; color: #999; margin-top: 1rem;">Total count: ${pagination.total || 0}</p>
                    </div>
                `;
                return;
            }

            const paginationHTML = this.createPaginationControls(pagination);

            // Remove results-grid class from browseResults to prevent pagination from being a grid item
            browseResults.classList.remove('results-grid');
            
            browseResults.innerHTML = `
                ${paginationHTML}
                <h3>All Recipes (${pagination.total || recipes.length} total):</h3>
                <div class="results-grid">
                    ${recipes.map(recipe => this.createRecipeCard(recipe)).join('')}
                </div>
            `;

            this.bindRecipeCardEvents();
            browseResults.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error('Browse error:', error);
            browseResults.innerHTML = `<div class="empty-state">
                <p>Error loading recipes</p>
                <p style="font-size: 0.9em; color: #666;">Check browser console (F12) for details</p>
                <p style="font-size: 0.8em; color: #999;">${error.message}</p>
            </div>`;
            this.showNotification('Failed to load recipes', 'error');
        }
    }

    createPaginationControls(pagination, type = null) {
        if (!pagination || pagination.totalPages <= 1) {
            return '';
        }

        const { page, totalPages, hasNext, hasPrev } = pagination;
        let controls = '<div class="pagination-controls">';
        
        // Helper function to generate onclick handler
        const getPageHandler = (pageNum) => {
            if (type) {
                // Escape single quotes in type for JavaScript
                const escapedType = type.replace(/'/g, "\\'");
                return `app.browseRecipesByType('${escapedType}', ${pageNum})`;
            }
            return `app.browseRecipes(${pageNum})`;
        };
        
        // Previous button
        if (hasPrev) {
            controls += `<button class="pagination-btn" onclick="${getPageHandler(page - 1)}">
                <i class="fas fa-chevron-left"></i> Previous
            </button>`;
        } else {
            controls += `<button class="pagination-btn" disabled>
                <i class="fas fa-chevron-left"></i> Previous
            </button>`;
        }

        // Page numbers
        controls += '<div class="pagination-pages">';
        const maxPagesToShow = 5;
        let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        if (startPage > 1) {
            controls += `<button class="pagination-page" onclick="${getPageHandler(1)}">1</button>`;
            if (startPage > 2) {
                controls += '<span class="pagination-ellipsis">...</span>';
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            if (i === page) {
                controls += `<button class="pagination-page active">${i}</button>`;
            } else {
                controls += `<button class="pagination-page" onclick="${getPageHandler(i)}">${i}</button>`;
            }
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                controls += '<span class="pagination-ellipsis">...</span>';
            }
            controls += `<button class="pagination-page" onclick="${getPageHandler(totalPages)}">${totalPages}</button>`;
        }

        controls += '</div>';

        // Next button
        if (hasNext) {
            controls += `<button class="pagination-btn" onclick="${getPageHandler(page + 1)}">
                Next <i class="fas fa-chevron-right"></i>
            </button>`;
        } else {
            controls += `<button class="pagination-btn" disabled>
                Next <i class="fas fa-chevron-right"></i>
            </button>`;
        }

        controls += '</div>';
        return controls;
    }

    async browseRecipesByType(type, page = 1) {
        // Remove results-grid class to allow proper layout
        browseResults.classList.remove('results-grid');
        browseResults.innerHTML = '<div class="empty-state">Loading recipes...</div>';

        try {
            // Use cached recipes if available, otherwise fetch
            let recipesToFilter = allRecipes;
            if (!Array.isArray(recipesToFilter) || recipesToFilter.length === 0) {
                const response = await fetch('/api/tables/names?page=1&limit=1000');
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('API Error:', response.status, errorText);
                    throw new Error(`Failed to fetch recipes: ${response.status} - ${errorText}`);
                }
                const data = await response.json();
                // Handle both old format (array) and new format (object with recipes property)
                if (Array.isArray(data)) {
                    recipesToFilter = data;
                } else {
                    recipesToFilter = data.recipes || [];
                }
            }

            // Check if this is a category filter (Kött, Fisk, Fågel) or a recipe type filter
            let recipes;
            const categoryMap = {
                'Kött': ['Kött', 'Meat', 'meat'],  // Check multiple possible column names
                'Fisk': ['Fisk', 'Fish', 'fish'],
                'Fågel': ['Fågel', 'Poultry', 'poultry']
            };

            if (categoryMap[type]) {
                // Filter by category boolean column
                // First, find which column name actually exists in the data
                const possibleColumns = categoryMap[type];
                let actualColumnName = null;
                
                // Find the first column that exists in at least one recipe
                for (const recipe of recipesToFilter) {
                    for (const colName of possibleColumns) {
                        if (colName in recipe) {
                            actualColumnName = colName;
                            break;
                        }
                    }
                    if (actualColumnName) break;
                }
                
                if (actualColumnName) {
                    recipes = recipesToFilter.filter(recipe => {
                        const value = recipe[actualColumnName];
                        // Check for true, 1, or '1' (handles different database formats)
                        return value === true || value === 1 || value === '1';
                    });
                    console.log(`Found ${recipes.length} recipes with category "${type}" (using column "${actualColumnName}"):`, recipes);
                } else {
                    // No matching column found - might be that columns don't exist yet
                    recipes = [];
                    console.warn(`Category column for "${type}" not found in recipe data. Possible column names: ${possibleColumns.join(', ')}`);
                }
            } else {
                // Filter by recipe type (original behavior)
                recipes = recipesToFilter.filter(recipe => recipe.type === type);
                console.log(`Found ${recipes.length} recipes of type "${type}":`, recipes);
            }

            if (recipes.length === 0) {
                // Remove results-grid class to allow proper layout
                browseResults.classList.remove('results-grid');
                const isCategory = categoryMap[type];
                const message = isCategory 
                    ? `No recipes found with category "${type}".`
                    : `No recipes found for type "${type}".`;
                browseResults.innerHTML = `
                    <div class="empty-state">
                        <p>${message}</p>
                    </div>
                `;
                return;
            }

            // Pagination for filtered results
            const limit = 15;
            const totalRecipes = recipes.length;
            const totalPages = Math.ceil(totalRecipes / limit);
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedRecipes = recipes.slice(startIndex, endIndex);

            // Create pagination object
            const pagination = {
                page: page,
                limit: limit,
                total: totalRecipes,
                totalPages: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            };

            // Remove results-grid class to allow proper layout
            browseResults.classList.remove('results-grid');
            const isCategory = categoryMap[type];
            const heading = isCategory
                ? `Recipes with category "${type}" (${totalRecipes} found):`
                : `Recipes of type "${type}" (${totalRecipes} found):`;
            
            const paginationHTML = this.createPaginationControls(pagination, type);
            
            browseResults.innerHTML = `
                ${paginationHTML}
                <h3>${heading}</h3>
                <div class="results-grid">
                    ${paginatedRecipes.map(recipe => this.createRecipeCard(recipe)).join('')}
                </div>
            `;

            this.bindRecipeCardEvents();
            browseResults.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error('Browse by type error:', error);
            // Remove results-grid class to allow proper layout
            browseResults.classList.remove('results-grid');
            browseResults.innerHTML = `<div class="empty-state">
                <p>Error loading recipes</p>
                <p style="font-size: 0.9em; color: #666;">Check browser console (F12) for details</p>
                <p style="font-size: 0.8em; color: #999;">${error.message}</p>
            </div>`;
            this.showNotification('Failed to load recipes', 'error');
        }
    }

    createRecipeCard(recipe) {
        // For the new table structure, we have: id, name, type
        const metaItems = [recipe.type].filter(Boolean);

        const ingredients = recipe.ingredients || [];
        const ingredientBadges = ingredients.map(ing =>
            `<span class="ingredient-badge">${ing.amount ? ing.amount + ' ' : ''}${ing.amount_type ? ing.amount_type + ' ' : ''}${ing.ingredient}</span>`
        ).slice(0, 6); // Show max 6 ingredients

        // Handle cooking time
        const cookingTime = recipe.cooking_time ? 
            `${recipe.cooking_time.time} ${recipe.cooking_time.timeunit}` : null;

        // Handle rating
        const rating = recipe.rating ? recipe.rating.rating : null;
        const ratingStars = rating ? '⭐'.repeat(Math.round(rating)) + (rating % 1 >= 0.5 ? '½' : '') : null;

        // Image path - try .jpg first
        const imagePath = `/images/${recipe.id}.jpg`;

        return `
            <div class="recipe-card" data-recipe-id="${recipe.id}">
                <div class="recipe-card-top">
                    <img 
                        class="recipe-image" 
                        src="${imagePath}" 
                        alt="${recipe.name}"
                        loading="lazy"
                        onload="console.log('Card image loaded:', '${imagePath}')"
                        onerror="console.error('Card image failed:', '${imagePath}'); this.onerror=null; this.style.display='none';"
                    >
                    <div class="recipe-image-info">
                        ${cookingTime ? `<div class="recipe-info-item"><i class="fas fa-clock"></i> ${cookingTime}</div>` : ''}
                        ${rating ? `<div class="recipe-info-item"><i class="fas fa-star"></i> ${rating.toFixed(1)}${ratingStars ? ` ${ratingStars}` : ''}</div>` : ''}
                    </div>
                </div>
                <div class="recipe-header">
                    <h3 class="recipe-title">${recipe.name}</h3>
                    <div class="recipe-meta">
                        ${metaItems.map(item => `<span><i class="fas fa-tag"></i> ${item}</span>`).join('')}
                    </div>
                </div>
                <div class="recipe-card-body">
                    ${recipe.description ? `<p class="recipe-description">${recipe.description}</p>` : ''}
                    ${ingredients.length > 0 ? `
                        <div class="recipe-ingredients">
                            <h4><i class="fas fa-list"></i> Ingredients:</h4>
                            <div class="ingredient-list">
                                ${ingredientBadges.join('')}
                                ${ingredients.length > 6 ? `<span class="ingredient-badge">+${ingredients.length - 6} more</span>` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    bindRecipeCardEvents() {
        document.querySelectorAll('.recipe-card').forEach(card => {
            card.addEventListener('click', () => {
                const recipeId = card.dataset.recipeId;
                this.showRecipeDetail(recipeId);
            });
        });
    }

    async showRecipeDetail(recipeId) {
        // Check if there's a pending day selection from the menu planner
        let pendingSelection = null;
        if (window.menuPlanner && window.menuPlanner.pendingDaySelection) {
            pendingSelection = window.menuPlanner.pendingDaySelection;
        } else {
            // Check sessionStorage as backup
            const stored = sessionStorage.getItem('pendingDaySelection');
            if (stored) {
                try {
                    pendingSelection = JSON.parse(stored);
                } catch (e) {
                    console.error('Error parsing pendingDaySelection:', e);
                }
            }
        }
        
        // If there's a pending selection, add recipe to menu instead of showing details
        if (pendingSelection && pendingSelection.menuId && window.menuPlanner) {
            // Verify that the current menu matches the pending selection
            if (!window.menuPlanner.currentMenu || window.menuPlanner.currentMenu.id !== pendingSelection.menuId) {
                // Try to select the menu first
                try {
                    await window.menuPlanner.selectMenu(pendingSelection.menuId);
                } catch (error) {
                    console.error('Error selecting menu:', error);
                    this.showNotification('Menu not found. Please select a menu first.', 'error');
                    // Clear pending selection and show recipe details instead
                    if (window.menuPlanner) {
                        window.menuPlanner.pendingDaySelection = null;
                    }
                    sessionStorage.removeItem('pendingDaySelection');
                }
            }
            
            // If we have a current menu, add the recipe
            if (window.menuPlanner.currentMenu && window.menuPlanner.currentMenu.id === pendingSelection.menuId) {
                try {
                    this.showLoading(true);
                    await window.menuPlanner.addRecipeToDay(pendingSelection.dayOfWeek, recipeId);
                    
                    // Clear the pending selection
                    if (window.menuPlanner) {
                        window.menuPlanner.pendingDaySelection = null;
                    }
                    sessionStorage.removeItem('pendingDaySelection');
                    
                    // Switch back to menu tab
                    if (window.menuPlanner) {
                        window.menuPlanner.switchTab('menu');
                    }
                    
                    this.showNotification(`Recipe added to ${pendingSelection.dayName}!`, 'success');
                    return;
                } catch (error) {
                    console.error('Error adding recipe to menu:', error);
                    this.showNotification('Failed to add recipe to menu: ' + (error.message || 'Unknown error'), 'error');
                    // Clear pending selection on error
                    if (window.menuPlanner) {
                        window.menuPlanner.pendingDaySelection = null;
                    }
                    sessionStorage.removeItem('pendingDaySelection');
                    // Continue to show recipe details as fallback
                } finally {
                    this.showLoading(false);
                }
            }
        }
        
        // Normal flow: show recipe details
        this.showLoading(true);
        
        try {
            console.log('Fetching recipe details for ID:', recipeId);
            const response = await fetch(`/api/tables/names/${recipeId}`);
            
            console.log('Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                // Try to get detailed error from response
                let errorData = {};
                let errorText = '';
                try {
                    errorText = await response.text();
                    console.log('Error response text:', errorText);
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    // If JSON parsing fails, use the text or status
                    console.log('Could not parse error as JSON:', e);
                    errorData = { 
                        error: errorText || response.statusText || `HTTP ${response.status}`,
                        details: errorText || `Server returned status ${response.status}`
                    };
                }
                
                const errorMessage = errorData.details || errorData.error || `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`;
                console.error('Recipe fetch error:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData: errorData,
                    errorText: errorText
                });
                throw new Error(errorMessage);
            }
            
            const recipe = await response.json();
            console.log('Recipe data received:', recipe);
            
            if (!recipe || !recipe.id) {
                console.error('Invalid recipe data:', recipe);
                throw new Error('Invalid recipe data received from server - missing ID');
            }
            
            this.displayRecipeDetail(recipe);
            this.openModal();
            
        } catch (error) {
            console.error('Error fetching recipe:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                recipeId: recipeId
            });
            
            // Show detailed error message
            let errorMessage = 'Failed to load recipe details';
            if (error.message) {
                errorMessage = error.message;
            } else if (error.toString && error.toString() !== '[object Object]') {
                errorMessage = error.toString();
            }
            
            // Make sure we show something useful
            if (errorMessage === 'Failed to load recipe details' || errorMessage === 'Failed to fetch recipe details') {
                errorMessage += ' (check browser console for details)';
            }
            
            this.showNotification(errorMessage, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayRecipeDetail(recipe) {
        // Handle cooking time from the new structure
        const cookingTime = recipe.cooking_time ? 
            `${recipe.cooking_time.time} ${recipe.cooking_time.timeunit}` : 'Not specified';
        
        // Handle rating from the new structure
        const rating = recipe.rating ? 
            `${recipe.rating.rating}/5 stars` : 'No rating';

        const ingredientsList = (recipe.ingredients || [])
            .map(ing => `<li>${ing.amount || ''} ${ing.amount_type || ''} ${ing.ingredient}`.trim())
            .join('');

        const instructionsList = (recipe.instructions || [])
            .map(inst => `<li><strong>Step ${inst.step}:</strong> ${inst.instruction}</li>`)
            .join('');

        // Image path for recipe detail
        const imagePath = `/images/${recipe.id}.jpg`;

        recipeDetail.innerHTML = `
            <div class="recipe-detail-header">
                <div class="recipe-detail-title-section">
                    <h2>${recipe.name}</h2>
                    <p class="recipe-id"><i class="fas fa-hashtag"></i> Recipe ID: ${recipe.id}</p>
                    ${recipe.type ? `<p class="recipe-type"><i class="fas fa-tag"></i> ${recipe.type}</p>` : ''}
                </div>
                <button class="btn btn-secondary btn-small" onclick="app.editRecipe(${recipe.id})" style="margin-top: 10px;">
                    <i class="fas fa-edit"></i> Edit Recipe
                </button>
            </div>
            <img 
                class="recipe-detail-image" 
                src="${imagePath}" 
                alt="${recipe.name}"
                onload="console.log('Image loaded successfully:', '${imagePath}'); this.style.display='block';"
                onerror="console.error('Image failed to load:', '${imagePath}'); setTimeout(() => { if (this.naturalWidth === 0) this.style.display='none'; }, 100);"
            >
            <div class="recipe-info">
                <div class="info-section">
                    <h3><i class="fas fa-clock"></i> Timing</h3>
                    <ul>
                        <li><strong>Cooking Time:</strong> ${cookingTime}</li>
                        <li><strong>Rating:</strong> ${rating}</li>
                    </ul>
                </div>
                
                ${ingredientsList ? `
                    <div class="info-section">
                        <h3><i class="fas fa-list"></i> Ingredients</h3>
                        <ul>${ingredientsList}</ul>
                    </div>
                ` : ''}
                
                ${instructionsList ? `
                    <div class="info-section">
                        <h3><i class="fas fa-book-open"></i> Instructions</h3>
                        <ol>${instructionsList}</ol>
                    </div>
                ` : ''}
            </div>
        `;
    }

    openModal() {
        recipeModal.style.display = 'block';
    }

    closeModal() {
        recipeModal.style.display = 'none';
    }

    showLoading(show) {
        loadingSpinner.style.display = show ? 'block' : 'none';
    }

    showNotification(message, type = 'info') {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 15000);
    }

    // Recipe editing methods
    initRecipeEditor() {
        const addRecipeBtn = document.getElementById('addRecipeBtn');
        const recipeEditModal = document.getElementById('recipeEditModal');
        const recipeEditForm = document.getElementById('recipeEditForm');
        const closeEditModal = document.getElementById('closeEditModal');
        const cancelRecipeBtn = document.getElementById('cancelRecipeBtn');
        const addIngredientBtnForm = document.getElementById('addIngredientBtnForm');
        const addInstructionBtnForm = document.getElementById('addInstructionBtnForm');
        const recipeImage = document.getElementById('recipeImage');
        const imagePreview = document.getElementById('imagePreview');

        if (addRecipeBtn) {
            addRecipeBtn.addEventListener('click', () => this.openRecipeEditor());
        }

        if (closeEditModal) {
            closeEditModal.addEventListener('click', () => this.closeRecipeEditor());
        }

        if (cancelRecipeBtn) {
            cancelRecipeBtn.addEventListener('click', () => this.closeRecipeEditor());
        }

        const deleteRecipeBtn = document.getElementById('deleteRecipeBtn');
        if (deleteRecipeBtn) {
            deleteRecipeBtn.addEventListener('click', () => this.deleteRecipe());
        }

        if (recipeEditModal) {
            window.addEventListener('click', (e) => {
                if (e.target === recipeEditModal) this.closeRecipeEditor();
            });
        }

        if (recipeEditForm) {
            recipeEditForm.addEventListener('submit', (e) => this.handleRecipeSubmit(e));
        }

        if (addIngredientBtnForm) {
            addIngredientBtnForm.addEventListener('click', () => this.addIngredientRow());
        }

        if (addInstructionBtnForm) {
            addInstructionBtnForm.addEventListener('click', () => this.addInstructionRow());
        }

        if (recipeImage) {
            recipeImage.addEventListener('change', (e) => this.handleImagePreview(e));
        }
    }

    openRecipeEditor(recipeId = null) {
        const recipeEditModal = document.getElementById('recipeEditModal');
        const recipeEditTitle = document.getElementById('recipeEditTitle');
        const recipeIdInput = document.getElementById('recipeId');
        const recipeName = document.getElementById('recipeName');
        const recipeDescription = document.getElementById('recipeDescription');
        const cookingTime = document.getElementById('cookingTime');
        const cookingTimeUnit = document.getElementById('cookingTimeUnit');
        const recipeRating = document.getElementById('recipeRating');
        const ingredientsList = document.getElementById('ingredientsList');
        const instructionsList = document.getElementById('instructionsList');
        const imagePreview = document.getElementById('imagePreview');
        const recipeImage = document.getElementById('recipeImage');
        const deleteRecipeBtn = document.getElementById('deleteRecipeBtn');

        if (recipeId) {
            recipeEditTitle.textContent = 'Edit Recipe';
            recipeIdInput.value = recipeId;
            // Show delete button when editing
            if (deleteRecipeBtn) deleteRecipeBtn.style.display = 'inline-block';
            this.loadRecipeForEditing(recipeId);
        } else {
            recipeEditTitle.textContent = 'Add New Recipe';
            recipeIdInput.value = '';
            recipeName.value = '';
            recipeDescription.value = '';
            cookingTime.value = '';
            cookingTimeUnit.value = '';
            recipeRating.value = '';
            ingredientsList.innerHTML = '';
            instructionsList.innerHTML = '';
            imagePreview.innerHTML = '';
            if (recipeImage) recipeImage.value = '';
            // Hide delete button when creating new recipe
            if (deleteRecipeBtn) deleteRecipeBtn.style.display = 'none';
            // Populate radio buttons with no selection
            this.populateTypeRadioButtons('');
            this.addIngredientRow();
            this.addInstructionRow();
        }

        recipeEditModal.style.display = 'block';
    }

    async loadRecipeForEditing(recipeId) {
        try {
            const response = await fetch(`/api/tables/names/${recipeId}`);
            if (!response.ok) throw new Error('Failed to load recipe');
            
            const recipe = await response.json();
            
            document.getElementById('recipeName').value = recipe.name || '';
            // Populate radio buttons with the recipe's type selected
            this.populateTypeRadioButtons(recipe.type || '');
            // Description might not exist in the database schema
            const descriptionField = document.getElementById('recipeDescription');
            if (descriptionField) {
                descriptionField.value = recipe.description || '';
            }
            
            if (recipe.cooking_time) {
                document.getElementById('cookingTime').value = recipe.cooking_time.time || '';
                document.getElementById('cookingTimeUnit').value = recipe.cooking_time.timeunit || '';
            }
            
            if (recipe.rating) {
                document.getElementById('recipeRating').value = recipe.rating.rating || '';
            }

            // Load ingredients
            const ingredientsList = document.getElementById('ingredientsList');
            ingredientsList.innerHTML = '';
            if (recipe.ingredients && recipe.ingredients.length > 0) {
                recipe.ingredients.forEach(ing => {
                    this.addIngredientRow(ing.amount, ing.amount_type, ing.ingredient);
                });
            } else {
                this.addIngredientRow();
            }

            // Load instructions
            const instructionsList = document.getElementById('instructionsList');
            instructionsList.innerHTML = '';
            if (recipe.instructions && recipe.instructions.length > 0) {
                recipe.instructions.forEach(inst => {
                    this.addInstructionRow(inst.step, inst.instruction);
                });
            } else {
                this.addInstructionRow();
            }

            // Show existing image if available
            const imagePreview = document.getElementById('imagePreview');
            const imagePath = `/images/${recipeId}.jpg`;
            imagePreview.innerHTML = `
                <img src="${imagePath}" alt="Current recipe image" 
                     onerror="this.style.display='none'"
                     style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 10px;">
            `;
        } catch (error) {
            console.error('Error loading recipe:', error);
            this.showNotification('Failed to load recipe for editing', 'error');
        }
    }

    closeRecipeEditor() {
        const recipeEditModal = document.getElementById('recipeEditModal');
        recipeEditModal.style.display = 'none';
    }

    addIngredientRow(amount = '', amountType = '', ingredient = '') {
        const ingredientsList = document.getElementById('ingredientsList');
        const rowIndex = ingredientsList.children.length;
        const row = document.createElement('div');
        row.className = 'ingredient-edit-row';
        row.innerHTML = `
            <input type="number" class="ingredient-amount" placeholder="Amount" step="0.01" value="${amount}">
            <input type="text" class="ingredient-amount-type" placeholder="Unit (e.g., cups, tbsp)" value="${amountType}">
            <input type="text" class="ingredient-name" placeholder="Ingredient name" value="${ingredient}">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        ingredientsList.appendChild(row);
    }

    addInstructionRow(step = null, instruction = '') {
        const instructionsList = document.getElementById('instructionsList');
        const stepNumber = step !== null ? step : instructionsList.children.length + 1;
        const row = document.createElement('div');
        row.className = 'instruction-edit-row';
        row.innerHTML = `
            <label class="instruction-step-label">Step ${stepNumber}:</label>
            <textarea class="instruction-text" placeholder="Enter instruction...">${instruction}</textarea>
            <input type="hidden" class="instruction-step" value="${stepNumber}">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove(); app.renumberInstructions()">
                <i class="fas fa-times"></i>
            </button>
        `;
        instructionsList.appendChild(row);
    }

    renumberInstructions() {
        const instructionsList = document.getElementById('instructionsList');
        const rows = instructionsList.querySelectorAll('.instruction-edit-row');
        rows.forEach((row, index) => {
            const stepLabel = row.querySelector('.instruction-step-label');
            const stepInput = row.querySelector('.instruction-step');
            const stepNumber = index + 1;
            stepLabel.textContent = `Step ${stepNumber}:`;
            stepInput.value = stepNumber;
        });
    }

    handleImagePreview(e) {
        const file = e.target.files[0];
        const imagePreview = document.getElementById('imagePreview');
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.innerHTML = `
                    <img src="${e.target.result}" alt="Preview" 
                         style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 10px;">
                `;
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.innerHTML = '';
        }
    }

    async handleRecipeSubmit(e) {
        e.preventDefault();
        
        const recipeId = document.getElementById('recipeId').value;
        const formData = new FormData(e.target);
        const recipeImage = document.getElementById('recipeImage');
        
        // Get selected type from radio buttons
        const selectedTypeRadio = document.querySelector('input[name="recipeType"]:checked');
        const selectedType = selectedTypeRadio ? selectedTypeRadio.value : null;
        
        // Collect form data
        const recipeData = {
            name: document.getElementById('recipeName').value,
            type: selectedType || null,
            ingredients: [],
            instructions: [],
            cooking_time: null,
            rating: null
        };
        
        // Description is optional (may not exist in database schema)
        const descriptionField = document.getElementById('recipeDescription');
        if (descriptionField) {
            recipeData.description = descriptionField.value || null;
        }

        // Collect ingredients
        const ingredientRows = document.querySelectorAll('.ingredient-edit-row');
        ingredientRows.forEach(row => {
            const amount = row.querySelector('.ingredient-amount').value;
            const amountType = row.querySelector('.ingredient-amount-type').value;
            const ingredient = row.querySelector('.ingredient-name').value;
            if (ingredient.trim()) {
                recipeData.ingredients.push({
                    amount: amount || null,
                    amount_type: amountType || null,
                    ingredient: ingredient.trim()
                });
            }
        });

        // Collect instructions
        const instructionRows = document.querySelectorAll('.instruction-edit-row');
        instructionRows.forEach(row => {
            const step = parseInt(row.querySelector('.instruction-step').value);
            const instruction = row.querySelector('.instruction-text').value;
            if (instruction.trim()) {
                recipeData.instructions.push({
                    step: step,
                    instruction: instruction.trim()
                });
            }
        });

        // Collect cooking time
        const cookingTime = document.getElementById('cookingTime').value;
        const cookingTimeUnit = document.getElementById('cookingTimeUnit').value;
        if (cookingTime && cookingTimeUnit) {
            recipeData.cooking_time = {
                time: parseInt(cookingTime),
                timeunit: cookingTimeUnit
            };
        }

        // Collect rating
        const rating = document.getElementById('recipeRating').value;
        if (rating) {
            recipeData.rating = {
                rating: parseFloat(rating)
            };
        }

        this.showLoading(true);

        try {
            let savedRecipe;
            
            if (recipeId) {
                // Update existing recipe
                const response = await fetch(`/api/tables/names/${recipeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(recipeData)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.details || errorData.error || 'Failed to update recipe');
                }
                savedRecipe = await response.json();
            } else {
                // Create new recipe
                const response = await fetch('/api/tables/names', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(recipeData)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.details || errorData.error || 'Failed to create recipe');
                }
                savedRecipe = await response.json();
            }

            // Upload image if provided
            if (recipeImage.files.length > 0) {
                const imageFormData = new FormData();
                imageFormData.append('image', recipeImage.files[0]);
                imageFormData.append('recipeId', savedRecipe.id);

                const imageResponse = await fetch(`/api/tables/names/${savedRecipe.id}/image`, {
                    method: 'POST',
                    body: imageFormData
                });

                if (!imageResponse.ok) {
                    console.warn('Image upload failed, but recipe was saved');
                }
            }

            // Close the modal first so the notification is visible
            this.closeRecipeEditor();
            
            // Also close the recipe detail modal if it's open
            this.closeModal();
            
            // Small delay to ensure modal is closed before showing notification
            setTimeout(() => {
                this.showNotification(recipeId ? 'Recipe updated successfully!' : 'Recipe created successfully!', 'success');
            }, 100);
            
            // Refresh recipe list
            await this.fetchAllRecipes();
            this.createTypeFilterButtons();
        } catch (error) {
            console.error('Error saving recipe:', error);
            // Close modal first on error too
            this.closeRecipeEditor();
            
            // Get more detailed error message
            let errorMessage = 'Failed to save recipe';
            if (error.message) {
                errorMessage += ': ' + error.message;
            } else if (error.details) {
                errorMessage += ': ' + error.details;
            }
            
            setTimeout(() => {
                this.showNotification(errorMessage, 'error');
            }, 100);
        } finally {
            this.showLoading(false);
        }
    }

    editRecipe(recipeId) {
        this.closeModal();
        this.openRecipeEditor(recipeId);
    }

    async deleteRecipe() {
        const recipeId = document.getElementById('recipeId').value;
        const recipeName = document.getElementById('recipeName').value;
        
        if (!recipeId) {
            this.showNotification('No recipe selected to delete', 'error');
            return;
        }

        // Confirm deletion
        const confirmMessage = `Are you sure you want to delete "${recipeName || 'this recipe'}"? This action cannot be undone.`;
        if (!confirm(confirmMessage)) {
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch(`/api/tables/names/${recipeId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.error || 'Failed to delete recipe');
            }

            // Close the modal
            this.closeRecipeEditor();
            
            // Show success notification
            setTimeout(() => {
                this.showNotification('Recipe deleted successfully!', 'success');
            }, 100);
            
            // Refresh recipe list
            await this.fetchAllRecipes();
            this.createTypeFilterButtons();
            
            // If we were viewing this recipe, close the detail modal
            this.closeModal();
            
        } catch (error) {
            console.error('Error deleting recipe:', error);
            let errorMessage = 'Failed to delete recipe';
            if (error.message) {
                errorMessage += ': ' + error.message;
            }
            this.showNotification(errorMessage, 'error');
        } finally {
            this.showLoading(false);
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RecipeSearchApp();
    window.app.initRecipeEditor();
});
