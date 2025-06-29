import { expect, jest } from '@jest/globals';

jest.unstable_mockModule('node:fs/promises', () => ({
  access: jest.fn(),
  copyFile: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn()
}));

jest.unstable_mockModule('node:os', () => ({
  homedir: () => '/fake/home'
}));

jest.unstable_mockModule('node:path', () => ({
  join: (...paths) => paths.join('/')
}));

jest.unstable_mockModule('../src/supabase-db.js', () => ({
  createNote: jest.fn()
}));

const { access, copyFile, readFile, mkdir, unlink } = await import('node:fs/promises');
const { createNote } = await import('../src/supabase-db.js');

const {
  hasLegacyNotes,
  createBackup,
  readLegacyNotes,
  normalizeLegacyNote,
  migrateLegacyNotes,
  archiveLegacyFiles,
  checkMigrationPreview
} = await import('../src/migration.js');

const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {})
};

describe('Migration Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console spies
    Object.values(consoleSpy).forEach(spy => spy.mockClear());
  });

  describe('hasLegacyNotes', () => {
    test('should return true when legacy notes file exists', async () => {
      access.mockResolvedValue();

      const result = await hasLegacyNotes();

      expect(access).toHaveBeenCalledWith('/fake/home/.note-cli/db.json');
      expect(result).toBe(true);
    });

    test('should return false when legacy notes file does not exist', async () => {
      const noFileError = new Error('File not found');
      noFileError.code = 'ENOENT';
      access.mockRejectedValue(noFileError);

      const result = await hasLegacyNotes();

      expect(result).toBe(false);
    });

    test('should return false on any access error', async () => {
      access.mockRejectedValue(new Error('Permission denied'));

      const result = await hasLegacyNotes();

      expect(result).toBe(false);
    });
  });

  describe('createBackup', () => {
    test('should create backup successfully', async () => {
      copyFile.mockResolvedValue();

      const result = await createBackup();

      expect(copyFile).toHaveBeenCalledWith(
        '/fake/home/.note-cli/db.json',
        '/fake/home/.note-cli/db.json.backup'
      );
      expect(result).toBe('/fake/home/.note-cli/db.json.backup');
    });

    test('should throw error when backup creation fails', async () => {
      copyFile.mockRejectedValue(new Error('Disk full'));

      await expect(createBackup())
        .rejects
        .toThrow('Failed to create backup: Disk full');
    });

  });

  describe('readLegacyNotes', () => {
    test('should read and parse valid legacy notes', async () => {
      const mockNotes = {
        notes: [
          { content: 'Note 1', tags: ['tag1'] },
          { content: 'Note 2', tags: [] }
        ]
      };
      readFile.mockResolvedValue(JSON.stringify(mockNotes));

      const result = await readLegacyNotes();

      expect(readFile).toHaveBeenCalledWith('/fake/home/.note-cli/db.json', 'utf-8');
      expect(result).toEqual(mockNotes.notes);
    });

    test('should throw error when file not found', async () => {
      const noFileError = new Error('File not found');
      noFileError.code = 'ENOENT';
      readFile.mockRejectedValue(noFileError);

      await expect(readLegacyNotes())
        .rejects
        .toThrow('Legacy notes file not found');
    });

    test('should throw error for invalid JSON', async () => {
      readFile.mockResolvedValue('invalid json');

      await expect(readLegacyNotes())
        .rejects
        .toThrow('Legacy notes file contains invalid JSON');
    });

    test('should throw error for invalid format (missing notes array)', async () => {
      readFile.mockResolvedValue(JSON.stringify({ data: [] }));

      await expect(readLegacyNotes())
        .rejects
        .toThrow('Invalid notes file format - expected object with notes array property');
    });

    test('should throw error for invalid format (notes not array)', async () => {
      readFile.mockResolvedValue(JSON.stringify({ notes: 'not an array' }));

      await expect(readLegacyNotes())
        .rejects
        .toThrow('Invalid notes file format - expected object with notes array property');
    });

    test('should handle other file read errors', async () => {
      readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(readLegacyNotes())
        .rejects
        .toThrow('Failed to read legacy notes: Permission denied');
    });
  });

  describe('normalizeLegacyNote', () => {
    test('should normalize string note', () => {
      const result = normalizeLegacyNote('Simple note text');

      expect(result).toEqual({
        content: 'Simple note text',
        tags: []
      });
    });

    test('should normalize object note with content and tags', () => {
      const note = {
        content: 'Note content',
        tags: ['tag1', 'tag2']
      };

      const result = normalizeLegacyNote(note);

      expect(result).toEqual({
        content: 'Note content',
        tags: ['tag1', 'tag2']
      });
    });

    test('should normalize object note with text property', () => {
      const note = {
        text: 'Note text',
        tags: ['tag1']
      };

      const result = normalizeLegacyNote(note);

      expect(result).toEqual({
        content: 'Note text',
        tags: ['tag1']
      });
    });

    test('should normalize object note with note property', () => {
      const note = {
        note: 'Note content',
        labels: ['label1']
      };

      const result = normalizeLegacyNote(note);

      expect(result).toEqual({
        content: 'Note content',
        tags: ['label1']
      });
    });

    test('should handle object with missing content properties', () => {
      const note = {
        tags: ['tag1']
      };

      const result = normalizeLegacyNote(note);

      expect(result).toEqual({
        content: '',
        tags: ['tag1']
      });
    });

    test('should handle object with missing tags properties', () => {
      const note = {
        content: 'Content only'
      };

      const result = normalizeLegacyNote(note);

      expect(result).toEqual({
        content: 'Content only',
        tags: []
      });
    });

    test('should throw error for invalid note types', () => {
      expect(() => normalizeLegacyNote(123))
        .toThrow('Invalid note format: number');

      expect(() => normalizeLegacyNote(null))
        .toThrow('Invalid note format: object');

      expect(() => normalizeLegacyNote(undefined))
        .toThrow('Invalid note format: undefined');
    });
  });

  describe('migrateLegacyNotes', () => {
    const mockUserSession = {
      id: 'user-123',
      username: 'testuser'
    };

    test('should return success when no migration needed', async () => {
      const noFileError = new Error('File not found');
      noFileError.code = 'ENOENT';
      access.mockRejectedValue(noFileError);

      const result = await migrateLegacyNotes(mockUserSession);

      expect(result).toEqual({
        success: true,
        message: 'No migration needed',
        migrated: 0,
        skipped: 0,
        errors: []
      });
    });

    test('should fail when backup creation fails', async () => {
      access.mockResolvedValue(); // hasLegacyNotes returns true
      copyFile.mockRejectedValue(new Error('Disk full'));

      const result = await migrateLegacyNotes(mockUserSession);

      expect(result).toEqual({
        success: false,
        message: 'Migration aborted: Failed to create backup: Disk full',
        migrated: 0,
        skipped: 0,
        errors: [{ type: 'system', error: 'Failed to create backup: Disk full', stage: 'backup' }]
      });
    });

    test('should fail when reading legacy notes fails', async () => {
      access.mockResolvedValue(); // hasLegacyNotes returns true
      copyFile.mockResolvedValue(); // backup succeeds
      readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await migrateLegacyNotes(mockUserSession);

      expect(result).toEqual({
        success: false,
        message: 'Migration failed: Failed to read legacy notes: Permission denied',
        migrated: 0,
        skipped: 0,
        errors: [{ type: 'system', error: 'Failed to read legacy notes: Permission denied', stage: 'reading' }]
      });
    });

    test('should successfully migrate valid notes', async () => {
      const mockNotes = {
        notes: [
          { content: 'Note 1', tags: ['tag1'] },
          'Simple string note',
          { content: 'Note 3', tags: [] }
        ]
      };

      access.mockResolvedValue(); // hasLegacyNotes returns true
      copyFile.mockResolvedValue(); // backup succeeds
      readFile.mockResolvedValue(JSON.stringify(mockNotes)); // reading succeeds
      createNote.mockResolvedValue({ error: null }); // all creates succeed

      const result = await migrateLegacyNotes(mockUserSession);

      expect(createNote).toHaveBeenCalledTimes(3);
      expect(createNote).toHaveBeenNthCalledWith(1, 'user-123', 'Note 1', ['tag1'], 'testuser');
      expect(createNote).toHaveBeenNthCalledWith(2, 'user-123', 'Simple string note', [], 'testuser');
      expect(createNote).toHaveBeenNthCalledWith(3, 'user-123', 'Note 3', [], 'testuser');

      expect(result).toEqual({
        success: true,
        message: 'Migration completed successfully! 3 notes migrated.',
        migrated: 3,
        skipped: 0,
        errors: []
      });
    });

    test('should skip empty notes', async () => {
      const mockNotes = {
        notes: [
          { content: 'Valid note', tags: [] },
          { content: '', tags: [] },
          { content: '   ', tags: [] },
          'Another valid note'
        ]
      };

      access.mockResolvedValue();
      copyFile.mockResolvedValue();
      readFile.mockResolvedValue(JSON.stringify(mockNotes));
      createNote.mockResolvedValue({ error: null });

      const result = await migrateLegacyNotes(mockUserSession);

      expect(createNote).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        success: true,
        message: 'Migration completed successfully! 2 notes migrated.',
        migrated: 2,
        skipped: 2,
        errors: []
      });
    });

    test('should handle database errors for individual notes', async () => {
      const mockNotes = {
        notes: [
          { content: 'Good note', tags: [] },
          { content: 'Bad note', tags: [] },
          { content: 'Another good note', tags: [] }
        ]
      };

      access.mockResolvedValue();
      copyFile.mockResolvedValue();
      readFile.mockResolvedValue(JSON.stringify(mockNotes));

      createNote
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: 'Database constraint violation' } })
        .mockResolvedValueOnce({ error: null });

      const result = await migrateLegacyNotes(mockUserSession);

      expect(result).toEqual({
        success: false,
        message: 'Migration completed with 1 errors. 2 notes migrated successfully.',
        migrated: 2,
        skipped: 0,
        errors: [{
          type: 'note',
          noteIndex: 2,
          originalNote: { content: 'Bad note', tags: [] },
          error: 'Database constraint violation'
        }]
      });
    });

    test('should handle note normalization errors', async () => {
      const mockNotes = {
        notes: [
          { content: 'Good note', tags: [] },
          123, // Invalid note type
          { content: 'Another good note', tags: [] }
        ]
      };

      access.mockResolvedValue();
      copyFile.mockResolvedValue();
      readFile.mockResolvedValue(JSON.stringify(mockNotes));
      createNote.mockResolvedValue({ error: null });

      const result = await migrateLegacyNotes(mockUserSession);

      expect(createNote).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        success: false,
        message: 'Migration completed with 1 errors. 2 notes migrated successfully.',
        migrated: 2,
        skipped: 0,
        errors: [{
          type: 'note',
          noteIndex: 2,
          originalNote: 123,
          error: 'Invalid note format: number'
        }]
      });
    });
  });

  describe('archiveLegacyFiles', () => {
    test('should archive legacy files successfully', async () => {
      mkdir.mockResolvedValue();
      copyFile.mockResolvedValue();
      unlink.mockResolvedValue();

      // Mock Date.now() to return predictable timestamp
      const mockTimestamp = 1640995200000;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      await archiveLegacyFiles();

      expect(mkdir).toHaveBeenCalledWith('/fake/home/.note-cli/archive', { recursive: true });
      expect(copyFile).toHaveBeenCalledWith(
        '/fake/home/.note-cli/db.json',
        `/fake/home/.note-cli/archive/db-${mockTimestamp}.json`
      );
      expect(unlink).toHaveBeenCalledWith('/fake/home/.note-cli/db.json');

      Date.now.mockRestore();
    });

    test('should throw error when archiving fails', async () => {
      mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(archiveLegacyFiles())
        .rejects
        .toThrow('Failed to archive legacy files: Permission denied');
    });

    test('should throw error when file copy fails', async () => {
      mkdir.mockResolvedValue();
      copyFile.mockRejectedValue(new Error('Disk full'));

      await expect(archiveLegacyFiles())
        .rejects
        .toThrow('Failed to archive legacy files: Disk full');
    });

    test('should throw error when file deletion fails', async () => {
      mkdir.mockResolvedValue();
      copyFile.mockResolvedValue();
      unlink.mockRejectedValue(new Error('Permission denied'));

      await expect(archiveLegacyFiles())
        .rejects
        .toThrow('Failed to archive legacy files: Permission denied');
    });
  });

  describe('checkMigrationPreview', () => {
    test('should show no migration needed message when no legacy notes', async () => {
      const noFileError = new Error('File not found');
      noFileError.code = 'ENOENT';
      access.mockRejectedValue(noFileError);

      await checkMigrationPreview();

      expect(console.log).toHaveBeenCalledWith('ℹ️  No legacy notes found. Migration not needed.');
    });

    test('should show preview with valid and empty notes', async () => {
      const mockNotes = {
        notes: [
          { content: 'Valid note 1', tags: [] },
          { content: '', tags: [] },
          'Valid string note',
          { content: '   ', tags: [] },
          { content: 'Valid note 2', tags: ['tag1'] }
        ]
      };

      access.mockResolvedValue();
      readFile.mockResolvedValue(JSON.stringify(mockNotes));

      await checkMigrationPreview();

      expect(console.log).toHaveBeenCalledWith('📊 Found 5 legacy notes:');
      expect(console.log).toHaveBeenCalledWith('✅ 3 notes would be migrated');
      expect(console.log).toHaveBeenCalledWith('⚠️  2 empty notes would be skipped');
      expect(console.log).toHaveBeenCalledWith('\n💡 Run "note migrate" to perform the migration.');
    });

    test('should show preview with only valid notes', async () => {
      const mockNotes = {
        notes: [
          { content: 'Valid note 1', tags: [] },
          'Valid string note'
        ]
      };

      access.mockResolvedValue();
      readFile.mockResolvedValue(JSON.stringify(mockNotes));

      await checkMigrationPreview();

      expect(console.log).toHaveBeenCalledWith('📊 Found 2 legacy notes:');
      expect(console.log).toHaveBeenCalledWith('✅ 2 notes would be migrated');
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('empty notes would be skipped'));
      expect(console.log).toHaveBeenCalledWith('\n💡 Run "note migrate" to perform the migration.');
    });

    test('should handle invalid notes gracefully in preview', async () => {
      const mockNotes = {
        notes: [
          { content: 'Valid note', tags: [] },
          123, // Invalid note
          null, // Invalid note
          'Another valid note'
        ]
      };

      access.mockResolvedValue();
      readFile.mockResolvedValue(JSON.stringify(mockNotes));

      await checkMigrationPreview();

      expect(console.log).toHaveBeenCalledWith('📊 Found 4 legacy notes:');
      expect(console.log).toHaveBeenCalledWith('✅ 2 notes would be migrated');
    });
  });
});