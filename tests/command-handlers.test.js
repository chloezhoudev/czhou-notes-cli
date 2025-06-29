import { jest } from '@jest/globals';

// Mock all external dependencies
jest.unstable_mockModule('../src/notes.js', () => ({
  addNote: jest.fn(),
  getAllNotes: jest.fn(),
  findNotes: jest.fn(),
  removeNote: jest.fn(),
  removeAllNotes: jest.fn()
}));

jest.unstable_mockModule('../src/users.js', () => ({
  saveUserSession: jest.fn(),
  getUserSession: jest.fn(),
  clearUserSession: jest.fn(),
  requireUserSession: jest.fn()
}));

jest.unstable_mockModule('../src/supabase-db.js', () => ({
  createUser: jest.fn(),
  findUserByUsername: jest.fn()
}));

jest.unstable_mockModule('../src/utils.js', () => ({
  validateUsername: jest.fn(),
  isSessionValid: jest.fn(),
  listNotes: jest.fn(),
  isNumericIndex: jest.fn()
}));

jest.unstable_mockModule('../src/migration.js', () => ({
  hasLegacyNotes: jest.fn(),
  migrateLegacyNotes: jest.fn(),
  archiveLegacyFiles: jest.fn()
}));

const supabaseDb = await import('../src/supabase-db.js');
const notes = await import('../src/notes.js');
const users = await import('../src/users.js');
const utils = await import('../src/utils.js');
const migration = await import('../src/migration.js');

const {
  handleUserSetup,
  handleWhoami,
  handleLogout,
  handleAddNote,
  handleGetAllNotes,
  handleFindNotes,
  handleRemoveNote,
  handleCleanNotes,
  handleMigrate
} = await import('../src/command-handlers.js');

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  info: jest.spyOn(console, 'info').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {})
};

