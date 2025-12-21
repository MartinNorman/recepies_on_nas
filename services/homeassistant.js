const https = require('https');
const http = require('http');

class HomeAssistantService {
  constructor(config) {
    this.baseUrl = config.baseUrl || process.env.HA_BASE_URL;
    this.token = config.token || process.env.HA_TOKEN;
    this.enabled = !!(this.baseUrl && this.token);
  }

  /**
   * Make an API request to Home Assistant
   * @param {string} endpoint - API endpoint path
   * @param {string} method - HTTP method
   * @param {object} data - Request body data
   * @returns {Promise<object>} Response data
   */
  async request(endpoint, method = 'POST', data = null) {
    if (!this.enabled) {
      throw new Error('Home Assistant integration is not configured');
    }

    const url = new URL(endpoint, this.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    };

    return new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(body ? JSON.parse(body) : {});
            } catch (e) {
              resolve({ raw: body });
            }
          } else {
            reject(new Error(`HA API error ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  /**
   * Add an item to the Home Assistant shopping list
   * @param {string} itemName - Name of the item to add
   * @returns {Promise<object>} Response from HA
   */
  async addItem(itemName) {
    return this.request('/api/services/shopping_list/add_item', 'POST', {
      name: itemName,
    });
  }

  /**
   * Add multiple items to the Home Assistant shopping list
   * @param {Array<string>} items - Array of item names to add
   * @returns {Promise<Array>} Array of results
   */
  async addItems(items) {
    const results = [];
    const errors = [];

    console.log(`[HA] Starting to add ${items.length} items`);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        console.log(`[HA] Adding item ${i + 1}/${items.length}: "${item}"`);
        const result = await this.addItem(item);
        results.push({ item, success: true, result });
        console.log(`[HA] Successfully added: "${item}"`);
      } catch (error) {
        console.error(`[HA] Failed to add "${item}": ${error.message}`);
        errors.push({ item, success: false, error: error.message });
      }
    }
    console.log(`[HA] Finished. Added: ${results.length}, Errors: ${errors.length}`);

    return { results, errors };
  }

  /**
   * Remove an item from the Home Assistant shopping list
   * @param {string} itemName - Name of the item to remove
   * @returns {Promise<object>} Response from HA
   */
  async removeItem(itemName) {
    return this.request('/api/services/shopping_list/remove_item', 'POST', {
      name: itemName,
    });
  }

  /**
   * Mark an item as complete in the Home Assistant shopping list
   * @param {string} itemName - Name of the item to complete
   * @returns {Promise<object>} Response from HA
   */
  async completeItem(itemName) {
    return this.request('/api/services/shopping_list/complete_item', 'POST', {
      name: itemName,
    });
  }

  /**
   * Mark an item as incomplete in the Home Assistant shopping list
   * @param {string} itemName - Name of the item to mark incomplete
   * @returns {Promise<object>} Response from HA
   */
  async incompleteItem(itemName) {
    return this.request('/api/services/shopping_list/incomplete_item', 'POST', {
      name: itemName,
    });
  }

  /**
   * Clear all completed items from the Home Assistant shopping list
   * @returns {Promise<object>} Response from HA
   */
  async clearCompleted() {
    return this.request('/api/services/shopping_list/clear_completed_items', 'POST', {});
  }

  /**
   * Check if the Home Assistant integration is properly configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return this.enabled;
  }

  /**
   * Test the connection to Home Assistant
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      await this.request('/api/', 'GET');
      return true;
    } catch (error) {
      console.error('Home Assistant connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = HomeAssistantService;
