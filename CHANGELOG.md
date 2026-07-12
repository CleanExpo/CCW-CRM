# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- In-memory caching for dashboard aggregated data (60s TTL) to improve performance
- New `src/lib/dashboard/cache.ts` module for managing cached dashboard data

### Changed
- Removed redundant `X-User-Id` header from browser API client to prevent potential auth bypass
- Updated middleware to properly protect top-level dashboard routes (`/playground`, `/dashboard-analytics`)
- Modified public path matching logic in middleware to use exact matching for API endpoints (`/api/cron`, `/api/public`) to prevent unintended exposure

### Fixed
- Security vulnerability related to X-User-Id header in browser API client