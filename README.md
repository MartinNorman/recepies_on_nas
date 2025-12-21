# Recipe Search Application

A modern web application for searching recipes based on ingredients you have on hand. Built with Node.js, Express, PostgreSQL, dbt Core for data transformations, and vanilla JavaScript.

## Features

- 🔍 **Ingredient-based Search**: Find recipes by typing in the ingredients you have
- 🎯 **Flexible Matching**: Search for recipes containing ANY ingredients or ALL ingredients
- 📝 **Recipe Management**: Create, view, and manage your recipe collection
- 🔤 **Smart Suggestions**: Autocomplete ingredient suggestions as you type
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- ⚡ **Fast Search**: Optimized database queries with indexing for quick results

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Data Transformations**: dbt Core with PostgreSQL adapter
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: Modern CSS with gradients, shadows, and animations

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- Python (v3.8 or higher) - for dbt Core
- dbt Core (`pip install dbt-core dbt-postgres`)
- npm or yarn package manager

## Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository (or download the files)
cd recipe-search-app

# Install npm dependencies
npm install

# Install Python dependencies for dbt
pip install -r requirements.txt
# OR install dbt core directly
pip install dbt-core dbt-postgres
```

### 2. Database Setup

Create a PostgreSQL database and update the configuration:

```bash
# Connect to PostgreSQL
psql -U your_username

# Create the database
CREATE DATABASE recipe_db;

# Create a user (optional, you can use your existing user)
CREATE USER recipe_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE recipe_db TO recipe_user;
```

### 3. Environment Configuration

Copy the configuration template and update your database settings:

```bash
# Create your environment config
cp config.js config.local.js
```

Edit `config.local.js` with your actual database credentials:

```javascript
require('dotenv').config();

module.exports = {
  database: {
    host: 'localhost',
    port: 5432,
    database: 'recipe_db',
    user: 'recipe_user',        // Your PostgreSQL username
    password: 'your_password',  // Your PostgreSQL password
  },
  server: {
    port: 3000,
  },
};
```

### 4. Initialize the Database

```bash
# Install dbt dependencies
npm run dbt-deps

# Create database tables and indexes
npm run init-db

# Seed the database with sample recipes
npm run seed-db

# Run dbt models to transform and enrich the data
npm run dbt-build
```

### 5. Start the Application

```bash
# Start the development server
npm run dev

# Or start the production server
npm start
```

The application will be available at: `http://localhost:3000`

## dbt Core Data Models

This application uses dbt Core for robust data transformations and modeling. The dbt project structure follows best practices:

### Data Model Architecture

- **Sources** (`models/staging/`): Raw database tables
- **Base Models** (`models/base/`): Cleaned and standardized data
- **Mart Models** (`models/marts/`): Business-ready aggregated data

### Key dbt Models

1. **Base Models**:
   - `base_recipes`: Cleaned recipe data with time categorizations
   - `base_ingredients`: Normalized ingredient data
   - `base_recipe_ingredients`: Recipe-ingredient relationships

2. **Mart Models**:
   - `recipes_enriched`: Recipes with aggregated ingredient information
   - `ingredient_summary`: Ingredient usage statistics and popularity
   - `recipe_search_helper`: Optimized denormalized view for searches
   - `recipe_dietary_analysis`: Dietary categorization analysis

### dbt Commands

```bash
# Install dbt dependencies
npm run dbt-deps

# Run all dbt models
npm run dbt-run

# Run dbt tests
npm run dbt-test

# Build all models (run + test)
npm run dbt-build

# Compile models to check SQL
npm run dbt-compile

# Generate documentation (built into dbt-core)
dbt docs generate && dbt docs serve
```

### Data Transformation Features

- **Time Categorization**: Automatically categorizes recipes as Quick/Medium/Long
- **Ingredient Normalization**: Standardizes ingredient names for consistent matching
- **Dietary Analysis**: Analyzes recipes for vegetarian, vegan, gluten-free, etc.
- **Usage Statistics**: Tracks ingredient popularity and usage patterns
- **Search Optimization**: Creates denormalized views for fast recipe searches

## Usage

### Main Features

1. **Search by Ingredients**:
   - Type ingredient names to add them to your search
   - Toggle "Match all ingredients" to find recipes containing only the specified ingredients
   - Click "Search Recipes" to see matching recipes

2. **Quick Search**:
   - Search recipes by name or description using the quick search bar

3. **Browse All Recipes**:
   - Click "View All Recipes" to see the complete recipe collection

