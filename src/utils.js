import { findUserByUsername } from './supabase-db.js';

export const listNotes = (notes) => {
  notes.forEach((note, index) => {
    console.log('\n');
    console.log(`\n[${index + 1}]`);
    console.log('note:', note.content);
    console.log('id:', note.id);
    console.log('tags:', note.tags.join(', '));
  })
}

export const validateUsername = (username) => {
  const normalized = username.trim();

  if (normalized.length === 0) {
    throw new Error('Username cannot be empty or contain only whitespace');
  }

  if (normalized.length < 2) {
    throw new Error('Username must be at least 2 characters long');
  }

  if (normalized.length > 50) {
    throw new Error('Username cannot be longer than 50 characters');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
  }

  return normalized;
};

export const isSessionValid = async (session) => {
  try {
    if (!session || !session.username || !session.id) {
      return false;
    }

    const { data: user, error } = await findUserByUsername(session.username);

    if (error || !user || user.id !== session.id) {
      return false;
    }

    return true;
  } catch (error) {
    console.log('Session validation failed:', error.message);
    return false;
  }
};

export const isNumericIndex = (str) => {
  return /^\d+$/.test(str);
};