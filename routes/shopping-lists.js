const express = require('express');
const DatabaseService = require('../services/database');
const HomeAssistantService = require('../services/homeassistant');
const config = require('../config');

const router = express.Router();
const db = new DatabaseService();
const ha = new HomeAssistantService(config.homeAssistant);

// GET /api/shopping-lists - Get shopping list for active week
router.get('/', async (req, res) => {
  try {
    // Get the active menu
    const activeMenuQuery = `
      SELECT id, name FROM WeeklyMenus WHERE active = TRUE LIMIT 1;
    `;
    const activeMenuResult = await db.query(activeMenuQuery);
    
    if (activeMenuResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active menu found' });
    }
    
    const activeMenu = activeMenuResult.rows[0];
    
    // Check if we already have a shopping list for this active menu
    const existingListQuery = `
      SELECT sli.* FROM ShoppingLists sl
      JOIN ShoppingListItems sli ON sl.id = sli.shopping_list_id
      WHERE sl.menu_id = $1
      ORDER BY sli.created_at DESC;
    `;
    const existingItemsResult = await db.query(existingListQuery, [activeMenu.id]);
    
    if (existingItemsResult.rows.length > 0) {
      // Return existing shopping list items
      const shoppingList = existingItemsResult.rows.map(item => ({
        name: item.name || `${item.ingredient} ${item.total_amount} ${item.amount_type || ''}`.trim(),
        id: item.random_id,
        complete: item.is_purchased || false
      }));
      return res.json(shoppingList);
    }
    
    // Generate shopping list from menu ingredients if no existing list
    const ingredientsQuery = `
      SELECT 
        i.ingredient,
        i.amount_type,
        SUM(i.amount * recipe_counts.recipe_count) as total_amount
      FROM Ingredients i
      JOIN (
        SELECT mi.recipe_id, COUNT(*) as recipe_count
        FROM MenuItems mi
        WHERE mi.menu_id = $1
        GROUP BY mi.recipe_id
      ) recipe_counts ON i.recipe_id = recipe_counts.recipe_id
      GROUP BY i.ingredient, i.amount_type
      ORDER BY i.ingredient;
    `;
    const ingredientsResult = await db.query(ingredientsQuery, [activeMenu.id]);
    
    // Generate random 32-character ID for each item
    const generateRandomId = () => {
      const chars = '0123456789abcdef';
      let result = '';
      for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    // Create shopping list in database
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create shopping list
      const shoppingListQuery = `
        INSERT INTO ShoppingLists (menu_id, name)
        VALUES ($1, $2)
        RETURNING *;
      `;
      const shoppingListResult = await client.query(shoppingListQuery, [activeMenu.id, `${activeMenu.name} - Shopping List`]);
      const shoppingList = shoppingListResult.rows[0];
      
      // Add items to database with random IDs
      const shoppingListItems = [];
      for (const item of ingredientsResult.rows) {
        const randomId = generateRandomId();
        const itemQuery = `
          INSERT INTO ShoppingListItems (shopping_list_id, ingredient, total_amount, amount_type, random_id, name)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *;
        `;
        const itemName = `${item.ingredient} ${item.total_amount} ${item.amount_type || ''}`.trim();
        const itemResult = await client.query(itemQuery, [
          shoppingList.id,
          item.ingredient,
          item.total_amount,
          item.amount_type,
          randomId,
          itemName
        ]);
        shoppingListItems.push(itemResult.rows[0]);
      }
      
      await client.query('COMMIT');

      // Format the response as requested - flat array of items
      const response = shoppingListItems.map(item => ({
        name: item.name,
        id: item.random_id,
        complete: item.is_purchased || false
      }));

      res.json(response);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching active shopping list:', error);
    res.status(500).json({ error: 'Failed to fetch active shopping list' });
  }
});

// GET /api/shopping-lists/ha/status - Check Home Assistant integration status
// IMPORTANT: This route must be defined BEFORE /:id routes to avoid matching "ha" as an id
router.get('/ha/status', async (req, res) => {
  try {
    const configured = ha.isConfigured();
    if (!configured) {
      return res.json({
        configured: false,
        connected: false,
        message: 'Home Assistant integration is not configured. Set HA_BASE_URL and HA_TOKEN environment variables.'
      });
    }

    const connected = await ha.testConnection();
    res.json({
      configured: true,
      connected: connected,
      message: connected ? 'Home Assistant integration is active' : 'Home Assistant is configured but connection failed'
    });
  } catch (error) {
    console.error('Error checking HA status:', error);
    res.status(500).json({ error: 'Failed to check Home Assistant status' });
  }
});

// POST /api/shopping-lists/ha/sync - Manually sync current shopping list to Home Assistant
// IMPORTANT: This route must be defined BEFORE /:id routes to avoid matching "ha" as an id
router.post('/ha/sync', async (req, res) => {
  try {
    console.log('HA Sync endpoint called');
    console.log('HA configured:', ha.isConfigured());

    if (!ha.isConfigured()) {
      return res.status(400).json({ error: 'Home Assistant integration is not configured' });
    }

    // Use items from request body if provided (from UI), otherwise query database
    let itemNames = [];
    if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
      // Items sent from frontend - use these directly
      itemNames = req.body.items;
      console.log('Using items from request body:', itemNames.length);
    } else {
      // Fallback: Get from database
      const activeMenuQuery = `
        SELECT DISTINCT sli.name FROM ShoppingLists sl
        JOIN WeeklyMenus wm ON sl.menu_id = wm.id
        JOIN ShoppingListItems sli ON sl.id = sli.shopping_list_id
        WHERE wm.active = TRUE AND sli.is_purchased = FALSE
          AND sl.id = (
            SELECT sl2.id FROM ShoppingLists sl2
            JOIN WeeklyMenus wm2 ON sl2.menu_id = wm2.id
            WHERE wm2.active = TRUE
            ORDER BY sl2.created_at DESC
            LIMIT 1
          )
        ORDER BY sli.name;
      `;
      const itemsResult = await db.query(activeMenuQuery);
      itemNames = itemsResult.rows.map(row => row.name);
      console.log('Using items from database:', itemNames.length);
    }

    console.log('Found items to sync:', itemNames.length);

    if (itemNames.length === 0) {
      return res.json({ message: 'No unpurchased items to sync', itemsSynced: 0 });
    }

    console.log('Item names:', itemNames);

    const syncResult = await ha.addItems(itemNames);
    console.log('Sync result:', syncResult);

    res.json({
      message: 'Shopping list synced to Home Assistant',
      itemsSynced: syncResult.results.length,
      errors: syncResult.errors.length,
      errorDetails: syncResult.errors
    });
  } catch (error) {
    console.error('Error syncing to Home Assistant:', error);
    res.status(500).json({ error: 'Failed to sync with Home Assistant' });
  }
});

