import { expect, jest } from '@jest/globals';

// Mock fs/promises and os
jest.unstable_mockModule('node:fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  access: jest.fn(),
  unlink: jest.fn()
}));

jest.unstable_mockModule('node:os', () => ({
  homedir: () => '/fake/home'
}));

const { mkdir, writeFile, readFile, access, unlink } = await import('node:fs/promises');
const {
  saveUserSession,
  getUserSession,
  clearUserSession,
  requireUserSession
} = await import('../src/users.js');

describe('User Session Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveUserSession', () => {
    test('should save user session to file', async () => {
      const mockUser = { id: 'user-123', username: 'testuser' };

      mkdir.mockResolvedValue();
      writeFile.mockResolvedValue();

      const result = await saveUserSession(mockUser);

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.note-cli'),
        { recursive: true }
      );

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('user.json'),
        expect.stringContaining('"username": "testuser"'),
        'utf-8'
      );

      expect(result).toEqual({
        id: 'user-123',
        username: 'testuser',
        loginTime: expect.any(String)
      });
    });

    test('should throw error on file write failure', async () => {
      const mockUser = { id: 'user-123', username: 'testuser' };

      mkdir.mockResolvedValue();
      writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(saveUserSession(mockUser))
        .rejects
        .toThrow('Could not save user session: Permission denied');
    });

    test('should throw error on directory creation failure', async () => {
      const mockUser = { id: 'user-123', username: 'testuser' };

      mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(saveUserSession(mockUser))
        .rejects
        .toThrow('Could not save user session: Permission denied');
    });

  });

  describe('getUserSession', () => {
    test('should return existing session', async () => {
      const mockSession = {
        id: 'user-123',
        username: 'testuser',
        loginTime: '2024-01-01T00:00:00.000Z'
      };

      access.mockResolvedValue();
      readFile.mockResolvedValue(JSON.stringify(mockSession));

      const result = await getUserSession();

      expect(access).toHaveBeenCalledWith(expect.stringContaining('user.json'));
      expect(readFile).toHaveBeenCalledWith(expect.stringContaining('user.json'), 'utf-8');
      expect(result).toEqual(mockSession);
    });

    test('should return null when session file does not exist', async () => {
      const noFileError = new Error('File not found');
      noFileError.code = 'ENOENT';
      access.mockRejectedValue(noFileError);

      const result = await getUserSession();

      expect(result).toBe(null);
    });

    test('should return null when readFile throws ENOENT', async () => {
      const noFileError = new Error('File not found');
      noFileError.code = 'ENOENT';

      access.mockResolvedValue(); // File exists during access check
      readFile.mockRejectedValue(noFileError); // But deleted before read

      const result = await getUserSession();
      expect(result).toBe(null);
    });

    test('should throw error on other file read errors', async () => {
      access.mockResolvedValue();
      readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(getUserSession())
        .rejects
        .toThrow('Could not read user session: Permission denied');
    });

    test('should throw error on invalid JSON', async () => {
      access.mockResolvedValue();
      readFile.mockResolvedValue('invalid json');

      await expect(getUserSession())
        .rejects
        .toThrow('Could not read user session:');
    });
  });

  describe('clearUserSession', () => {
    test('should delete session file', async () => {
      unlink.mockResolvedValue();

      const result = await clearUserSession();

      expect(unlink).toHaveBeenCalledWith(expect.stringContaining('user.json'));
      expect(result).toBe(true);
    });

    test('should return true even if file does not exist', async () => {
      const noFileError = new Error('File not found');
      noFileError.code = 'ENOENT';
      unlink.mockRejectedValue(noFileError);

      const result = await clearUserSession();

      expect(result).toBe(true);
    });

    test('should throw error on other unlink errors', async () => {
      unlink.mockRejectedValue(new Error('Permission denied'));

      await expect(clearUserSession())
        .rejects
        .toThrow('Could not clear user session: Permission denied');
    });
  });

  describe('requireUserSession', () => {
    test('should return session when user is logged in', async () => {
      const mockSession = {
        id: 'user-123',
        username: 'testuser',
        loginTime: '2024-01-01T00:00:00.000Z'
      };

      access.mockResolvedValue();
      readFile.mockResolvedValue(JSON.stringify(mockSession));

      const result = await requireUserSession();

      expect(result).toEqual(mockSession);
    });

    test('should throw error when no session exists', async () => {
      const noFileError = new Error('File not found');
      noFileError.code = 'ENOENT';
      access.mockRejectedValue(noFileError);

      await expect(requireUserSession())
        .rejects
        .toThrow('No user session found. Please run "note setup <username>" first.');
    });

    test('should propagate getUserSession errors', async () => {
      access.mockResolvedValue();
      readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(requireUserSession())
        .rejects
        .toThrow('Could not read user session: Permission denied');
    });

    test('should throw error when session file contains null', async () => {
      access.mockResolvedValue();
      readFile.mockResolvedValue('null'); // Valid JSON that parses to null

      await expect(requireUserSession())
        .rejects
        .toThrow('No user session found. Please run "note setup <username>" first.');
    });
  });
});