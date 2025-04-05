import fs from 'node:fs/promises';
import { join, dirname } from 'node:path';
import os from 'node:os';

const homeDir = os.homedir(); // /home/username
const DB_PATH = join(homeDir, '.note-cli', 'db.json'); // /home/usernme/.note-cli/db.json

const ensureDB = async () => {
  // Create .note-cli directory
  await fs.mkdir(dirname(DB_PATH), { recursive: true });

  try {
    // Check if db.json exists
    await fs.access(DB_PATH);
  } catch (error) {
    // Create db.json if it doesn't exist
    await fs.writeFile(DB_PATH, JSON.stringify({ notes: [] }));
  }
}

export const getDB = async () => {
  await ensureDB();
  const db = await fs.readFile(DB_PATH, 'utf-8');
  return JSON.parse(db);
}

export const saveDB = async (db) => {
  await ensureDB();
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  return db;
}

export const insertDB = async (collection, data) => {
  await ensureDB();
  const db = await getDB();
  const newItem = {
    ...data,
    id: Date.now()
  }

  db[collection].push(newItem);
  await saveDB(db);
  return newItem;
}