// GET /api/shopping-lists/:id - Get specific shopping list with items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT sl.*, wm.name as menu_name, wm.week_start_date, wm.week_end_date,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', sli.id,
            'ingredient', sli.ingredient,
            'total_amount', sli.total_amount,
            'amount_type', sli.amount_type,
            'is_purchased', sli.is_purchased,
            'created_at', sli.created_at,
            'updated_at', sli.updated_at
          )
        ) FILTER (WHERE sli.id IS NOT NULL) as items
      FROM ShoppingLists sl
      LEFT JOIN WeeklyMenus wm ON sl.menu_id = wm.id
      LEFT JOIN ShoppingListItems sli ON sl.id = sli.shopping_list_id
      WHERE sl.id = $1
      GROUP BY sl.id, sl.menu_id, sl.name, sl.created_at, sl.updated_at, wm.name, wm.week_start_date, wm.week_end_date;
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    res.status(500).json({ error: 'Failed to fetch shopping list' });
  }
});

// POST /api/shopping-lists - Create new shopping list
router.post('/', async (req, res) => {
  try {
    const { name, menu_id, items } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Shopping list name is required' });
    }

    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create shopping list
      const shoppingListQuery = `
        INSERT INTO ShoppingLists (menu_id, name)
        VALUES ($1, $2)
        RETURNING *;
      `;
      const shoppingListResult = await client.query(shoppingListQuery, [menu_id || null, name]);
      const shoppingList = shoppingListResult.rows[0];
      
      // Add items if provided
      if (items && items.length > 0) {
        for (const item of items) {
          const itemQuery = `
            INSERT INTO ShoppingListItems (shopping_list_id, ingredient, total_amount, amount_type)
            VALUES ($1, $2, $3, $4);
          `;
          await client.query(itemQuery, [
            shoppingList.id,
            item.ingredient,
            item.total_amount,
            item.amount_type
          ]);
        }
      }
      
      await client.query('COMMIT');
      res.status(201).json(shoppingList);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating shopping list:', error);
    res.status(500).json({ error: 'Failed to create shopping list' });
  }
});

// PUT /api/shopping-lists/:id - Update shopping list
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, items } = req.body;
    
    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update shopping list
      const updateQuery = `
        UPDATE ShoppingLists 
        SET name = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
      `;
      const result = await client.query(updateQuery, [name, id]);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Shopping list not found' });
      }
      
      // Update items if provided
      if (items) {
        // Delete existing items
        await client.query('DELETE FROM ShoppingListItems WHERE shopping_list_id = $1', [id]);
        
        // Add new items
        for (const item of items) {
          const itemQuery = `
            INSERT INTO ShoppingListItems (shopping_list_id, ingredient, total_amount, amount_type)
            VALUES ($1, $2, $3, $4);
          `;
          await client.query(itemQuery, [
            id,
            item.ingredient,
            item.total_amount,
            item.amount_type
          ]);
        }
      }
      
      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating shopping list:', error);
    res.status(500).json({ error: 'Failed to update shopping list' });
  }
});

// DELETE /api/shopping-lists/:id - Delete shopping list
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Delete shopping list items
      await client.query('DELETE FROM ShoppingListItems WHERE shopping_list_id = $1', [id]);
      
      // Delete shopping list
      const result = await client.query('DELETE FROM ShoppingLists WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Shopping list not found' });
      }
      
      await client.query('COMMIT');
      res.json({ message: 'Shopping list deleted successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting shopping list:', error);
    res.status(500).json({ error: 'Failed to delete shopping list' });
  }
});