describe('Command Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all console spies
    Object.values(consoleSpy).forEach(spy => spy.mockClear());
  });

  describe('handleUserSetup', () => {
    const mockUser = { id: 'user-123', username: 'testuser' };
    const mockSession = { id: 'user-123', username: 'testuser', loginTime: '2025-01-01T00:00:00.000Z' };

    beforeEach(() => {
      utils.validateUsername.mockReturnValue('testuser');
    });

    test('should welcome back user with valid existing session', async () => {
      users.getUserSession.mockResolvedValue(mockSession);
      utils.isSessionValid.mockResolvedValue(true);

      const result = await handleUserSetup('testuser');

      expect(utils.validateUsername).toHaveBeenCalledWith('testuser');
      expect(users.getUserSession).toHaveBeenCalled();
      expect(utils.isSessionValid).toHaveBeenCalledWith(mockSession);
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ Welcome back, testuser!');
      expect(result).toEqual(mockSession);
    });

    test('should clear invalid session and create new one for existing user', async () => {
      users.getUserSession.mockResolvedValue(mockSession);
      utils.isSessionValid.mockResolvedValue(false);
      supabaseDb.findUserByUsername.mockResolvedValue({ data: mockUser, error: null });
      users.saveUserSession.mockResolvedValue(mockSession);

      const result = await handleUserSetup('testuser');

      expect(users.clearUserSession).toHaveBeenCalled();
      expect(supabaseDb.findUserByUsername).toHaveBeenCalledWith('testuser');
      expect(users.saveUserSession).toHaveBeenCalledWith(mockUser);
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ Welcome back, testuser!');
      expect(result).toEqual(mockSession);
    });

    test('should clear session with different username and create new one', async () => {
      const differentSession = { ...mockSession, username: 'different' };
      users.getUserSession.mockResolvedValue(differentSession);
      supabaseDb.findUserByUsername.mockResolvedValue({ data: mockUser, error: null });
      users.saveUserSession.mockResolvedValue(mockSession);

      const result = await handleUserSetup('testuser');

      expect(users.clearUserSession).toHaveBeenCalled();
      expect(supabaseDb.findUserByUsername).toHaveBeenCalledWith('testuser');
      expect(users.saveUserSession).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockSession);
    });

    test('should create new user when user does not exist', async () => {
      users.getUserSession.mockResolvedValue(null);
      supabaseDb.findUserByUsername.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });
      supabaseDb.createUser.mockResolvedValue({ data: mockUser, error: null });
      users.saveUserSession.mockResolvedValue(mockSession);

      const result = await handleUserSetup('testuser');

      expect(supabaseDb.createUser).toHaveBeenCalledWith('testuser');
      expect(users.saveUserSession).toHaveBeenCalledWith(mockUser);
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ Account created for testuser!');
      expect(result).toEqual(mockSession);
    });

    test('should throw error for database fetch error (not PGRST116)', async () => {
      users.getUserSession.mockResolvedValue(null);
      supabaseDb.findUserByUsername.mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Database connection failed' }
      });

      await expect(handleUserSetup('testuser')).rejects.toThrow('Database error: Database connection failed');
    });

    test('should throw error for unique constraint violation on user creation', async () => {
      users.getUserSession.mockResolvedValue(null);
      supabaseDb.findUserByUsername.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });
      supabaseDb.createUser.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'Unique constraint violation' }
      });

      await expect(handleUserSetup('testuser')).rejects.toThrow('Username "testuser" is already taken. Please choose a different username.');
    });

    test('should throw error for other user creation errors', async () => {
      users.getUserSession.mockResolvedValue(null);
      supabaseDb.findUserByUsername.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });
      supabaseDb.createUser.mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Creation failed' }
      });

      await expect(handleUserSetup('testuser')).rejects.toThrow('Failed to create user: Creation failed');
    });

    test('should offer migration when legacy notes are detected after user setup', async () => {
      users.getUserSession.mockResolvedValue(null);
      supabaseDb.findUserByUsername.mockResolvedValue({ data: mockUser, error: null });
      users.saveUserSession.mockResolvedValue(mockSession);
      migration.hasLegacyNotes.mockResolvedValue(true);

      await handleUserSetup('testuser');

      expect(migration.hasLegacyNotes).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('\n🔍 Legacy notes detected!');
      expect(consoleSpy.log).toHaveBeenCalledWith('💡 Run "note migrate" to import your old notes into the new system.');
      expect(consoleSpy.log).toHaveBeenCalledWith('💡 Or run "note migrate-check" to see what would be migrated.');
    });

    test('should not offer migration when no legacy notes found', async () => {
      users.getUserSession.mockResolvedValue(null);
      supabaseDb.findUserByUsername.mockResolvedValue({ data: mockUser, error: null });
      users.saveUserSession.mockResolvedValue(mockSession);
      migration.hasLegacyNotes.mockResolvedValue(false);

      await handleUserSetup('testuser');

      expect(migration.hasLegacyNotes).toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalledWith(expect.stringContaining('Legacy notes detected'));
      expect(consoleSpy.log).not.toHaveBeenCalledWith(expect.stringContaining('note migrate'));
    });

    test('should propagate migration check errors during user setup', async () => {
      users.getUserSession.mockResolvedValue(null);
      supabaseDb.findUserByUsername.mockResolvedValue({ data: mockUser, error: null });
      users.saveUserSession.mockResolvedValue(mockSession);
      migration.hasLegacyNotes.mockRejectedValue(new Error('File system error'));

      await expect(handleUserSetup('testuser')).rejects.toThrow('File system error');

      expect(migration.hasLegacyNotes).toHaveBeenCalled();
    });

    test('should offer migration for new user creation with legacy notes', async () => {
      const newUserMock = { id: 'user-456', username: 'newuser' };
      const newSessionMock = { id: 'user-456', username: 'newuser', loginTime: '2025-01-01T00:00:00.000Z' };

      utils.validateUsername.mockReturnValue('newuser');
      users.getUserSession.mockResolvedValue(null);
      supabaseDb.findUserByUsername.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });
      supabaseDb.createUser.mockResolvedValue({ data: newUserMock, error: null });
      users.saveUserSession.mockResolvedValue(newSessionMock);
      migration.hasLegacyNotes.mockResolvedValue(true);

      await handleUserSetup('newuser');

      expect(migration.hasLegacyNotes).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ Account created for newuser!');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n🔍 Legacy notes detected!');
    });
  });

  describe('handleWhoami', () => {
    test('should display current user when session exists', async () => {
      const mockSession = { username: 'testuser', id: 'user-123' };
      users.getUserSession.mockResolvedValue(mockSession);

      const result = await handleWhoami();

      expect(users.getUserSession).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('Logged in as: testuser');
      expect(result).toEqual(mockSession);
    });

    test('should display message when no session exists', async () => {
      users.getUserSession.mockResolvedValue(null);

      const result = await handleWhoami();

      expect(consoleSpy.log).toHaveBeenCalledWith('No user session found. Please run "note setup <username>" first.');
      expect(result).toBeNull();
    });
  });

  describe('handleLogout', () => {
    test('should logout successfully when session exists', async () => {
      const mockSession = { username: 'testuser', id: 'user-123' };
      users.getUserSession.mockResolvedValue(mockSession);

      const result = await handleLogout();

      expect(users.clearUserSession).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ Logged out testuser successfully.');
      expect(result).toBe('testuser');
    });

    test('should display message when no active session', async () => {
      users.getUserSession.mockResolvedValue(null);

      const result = await handleLogout();

      expect(users.clearUserSession).not.toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ No active session to logout from.');
      expect(result).toBeNull();
    });
  });

  describe('handleAddNote', () => {
    test('should add note successfully with tags', async () => {
      const mockNote = { id: 'note-123', content: 'Test note', tags: ['work', 'urgent'] };
      notes.addNote.mockResolvedValue(mockNote);

      const result = await handleAddNote('Test note', ['work', 'urgent']);

      expect(notes.addNote).toHaveBeenCalledWith('Test note', ['work', 'urgent']);
      expect(consoleSpy.info).toHaveBeenCalledWith('Note added! ID:', 'note-123');
      expect(result).toEqual(mockNote);
    });

    test('should add note successfully without tags', async () => {
      const mockNote = { id: 'note-123', content: 'Test note', tags: [] };
      notes.addNote.mockResolvedValue(mockNote);

      const result = await handleAddNote('Test note');

      expect(notes.addNote).toHaveBeenCalledWith('Test note', []);
      expect(consoleSpy.info).toHaveBeenCalledWith('Note added! ID:', 'note-123');
      expect(result).toEqual(mockNote);
    });
  });

  describe('handleGetAllNotes', () => {
    test('should get and list all notes', async () => {
      const mockNotes = [
        { id: 'note-1', content: 'First note', tags: ['tag1'] },
        { id: 'note-2', content: 'Second note', tags: ['tag2'] }
      ];
      notes.getAllNotes.mockResolvedValue(mockNotes);

      const result = await handleGetAllNotes();

      expect(notes.getAllNotes).toHaveBeenCalled();
      expect(utils.listNotes).toHaveBeenCalledWith(mockNotes);
      expect(result).toEqual(mockNotes);
    });
  });

  describe('handleFindNotes', () => {
    test('should find and list notes by filter', async () => {
      const mockNotes = [
        { id: 'note-1', content: 'Meeting notes', tags: ['work'] }
      ];
      notes.findNotes.mockResolvedValue(mockNotes);

      const result = await handleFindNotes('meeting');

      expect(notes.findNotes).toHaveBeenCalledWith('meeting');
      expect(utils.listNotes).toHaveBeenCalledWith(mockNotes);
      expect(result).toEqual(mockNotes);
    });
  });

  describe('handleRemoveNote', () => {
    test('should remove note by numeric index', async () => {
      const noteId = 'note-123';
      notes.removeNote.mockResolvedValue(noteId);
      utils.isNumericIndex.mockReturnValue(true);

      const result = await handleRemoveNote('2');

      expect(notes.removeNote).toHaveBeenCalledWith('2');
      expect(utils.isNumericIndex).toHaveBeenCalledWith('2');
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ Note #2 removed successfully');
      expect(result).toBe(noteId);
    });

    test('should remove note by UUID', async () => {
      const noteId = 'note-123';
      notes.removeNote.mockResolvedValue(noteId);
      utils.isNumericIndex.mockReturnValue(false);

      const result = await handleRemoveNote('note-123');

      expect(notes.removeNote).toHaveBeenCalledWith('note-123');
      expect(utils.isNumericIndex).toHaveBeenCalledWith('note-123');
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ Note removed: note-123');
      expect(result).toBe(noteId);
    });
  });

  describe('handleCleanNotes', () => {
    test('should remove all notes successfully', async () => {
      notes.removeAllNotes.mockResolvedValue(true);

      const result = await handleCleanNotes();

      expect(notes.removeAllNotes).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('All notes removed');
      expect(result).toBe(true);
    });

    test('should display retry message when removal fails', async () => {
      notes.removeAllNotes.mockResolvedValue(false);

      const result = await handleCleanNotes();

      expect(notes.removeAllNotes).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('Please try again later');
      expect(result).toBe(false);
    });
  });

  describe('Error handling', () => {
    test('handleUserSetup should propagate validateUsername errors', async () => {
      utils.validateUsername.mockImplementation(() => {
        throw new Error('Username validation failed');
      });

      await expect(handleUserSetup('invalid')).rejects.toThrow('Username validation failed');
    });

    test('handleAddNote should propagate addNote errors', async () => {
      notes.addNote.mockRejectedValue(new Error('Failed to add note'));

      await expect(handleAddNote('Test note')).rejects.toThrow('Failed to add note');
    });

    test('handleGetAllNotes should propagate getAllNotes errors', async () => {
      notes.getAllNotes.mockRejectedValue(new Error('Failed to get notes'));

      await expect(handleGetAllNotes()).rejects.toThrow('Failed to get notes');
    });

    test('handleFindNotes should propagate findNotes errors', async () => {
      notes.findNotes.mockRejectedValue(new Error('Search failed'));

      await expect(handleFindNotes('test')).rejects.toThrow('Search failed');
    });

    test('handleRemoveNote should propagate removeNote errors', async () => {
      notes.removeNote.mockRejectedValue(new Error('Failed to remove note'));

      await expect(handleRemoveNote('1')).rejects.toThrow('Failed to remove note');
    });

    test('handleCleanNotes should propagate removeAllNotes errors', async () => {
      notes.removeAllNotes.mockRejectedValue(new Error('Failed to clean notes'));

      await expect(handleCleanNotes()).rejects.toThrow('Failed to clean notes');
    });
  });

  describe('handleMigrate', () => {
    const mockSession = { id: 'user-123', username: 'testuser' };

    beforeEach(() => {
      users.requireUserSession.mockResolvedValue(mockSession);
    });

    test('should migrate notes successfully with results', async () => {
      const mockResult = {
        success: true,
        message: 'Migration completed successfully',
        migrated: 5,
        skipped: 2
      };
      migration.migrateLegacyNotes.mockResolvedValue(mockResult);
      migration.archiveLegacyFiles.mockResolvedValue();

      const result = await handleMigrate();

      expect(users.requireUserSession).toHaveBeenCalled();
      expect(migration.migrateLegacyNotes).toHaveBeenCalledWith(mockSession);
      expect(migration.archiveLegacyFiles).toHaveBeenCalled();

      expect(consoleSpy.log).toHaveBeenCalledWith('🚀 Starting migration for user: testuser');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n📊 Migration Results:');
      expect(consoleSpy.log).toHaveBeenCalledWith('✅ Migration completed successfully');
      expect(consoleSpy.log).toHaveBeenCalledWith('📝 5 notes migrated successfully');
      expect(consoleSpy.log).toHaveBeenCalledWith('⚠️  2 empty notes were skipped');
      expect(consoleSpy.log).toHaveBeenCalledWith('💡 Run "note all" to see all your notes.');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n📦 Archiving legacy note files...');

      expect(result).toEqual(mockResult);
    });

    test('should handle migration with only migrated notes (no skipped)', async () => {
      const mockResult = {
        success: true,
        message: 'Migration completed successfully',
        migrated: 3,
        skipped: 0
      };
      migration.migrateLegacyNotes.mockResolvedValue(mockResult);
      migration.archiveLegacyFiles.mockResolvedValue();

      const result = await handleMigrate();

      expect(consoleSpy.log).toHaveBeenCalledWith('✅ Migration completed successfully');
      expect(consoleSpy.log).toHaveBeenCalledWith('📝 3 notes migrated successfully');
      expect(consoleSpy.log).not.toHaveBeenCalledWith(expect.stringContaining('empty notes were skipped'));
      expect(consoleSpy.log).toHaveBeenCalledWith('💡 Run "note all" to see all your notes.');
      expect(migration.archiveLegacyFiles).toHaveBeenCalled();

      expect(result).toEqual(mockResult);
    });

    test('should handle migration with only skipped notes (no migrated)', async () => {
      const mockResult = {
        success: true,
        message: 'Migration completed successfully',
        migrated: 0,
        skipped: 3
      };
      migration.migrateLegacyNotes.mockResolvedValue(mockResult);

      const result = await handleMigrate();

      expect(consoleSpy.log).toHaveBeenCalledWith('✅ Migration completed successfully');
      expect(consoleSpy.log).not.toHaveBeenCalledWith(expect.stringContaining('notes migrated successfully'));
      expect(consoleSpy.log).toHaveBeenCalledWith('⚠️  3 empty notes were skipped');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('💡 Run "note all" to see all your notes.');
      expect(migration.archiveLegacyFiles).not.toHaveBeenCalled();

      expect(result).toEqual(mockResult);
    });

    test('should handle successful migration with no notes processed', async () => {
      const mockResult = {
        success: true,
        message: 'No legacy notes found to migrate',
        migrated: 0,
        skipped: 0
      };
      migration.migrateLegacyNotes.mockResolvedValue(mockResult);

      const result = await handleMigrate();

      expect(consoleSpy.log).toHaveBeenCalledWith('✅ No legacy notes found to migrate');
      expect(consoleSpy.log).not.toHaveBeenCalledWith(expect.stringContaining('notes migrated successfully'));
      expect(consoleSpy.log).not.toHaveBeenCalledWith(expect.stringContaining('empty notes were skipped'));
      expect(consoleSpy.log).not.toHaveBeenCalledWith('💡 Run "note all" to see all your notes.');
      expect(migration.archiveLegacyFiles).not.toHaveBeenCalled();

      expect(result).toEqual(mockResult);
    });

    test('should handle migration failure', async () => {
      const mockResult = {
        success: false,
        message: 'Migration failed: Database connection error',
        migrated: 0,
        skipped: 0
      };
      migration.migrateLegacyNotes.mockResolvedValue(mockResult);

      const result = await handleMigrate();

      expect(consoleSpy.log).toHaveBeenCalledWith('🚀 Starting migration for user: testuser');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n📊 Migration Results:');
      expect(consoleSpy.log).toHaveBeenCalledWith('❌ Migration failed: Database connection error');
      expect(consoleSpy.log).not.toHaveBeenCalledWith(expect.stringContaining('notes migrated successfully'));
      expect(consoleSpy.log).not.toHaveBeenCalledWith('💡 Run "note all" to see all your notes.');
      expect(migration.archiveLegacyFiles).not.toHaveBeenCalled();

      expect(result).toEqual(mockResult);
    });

    test('should propagate requireUserSession errors', async () => {
      users.requireUserSession.mockRejectedValue(new Error('No user session'));

      await expect(handleMigrate()).rejects.toThrow('No user session');

      expect(migration.migrateLegacyNotes).not.toHaveBeenCalled();
      expect(migration.archiveLegacyFiles).not.toHaveBeenCalled();
    });

    test('should propagate migrateLegacyNotes errors', async () => {
      migration.migrateLegacyNotes.mockRejectedValue(new Error('Migration process failed'));

      await expect(handleMigrate()).rejects.toThrow('Migration process failed');

      expect(users.requireUserSession).toHaveBeenCalled();
      expect(migration.archiveLegacyFiles).not.toHaveBeenCalled();
    });

    test('should handle archiveLegacyFiles errors gracefully', async () => {
      const mockResult = {
        success: true,
        message: 'Migration completed successfully',
        migrated: 3,
        skipped: 0
      };
      migration.migrateLegacyNotes.mockResolvedValue(mockResult);
      migration.archiveLegacyFiles.mockRejectedValue(new Error('Archive failed'));

      // Should not throw, but should still complete migration
      await expect(handleMigrate()).rejects.toThrow('Archive failed');

      expect(migration.migrateLegacyNotes).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('✅ Migration completed successfully');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n📦 Archiving legacy note files...');
    });
  });
});

