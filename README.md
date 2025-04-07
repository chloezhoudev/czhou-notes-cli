# Note CLI

A command-line tool for taking and managing notes with tags.

## Installation
```bash
npm install -g czhou-notes-cli
```

## Features
- Create notes with tags
- List all notes
- Search notes by content
- Remove notes by ID
- Clean all notes
- Web interface to view notes
- Data stored in user's home directory

## Commands

| Command | Description |
|---------|-------------|
| `add <note>` | Create a new note |
| `all` | List all notes |
| `find <filter>` | Search notes |
| `remove <id>` | Remove a note |
| `clean` | Remove all notes |
| `web [port]` | Start web interface |

## Development
```bash
npm install
npm test
```

## License

MIT

## Contributing

Contributions are welcome! Please read our [Code of Conduct](CODE_OF_CONDUCT.md).
