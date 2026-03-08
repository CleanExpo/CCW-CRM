# Install Ollama - Quick Guide

**Time Required**: 30 minutes
**Impact**: Unlocks 36 AI feature tests

---

## Step 1: Install Ollama (5 minutes)

### Option A: Using WinGet (Easiest)
Open PowerShell as Administrator and run:
```powershell
winget install Ollama.Ollama
```

### Option B: Manual Download
1. Visit: https://ollama.com/download
2. Download "Ollama for Windows"
3. Run the installer
4. Follow installation wizard

---

## Step 2: Verify Installation (1 minute)

Open a new PowerShell window (Ollama service starts automatically):
```powershell
# Check if Ollama is running
curl http://localhost:11434/api/version

# Should return: {"version":"..."}
```

If you get a connection error, start Ollama manually:
```powershell
ollama serve
```

---

## Step 3: Download Required Models (20 minutes)

**Note**: Models are large (5GB total), requires good internet connection

```powershell
# Embedding model for semantic search (274 MB)
ollama pull nomic-embed-text

# Coding model for AI translations (4.7 GB)
ollama pull qwen2.5-coder:7b

# Verify models are installed
ollama list
```

Expected output:
```
NAME                ID              SIZE      MODIFIED
nomic-embed-text    latest          274MB     X minutes ago
qwen2.5-coder:7b    latest          4.7GB     X minutes ago
```

---

## Step 4: Test AI Features (5 minutes)

```powershell
cd "C:\CCW-Online ERP\apps\backend"

# Test semantic search (17 tests)
python -m pytest tests/integration/test_search.py -v

# Test recommendations (19 tests)
python -m pytest tests/integration/test_recommendations.py -v
```

**Expected**: All tests should pass ✅

---

## Troubleshooting

### Issue: "Connection refused" on port 11434

**Solution**:
```powershell
# Check if service is running
sc query ollama

# If stopped, start it
sc start ollama

# Or run manually
ollama serve
```

### Issue: Models won't download

**Causes**:
- Slow internet connection
- Insufficient disk space (need 6+ GB free)
- Firewall blocking downloads

**Solution**:
- Check disk space: `Get-PSDrive C`
- Check firewall settings
- Try again with stable connection

### Issue: Port conflict

**Solution**:
```powershell
# Check what's using port 11434
netstat -ano | findstr :11434

# If another process is using it, kill it or change Ollama port:
$env:OLLAMA_HOST = "localhost:11435"
ollama serve
```

---

## That's It!

Once installed, return to your session and let Claude know. The AI tests will then be able to run and validate all semantic search and recommendation features.

**Next Steps After Installation**:
1. Run AI integration tests
2. Fix any remaining minor test issues
3. Move to Phase 9 (Performance Testing)

---

**Questions?** Just ask Claude for help!
