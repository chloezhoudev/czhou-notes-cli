import { supabase } from './supabase.js';

// ============================================================================
// USER OPERATIONS
// ============================================================================

export const createUser = async (username) => {
  const { data, error } = await supabase
    .from('users')
    .insert([{ username }])
    .select()
    .single();

  return { data, error };
};

export const findUserById = async (id) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  return { data, error };
};

export const findUserByUsername = async (username) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  return { data, error };
};

// ============================================================================
// NOTE OPERATIONS
// ============================================================================

export const createNote = async (userId, content, tags = []) => {
  const { data, error } = await supabase
    .from('notes')
    .insert([{ user_id: userId, content, tags }])
    .select()
    .single();

  return { data, error };
};

export const getAllNotesForUser = async (userId) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId);

  return { data, error };
};

export const findNotesByContent = async (userId, searchTerm) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .ilike('content', `%${searchTerm}%`);

  return { data, error };
};

export const removeNoteById = async (noteId, userId) => {
  const { data, error } = await supabase
    .from('notes')
    .delete()
    .match({ id: noteId, user_id: userId })
    .select()
    .single()

  return { data, error };
};

export const removeAllNotesForUser = async (userId) => {
  const { data, error } = await supabase
    .from('notes')
    .delete()
    .eq('user_id', userId)
    .select()

  return { data, error };
};

export const findNotesByTags = async (userId, tags) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .overlaps('tags', tags)

    return { data, error };
};

// ============================================================================
// ADDITIONAL RECOMMENDED OPERATIONS
// ============================================================================

export const findNoteById = async (noteId, userId) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .match({ id: noteId, user_id: userId })
    .single()

  return { data, error };
};

export const updateNote = async (noteId, userId, updates) => {
  // updates could be:
  // { content: "new content" }
  // { tags: ["new", "tags"] }
  // { content: "new content", tags: ["new", "tags"] }
  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .match({ id: noteId, user_id: userId })
    .select()
    .single()

  return { data, error };
};