import { expect, jest } from '@jest/globals';

jest.unstable_mockModule('node:os', () => ({
  homedir: () => '/fake/home'
}));

jest.unstable_mockModule('node:fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  access: jest.fn()
}));

const { mkdir, writeFile, readFile, access } = await import('node:fs/promises');
const { getDB, saveDB, insertDB } = await import('../src/db.js');

describe('DB operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns existing DB data', async () => {
    const mockData = { notes: [{ id: 1, content: 'test', tags: [] }] };
    access.mockResolvedValue(); // File exists
    readFile.mockResolvedValue(JSON.stringify(mockData));

    const result = await getDB();

    expect(result).toEqual(mockData);
  });

  test('creates new DB if not exists', async () => {
    access.mockRejectedValueOnce(new Error());
    readFile.mockResolvedValueOnce(JSON.stringify({ notes: [] }));

    await getDB();

    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('.note-cli'),
      { recursive: true }
    );

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('db.json'),
      JSON.stringify({ notes: [] })
    );
  });

  test('saves DB data', async () => {
    const mockData = { notes: [{ id: 1, content: 'test', tags: [] }] };

    access.mockResolvedValue();
    writeFile.mockResolvedValue(JSON.stringify(mockData));

    const result = await saveDB(mockData);

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('db.json'),
      JSON.stringify(mockData, null, 2),
      expect.any(String)
    );

    expect(result).toEqual(mockData);
  })

  test('inserts data into DB', async () => {
    const mockData = { notes: [] };
    const newItem = { content: 'test', tags: [] };

    access.mockResolvedValue();
    readFile.mockResolvedValue(JSON.stringify(mockData));

    const result = await insertDB('notes', newItem);

    expect(result).toEqual({ ...newItem, id: expect.any(Number) });
  });
});
