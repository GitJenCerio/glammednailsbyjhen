#!/bin/bash
# Bash script to create .env.local file from .env.example
# Run this script: bash setup-env.sh

echo "Creating .env.local file from .env.example..."

if [ -f .env.example ]; then
    cp .env.example .env.local
    echo "✓ Created .env.local file"
    echo ""
    echo "IMPORTANT: Now you need to:"
    echo "1. Get your Firebase credentials from https://console.firebase.google.com/"
    echo "2. Open .env.local and replace the placeholder values"
    echo "3. Restart your dev server"
else
    echo "✗ Error: .env.example file not found!"
    echo "Please create .env.example first"
fi

