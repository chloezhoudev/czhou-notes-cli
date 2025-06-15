import { requireUserSession } from './users.js';
import {
  createNote,
  getAllNotesForUser,
  findNotesByContent,
  removeNoteById,
  removeAllNotesForUser
} from "./supabase-db.js";

export const addNote = async (note, tags) => {
  const session = await requireUserSession();

  const { data: savedNote, error } = await createNote(session.id, note, tags);

  if (error) {
    throw new Error(`Failed to add note: ${error.message}`);
  }

  return savedNote;
}

export const getAllNotes = async () => {
  const session = await requireUserSession();

  const { data: notes, error } = await getAllNotesForUser(session.id);

  if (error) {
    throw new Error(`Failed to get notes: ${error.message}`);
  }

  return notes || [];

}

export const findNotes = async (filter) => {
  const session = await requireUserSession();

  const { data: notes, error } = await findNotesByContent(session.id, filter);

  if (error) {
    throw new Error(`Failed to find notes: ${error.message}`);
  }

  return notes || [];
}

export const removeNote = async (id) => {
  const session = await requireUserSession();

  const { data: removedNote, error } = await removeNoteById(id, session.id);

  if (error) {
    throw new Error(`Failed to remove note: ${error.message}`);
  }

  return removedNote ? removedNote.id : null;
}

export const removeAllNotes = async () => {
  const session = await requireUserSession();

  const { error } = await removeAllNotesForUser(session.id);

  if (error) {
    throw new Error(`Failed to remove all notes: ${error.message}`);
  }

  return true;
}