import { saveUserSession, getUserSession, clearUserSession, requireUserSession } from './users.js';
import { createUser, findUserByUsername } from './supabase-db.js';
import { validateUsername, isSessionValid, listNotes, isNumericIndex } from './utils.js';
import { addNote, getAllNotes, findNotes, removeNote, removeAllNotes } from './notes.js';
import { hasLegacyNotes, migrateLegacyNotes, archiveLegacyFiles } from './migration.js';

export const handleUserSetup = async (username) => {
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

  // Check for migration after new login/signup
  await checkAndOfferMigration();

  return session;
};

const checkAndOfferMigration = async () => {
  const needsMigration = await hasLegacyNotes();

  if (needsMigration) {
    console.log('\n🔍 Legacy notes detected!');
    console.log('💡 Run "note migrate" to import your old notes into the new system.');
    console.log('💡 Or run "note migrate-check" to see what would be migrated.');
  }
};

export const handleWhoami = async () => {
  const session = await getUserSession();
  if (!session) {
    console.log('No user session found. Please run "note setup <username>" first.');
    return null;
  }
  console.log(`Logged in as: ${session.username}`);
  return session;
};

export const handleLogout = async () => {
  const session = await getUserSession();
  if (!session) {
    console.log('✓ No active session to logout from.');
    return null;
  }

  await clearUserSession();
  console.log(`✓ Logged out ${session.username} successfully.`);
  return session.username;
};

export const handleAddNote = async (noteContent, tags = []) => {
  const note = await addNote(noteContent, tags);
  console.info('Note added! ID:', note.id);
  return note;
};

export const handleGetAllNotes = async () => {
  const notes = await getAllNotes();
  listNotes(notes);
  return notes;
};

export const handleFindNotes = async (filter) => {
  const notes = await findNotes(filter);
  listNotes(notes);
  return notes;
};

export const handleRemoveNote = async (id) => {
  const removedId = await removeNote(id);

  if (isNumericIndex(id)) {
    console.log(`✓ Note #${id} removed successfully`);
  } else {
    console.log(`✓ Note removed: ${removedId}`);
  }

  return removedId;
};

export const handleCleanNotes = async () => {
  const done = await removeAllNotes();
  console.log(done ? 'All notes removed' : 'Please try again later');
  return done;
};

export const handleMigrate = async () => {
  const session = await requireUserSession();
  console.log(`🚀 Starting migration for user: ${session.username}`);

  const result = await migrateLegacyNotes(session);

  // Report results based on success/failure
  console.log('\n📊 Migration Results:');

  if (result.success) {
    console.log(`✅ ${result.message}`);

    if (result.migrated > 0) {
      console.log(`📝 ${result.migrated} notes migrated successfully`);
    }

    if (result.skipped > 0) {
      console.log(`⚠️  ${result.skipped} empty notes were skipped`);
    }
  } else {
    console.log(`❌ ${result.message}`);
  }

  if (result.success && result.migrated > 0) {
    console.log('💡 Run "note all" to see all your notes.');

    // Automatically archive legacy files
    console.log('\n📦 Archiving legacy note files...');
    await archiveLegacyFiles();
  }

  return result;
};

