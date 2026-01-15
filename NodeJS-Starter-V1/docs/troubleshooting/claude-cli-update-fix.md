# Claude Code CLI Auto-Update Fix

## Error Message

```
✗ Auto-update failed · Try claude doctor or npm i -g @anthropic-ai/claude-code
```

## Important

**This is an external CLI issue**, not a problem with your CCW-Online ERP codebase. The error comes from the globally-installed Claude Code command-line tool attempting to auto-update itself.

## Solutions

### Option 1: Run Diagnostics (Recommended)

```bash
claude doctor
```

This command checks your Claude Code installation for common issues and attempts to fix them automatically.

### Option 2: Manual Update

If the auto-update continues failing, manually reinstall the latest version:

```bash
# Using npm
npm i -g @anthropic-ai/claude-code@latest

# Or using pnpm
pnpm add -g @anthropic-ai/claude-code@latest

# Or using yarn
yarn global add @anthropic-ai/claude-code@latest
```

### Option 3: Disable Auto-Update Checks

If updates keep failing and you want to suppress the error message:

```bash
# Linux/macOS - Add to ~/.bashrc or ~/.zshrc
export CLAUDE_NO_UPDATE_CHECK=1

# Windows PowerShell - Add to $PROFILE
$env:CLAUDE_NO_UPDATE_CHECK = "1"

# Windows CMD - Set per session
set CLAUDE_NO_UPDATE_CHECK=1
```

## Common Root Causes

### 1. Network/Registry Issues
- Corporate proxy blocking npm registry access
- Firewall rules preventing HTTPS connections
- npm registry temporarily unavailable

**Fix**: Check network connectivity and proxy settings

### 2. File Permission Issues
- npm global directory lacks write permissions
- Claude CLI installation directory is protected

**Fix**:
```bash
# Check npm global directory
npm config get prefix

# Fix permissions (Linux/macOS)
sudo chown -R $USER:$GROUP ~/.npm-global

# Fix permissions (Windows - run as Administrator)
# Reinstall using administrator privileges
```

### 3. Outdated npm/Node.js
- npm version too old to handle package updates
- Node.js version incompatible with latest CLI

**Fix**:
```bash
# Update npm
npm install -g npm@latest

# Check Node.js version (should be 18+)
node --version
```

### 4. Corrupted Cache
- npm cache corrupted
- Claude CLI cache issues

**Fix**:
```bash
# Clear npm cache
npm cache clean --force

# Reinstall Claude Code
npm uninstall -g @anthropic-ai/claude-code
npm install -g @anthropic-ai/claude-code@latest
```

## Verification

After applying a fix, verify the installation:

```bash
# Check Claude Code version
claude-code --version

# Check installation location
which claude-code  # Linux/macOS
where claude-code  # Windows

# Test basic functionality
claude-code --help
```

## Related Issues

- This error does NOT affect your CCW-Online ERP project functionality
- Your codebase has no dependency on @anthropic-ai/claude-code
- The CLI is a separate global tool for development workflows

## When to Seek Help

If none of these solutions work:

1. Check Claude Code GitHub issues: https://github.com/anthropics/claude-code/issues
2. Report the issue with:
   - Your operating system and version
   - Node.js version (`node --version`)
   - npm version (`npm --version`)
   - Full error output from `claude doctor`
   - Network environment (corporate proxy, firewall, etc.)

## Prevention

To avoid future auto-update issues:

1. **Manual Updates**: Disable auto-updates and manually update quarterly
2. **Use Package Manager**: Let npm/pnpm/yarn handle updates via `*@latest`
3. **Corporate Environment**: Work with IT to whitelist npm registry access
4. **Pin Version**: Use specific version if updates consistently fail

## Quick Reference

| Issue | Command |
|-------|---------|
| Diagnose problems | `claude doctor` |
| Manual update | `npm i -g @anthropic-ai/claude-code@latest` |
| Disable updates | `export CLAUDE_NO_UPDATE_CHECK=1` |
| Clear cache | `npm cache clean --force` |
| Check version | `claude-code --version` |
| Full reinstall | `npm uninstall -g @anthropic-ai/claude-code && npm i -g @anthropic-ai/claude-code` |

---

**Last Updated**: 2026-01-09
**Applies To**: Claude Code CLI v1.x+
