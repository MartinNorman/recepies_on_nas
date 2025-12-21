# Recipe Application Setup Guide

This guide will walk you through setting up the Recipe Search Application from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Database Setup](#database-setup)
4. [Configuration](#configuration)
5. [Initialize Database](#initialize-database)
6. [Start the Application](#start-the-application)
7. [Using the Application](#using-the-application)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js** (v14 or higher)
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`
  
- **npm** (comes with Node.js)
  - Verify installation: `npm --version`

### Database (Choose One)

**Option A: PostgreSQL** (Recommended)
- PostgreSQL v12 or higher
- Download from [postgresql.org](https://www.postgresql.org/download/)

**Option B: MariaDB/MySQL**
- MariaDB 10 or MySQL 8.0+
- Can be installed via package manager or downloaded from [mariadb.org](https://mariadb.org/download/)

### Optional (for dbt data transformations)

- **Python** (v3.8 or higher)
- **dbt Core**: `pip install dbt-core dbt-postgres` (for PostgreSQL) or `pip install dbt-core dbt-mysql` (for MySQL)

---

## Installation

### Step 1: Download/Clone the Project

If you have the project files, navigate to the project directory:

```bash
cd Z:\Martin\recept
# or on Linux/Mac:
cd /path/to/recept
```

### Step 2: Install Node.js Dependencies

```bash
npm install
```

This will install all required packages including:
- Express.js (web server)
- Database drivers (pg for PostgreSQL, mysql2 for MariaDB)
- Multer (for image uploads)
- Other dependencies

### Step 3: Verify Installation

Check that all dependencies are installed:

```bash
npm list --depth=0
```

---

## Database Setup

### Option A: PostgreSQL Setup

#### 1. Create Database

Connect to PostgreSQL:

```bash
# On Windows (using psql from PostgreSQL installation)
psql -U postgres

# On Linux/Mac
sudo -u postgres psql
```

Create the database and user:

```sql
-- Create database
CREATE DATABASE recepie_db;

-- Create user (optional, you can use existing postgres user)
CREATE USER recept_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE recepie_db TO recept_user;

-- Exit psql
\q
```

#### 2. Test Connection

```bash
psql -U recept_user -d recepie_db -h localhost
```

### Option B: MariaDB/MySQL Setup

#### 1. Create Database

Connect to MariaDB/MySQL:

```bash
mysql -u root -p
```

Create the database and user:

```sql
-- Create database
CREATE DATABASE recepie_db;

-- Create user
CREATE USER 'recept_user'@'localhost' IDENTIFIED BY 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON recepie_db.* TO 'recept_user'@'localhost';
FLUSH PRIVILEGES;

-- Exit
EXIT;
```

#### 2. Test Connection

```bash
mysql -u recept_user -p recepie_db
```

---

## Configuration

### Step 1: Create Environment File

Create a `.env` file in the project root directory:

**For PostgreSQL:**
```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=recepie_db
DB_USER=recept_user
DB_PASSWORD=your_secure_password
PORT=3000
```

**For MariaDB/MySQL:**
```env
DB_TYPE=mariadb
DB_HOST=localhost
DB_PORT=3306
DB_NAME=recepie_db
DB_USER=recept_user
DB_PASSWORD=your_secure_password
PORT=3000
```

### Step 2: Verify Configuration

The application reads configuration from:
1. `.env` file (via `dotenv`)
2. `config.js` (fallback defaults)

Check `config.js` to see the default values and structure.

---

## Initialize Database

### Step 1: Create Database Schema

Run the initialization script:

```bash
npm run init-db
```

This will:
- Create all required tables (Names, Ingredients, Instructions, CookingTimes, Ratings, etc.)
- Set up indexes for optimal performance
- Create relationships between tables

### Step 2: (Optional) Seed Sample Data

If you want to populate the database with sample recipes:

```bash
npm run seed-db
```

Or if you have CSV files:

```bash
npm run seed-csv
```

### Step 3: Verify Database Setup

Check that tables were created:

**PostgreSQL:**
```bash
psql -U recept_user -d recepie_db -c "\dt"
```

**MariaDB/MySQL:**
```bash
mysql -u recept_user -p recepie_db -e "SHOW TABLES;"
```

You should see tables like:
- `Name` (or `Names` depending on your schema)
- `Ingredients`
- `Instructions`
- `CookingTimes`
- `Ratings`
- `WeeklyMenus`
- `MenuItems`
- `ShoppingLists`
- `ShoppingListItems`

---

## Start the Application

### Development Mode (with auto-reload)

```bash
npm run dev
```

This uses `nodemon` to automatically restart the server when you make code changes.

### Production Mode

```bash
npm start
```

### Verify Server is Running

You should see output like:
```
Recipe search server running on 0.0.0.0:3000
Visit http://localhost:3000 to see the application
```

### Access the Application

Open your web browser and navigate to:
- **Local**: `http://localhost:3000`
- **Network**: `http://your-ip-address:3000`

---

## Using the Application

### Main Features

1. **Search Recipes by Ingredients**
   - Type ingredient names in the search box
   - Add multiple ingredients
   - Choose "Match all ingredients" for recipes containing all selected ingredients
   - Click "Search Recipes"

2. **Quick Search**
   - Use the quick search bar to find recipes by name or description

3. **Browse All Recipes**
   - Click "View All Recipes" to see your complete recipe collection
   - Filter by recipe type using the type filter buttons

4. **View Recipe Details**
   - Click any recipe card to see full details
   - View ingredients, instructions, cooking time, and rating
   - See recipe photos

### Adding New Recipes

1. Click the **"Add New Recipe"** button at the top of the page
2. Fill in the recipe form:
   - **Recipe Name** (required)
   - **Type** (e.g., Main Course, Dessert)
   - **Description** (optional)
   - **Photo** - Upload an image or take a photo with your phone
   - **Cooking Time** - Enter time and unit (minutes/hours)
   - **Rating** - Rate from 0-5
   - **Ingredients** - Click "Add Ingredient" for each ingredient
     - Enter amount, unit (e.g., cups, tbsp), and ingredient name
   - **Instructions** - Click "Add Instruction Step" for each step
     - Steps are automatically numbered
3. Click **"Save Recipe"**

### Editing Existing Recipes

1. Click on a recipe card to view its details
2. Click the **"Edit Recipe"** button in the recipe detail view
3. Modify any fields in the form
4. Click **"Save Recipe"** to update

### Uploading Recipe Photos

- **From Computer**: Click the file input and select an image
- **From Phone**: The file input supports camera capture - tap to take a photo directly
- Supported formats: JPG, PNG, GIF, etc.
- Maximum file size: 10MB
- Images are automatically saved as `{recipe_id}.jpg` in the `images/` directory

---

## Troubleshooting

### Server Won't Start

**Port Already in Use:**
```bash
# Windows - Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Linux/Mac - Find and kill process
lsof -ti:3000 | xargs kill -9
```

**Or change the port:**
Edit `.env` file:
```env
PORT=3001
```

### Database Connection Errors

**Check Database is Running:**
- PostgreSQL: `pg_isready` or check services
- MariaDB: `systemctl status mariadb` (Linux) or check services

**Verify Credentials:**
- Double-check `.env` file has correct database credentials
- Test connection manually using `psql` or `mysql` command

**Connection Refused:**
- Ensure database is accepting connections
- Check firewall settings
- Verify host and port are correct

### "Route not found" Error

If you see "Route not found" when creating/editing recipes:

1. **Restart the server** - New routes need the server to be restarted
   - See `RESTART_SERVER.md` for detailed instructions
2. **Check server logs** - Look for any error messages
3. **Verify routes are loaded** - Check that `routes/recipes.js` is properly imported in `server.js`

### Images Not Uploading

**Check Images Directory:**
- Ensure `images/` directory exists in project root
- Check write permissions on the directory

**File Size:**
- Maximum file size is 10MB
- Compress large images before uploading

**File Format:**
- Only image files are accepted (JPG, PNG, GIF, etc.)

### Recipe Not Saving

**Check Browser Console:**
- Open browser developer tools (F12)
- Look for JavaScript errors
- Check Network tab for failed API requests

**Check Server Logs:**
- Look at terminal output for error messages
- Check for database errors

**Verify Required Fields:**
- Recipe name is required
- At least one ingredient with a name is required
- Instruction steps must have text

### Database Schema Issues

**Table Name Mismatch:**
- Some databases use `Name` (singular), others use `Names` (plural)
- Check your actual table names: `\dt` (PostgreSQL) or `SHOW TABLES;` (MariaDB)
- Update queries in `services/database.js` if needed

**Missing Columns:**
- Run `npm run init-db` again to ensure all columns exist
- Check `scripts/init-db.sql` or `scripts/init-db-mariadb.sql` for schema

### Performance Issues

**Database Indexes:**
- Ensure indexes are created: `npm run init-db` creates them automatically
- Check indexes: `\di` (PostgreSQL) or `SHOW INDEX FROM table_name;` (MariaDB)

**Connection Pooling:**
- The application uses connection pooling automatically
- Adjust pool size in `services/database.js` if needed

---

## Next Steps

After setup is complete:

1. **Add Your Recipes**: Use the web interface to add your favorite recipes
2. **Upload Photos**: Add photos of your dishes for better visual reference
3. **Organize by Type**: Use the type field to categorize recipes
4. **Create Weekly Menus**: Use the Weekly Menu Planner feature
5. **Generate Shopping Lists**: Create shopping lists from your weekly menus

---

## Additional Resources

- **README.md** - General project information and API documentation
- **RESTART_SERVER.md** - How to restart the server
- **SYNOLOGY_DEPLOYMENT.md** - Deployment guide for Synology NAS
- **SYNOLOGY_NODEJS_DEPLOYMENT.md** - Node.js specific deployment guide

---

## Getting Help

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review server logs in the terminal
3. Check browser console for JavaScript errors
4. Verify database connection and schema
5. Review the documentation files mentioned above

For database-specific issues, refer to your database's official documentation:
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [MariaDB Documentation](https://mariadb.com/kb/en/documentation/)

---

## Summary Checklist

- [ ] Node.js and npm installed
- [ ] Database (PostgreSQL or MariaDB) installed and running
- [ ] Database created (`recepie_db`)
- [ ] Database user created with proper permissions
- [ ] Project dependencies installed (`npm install`)
- [ ] `.env` file created with correct database credentials
- [ ] Database schema initialized (`npm run init-db`)
- [ ] Server starts successfully (`npm start` or `npm run dev`)
- [ ] Application accessible in browser (`http://localhost:3000`)
- [ ] Can create new recipes via web interface
- [ ] Can edit existing recipes
- [ ] Can upload recipe photos

Once all items are checked, your Recipe Application is fully set up and ready to use!

