# Linear API Scripts Setup

These scripts are for **project management only** and are NOT part of the application.

## Setup Instructions

### 1. Create your local Linear config file

Create a file named `.linear-api-key` in the project root:

```bash
# From project root
cat > .linear-api-key << 'ENDCONFIG'
LINEAR_API_KEY=your_actual_linear_api_key_here
LINEAR_PROJECT_ID=your_project_id_here
ENDCONFIG
```

This file is **gitignored** and will never be committed.

### 2. Copy example scripts to active scripts

```bash
cd scripts
cp create_phase5_issues.example.py create_phase5_issues.py
cp update-linear.example.js update-linear.js
```

The `.py` and `.js` files are gitignored, only `.example.*` files are tracked.

### 3. Run the scripts

```bash
# Python script
python scripts/create_phase5_issues.py

# Node script
node scripts/update-linear.js
```

## Why This Setup?

- **Security**: API keys never committed to git
- **Flexibility**: Each developer can use their own keys
- **Simplicity**: One config file for all Linear scripts
- **Safety**: No accidental key exposure in PRs

## Getting Your Linear API Key

1. Go to https://linear.app/settings/api
2. Create a new personal API key
3. Copy it to your `.linear-api-key` file

## Troubleshooting

**Error: "LINEAR_API_KEY not configured!"**
- Make sure `.linear-api-key` exists in project root
- Check the file contains `LINEAR_API_KEY=your_key_here`
- Or set environment variable: `export LINEAR_API_KEY=your_key_here`
