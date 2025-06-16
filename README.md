# Note CLI

[![CI](https://github.com/chloezhoudev/czhou-notes-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/chloezhoudev/czhou-notes-cli/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/chloezhoudev/czhou-notes-cli/branch/main/graph/badge.svg)](https://codecov.io/gh/chloezhoudev/czhou-notes-cli)

Simple CLI tool to quickly add, search, and organize your notes from anywhere in terminal.

## Requirements
- Node.js >= 18.0.0

## Installation
```bash
npm install -g czhou-notes-cli
```

## Quick Start
```bash
# Set up your user account
note setup john_doe

# Add a note with tags
note add "Meeting with team" --tags work urgent

# View all notes
note all

# Search notes by content or tags
note find "meeting"
note find "urgent"
```

## Features
- **Multi-user support** - Each user has their own notes
- **Create notes with tags** - Organize with multiple tags
- **Smart search functionality** - Find notes by content OR tags
- **Tag-based organization** - Filter and categorize notes
- **Flexible note removal** - Remove by index number or UUID
- **Web interface** - View notes in browser
- **Secure data storage** - Notes stored in Supabase database

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `setup <username>` | Create account or login | `note setup john_doe` |
| `whoami` | Show current user | `note whoami` |
| `logout` | Clear user session | `note logout` |
| `add <note>` | Create a new note | `note add "Buy groceries"` |
| `add <note> --tags <tags>` | Create note with tags | `note add "Team meeting" --tags work urgent` |
| `all` | List all your notes | `note all` |
| `find <filter>` | Search notes by content or tags | `note find "meeting"` |
| `remove <id>` | Remove note by index or UUID | `note remove 2` or `note remove f92e836e-...` |
| `clean` | Remove all your notes | `note clean` |
| `web [port]` | Start web interface | `note web 3000` |

## Development
```bash
npm install
npm test
```

## License
MIT

## Contributing
Contributions are welcome! Please read our [Code of Conduct](CODE_OF_CONDUCT.md).
