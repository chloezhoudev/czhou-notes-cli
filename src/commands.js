import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { start } from './server.js';
import {
  handleUserSetup,
  handleWhoami,
  handleLogout,
  handleAddNote,
  handleGetAllNotes,
  handleFindNotes,
  handleRemoveNote,
  handleCleanNotes,
  handleMigrate,
} from './command-handlers.js';
import { getAllNotes } from './notes.js';
import { checkMigrationPreview } from './migration.js';

const handleYargsError = (msg) => {
  console.error(`Error: ${msg}`);
  console.error(`Use "note --help" to see available commands and options`);
  process.exit(1);
};

yargs(hideBin(process.argv))
  .strict()
  .fail(handleYargsError) // Custom error handler
  .command(
    'setup <username>',
    'Log in (or create user if needed) and persist the session',
    (yargs) => {
      return yargs
        .positional('username', {
          describe: 'Your username',
          type: 'string'
        })
        .example('note setup john_doe', 'Create account or login as john_doe')
    }, async (argv) => {
      try {
        await handleUserSetup(argv.username);
      } catch (error) {
        console.error('Setup failed:', error.message);
        process.exit(1);
      }
    })
  .command(
    'whoami',
    'Display the currently logged-in user',
    () => {},
    async (_argv) => {
      try {
        await handleWhoami();
      } catch (error) {
        console.error('Error retrieving user session:', error.message);
      }
    }
  )
  .command(
    'logout',
    'Clear the current user session',
    () => {},
    async (_argv) => {
      try {
        await handleLogout();
      } catch (error) {
        console.error('Logout failed:', error.message);
      }
    }
  )
  .command(
    'migrate',
    'Migrate legacy notes to the new system',
    () => {},
    async (_argv) => {
      try {
        await handleMigrate();
      } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'migrate-check',
    'Check if migration is needed and preview what would be migrated',
    () => {},
    async (_argv) => {
      try {
        await checkMigrationPreview();
      } catch (error) {
        console.error('Migration check failed:', error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'add <note>', 
    'Create a new note', 
    (yargs) => {
    return yargs
        .positional('note', {
            describe: 'The content of the note you want to create',
            type: 'string'
        })
        .option('tags', {
            type: 'array',
            describe: 'Tags to add to the note',
            default: []
        })
        .example('note add "Buy groceries"', 'Add a simple note')
        .example('note add "Team meeting" --tags work urgent', 'Add note with tags')
  }, async (argv) => {
    try {
      await handleAddNote(argv.note, argv.tags);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  })
  .command(
    'all',
    'Get all notes',
    () => {},
    async (_argv) => {
      try {
        await handleGetAllNotes();
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'find <filter>',
    'Search notes by content or tags',
    (yargs) => {
      return yargs
        .positional('filter', {
          describe: 'The search term to filter note by',
          type: 'string'
        })
        .example('note find "meeting"', 'Find notes containing "meeting"')
    },
    async (argv) => {
      try {
        await handleFindNotes(argv.filter);
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'remove <id>',
    'Remove a note by index number or UUID',
    (yargs) => {
      return yargs
        .positional('id', {
          describe: 'The index number (from "note all") or UUID of the note to remove',
          type: 'string'
        })
        .example('note remove 2', 'Remove the 2nd note from your list')
        .example('note remove f92e836e-a85b-491f-af2a-435b3308f6c1', 'Remove note by UUID')
    },
    async (argv) => {
      try {
        await handleRemoveNote(argv.id);
      } catch (error) {
        console.error('❌', error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'clean',
    'Remove all notes',
    () => {},
    async (_argv) => {
      try {
        await handleCleanNotes();
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'web [port]',
    'Launch website to see notes',
    (yargs) => {
      return yargs
        .positional('port', {
          default: 5000,
          type: 'number',
          describe: 'Port to bind on'
        })
    },
    async (argv) => {
      try {
        const notes = await getAllNotes();
        start(notes, argv.port);
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    }
  )
  .demandCommand(1)
  .parse()