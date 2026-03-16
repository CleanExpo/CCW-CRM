# /pi-scan-packages — Audit All Frontend + Backend Packages

Reads package manifests and updates docs/catalogs/PACKAGES.md.

## Steps

1. Read apps/web/package.json (frontend dependencies + devDependencies)
2. Read apps/backend/pyproject.toml OR requirements.txt (backend packages)
3. For each package: version, purpose category, direct/dev
4. Flag: duplicate functionality packages, very large packages (>5MB), unused candidates
5. Update docs/catalogs/PACKAGES.md

## Output Format

```
### PKG-NNN: [package-name]
- **Version**: [version]
- **Ecosystem**: Frontend/Backend
- **Type**: Direct/Dev
- **Category**: [UI|Forms|Validation|Database|Auth|HTTP|AI|Monitoring|etc]
- **Purpose**: [one-line description]
- **Size**: [approx if known]
- **Status**: Active/Unused/Candidate-for-removal
```

## Gap Detection

- Packages imported in code but not in manifest
- Packages in manifest but never imported (unused candidates)

## Usage

/pi-scan-packages
