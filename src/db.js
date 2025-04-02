import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '..', 'db.json');

export const getDB = async () => {
  const db = await fs.readFile(DB_PATH, 'utf-8');
  return JSON.parse(db);
}

export const saveDB = async (db) => {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  return db;
}

export const insertDB = async (collection, data) => {
  const db = await getDB();
  const newItem = {
    ...data,
    id: Date.now()
  }

  db[collection].push(newItem);
  await saveDB(db);
  return newItem;
}