4. **Recipe Details**:
   - Click any recipe card to view full details including ingredients and instructions

### Adding New Recipes

You can add new recipes via the REST API:

```bash
curl -X POST http://localhost:3000/api/recipes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chocolate Cake",
    "description": "Rich chocolate cake",
    "instructions": "Mix ingredients and bake at 350F for 30 minutes",
    "prep_time": 15,
    "cook_time": 30,
    "servings": 8,
    "ingredients": [
      {"name": "flour", "amount": "2", "unit": "cups"},
      {"name": "chocolate", "amount": "6", "unit": "oz"},
      {"name": "eggs", "amount": "3", "unit": "large"}
    ]
  }'
```

## API Endpoints

### Recipes

- `GET /api/recipes` - Get all recipes
- `GET /api/recipes/:id` - Get specific recipe
- `POST /api/recipes` - Create new recipe
- `GET /api/recipes/ingredients/all` - Get all available ingredients

### Search

- `POST /api/search/by-ingredients` - Search recipes by ingredients
- `GET /api/search/suggestions` - Get ingredient suggestions
- `GET /api/search/recipes` - Search recipes by name/description
- `GET /api/health` - Health check endpoint

### Example Search Request

```bash
curl -X POST http://localhost:3000/api/search/by-ingredients \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": ["chicken", "rice", "vegetables"],
    "matchAll": false
  }'
```

## Database Schema

The application uses three main tables:

- `recipes`: Stores recipe information (name, description, instructions, timings)
- `ingredients`: Stores ingredient information (name)
- `recipe_ingredients`: Junction table linking recipes to ingredients with amounts/units

## Development

### Scripts

**Application Scripts**:
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

**Database Scripts**:
- `npm run init-db` - Initialize database schema
- `npm run seed-db` - Seed database with sample data

**dbt Scripts**:
- `npm run dbt-deps` - Install dbt dependencies
- `npm run dbt-seed` - Load seed data
- `npm run dbt-run` - Run all dbt models
- `npm run dbt-test` - Run dbt tests
- `npm run dbt-build` - Build all models (run + test)
- `npm run dbt-compile` - Compile models to check SQL
- `npm run dbt-setup` - Complete setup (deps + init-db + seed)

### Project Structure

```
recipe-search-app/
├── public/              # Frontend files
│   ├── index.html      # Main HTML page
│   ├── styles.css      # CSS styles
│   └── app.js          # JavaScript application
├── scripts/            # Database scripts
│   ├── init-db.js     # Database initialization
│   └── seed-db.js     # Sample data seeding
├── routes/             # API route handlers
│   ├── recipes.js     # Recipe endpoints
│   └── search.js     # Search endpoints
├── services/           # Business logic
│   └── database.js   # Database service
├── models/             # dbt Core models
│   ├── base/          # Base (cleaned) models
│   │   ├── base_recipes.sql
│   │   ├── base_ingredients.sql
│   │   └── base_recipe_ingredients.sql
│   ├── marts/         # Business-ready mart models
│   │   ├── recipes_enriched.sql
│   │   ├── ingredient_summary.sql
│   │   ├── recipe_search_helper.sql
│   │   └── recipe_dietary_analysis.sql
│   ├── staging/       # Source definitions
│   │   ├── _sources.yml
│   │   └── _schemas.yml
│   └── _schema_base.yml & _schema_marts.yml
├── seeds/             # dbt seed data
│   └── dietary_categories.csv
├── macros/            # dbt macros
│   └── recipe_transformations.sql
├── dbt_project.yml    # dbt project configuration
├── profiles.yml      # dbt profiles configuration
├── packages.yml      # dbt dependencies
├── requirements.txt   # Python dependencies
├── config.js         # Configuration
├── server.js         # Main server file
└── package.json      # Dependencies and scripts
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**:
   - Verify PostgreSQL is running
   - Check database credentials in config.js
   - Ensure database exists and is accessible

2. **Port Already in Use**:
   - Change the port in config.js
   - Kill existing processes on port 3000

3. **No Suggestions Appearing**:
   - Run `npm run seed-db` to populate ingredient data
   - Check browser console for errors

### Performance Tips

- The database includes indexes on recipe names, ingredient names, and foreign keys for optimal search performance
- Recipe searches are optimized to handle large datasets efficiently
- Consider using connection pooling for production deployments

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues or have questions, please check the troubleshooting section or create an issue in the repository.
