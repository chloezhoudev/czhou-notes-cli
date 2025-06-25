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

const {
  handleUserSetup,
  handleWhoami,
  handleLogout,
  handleAddNote,
  handleGetAllNotes,
  handleFindNotes,
  handleRemoveNote,
  handleCleanNotes
} = await import('../src/command-handlers.js');

const supabaseDb = await import('../src/supabase-db.js');
const notes = await import('../src/notes.js');
const users = await import('../src/users.js');
const utils = await import('../src/utils.js');

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
});

