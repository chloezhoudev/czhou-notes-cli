import { supabase } from './supabase.js';

// Helper function to set the current user context for RLS
const setUserContext = async (username) => {
  const { error } = await supabase.rpc('set_current_user', { username });

  if (error) {
    throw new Error(`Failed to set user context: ${error.message}`);
  }
};

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

export const createNote = async (userId, content, tags = [], username) => {
  // Set user context for RLS
  await setUserContext(username);

  const { data, error } = await supabase
    .from('notes')
    .insert([{ user_id: userId, content, tags }])
    .select()
    .single();

  return { data, error };
};

export const getAllNotesForUser = async (userId, username) => {
  // Set user context for RLS
  await setUserContext(username);

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId);

  return { data, error };
};

export const findNotesByContent = async (userId, searchTerm, username) => {
  // Set user context for RLS
  await setUserContext(username);

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .ilike('content', `%${searchTerm}%`);

  return { data, error };
};

export const removeNoteById = async (noteId, userId, username) => {
  // Set user context for RLS
  await setUserContext(username);

  const { data, error } = await supabase
    .from('notes')
    .delete()
    .match({ id: noteId, user_id: userId })
    .select()
    .single()

  return { data, error };
};

export const removeAllNotesForUser = async (userId, username) => {
  // Set user context for RLS
  await setUserContext(username);

  const { data, error } = await supabase
    .from('notes')
    .delete()
    .eq('user_id', userId)
    .select()

  return { data, error };
};

export const findNotesByTags = async (userId, tags, username) => {
  // Set user context for RLS
  await setUserContext(username);

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

export const findNoteById = async (noteId, userId, username) => {
  // Set user context for RLS
  await setUserContext(username);

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .match({ id: noteId, user_id: userId })
    .single()

  return { data, error };
};

export const updateNote = async (noteId, userId, updates, username) => {
  // Set user context for RLS
  await setUserContext(username);

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