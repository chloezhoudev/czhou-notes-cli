import { expect, jest } from '@jest/globals';

// Mock the entire supabase module
jest.unstable_mockModule('../src/supabase.js', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          ilike: jest.fn(() => ({})),
          overlaps: jest.fn(() => ({}))
        })),
        ilike: jest.fn(() => ({})),
        overlaps: jest.fn(() => ({})),
        match: jest.fn(() => ({
          single: jest.fn(),
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      })),
      delete: jest.fn(() => ({
        match: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        })),
        eq: jest.fn(() => ({
          select: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        match: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    }))
  }
}));

const { supabase } = await import('../src/supabase.js');
const {
  createUser,
  findUserByUsername,
  createNote,
  getAllNotesForUser,
  findNotesByContent,
  findNotesByTags,
  removeNoteById,
  removeAllNotesForUser
} = await import('../src/supabase-db.js');

describe('Supabase Database Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Operations', () => {
    test('createUser should create a new user', async () => {
      const mockUser = { id: 1, username: 'testuser' };

      // We need to mock the final result that gets awaited
      const mockChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
          })
        })
      };

      supabase.from.mockReturnValue(mockChain);

      const result = await createUser('testuser');

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockChain.insert).toHaveBeenCalledWith([{ username: 'testuser' }]);
      expect(result).toEqual({ data: mockUser, error: null });
    });

    test('findUserByUsername should find existing user', async () => {
      const mockUser = { id: 1, username: 'testuser' };

      const mockChain = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
          })
        })
      };

      supabase.from.mockReturnValue(mockChain);

      const result = await findUserByUsername('testuser');

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.select().eq).toHaveBeenCalledWith('username', 'testuser');
      expect(result).toEqual({ data: mockUser, error: null });
    });
  });

  describe('Note Operations', () => {
    test('createNote should create a new note', async () => {
      const mockNote = {
        id: 'uuid-123',
        user_id: 1,
        content: 'Test note',
        tags: ['test']
      };

      supabase.rpc.mockResolvedValue({ error: null });

      const mockChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockNote, error: null })
          })
        })
      };

      supabase.from.mockReturnValue(mockChain);

      const result = await createNote(1, 'Test note', ['test'], 'testuser');

      expect(supabase.rpc).toHaveBeenCalledWith('set_current_user', { username: 'testuser' });
      expect(supabase.from).toHaveBeenCalledWith('notes');
      expect(mockChain.insert).toHaveBeenCalledWith([{
        user_id: 1,
        content: 'Test note',
        tags: ['test']
      }]);
      expect(result).toEqual({ data: mockNote, error: null });
    });

    test('getAllNotesForUser should fetch all user notes', async () => {
      const mockNotes = [
        { id: 'uuid-1', user_id: 1, content: 'Note 1', tags: [] },
        { id: 'uuid-2', user_id: 1, content: 'Note 2', tags: ['tag1'] }
      ];

      supabase.rpc.mockResolvedValue({ error: null });

      const mockChain = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: mockNotes, error: null })
        })
      };

      supabase.from.mockReturnValue(mockChain);


      const result = await getAllNotesForUser(1, 'testuser');

      expect(supabase.rpc).toHaveBeenCalledWith('set_current_user', { username: 'testuser' });
      expect(supabase.from).toHaveBeenCalledWith('notes');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.select().eq).toHaveBeenCalledWith('user_id', 1);
      expect(result).toEqual({ data: mockNotes, error: null });
    });

    test('findNotesByContent should find notes by content search', async () => {
      const mockNotes = [
        { id: 'uuid-1', user_id: 1, content: 'This is a test note', tags: [] },
        { id: 'uuid-2', user_id: 1, content: 'Another test message', tags: ['work'] }
      ];

      supabase.rpc.mockResolvedValue({ error: null });

      const mockChain = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            ilike: jest.fn().mockResolvedValue({ data: mockNotes, error: null })
          })
        })
      };

      supabase.from.mockReturnValue(mockChain);

      const result = await findNotesByContent(1, 'test', 'testuser');

      expect(supabase.rpc).toHaveBeenCalledWith('set_current_user', { username: 'testuser' });
      expect(supabase.from).toHaveBeenCalledWith('notes');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.select().eq).toHaveBeenCalledWith('user_id', 1);
      expect(mockChain.select().eq().ilike).toHaveBeenCalledWith('content', '%test%');
      expect(result).toEqual({ data: mockNotes, error: null });
    });

    test('findNotesByTags should find notes by tag overlap', async () => {
      const mockNotes = [
        { id: 'uuid-1', user_id: 1, content: 'Work note', tags: ['work', 'urgent'] },
        { id: 'uuid-2', user_id: 1, content: 'Personal note', tags: ['personal', 'work'] }
      ];

      supabase.rpc.mockResolvedValue({ error: null });

      const mockChain = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            overlaps: jest.fn().mockResolvedValue({ data: mockNotes, error: null })
          })
        })
      };

      supabase.from.mockReturnValue(mockChain);

      const result = await findNotesByTags(1, ['work'], 'testuser');

      expect(supabase.rpc).toHaveBeenCalledWith('set_current_user', { username: 'testuser' });
      expect(supabase.from).toHaveBeenCalledWith('notes');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.select().eq).toHaveBeenCalledWith('user_id', 1);
      expect(mockChain.select().eq().overlaps).toHaveBeenCalledWith('tags', ['work']);
      expect(result).toEqual({ data: mockNotes, error: null });
    });

    test('removeNoteById should delete a note', async () => {
      const mockDeletedNote = { id: 'uuid-123', content: 'Deleted note' };

      supabase.rpc.mockResolvedValue({ error: null });

      const mockChain = {
        delete: jest.fn().mockReturnValue({
          match: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockDeletedNote, error: null })
            })
          })
        })
      };

      supabase.from.mockReturnValue(mockChain);

      const result = await removeNoteById('uuid-123', 1, 'testuser');

      expect(supabase.rpc).toHaveBeenCalledWith('set_current_user', { username: 'testuser' });
      expect(supabase.from).toHaveBeenCalledWith('notes');
      expect(mockChain.delete().match).toHaveBeenCalledWith({ id: 'uuid-123', user_id: 1 });
      expect(result).toEqual({ data: mockDeletedNote, error: null });
    });

    test('removeAllNotesForUser should delete all notes for a user', async () => {
      const mockDeletedNotes = [
        { id: 'uuid-1', user_id: 1, content: 'Note 1', tags: [] },
        { id: 'uuid-2', user_id: 1, content: 'Note 2', tags: ['work'] }
      ];

      supabase.rpc.mockResolvedValue({ error: null });

      const mockChain = {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ data: mockDeletedNotes, error: null })
          })
        })
      };

      supabase.from.mockReturnValue(mockChain);

      const result = await removeAllNotesForUser(1, 'testuser');

      expect(supabase.rpc).toHaveBeenCalledWith('set_current_user', { username: 'testuser' });
      expect(supabase.from).toHaveBeenCalledWith('notes');
      expect(mockChain.delete().eq).toHaveBeenCalledWith('user_id', 1);
      expect(result).toEqual({ data: mockDeletedNotes, error: null });
    });
  });

  describe('Error Handling', () => {
    describe('RLS (Row Level Security) Errors', () => {
      test('should handle RLS context errors', async () => {
        const contextError = { message: 'RLS context failed' };
        supabase.rpc.mockResolvedValue({ error: contextError });

        await expect(createNote(1, 'Test', [], 'testuser'))
          .rejects
          .toThrow('Failed to set user context: RLS context failed');
      });

      test('should handle RLS context errors in other functions', async () => {
        const contextError = { message: 'User not authorized' };
        supabase.rpc.mockResolvedValue({ error: contextError });

        // Test different functions that use RLS
        await expect(getAllNotesForUser(1, 'testuser'))
          .rejects
          .toThrow('Failed to set user context: User not authorized');

        await expect(findNotesByContent(1, 'test', 'testuser'))
          .rejects
          .toThrow('Failed to set user context: User not authorized');
      });
    });

    describe('Database Operation Errors', () => {
      test('should handle database errors in create operations', async () => {
        supabase.rpc.mockResolvedValue({ error: null });

        const dbError = { message: 'Database connection failed' };
        const mockChain = {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: dbError })
            })
          })
        };

        supabase.from.mockReturnValue(mockChain);

        const result = await createNote(1, 'Test', [], 'testuser');

        expect(result.data).toBeNull();
        expect(result.error).toEqual(dbError);
      });

      test('should handle database errors in read operations', async () => {
        supabase.rpc.mockResolvedValue({ error: null });

        const dbError = { message: 'Table not found' };
        const mockChain = {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: dbError })
          })
        };

        supabase.from.mockReturnValue(mockChain);

        const result = await getAllNotesForUser(1, 'testuser');

        expect(result.data).toBeNull();
        expect(result.error).toEqual(dbError);
      });

      test('should handle database errors in single delete operations', async () => {
        supabase.rpc.mockResolvedValue({ error: null });

        const dbError = { message: 'Permission denied' };
        const mockChain = {
          delete: jest.fn().mockReturnValue({
            match: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: dbError })
              })
            })
          })
        };

        supabase.from.mockReturnValue(mockChain);

        const result = await removeNoteById('uuid-123', 1, 'testuser');

        expect(result.data).toBeNull();
        expect(result.error).toEqual(dbError);
      });

      test('should handle errors in bulk delete operations', async () => {
        supabase.rpc.mockResolvedValue({ error: null });

        const deleteError = { message: 'Bulk delete failed' };
        const mockChain = {
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({ data: null, error: deleteError })
            })
          })
        };

        supabase.from.mockReturnValue(mockChain);

        const result = await removeAllNotesForUser(1, 'testuser');

        expect(result.data).toBeNull();
        expect(result.error).toEqual(deleteError);
      });
    });

    describe('Data Validation Errors', () => {
      test('should handle unique constraint violations', async () => {
        const validationError = {
          message: 'duplicate key value violates unique constraint "users_username_key"',
          code: '23505'
        };

        const mockChain = {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: validationError })
            })
          })
        };

        supabase.from.mockReturnValue(mockChain);

        const result = await createUser('existing_user');

        expect(result.data).toBeNull();
        expect(result.error).toEqual(validationError);
      });

      test('should handle not found errors', async () => {
        const notFoundError = {
          message: 'No rows found',
          code: 'PGRST116'
        };

        const mockChain = {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: notFoundError })
            })
          })
        };

        supabase.from.mockReturnValue(mockChain);

        const result = await findUserByUsername('non-existent-user');

        expect(result.data).toBeNull();
        expect(result.error).toEqual(notFoundError);
      });
    });

    describe('Network and Connection Errors', () => {
      test('should handle network/connection errors', async () => {
        supabase.rpc.mockRejectedValue(new Error('Network error'));

        await expect(createNote(1, 'Test', [], 'testuser'))
          .rejects
          .toThrow('Network error');
      });
    });
  });
});