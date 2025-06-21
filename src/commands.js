import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { addNote, getAllNotes, findNotes, removeNote, removeAllNotes } from './notes.js';
import { start } from './server.js';
import { saveUserSession, getUserSession, clearUserSession } from './users.js';
import { createUser, findUserByUsername } from './supabase-db.js';

const listNotes = (notes) => {
  notes.forEach((note, index) => {
    console.log('\n');
    console.log(`\n[${index + 1}]`);
    console.log('note:', note.content);
    console.log('id:', note.id);
    console.log('tags:', note.tags.join(', '));
  })
}

const validateUsername = (username) => {
  const normalized = username.trim();

  if (normalized.length === 0) {
    throw new Error('Username cannot be empty or contain only whitespace');
  }

  if (normalized.length < 2) {
    throw new Error('Username must be at least 2 characters long');
  }

  if (normalized.length > 50) {
    throw new Error('Username cannot be longer than 50 characters');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
  }

  return normalized;
};

const isSessionValid = async (session) => {
  try {
    const { data: user, error } = await findUserByUsername(session.username);
    // Check if user exists and the ID matches (extra safety)
    return user && !error && user.id === session.id;
  } catch (error) {
    console.log('Session validation failed:', error.message);
    return false;
  }
};

const handleUserSetup = async (username) => {
    // STEP 1: Validate and normalize username
    const normalizedUsername = validateUsername(username);

    // STEP 2: Check current session
    const currentSession = await getUserSession();

    if (currentSession && currentSession.username === normalizedUsername) {
      // Username matches session - check if session is still valid
      if (await isSessionValid(currentSession)) {
        console.log(`✓ Welcome back, ${normalizedUsername}!`);
        return currentSession;
      } else {
        // Session is invalid - clear it and proceed to step 3
        await clearUserSession();
      }
    } else if (currentSession) {
      // Username doesn't match session - clear it and proceed to step 3
      await clearUserSession();
    }
    // If no session, proceed directly to step 3


    // STEP 3: Fresh DB lookup for the requested username
    const { data: existingUser, error: fetchError } = await findUserByUsername(normalizedUsername);

    let user;
    if (existingUser && !fetchError) {
      // User exists in DB - create new session
      user = existingUser;
      console.log(`✓ Welcome back, ${normalizedUsername}!`);
    } else if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = "not found" error, which is expected for new users
      // Any other error is a real problem
      throw new Error(`Database error: ${fetchError.message}`);
    } else {
      // User doesn't exist in DB - create new user and new session
      const { data: newUser, error: createError } = await createUser(normalizedUsername);

      if (createError) {
        if (createError.code === '23505') { // Unique constraint violation
          throw new Error(`Username "${normalizedUsername}" is already taken. Please choose a different username.`);
        }

        throw new Error(`Failed to create user: ${createError.message}`);
      }

      user = newUser;
      console.log(`✓ Account created for ${normalizedUsername}!`);
    }

    // Save new session
    const session = await saveUserSession(user);
    return session;
};

// Simple error handler - just provide clear feedback
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
        const session = await getUserSession();
        if (!session) {
          console.log('No user session found. Please run "note setup <username>" first.');
          return;
        }

        console.log(`Logged in as: ${session.username}`);
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
        const session = await getUserSession();
        if (!session) {
          console.log('✓ No active session to logout from.');
          return;
        }

        await clearUserSession();
        console.log(`✓ Logged out ${session.username} successfully.`);
      } catch (error) {
        console.error('Logout failed:', error.message);
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
      const note = await addNote(argv.note, argv.tags);
      console.info('Note added! ID:', note.id);
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
        const notes = await getAllNotes();
        listNotes(notes);
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
        const notes = await findNotes(argv.filter);
        listNotes(notes);
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
        const id = await removeNote(argv.id);

        // Better success message
        if (/^\d+$/.test(argv.id)) {
          console.log(`✓ Note #${argv.id} removed successfully`);
        } else {
          console.log(`✓ Note removed: ${id}`);
        }
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
        const done = await removeAllNotes();
        console.log(done ? 'All notes removed' : 'Please try again later');
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