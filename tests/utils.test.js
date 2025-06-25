// utils.test.js
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/supabase-db.js', () => ({
  findUserByUsername: jest.fn()
}));

const {
  listNotes,
  validateUsername,
  isSessionValid,
  isNumericIndex
} = await import('../src/utils.js');

const supabaseDb = await import('../src/supabase-db.js');

const mockFindUserByUsername = supabaseDb.findUserByUsername;

describe('Utils Module', () => {
  describe('validateUsername', () => {
    it('should validate and normalize valid usernames', () => {
      // Test trimming whitespace
      expect(validateUsername('  john_doe  ')).toBe('john_doe');

      // Test valid characters
      expect(validateUsername('user123')).toBe('user123');
      expect(validateUsername('test-user')).toBe('test-user');
      expect(validateUsername('my_username')).toBe('my_username');
      expect(validateUsername('User-123_test')).toBe('User-123_test');
    });

    it('should throw error for empty or whitespace-only usernames', () => {
      expect(() => validateUsername('')).toThrow('Username cannot be empty or contain only whitespace');
      expect(() => validateUsername('   ')).toThrow('Username cannot be empty or contain only whitespace');
      expect(() => validateUsername('\t\n')).toThrow('Username cannot be empty or contain only whitespace');
    });

    it('should throw error for too short usernames', () => {
      expect(() => validateUsername('a')).toThrow('Username must be at least 2 characters long');
      expect(() => validateUsername(' x ')).toThrow('Username must be at least 2 characters long');
    });

    it('should throw error for too long usernames', () => {
      const longUsername = 'a'.repeat(51);
      expect(() => validateUsername(longUsername)).toThrow('Username cannot be longer than 50 characters');
    });

    it('should throw error for invalid characters', () => {
      expect(() => validateUsername('user@domain')).toThrow('Username can only contain letters, numbers, underscores, and hyphens');
      expect(() => validateUsername('user.name')).toThrow('Username can only contain letters, numbers, underscores, and hyphens');
      expect(() => validateUsername('user name')).toThrow('Username can only contain letters, numbers, underscores, and hyphens');
      expect(() => validateUsername('user+name')).toThrow('Username can only contain letters, numbers, underscores, and hyphens');
      expect(() => validateUsername('user#name')).toThrow('Username can only contain letters, numbers, underscores, and hyphens');
    });

    it('should accept usernames at boundary lengths', () => {
      // Exactly 2 characters
      expect(validateUsername('ab')).toBe('ab');

      // Exactly 50 characters
      const maxUsername = 'a'.repeat(50);
      expect(validateUsername(maxUsername)).toBe(maxUsername);
    });
  });

  describe('isSessionValid', () => {
    let consoleSpy;

    beforeEach(() => {
      jest.clearAllMocks();
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should return true for valid session with matching user', async () => {
      const mockSession = { username: 'testuser', id: '123' };
      const mockUser = { id: '123', username: 'testuser' };

      mockFindUserByUsername.mockResolvedValue({
        data: mockUser,
        error: null
      });

      const result = await isSessionValid(mockSession);

      expect(result).toBe(true);
      expect(mockFindUserByUsername).toHaveBeenCalledWith('testuser');
      expect(mockFindUserByUsername).toHaveBeenCalledTimes(1);
    });

    it('should return false when user not found', async () => {
      const mockSession = { username: 'nonexistent', id: '123' };

      mockFindUserByUsername.mockResolvedValue({
        data: null,
        error: { message: 'User not found' }
      });

      const result = await isSessionValid(mockSession);

      expect(result).toBe(false);
      expect(mockFindUserByUsername).toHaveBeenCalledWith('nonexistent');
    });

    it('should return false when user ID does not match session ID', async () => {
      const mockSession = { username: 'testuser', id: '123' };
      const mockUser = { id: '456', username: 'testuser' }; // Different ID

      mockFindUserByUsername.mockResolvedValue({
        data: mockUser,
        error: null
      });

      const result = await isSessionValid(mockSession);

      expect(result).toBe(false);
    });

    it('should return false when database returns error', async () => {
      const mockSession = { username: 'testuser', id: '123' };

      mockFindUserByUsername.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const result = await isSessionValid(mockSession);

      expect(result).toBe(false);
    });

    it('should handle and log exceptions gracefully', async () => {
      const mockSession = { username: 'testuser', id: '123' };

      mockFindUserByUsername.mockRejectedValue(new Error('Network error'));

      const result = await isSessionValid(mockSession);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Session validation failed:', 'Network error');
    });

    it('should return false when user data exists but has error', async () => {
      const mockSession = { username: 'testuser', id: '123' };
      const mockUser = { id: '123', username: 'testuser' };

      mockFindUserByUsername.mockResolvedValue({
        data: mockUser,
        error: { message: 'Some error' }
      });

      const result = await isSessionValid(mockSession);

      expect(result).toBe(false);
    });

    it('should return false when session is missing username', async () => {
      const mockSession = { id: '123' }; // Missing username

      mockFindUserByUsername.mockResolvedValue({
        data: null,
        error: { message: 'No username provided' }
      });

      const result = await isSessionValid(mockSession);

      expect(result).toBe(false);
    });

    it('should return false when session is missing id', async () => {
      const mockSession = { username: 'testuser' }; // Missing id
      const mockUser = { id: '123', username: 'testuser' };

      mockFindUserByUsername.mockResolvedValue({
        data: mockUser,
        error: null
      });

      const result = await isSessionValid(mockSession);

      expect(result).toBe(false); // Should fail because session.id is undefined
    });
  });

  describe('isNumericIndex', () => {
    it('should return true for numeric strings', () => {
      expect(isNumericIndex('1')).toBe(true);
      expect(isNumericIndex('123')).toBe(true);
      expect(isNumericIndex('0')).toBe(true);
      expect(isNumericIndex('999')).toBe(true);
    });

    it('should return false for non-numeric strings', () => {
      expect(isNumericIndex('abc')).toBe(false);
      expect(isNumericIndex('12a')).toBe(false);
      expect(isNumericIndex('a12')).toBe(false);
      expect(isNumericIndex('1.5')).toBe(false);
      expect(isNumericIndex('-1')).toBe(false);
      expect(isNumericIndex('+1')).toBe(false);
      expect(isNumericIndex('')).toBe(false);
      expect(isNumericIndex(' 123 ')).toBe(false);
    });

    it('should return false for UUIDs', () => {
      expect(isNumericIndex('f92e836e-a85b-491f-af2a-435b3308f6c1')).toBe(false);
      expect(isNumericIndex('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
    });
  });

  describe('listNotes', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should format and display notes correctly', () => {
      const mockNotes = [
        { id: 'note-1', content: 'First note', tags: ['tag1', 'tag2'] },
        { id: 'note-2', content: 'Second note', tags: ['tag3'] }
      ];

      listNotes(mockNotes);

      // Check formatting for first note
      expect(consoleSpy).toHaveBeenCalledWith('\n[1]');
      expect(consoleSpy).toHaveBeenCalledWith('note:', 'First note');
      expect(consoleSpy).toHaveBeenCalledWith('id:', 'note-1');
      expect(consoleSpy).toHaveBeenCalledWith('tags:', 'tag1, tag2');

      // Check formatting for second note
      expect(consoleSpy).toHaveBeenCalledWith('\n[2]');
      expect(consoleSpy).toHaveBeenCalledWith('note:', 'Second note');
      expect(consoleSpy).toHaveBeenCalledWith('id:', 'note-2');
      expect(consoleSpy).toHaveBeenCalledWith('tags:', 'tag3');
    });

    it('should handle notes with no tags', () => {
      const mockNotes = [
        { id: 'note-1', content: 'Note without tags', tags: [] }
      ];

      listNotes(mockNotes);

      expect(consoleSpy).toHaveBeenCalledWith('\n[1]');
      expect(consoleSpy).toHaveBeenCalledWith('note:', 'Note without tags');
      expect(consoleSpy).toHaveBeenCalledWith('id:', 'note-1');
      expect(consoleSpy).toHaveBeenCalledWith('tags:', ''); // Empty string for no tags
    });

    it('should handle empty notes array gracefully', () => {
      listNotes([]);

      // Should not crash and should not log anything except potentially newlines
      // We'll check that no note-specific content was logged
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringMatching(/note:/));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringMatching(/id:/));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringMatching(/tags:/));
    });

    it('should handle notes with single tag', () => {
      const mockNotes = [
        { id: 'note-1', content: 'Single tag note', tags: ['important'] }
      ];

      listNotes(mockNotes);

      expect(consoleSpy).toHaveBeenCalledWith('tags:', 'important');
    });

    it('should handle notes with multiple tags correctly', () => {
      const mockNotes = [
        { id: 'note-1', content: 'Multi tag note', tags: ['work', 'urgent', 'meeting', 'project'] }
      ];

      listNotes(mockNotes);

      expect(consoleSpy).toHaveBeenCalledWith('tags:', 'work, urgent, meeting, project');
    });

    it('should display correct index numbers', () => {
      const mockNotes = Array.from({ length: 5 }, (_, i) => ({
        id: `note-${i + 1}`,
        content: `Note ${i + 1}`,
        tags: []
      }));

      listNotes(mockNotes);

      // Check that indices are correct (1-based, not 0-based)
      expect(consoleSpy).toHaveBeenCalledWith('\n[1]');
      expect(consoleSpy).toHaveBeenCalledWith('\n[2]');
      expect(consoleSpy).toHaveBeenCalledWith('\n[3]');
      expect(consoleSpy).toHaveBeenCalledWith('\n[4]');
      expect(consoleSpy).toHaveBeenCalledWith('\n[5]');

      // Should not have index 0 or 6
      expect(consoleSpy).not.toHaveBeenCalledWith('\n[0]');
      expect(consoleSpy).not.toHaveBeenCalledWith('\n[6]');
    });
  });
});