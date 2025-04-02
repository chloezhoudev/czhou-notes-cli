import { getDB, saveDB, insertDB } from "./db.js";

export const addNote = async (note, tags) => {
  const newNote = {
    content: note,
    tags
  }
  const savedNote = await insertDB('notes', newNote);
  return savedNote;
}

export const getAllNotes = async () => {
  const db = await getDB();
  return db.notes;
}

export const findNotes = async (filter) => {
  const notes = await getAllNotes();
  return notes.filter(note => note.content.toLowerCase().includes(filter.toLowerCase()));
}

export const removeNote = async (id) => {
  const notes = await getAllNotes();
  const match = notes.find(note => note.id === id);

  if (!match) {
    return;
  }

  const newNotes = notes.filter(note => note.id !== id);
  await saveDB({ notes: newNotes });
  return id;
}

export const removeAllNotes = async () => {
  await saveDB({ notes: [] });
  return true;
}