// PUT /api/shopping-lists/:id/items/:itemId - Update shopping list item
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { ingredient, total_amount, amount_type, is_purchased } = req.body;
    
    const query = `
      UPDATE ShoppingListItems 
      SET ingredient = COALESCE($1, ingredient),
          total_amount = COALESCE($2, total_amount),
          amount_type = COALESCE($3, amount_type),
          is_purchased = COALESCE($4, is_purchased),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND shopping_list_id = $6
      RETURNING *;
    `;
    
    const result = await db.query(query, [ingredient, total_amount, amount_type, is_purchased, itemId, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list item not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating shopping list item:', error);
    res.status(500).json({ error: 'Failed to update shopping list item' });
  }
});

// POST /api/shopping-lists/:id/items - Add item to shopping list
router.post('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { ingredient, total_amount, amount_type } = req.body;
    
    if (!ingredient) {
      return res.status(400).json({ error: 'Ingredient is required' });
    }
    
    const query = `
      INSERT INTO ShoppingListItems (shopping_list_id, ingredient, total_amount, amount_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    
    const result = await db.query(query, [id, ingredient, total_amount, amount_type]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding shopping list item:', error);
    res.status(500).json({ error: 'Failed to add shopping list item' });
  }
});

// DELETE /api/shopping-lists/:id/items/:itemId - Remove item from shopping list
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    
    const query = `
      DELETE FROM ShoppingListItems 
      WHERE id = $1 AND shopping_list_id = $2
      RETURNING *;
    `;
    
    const result = await db.query(query, [itemId, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list item not found' });
    }
    
    res.json({ message: 'Shopping list item deleted successfully' });
  } catch (error) {
    console.error('Error deleting shopping list item:', error);
    res.status(500).json({ error: 'Failed to delete shopping list item' });
  }
});

// DELETE /api/shopping-lists/items/:id - Delete shopping list item by random ID
router.delete('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First check if item exists
    const checkQuery = db.useMariaDB
      ? `SELECT * FROM ShoppingListItems WHERE random_id = ?;`
      : `SELECT * FROM ShoppingListItems WHERE random_id = $1;`;

    const checkResult = await db.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list item not found' });
    }

    // Delete the item
    const deleteQuery = db.useMariaDB
      ? `DELETE FROM ShoppingListItems WHERE random_id = ?;`
      : `DELETE FROM ShoppingListItems WHERE random_id = $1 RETURNING *;`;

    await db.query(deleteQuery, [id]);

    res.json({
      message: 'Shopping list item deleted successfully',
      deletedId: id
    });
  } catch (error) {
    console.error('Error deleting shopping list item:', error);
    res.status(500).json({ error: 'Failed to delete shopping list item' });
  }
});

// PUT /api/shopping-lists/items/:id - Update shopping list item by random ID
router.put('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, total_amount, amount_type, complete } = req.body;
    
    const query = `
      UPDATE ShoppingListItems 
      SET name = COALESCE($1, name),
          total_amount = COALESCE($2, total_amount),
          amount_type = COALESCE($3, amount_type),
          is_purchased = COALESCE($4, is_purchased),
          updated_at = CURRENT_TIMESTAMP
      WHERE random_id = $5
      RETURNING *;
    `;
    
    const result = await db.query(query, [name, total_amount, amount_type, complete, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list item not found' });
    }
    
    const updatedItem = {
      name: result.rows[0].name,
      id: result.rows[0].random_id,
      complete: result.rows[0].is_purchased || false
    };
    
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating shopping list item:', error);
    res.status(500).json({ error: 'Failed to update shopping list item' });
  }
});

// POST /api/shopping-lists/items - Add new item to active shopping list
router.post('/items', async (req, res) => {
  try {
    const { name, total_amount, amount_type } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Item name is required' });
    }
    
    // Get the active menu's shopping list
    const activeMenuQuery = `
      SELECT sl.id FROM ShoppingLists sl
      JOIN WeeklyMenus wm ON sl.menu_id = wm.id
      WHERE wm.active = TRUE
      ORDER BY sl.created_at DESC
      LIMIT 1;
    `;
    const activeListResult = await db.query(activeMenuQuery);
    
    if (activeListResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active shopping list found' });
    }
    
    const shoppingListId = activeListResult.rows[0].id;
    
    // Generate random 32-character ID for new item
    const generateRandomId = () => {
      const chars = '0123456789abcdef';
      let result = '';
      for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    const randomId = generateRandomId();
    
    const query = `
      INSERT INTO ShoppingListItems (shopping_list_id, ingredient, total_amount, amount_type, random_id, name)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    
    const result = await db.query(query, [
      shoppingListId,
      name.split(' ')[0] || name, // Extract ingredient name
      total_amount,
      amount_type,
      randomId,
      name
    ]);
    
    const newItem = {
      name: result.rows[0].name,
      id: result.rows[0].random_id,
      complete: false
    };

    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error adding shopping list item:', error);
    res.status(500).json({ error: 'Failed to add shopping list item' });
  }
});

module.exports = router;
