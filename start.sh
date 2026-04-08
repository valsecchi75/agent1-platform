#!/bin/bash
set -e
cd "$(dirname "$0")"

echo ""
echo "     _____  _____ _____ _   _ _____  __"
echo "    /  _  \/  ___/  ___/ \ / /__   \/ /"
echo "   / /_\  / /__ / /___/   V /  / /\/ /"
echo "  / /   _/ /__ / /___/ /V \ \ / / / /"
echo " /_/   /______/______/_/ \_\ \/  /_/"
echo ""
echo "  From Vision to Form              v0.9.14-alpha"
echo ""
echo "  +--------------------------------------+"
echo "  :                                      :"
echo "  :  LOGIN .... admin / admin            :"
echo "  :  SERVER ... http://localhost:3000    :"
echo "  :                                      :"
echo "  +--------------------------------------+"
echo ""

# ── Check Node.js ──────────────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo "  [ERROR] Node.js is required."
    echo "  Install from: https://nodejs.org/ (v18 or later)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "  [ERROR] Node.js 18+ required. Current: $(node -v)"
    exit 1
fi
if [ "$NODE_VERSION" -gt 22 ]; then
    echo "  [!] WARNING: Node.js $(node -v) detected. Tested on 18-22."
    echo ""
fi

if ! command -v npm &> /dev/null; then
    echo "  [ERROR] npm is required. It should come with Node.js."
    exit 1
fi

# ── Check port 3000 ──────────────────────────────────────────────
if command -v lsof &> /dev/null; then
    if lsof -i :3000 -sTCP:LISTEN &> /dev/null; then
        echo "  [!] WARNING: Port 3000 is already in use."
        echo "      Close the other process or change PORT in .env"
        echo ""
    fi
fi

# ── Clean corrupted node_modules if next is broken ───────────────
if [ -d "node_modules" ]; then
    if ! node -e "require('next/package.json')" 2>/dev/null; then
        echo "  [*] Detected corrupted dependencies, cleaning..."
        rm -rf node_modules package-lock.json
        echo "  [OK] Cleaned"
        echo ""
    fi
fi

# ── Install / update dependencies ──────────────────────────────
if [ ! -d "node_modules" ]; then
    echo "  [*] First launch - installing dependencies..."
    echo "      This may take a few minutes..."
    echo ""
    npm install
    echo ""
    echo "  [OK] Dependencies installed"
    echo ""
else
    echo "  [*] Checking dependencies..."
    npm install --prefer-offline --no-audit --no-fund --loglevel=error 2>/dev/null || npm install
fi

# ── Verify critical packages ────────────────────────────────────
if ! node -e "require('next/package.json')" 2>/dev/null; then
    echo "  [*] Next.js not found, reinstalling..."
    rm -rf node_modules
    npm install
    if ! node -e "require('next/package.json')" 2>/dev/null; then
        echo "  [ERROR] Next.js still not found after reinstall."
        echo "  Try: rm -rf node_modules && npm install"
        exit 1
    fi
fi

# ── Rebuild better-sqlite3 if needed ────────────────────────────
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
    echo "  [*] Rebuilding native database module..."
    npm rebuild better-sqlite3 2>/dev/null || {
        echo "  [!] WARNING: Database module failed to build."
        echo "      The app will use .env auth as fallback."
        echo ""
    }
    if node -e "require('better-sqlite3')" 2>/dev/null; then
        echo "  [OK] Database module ready"
        echo ""
    fi
fi

# ── Create .env if missing ─────────────────────────────────────
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "  [*] Creating config from template..."
        cp .env.example .env
        echo "  [OK] Config created"
        echo ""
    else
        echo "  [!] WARNING: No .env file found"
        echo ""
    fi
fi

# ── Ensure JWT_SECRET is set in .env ───────────────────────────
if [ -f ".env" ]; then
    if ! grep -qE "^JWT_SECRET=.{32,}" .env; then
        JWT_SECRET_VAL=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null)
        if [ -z "$JWT_SECRET_VAL" ]; then
            echo "  [ERROR] Failed to generate JWT_SECRET."
            exit 1
        fi
        if grep -q "^JWT_SECRET=" .env; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET_VAL}|" .env
            else
                sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET_VAL}|" .env
            fi
        else
            echo "JWT_SECRET=${JWT_SECRET_VAL}" >> .env
        fi
        echo "  [OK] JWT secret generated"
        echo ""
    fi
fi

# ── Create storage directories if missing ──────────────────────
mkdir -p data/generations
mkdir -p storage/input
mkdir -p storage/output/images
mkdir -p storage/output/videos
mkdir -p storage/output/audio
mkdir -p storage/workflows

# ── Build application ─────────────────────────────────────────
echo "  [*] Building application..."
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "  [!] Build failed, trying clean build..."
    rm -rf .next 2>/dev/null
    npm run build
    if [ $? -ne 0 ]; then
        echo ""
        echo "  [ERROR] Build failed. Check for errors above."
        echo ""
        exit 1
    fi
fi
echo "  [OK] Build complete"
echo ""

# ── Launch ─────────────────────────────────────────────────────
echo "  [OK] All systems ready"
echo ""
echo "  Starting server on http://localhost:3000"
echo ""

NODE_ENV=production node server.js