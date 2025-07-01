# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2025-07-01

### Added
- User authentication and session management
- Multi-user support with Supabase database
- Migration system for legacy notes
- `setup`, `whoami`, `logout` commands
- `migrate` and `migrate-check` commands

### Changed
- ***BREAKING***: Replaced local JSON storage with Supabase database
- ***BREAKING***: User authentication now required for all operations
- Notes now stored per-user in cloud database

### Migration
- Legacy notes can be migrated using `note migrate`
- Automatic backup creation during migration

## [1.0.3] - 2024-03-19

### Fixed
- Add permissions for GitHub release workflow
- Fix automated release process

## [1.0.0] - 2025-03-15

### Added
- Initial release
- Create notes with tags
- List all notes
- Search notes by content
- Remove notes by ID
- Clean all notes
- Web interface to view notes