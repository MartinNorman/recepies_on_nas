# Installing Dependencies on Synology NAS

## Quick Fix: Install Missing Dependencies

The error shows that `multer` module is missing. The `multer` package has been added to `package.json`, but you need to install all npm dependencies on your Synology NAS.

### Step 1: Find npm

```bash
# Find where npm is installed
find /var/packages -name "npm" -type f 2>/dev/null

# Or check if it's in PATH
which npm
```

### Step 2: Install Dependencies

```bash
cd /volume1/homes/Martin/recept

# Find npm path
NPM_PATH=$(find /var/packages -name "npm" -type f 2>/dev/null | head -1)

# Install all dependencies
$NPM_PATH install

# Or if npm is in PATH:
npm install
```

### Step 3: Verify Installation

```bash
# Check if multer is now installed
ls -la node_modules/multer

# Or check package.json dependencies
cat package.json | grep multer
```

### Step 4: Try Starting Again

```bash
cd /volume1/homes/Martin/recept
./synology/stop.sh
./synology/start.sh
```

## What This Does

Running `npm install` will:
- Read `package.json` to see all required packages
- Download and install all missing dependencies (including `multer`)
- Create/update the `node_modules` directory
- Install packages compatible with Node.js v12.22.12

## If npm install Fails

If you get permission errors:

```bash
# Check current directory permissions
ls -la /volume1/homes/Martin/recept

# Fix ownership if needed (replace 'admin' with your username)
chown -R admin:users /volume1/homes/Martin/recept
```

If you get network errors, check your internet connection on the NAS.

## After Installation

Once dependencies are installed, the server should start successfully. The `multer` package is required for image uploads in the recipe editor.

