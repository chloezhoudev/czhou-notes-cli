import { jest } from '@jest/globals';

// Mock the users module
jest.unstable_mockModule('../src/users.js', () => ({
  requireUserSession: jest.fn()
}));

// Mock the supabase-db module
jest.unstable_mockModule('../src/supabase-db.js', () => ({
  createNote: jest.fn(),
  getAllNotesForUser: jest.fn(),
  findNotesByContent: jest.fn(),
  findNotesByTags: jest.fn(),
  removeNoteById: jest.fn(),
  removeAllNotesForUser: jest.fn()
}));

const { requireUserSession } = await import('../src/users.js');
const {
  createNote,
  getAllNotesForUser,
  findNotesByContent,
  findNotesByTags,
  removeNoteById,
  removeAllNotesForUser
} = await import('../src/supabase-db.js');

const {
  addNote,
  getAllNotes,
  findNotes,
  removeNote,
  removeAllNotes
} = await import('../src/notes.js');

describe('Notes with Supabase Integration', () => {
  const mockSession = {
    id: 'user-uuid-123',
    username: 'testuser'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    requireUserSession.mockResolvedValue(mockSession);
  });

  describe('addNote', () => {
    test('should create note with user session', async () => {
      const mockNote = {
        id: 'note-uuid-123',
        user_id: 'user-uuid-123',
        content: 'Test note',
        tags: ['test']
      };

      createNote.mockResolvedValue({ data: mockNote, error: null });

      const result = await addNote('Test note', ['test']);

      expect(requireUserSession).toHaveBeenCalled();
      expect(createNote).toHaveBeenCalledWith(
        'user-uuid-123',
        'Test note',
        ['test'],
        'testuser'
      );
      expect(result).toEqual(mockNote);
    });

    test('should throw error when note creation fails', async () => {
      const dbError = { message: 'Database error' };
      createNote.mockResolvedValue({ data: null, error: dbError });

      await expect(addNote('Test note', []))
        .rejects
        .toThrow('Failed to add note: Database error');
    });

    test('should throw error when no user session', async () => {
      requireUserSession.mockRejectedValue(new Error('No user session'));

      await expect(addNote('Test note', []))
        .rejects
        .toThrow('No user session');
    });
  });

  describe('getAllNotes', () => {
    test('should fetch all notes for user', async () => {
      const mockNotes = [
        { id: 'note-1', content: 'Note 1', tags: [] },
        { id: 'note-2', content: 'Note 2', tags: ['work'] }
      ];

      getAllNotesForUser.mockResolvedValue({ data: mockNotes, error: null });

      const result = await getAllNotes();

      expect(requireUserSession).toHaveBeenCalled();
      expect(getAllNotesForUser).toHaveBeenCalledWith('user-uuid-123', 'testuser');
      expect(result).toEqual(mockNotes);
    });

    test('should return empty array when no notes', async () => {
      getAllNotesForUser.mockResolvedValue({ data: null, error: null });

      const result = await getAllNotes();

      expect(result).toEqual([]);
    });

    test('should throw error on database failure', async () => {
      const dbError = { message: 'Connection failed' };
      getAllNotesForUser.mockResolvedValue({ data: null, error: dbError });

      await expect(getAllNotes())
        .rejects
        .toThrow('Failed to get notes: Connection failed');
    });
  });

  describe('findNotes', () => {
    test('should search both content and tags and deduplicate', async () => {
      const contentResults = [
        { id: 'note-1', content: 'hello world', tags: [] },
        { id: 'note-2', content: 'hello jest', tags: [] }
      ];

      const tagResults = [
        { id: 'note-2', content: 'hello jest', tags: ['hello'] }, // duplicate
        { id: 'note-3', content: 'testing', tags: ['hello'] }
      ];

      findNotesByContent.mockResolvedValue({ data: contentResults, error: null });
      findNotesByTags.mockResolvedValue({ data: tagResults, error: null });

      const result = await findNotes('hello');

      expect(findNotesByContent).toHaveBeenCalledWith('user-uuid-123', 'hello', 'testuser');
      expect(findNotesByTags).toHaveBeenCalledWith('user-uuid-123', ['hello'], 'testuser');

      // Should have 3 unique notes (note-2 deduplicated)
      expect(result).toHaveLength(3);
      expect(result.map(n => n.id)).toEqual(['note-1', 'note-2', 'note-3']);
    });

    test('should handle content search errors', async () => {
      const searchError = { message: 'Search failed' };
      findNotesByContent.mockResolvedValue({ data: null, error: searchError });
      findNotesByTags.mockResolvedValue({ data: [], error: null });

      await expect(findNotes('hello'))
        .rejects
        .toThrow('Failed to search notes by content: Search failed');
    });

    test('should handle tag search errors', async () => {
      const searchError = { message: 'Tag search failed' };
      findNotesByContent.mockResolvedValue({ data: [], error: null });
      findNotesByTags.mockResolvedValue({ data: null, error: searchError });

      await expect(findNotes('hello'))
        .rejects
        .toThrow('Failed to search notes by tags: Tag search failed');
    });

    test('should return empty array when no matches found', async () => {
      findNotesByContent.mockResolvedValue({ data: [], error: null });
      findNotesByTags.mockResolvedValue({ data: [], error: null });

      const result = await findNotes('nonexistent');

      expect(result).toEqual([]);
    });

    test('should handle null data responses', async () => {
      findNotesByContent.mockResolvedValue({ data: null, error: null });
      findNotesByTags.mockResolvedValue({ data: null, error: null });

      const result = await findNotes('test');

      expect(result).toEqual([]);
    });
  });

  describe('removeNote', () => {
    test('should remove note by UUID directly', async () => {
      const noteId = 'note-uuid-123';
      removeNoteById.mockResolvedValue({
        data: { id: noteId, content: 'Deleted' },
        error: null
      });

      const result = await removeNote(noteId);

      expect(removeNoteById).toHaveBeenCalledWith(noteId, 'user-uuid-123', 'testuser');
      expect(result).toBe(noteId);
    });

    test('should remove note by index number', async () => {
      const mockNotes = [
        { id: 'note-1', content: 'First note' },
        { id: 'note-2', content: 'Second note' },
        { id: 'note-3', content: 'Third note' }
      ];

      getAllNotesForUser.mockResolvedValue({ data: mockNotes, error: null });
      removeNoteById.mockResolvedValue({
        data: { id: 'note-2', content: 'Second note' },
        error: null
      });

      const result = await removeNote('2'); // Index 2 = note-2

      expect(getAllNotesForUser).toHaveBeenCalledWith('user-uuid-123', 'testuser');
      expect(removeNoteById).toHaveBeenCalledWith('note-2', 'user-uuid-123', 'testuser');
      expect(result).toBe('note-2');
    });

    test('should throw error for invalid index', async () => {
      const mockNotes = [{ id: 'note-1', content: 'Only note' }];
      getAllNotesForUser.mockResolvedValue({ data: mockNotes, error: null });

      await expect(removeNote('5'))
        .rejects
        .toThrow('Note index 5 not found. You have 1 notes.');
    });

    test('should throw error for negative index', async () => {
      await expect(removeNote('-1'))
        .rejects
        .toThrow('Note index must be 1 or greater');
    });

    test('should throw error when no notes exist', async () => {
      getAllNotesForUser.mockResolvedValue({ data: [], error: null });

      await expect(removeNote('1'))
        .rejects
        .toThrow('No notes found');
    });

    test('should throw error when removal fails', async () => {
      const dbError = { message: 'Delete constraint violation' };
      removeNoteById.mockResolvedValue({ data: null, error: dbError });

      await expect(removeNote('note-uuid-123'))
        .rejects
        .toThrow('Failed to remove note: Delete constraint violation');
    });

    test('should throw error when fetching notes fails for index lookup', async () => {
      const fetchError = { message: 'Connection timeout' };
      getAllNotesForUser.mockResolvedValue({ data: null, error: fetchError });

      await expect(removeNote('1'))
        .rejects
        .toThrow('Failed to fetch notes: Connection timeout');
    });

    test('should throw error for zero index', async () => {
      await expect(removeNote('0'))
        .rejects
        .toThrow('Note index must be 1 or greater');
    });
  });

  describe('removeAllNotes', () => {
    test('should remove all notes for user', async () => {
      removeAllNotesForUser.mockResolvedValue({ error: null });

      const result = await removeAllNotes();

      expect(removeAllNotesForUser).toHaveBeenCalledWith('user-uuid-123', 'testuser');
      expect(result).toBe(true);
    });

    test('should throw error on database failure', async () => {
      const dbError = { message: 'Delete failed' };
      removeAllNotesForUser.mockResolvedValue({ error: dbError });

      await expect(removeAllNotes())
        .rejects
        .toThrow('Failed to remove all notes: Delete failed');
    });
  });

});

