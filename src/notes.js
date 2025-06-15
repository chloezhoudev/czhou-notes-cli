import { requireUserSession } from './users.js';
import {
  createNote,
  getAllNotesForUser,
  findNotesByContent,
  findNotesByTags,
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

  // Search both content and tags, then combine and deduplicate results
  const [contentResults, tagResults] = await Promise.all([
    findNotesByContent(session.id, filter),
    findNotesByTags(session.id, [filter])
  ]);

  if (contentResults.error) {
    throw new Error(`Failed to search notes by content: ${contentResults.error.message}`);
  }

  if (tagResults.error) {
    throw new Error(`Failed to search notes by tags: ${tagResults.error.message}`);
  }

  const contentNotes = contentResults.data || [];
  const tagNotes = tagResults.data || [];

  // Combine results and remove duplicates based on note ID
  const allNotes = [...contentNotes, ...tagNotes];
  const uniqueNotes = allNotes.filter((note, index, arr) =>
    arr.findIndex(n => n.id === note.id) === index
  );

  return uniqueNotes;
}

export const removeAllNotes = async () => {
  const session = await requireUserSession();

  const { error } = await removeAllNotesForUser(session.id);

  if (error) {
    throw new Error(`Failed to remove all notes: ${error.message}`);
  }

  return true;
}

export const removeNote = async (identifier) => {
  const session = await requireUserSession();

  let noteId = identifier;

  // Check if identifier is a number (index) vs UUID
  if (/^-?\d+$/.test(identifier)) {
    // It's a number - treat as index
    const index = parseInt(identifier) - 1; // Convert to 0-based index

    if (index < 0) {
      throw new Error('Note index must be 1 or greater');
    }

    // Get all notes to find the note at this index
    const { data: notes, error: fetchError } = await getAllNotesForUser(session.id);

    if (fetchError) {
      throw new Error(`Failed to fetch notes: ${fetchError.message}`);
    }

    if (!notes || notes.length === 0) {
      throw new Error('No notes found');
    }

    if (index >= notes.length) {
      throw new Error(`Note index ${identifier} not found. You have ${notes.length} notes.`);
    }

    // Get the actual UUID from the indexed note
    noteId = notes[index].id;
  }

  // Now remove by UUID (works for both direct UUID and index-converted UUID)
  const { data: removedNote, error } = await removeNoteById(noteId, session.id);

  if (error) {
    throw new Error(`Failed to remove note: ${error.message}`);
  }

  return removedNote ? removedNote.id : null;
}