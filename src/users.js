import { mkdir, writeFile, readFile, access, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import * as os from 'node:os';


const homeDir = os.homedir();
const USER_SESSION_PATH = join(homeDir, '.note-cli', 'user.json');

const ensureUserDir = async () => {
  await mkdir(dirname(USER_SESSION_PATH), { recursive: true });
};

export const saveUserSession = async (user) => {
  try {
    await ensureUserDir();
    const sessionData = {
      id: user.id,
      username: user.username,
      loginTime: new Date().toISOString()
    }

    await writeFile(USER_SESSION_PATH, JSON.stringify(sessionData, null, 2), 'utf-8');
    return sessionData;
  } catch (error) {
    throw new Error(`Could not save user session: ${error.message}`);
  }
}

export const getUserSession = async () => {
  try {
    await access(USER_SESSION_PATH);
    const sessionData = await readFile(USER_SESSION_PATH, 'utf-8');
    return JSON.parse(sessionData);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // Expected: file doesn't exist = no user session
    }

    throw new Error(`Could not read user session: ${error.message}`);
  }
}

export const clearUserSession = async () => {
  try {
    await unlink(USER_SESSION_PATH);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true; // File doesn't exist = mission accomplished anyway
    }

    throw new Error(`Could not clear user session: ${error.message}`);
  }
}

// a guard/validation function for commands that need the user to be logged in before they can execute.
export const requireUserSession = async () => {
  const session = await getUserSession(); // Any error here bubbles up automatically

  if (!session) {
    throw new Error('No user session found. Please run "note setup <username>" first.');
  }

  return session;
}
