/**
 * User-puzzle storage helpers.
 *
 * Drawings the child saved in "My Works" can be cloned here so they can be
 * played as puzzles. This folder is SEPARATE from the my_works/ gallery —
 * deleting a user puzzle never touches the original saved drawing.
 */
import * as FileSystem from "expo-file-system";

export const USER_PUZZLES_DIR =
  (FileSystem.documentDirectory ?? "") + "user_puzzles/";

export async function ensureUserPuzzlesDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(USER_PUZZLES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(USER_PUZZLES_DIR, {
      intermediates: true,
    });
  }
}

/** Returns user-puzzle file URIs, newest first. */
export async function listUserPuzzles(): Promise<string[]> {
  try {
    await ensureUserPuzzlesDir();
    const files = await FileSystem.readDirectoryAsync(USER_PUZZLES_DIR);
    return files
      .filter((f) => f.endsWith(".png"))
      .sort()
      .reverse()
      .map((name) => USER_PUZZLES_DIR + name);
  } catch {
    return [];
  }
}

/** Copy a saved drawing into the user-puzzles folder. Original is untouched. */
export async function copyToUserPuzzles(srcUri: string): Promise<void> {
  await ensureUserPuzzlesDir();
  const filename = `puzzle_user_${Date.now()}.png`;
  await FileSystem.copyAsync({ from: srcUri, to: USER_PUZZLES_DIR + filename });
}
