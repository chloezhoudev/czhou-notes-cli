import { access, copyFile, readFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import * as os from 'node:os';

const homeDir = os.homedir();
const LEGACY_NOTES_PATH = join(homeDir, '.note-cli', 'db.json');
const MIGRATION_BACKUP_PATH = join(homeDir, '.note-cli', 'db.json.backup');

export const hasLegacyNotes = async () => {
  try {
    await access(LEGACY_NOTES_PATH);
    return true;
  } catch {
    return false;
  }
}

export const createBackup = async () => {
  try {
    await copyFile(LEGACY_NOTES_PATH, MIGRATION_BACKUP_PATH);
    return MIGRATION_BACKUP_PATH;
  } catch (error) {
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}

export const readLegacyNotes = async () => {
  try {
    const fileContent = await readFile(LEGACY_NOTES_PATH, 'utf-8');

    // Parse the JSON
    const parsedData = JSON.parse(fileContent);

    // Based on your db.js, the format is always { "notes": [...] }
    if (parsedData.notes && Array.isArray(parsedData.notes)) {
      return parsedData.notes;
    } else {
      throw new Error('Invalid notes file format - expected object with notes array property');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Legacy notes file not found');
    } else if (error instanceof SyntaxError) {
      throw new Error('Legacy notes file contains invalid JSON');
    } else {
      throw new Error(`Failed to read legacy notes: ${error.message}`);
    }
  }
}

export const normalizeLegacyNote = (note) => {
  // Handle different possible legacy formats
  if (typeof note === 'string') {
    return {
      content: note,
      tags: []
    };
  }

  if (typeof note === 'object' && note !== null) {
    // Object note: { content: "text", tags: [...] } or other variations
    return {
      content: note.content || note.text || note.note || '',
      tags: note.tags || note.labels || []
    };
  }

  throw new Error(`Invalid note format: ${typeof note}`);
}

export const migrateLegacyNotes = async (userSession) => {
  // Step 1: Check if migration is needed
  const needsMigration = await hasLegacyNotes();
  if (!needsMigration) {
    return { success: true, message: 'No migration needed', migrated: 0, skipped: 0, errors: [] };
  }

  // Step 2: Create backup
  console.log('💾 Creating backup before migration...');
  try {
    const backupPath = await createBackup();
    console.log(`✅ Backup created: ${backupPath}`);
  } catch (error) {
    return {
      success: false,
      message: `Migration aborted: Could not create backup - ${error.message}`,
      migrated: 0,
      skipped: 0,
      errors: [{ type: 'system', error: error.message, stage: 'backup' }]
    };
  }

  // Step 3: Read legacy notes
  console.log('📖 Reading legacy notes...');
  let legacyNotes;
  try {
    legacyNotes = await readLegacyNotes();
    console.log(`📊 Found ${legacyNotes.length} legacy notes to migrate`);
  } catch (error) {
    return {
      success: false,
      message: `Migration failed: Could not read legacy notes - ${error.message}`,
      migrated: 0,
      skipped: 0,
      errors: [{ type: 'system', error: error.message, stage: 'reading' }]
    };
  }

  // Step 4: Import the database functions
  const { createNote } = await import('./supabase-db.js');

  // Step 5: Migrate each note
  console.log('📝 Migrating notes to database...');
  const results = {
    success: true,
    migrated: 0,
    skipped: 0,
    errors: []
  };

  for (let i = 0; i < legacyNotes.length; i++) {
    const legacyNote = legacyNotes[i];

    try {
      // Normalize the legacy note format
      const normalizedNote = normalizeLegacyNote(legacyNote);

      // Skip empty notes
      if (!normalizedNote.content || normalizedNote.content.trim() === '') {
        console.log(`⚠️  Skipping empty note ${i + 1}`);
        results.skipped++;
        continue;
      }

      // Create note in database
      const { error } = await createNote(
        userSession.id,
        normalizedNote.content,
        normalizedNote.tags,
        userSession.username
      );

      if (error) {
        results.errors.push({
          type: 'note',
          noteIndex: i + 1,
          originalNote: legacyNote,
          error: error.message
        });
        continue;
      }

      console.log(`✅ Migrated note ${i + 1}: "${normalizedNote.content.substring(0, 50)}${normalizedNote.content.length > 50 ? '...' : ''}"`);
      results.migrated++;

    } catch (error) {
      results.errors.push({
        type: 'note',
        noteIndex: i + 1,
        originalNote: legacyNote,
        error: error.message
      });
    }
  }

  // Determine overall success
  if (results.errors.length > 0) {
    results.success = false;
    results.message = `Migration completed with ${results.errors.length} errors. ${results.migrated} notes migrated successfully.`;
  } else {
    results.message = `Migration completed successfully! ${results.migrated} notes migrated.`;
  }

  return results;
}

export const archiveLegacyFiles = async () => {
  try {
    const archiveDir = join(homeDir, '.note-cli', 'archive');
    await mkdir(archiveDir, { recursive: true });

    // Move original file to archive
    const archivePath = join(archiveDir, `db-${Date.now()}.json`);
    await copyFile(LEGACY_NOTES_PATH, archivePath);
    await unlink(LEGACY_NOTES_PATH); // Remove original

    console.log(`📦 Legacy files archived to: ${archivePath}`);
  } catch (error) {
    throw new Error(`Failed to archive legacy files: ${error.message}`);
  }
};

export const checkMigrationPreview = async () => {
  const needsMigration = await hasLegacyNotes();
  if (!needsMigration) {
    console.log('ℹ️  No legacy notes found. Migration not needed.');
    return;
  }

  const legacyNotes = await readLegacyNotes();
  let validCount = 0;
  let emptyCount = 0;

  for (const note of legacyNotes) {
    try {
      const normalized = normalizeLegacyNote(note);
      if (normalized.content && normalized.content.trim()) {
        validCount++;
      } else {
        emptyCount++;
      }
    } catch {
      // Skip invalid notes
    }
  }

  console.log(`📊 Found ${legacyNotes.length} legacy notes:`);
  console.log(`✅ ${validCount} notes would be migrated`);
  if (emptyCount > 0) {
    console.log(`⚠️  ${emptyCount} empty notes would be skipped`);
  }
  console.log('\n💡 Run "note migrate" to perform the migration.');
};

