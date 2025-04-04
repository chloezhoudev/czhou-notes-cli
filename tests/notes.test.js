import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/db.js', () => ({
  getDB: jest.fn(),
  saveDB: jest.fn(),
  insertDB: jest.fn()
}));

const { getDB, saveDB, insertDB } = await import('../src/db.js');
const { addNote, getAllNotes, findNotes, removeNote, removeAllNotes } = await import('../src/notes.js');

beforeEach(() => {
  jest.clearAllMocks();
});

test('addNote inserts a note and returns it', async () => {
  // 1. ARRANGE
  const content = 'Test note';
  const tags = ['test'];

  insertDB.mockResolvedValue({
    content,
    tags,
    id: 123
  });

  // 2. ACT
  const result = await addNote(content, tags);

  // 3. ASSERT
  expect(result).toEqual({
    content,
    tags,
    id: expect.any(Number)
  });
});

describe('getAllNotes', () => {
  test('returns all notes when DB has notes', async () => {
    // ARRANGE
    const mockNotes = {
      notes: [
        { id: 1, content: 'note 1', tags: [] },
        { id: 2, content: 'note 2', tags: ['test'] }
      ]
    };
  
    getDB.mockResolvedValue(mockNotes);
  
    // 2. ACT
    const result = await getAllNotes();
  
    // 3. ASSERT
    expect(result).toEqual(mockNotes.notes);
  });

  test('returns empty array when DB is empty', async () => {
    const mockDB = { notes: [] };
    getDB.mockResolvedValue(mockDB);

    const result = await getAllNotes();

    expect(result).toEqual([]);
  })
  
});

describe('findNotes', () => {
  test('finds notes matching content', async () => {
    const mockDB = {
      notes: [
        { id: 1, content: 'hello world', tags: ['test'] },
        { id: 2, content: 'hello jest', tags: ['test'] },
        { id: 3, content: 'testing', tags: ['test'] },
      ]
    }

    getDB.mockResolvedValue(mockDB);

    const result = await findNotes('hello');

    expect(result).toEqual([
      { id: 1, content: 'hello world', tags: ['test'] },
      { id: 2, content: 'hello jest', tags: ['test'] },
    ]);
  });

  test('returns empty array when no matches', async () => {
    const mockDB = {
      notes: [
        { id: 1, content: 'hello world', tags: ['test'] },
        { id: 2, content: 'hello jest', tags: ['test'] },
        { id: 3, content: 'testing', tags: ['test'] },
      ]
    }

    getDB.mockResolvedValue(mockDB);

    const result = await findNotes('foo');

    expect(result).toEqual([]);
  });

  test('search should be case insensitive', async () => {
    const mockDB = {
      notes: [
        { id: 1, content: 'heLLo world', tags: ['test'] },
        { id: 2, content: 'hello Jest', tags: ['test'] },
        { id: 3, content: 'testing', tags: ['test'] },
      ]
    }

    getDB.mockResolvedValue(mockDB);

    const result = await findNotes('hello');

    expect(result).toEqual([
      { id: 1, content: 'heLLo world', tags: ['test'] },
      { id: 2, content: 'hello Jest', tags: ['test'] },
    ]);
  });
});

describe('removeNote', () => {
  test('removes note when ID exists', async () => {
    const mockDB = {
      notes: [
        { id: 1, content: 'note 1', tags: [] },
        { id: 2, content: 'note 2', tags: ['test'] },
      ]
    }

    getDB.mockResolvedValue(mockDB);

    const result = await removeNote(2);

    expect(result).toBe(2);
    expect(saveDB).toHaveBeenCalledWith({
      notes: [{ id: 1, content: 'note 1', tags: [] }]
    });
  });

  test('returns undefined when ID does not exist', async () => {
    const mockDB = {
      notes: [
        { id: 1, content: 'note 1', tags: [] },
        { id: 2, content: 'note 2', tags: ['test'] },
      ]
    }

    getDB.mockResolvedValue(mockDB);

    const result = await removeNote(3);

    expect(result).toBe(undefined);
    expect(saveDB).not.toHaveBeenCalled();
  });
});

test('removes all notes and returns true', async () => {
  const result = await removeAllNotes();

  expect(result).toBe(true);
  expect(saveDB).toHaveBeenCalledWith({ notes: [] });
});

