const express = require('express');
const DatabaseService = require('../services/database');
const HomeAssistantService = require('../services/homeassistant');
const config = require('../config');

const router = express.Router();
const db = new DatabaseService();
const ha = new HomeAssistantService(config.homeAssistant);

// GET /api/menus - Get all weekly menus
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT wm.*, 
        COUNT(mi.id) as recipe_count
      FROM WeeklyMenus wm
      LEFT JOIN MenuItems mi ON wm.id = mi.menu_id
      GROUP BY wm.id, wm.week_start_date, wm.week_end_date, wm.name, wm.created_at, wm.updated_at
      ORDER BY wm.week_start_date DESC;
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching menus:', error);
    res.status(500).json({ error: 'Failed to fetch menus' });
  }
});

// GET /api/menus/:id - Get specific menu with recipes
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get menu details
    const menuQuery = `
      SELECT * FROM WeeklyMenus WHERE id = $1;
    `;
    const menuResult = await db.query(menuQuery, [id]);
    
    if (menuResult.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    
    const menu = menuResult.rows[0];
    
    // Get menu items with recipe details
    const itemsQuery = `
      SELECT mi.*, n.name as recipe_name, n.type as recipe_type
      FROM MenuItems mi
      LEFT JOIN Name n ON mi.recipe_id = n.id
      WHERE mi.menu_id = $1
      ORDER BY mi.day_of_week, mi.meal_type;
    `;
    const itemsResult = await db.query(itemsQuery, [id]);
    menu.items = itemsResult.rows;
    
    res.json(menu);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// POST /api/menus - Create new weekly menu
router.post('/', async (req, res) => {
  try {
    const { name, week_start_date, week_end_date } = req.body;
    
    if (!week_start_date || !week_end_date) {
      return res.status(400).json({ 
        error: 'Week start date and end date are required' 
      });
    }

    const query = `
      INSERT INTO WeeklyMenus (name, week_start_date, week_end_date)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    
    const result = await db.query(query, [name, week_start_date, week_end_date]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating menu:', error);
    res.status(500).json({ error: 'Failed to create menu' });
  }
});

// PUT /api/menus/:id - Update weekly menu
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, week_start_date, week_end_date } = req.body;
    
    if (!week_start_date || !week_end_date) {
      return res.status(400).json({ 
        error: 'Week start date and end date are required' 
      });
    }

    const query = `
      UPDATE WeeklyMenus 
      SET name = $1, week_start_date = $2, week_end_date = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *;
    `;
    
    const result = await db.query(query, [name, week_start_date, week_end_date, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating menu:', error);
    res.status(500).json({ error: 'Failed to update menu' });
  }
});

// POST /api/menus/:id/items - Add recipe to menu
router.post('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { day_of_week, recipe_id, meal_type = 'dinner' } = req.body;

    if (day_of_week === undefined || !recipe_id) {
      return res.status(400).json({
        error: 'Day of week and recipe ID are required'
      });
    }

    if (day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({
        error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
      });
    }

    // MariaDB uses ON DUPLICATE KEY UPDATE instead of ON CONFLICT
    const query = db.useMariaDB
      ? `INSERT INTO MenuItems (menu_id, day_of_week, recipe_id, meal_type)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE recipe_id = VALUES(recipe_id), updated_at = CURRENT_TIMESTAMP;`
      : `INSERT INTO MenuItems (menu_id, day_of_week, recipe_id, meal_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (menu_id, day_of_week, meal_type)
         DO UPDATE SET recipe_id = $3, updated_at = CURRENT_TIMESTAMP
         RETURNING *;`;

    const result = await db.query(query, [id, day_of_week, recipe_id, meal_type]);

    // For MariaDB, fetch the inserted/updated row
    if (db.useMariaDB) {
      const fetchQuery = `SELECT * FROM MenuItems WHERE menu_id = ? AND day_of_week = ? AND meal_type = ?;`;
      const fetchResult = await db.query(fetchQuery, [id, day_of_week, meal_type]);
      res.status(201).json(fetchResult.rows[0]);
    } else {
      res.status(201).json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error adding menu item:', error);
    res.status(500).json({ error: 'Failed to add menu item' });
  }
});

// DELETE /api/menus/:id - Delete entire menu
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // With CASCADE constraints, we just need to delete the menu
    // The database will handle deleting related items
    const checkQuery = db.useMariaDB
      ? `SELECT * FROM WeeklyMenus WHERE id = ?;`
      : `SELECT * FROM WeeklyMenus WHERE id = $1;`;

    const checkResult = await db.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    const deleteQuery = db.useMariaDB
      ? `DELETE FROM WeeklyMenus WHERE id = ?;`
      : `DELETE FROM WeeklyMenus WHERE id = $1 RETURNING *;`;

    await db.query(deleteQuery, [id]);

    res.json({ message: 'Menu deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu:', error);
    res.status(500).json({ error: 'Failed to delete menu' });
  }
});

// DELETE /api/menus/:id/items/:itemId - Remove recipe from menu
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;

    // First check if item exists
    const checkQuery = db.useMariaDB
      ? `SELECT * FROM MenuItems WHERE id = ? AND menu_id = ?;`
      : `SELECT * FROM MenuItems WHERE id = $1 AND menu_id = $2;`;

    const checkResult = await db.query(checkQuery, [itemId, id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Delete the item
    const deleteQuery = db.useMariaDB
      ? `DELETE FROM MenuItems WHERE id = ? AND menu_id = ?;`
      : `DELETE FROM MenuItems WHERE id = $1 AND menu_id = $2 RETURNING *;`;

    await db.query(deleteQuery, [itemId, id]);

    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

// POST /api/menus/:id/shopping-list - Generate shopping list for menu
router.post('/:id/shopping-list', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Get all recipes for this menu with their frequency
    const recipesQuery = `
      SELECT mi.recipe_id, COUNT(*) as recipe_count
      FROM MenuItems mi
      WHERE mi.menu_id = $1
      GROUP BY mi.recipe_id;
    `;
    const recipesResult = await db.query(recipesQuery, [id]);

    if (recipesResult.rows.length === 0) {
      return res.status(400).json({ error: 'No recipes found in menu' });
    }

    // Get all ingredients for these recipes, multiplying by recipe frequency
    const ingredientsQuery = db.useMariaDB
      ? `SELECT
          i.ingredient,
          i.amount_type,
          SUM(i.amount * recipe_counts.recipe_count) as total_amount
        FROM Ingredients i
        JOIN (
          SELECT mi.recipe_id, COUNT(*) as recipe_count
          FROM MenuItems mi
          WHERE mi.menu_id = ?
          GROUP BY mi.recipe_id
        ) recipe_counts ON i.id = recipe_counts.recipe_id
        GROUP BY i.ingredient, i.amount_type
        ORDER BY i.ingredient;`
      : `SELECT
          i.ingredient,
          i.amount_type,
          SUM(i.amount * recipe_counts.recipe_count) as total_amount
        FROM Ingredients i
        JOIN (
          SELECT mi.recipe_id, COUNT(*) as recipe_count
          FROM MenuItems mi
          WHERE mi.menu_id = $1
          GROUP BY mi.recipe_id
        ) recipe_counts ON i.id = recipe_counts.recipe_id
        GROUP BY i.ingredient, i.amount_type
        ORDER BY i.ingredient;`;
    const ingredientsResult = await db.query(ingredientsQuery, [id]);

    // Generate random 32-character ID for each item
    const generateRandomId = () => {
      const chars = '0123456789abcdef';
      let result = '';
      for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Create shopping list
    const shoppingListQuery = `
      INSERT INTO ShoppingLists (menu_id, name)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const shoppingListResult = await db.query(shoppingListQuery, [id, name || 'Shopping List']);
    const shoppingList = shoppingListResult.rows[0];

    // Add shopping list items with random IDs and formatted names
    const shoppingListItems = [];
    for (const ingredient of ingredientsResult.rows) {
      const randomId = generateRandomId();
      const itemName = `${ingredient.ingredient} ${ingredient.total_amount} ${ingredient.amount_type || ''}`.trim();
      const itemQuery = `
        INSERT INTO ShoppingListItems (shopping_list_id, ingredient, total_amount, amount_type, random_id, name)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const itemResult = await db.query(itemQuery, [
        shoppingList.id,
        ingredient.ingredient,
        ingredient.total_amount,
        ingredient.amount_type,
        randomId,
        itemName
      ]);
      shoppingListItems.push(itemResult.rows[0]);
    }

    // Format response as flat array (expected by frontend)
    const response = shoppingListItems.map(item => ({
      name: item.name,
      id: item.random_id,
      complete: item.is_purchased || false
    }));

    res.status(201).json(response);
  } catch (error) {
    console.error('Error generating shopping list:', error);
    res.status(500).json({ error: 'Failed to generate shopping list' });
  }
});

// GET /api/menus/:id/shopping-list - Get shopping list for menu
router.get('/:id/shopping-list', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the shopping list
    const listQuery = db.useMariaDB
      ? `SELECT * FROM ShoppingLists WHERE menu_id = ? ORDER BY created_at DESC LIMIT 1;`
      : `SELECT * FROM ShoppingLists WHERE menu_id = $1 ORDER BY created_at DESC LIMIT 1;`;

    const listResult = await db.query(listQuery, [id]);

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    const shoppingList = listResult.rows[0];

    // Get the items for this shopping list
    const itemsQuery = db.useMariaDB
      ? `SELECT * FROM ShoppingListItems WHERE shopping_list_id = ? ORDER BY ingredient;`
      : `SELECT * FROM ShoppingListItems WHERE shopping_list_id = $1 ORDER BY ingredient;`;

    const itemsResult = await db.query(itemsQuery, [shoppingList.id]);

    shoppingList.items = itemsResult.rows;

    res.json(shoppingList);
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    res.status(500).json({ error: 'Failed to fetch shopping list' });
  }
});

// PUT /api/menus/:id/active - Set menu as active
router.put('/:id/active', async (req, res) => {
  try {
    const { id } = req.params;

    // Set all menus to inactive first
    await db.query('UPDATE WeeklyMenus SET active = FALSE, updated_at = CURRENT_TIMESTAMP');

    // Set the specified menu as active
    const updateQuery = db.useMariaDB
      ? `UPDATE WeeklyMenus SET active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`
      : `UPDATE WeeklyMenus SET active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *;`;

    await db.query(updateQuery, [id]);

    // Fetch the updated menu
    const fetchQuery = db.useMariaDB
      ? `SELECT * FROM WeeklyMenus WHERE id = ?;`
      : `SELECT * FROM WeeklyMenus WHERE id = $1;`;

    const result = await db.query(fetchQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error setting active menu:', error);
    res.status(500).json({ error: 'Failed to set active menu' });
  }
});

// GET /api/menus/active - Get the currently active menu
router.get('/active', async (req, res) => {
  try {
    const query = `
      SELECT wm.*, 
        COUNT(mi.id) as recipe_count
      FROM WeeklyMenus wm
      LEFT JOIN MenuItems mi ON wm.id = mi.menu_id
      WHERE wm.active = TRUE
      GROUP BY wm.id, wm.week_start_date, wm.week_end_date, wm.name, wm.active, wm.created_at, wm.updated_at
      ORDER BY wm.created_at DESC
      LIMIT 1;
    `;
    const result = await db.query(query);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active menu found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching active menu:', error);
    res.status(500).json({ error: 'Failed to fetch active menu' });
  }
});

// PUT /api/shopping-list/:listId/items/:itemId - Toggle item purchased status
router.put('/shopping-list/:listId/items/:itemId', async (req, res) => {
  try {
    const { listId, itemId } = req.params;
    const { is_purchased } = req.body;
    
    const query = `
      UPDATE ShoppingListItems 
      SET is_purchased = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND shopping_list_id = $3
      RETURNING *;
    `;
    
    const result = await db.query(query, [is_purchased, itemId, listId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list item not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating shopping list item:', error);
    res.status(500).json({ error: 'Failed to update shopping list item' });
  }
});

module.exports = router;

