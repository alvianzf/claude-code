import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");

export interface JsonFileStore<TData> {
  /** Serializes a task against this store's queue, returning its result. */
  enqueue<T>(task: () => Promise<T>): Promise<T>;
  /** Reads the file, seeding it via `seed()` first if missing/invalid. */
  readFileRaw(): Promise<TData>;
  /** Atomically writes data to the file (temp file + rename). */
  writeFileAtomic(data: TData): Promise<void>;
  /** Ensures the data file exists and is valid, seeding it if necessary. */
  ensureDataFile(): Promise<void>;
  /** Absolute path to the underlying data file. */
  filePath: string;
}

/**
 * Creates a JSON-file-backed store with atomic writes and an in-process
 * write queue, so concurrent requests can't interleave file access.
 *
 * @param fileName - file name within `server/data/` (e.g. "users.json")
 * @param isValid - returns true if the parsed JSON has the expected shape
 * @param seed - returns the data to write if the file is missing/invalid
 */
export function createJsonFileStore<TData>(
  fileName: string,
  isValid: (parsed: unknown) => parsed is TData,
  seed: () => Promise<TData> | TData
): JsonFileStore<TData> {
  const filePath = path.join(DATA_DIR, fileName);

  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task, task);
    queue = result.catch(() => undefined);
    return result;
  }

  async function writeFileAtomic(data: TData): Promise<void> {
    const tmpFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tmpFile, filePath);
  }

  async function ensureDataFile(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });

    let needsSeed = false;
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (!isValid(parsed)) {
        needsSeed = true;
      }
    } catch {
      needsSeed = true;
    }

    if (needsSeed) {
      const data = await seed();
      await writeFileAtomic(data);
    }
  }

  async function readFileRaw(): Promise<TData> {
    await ensureDataFile();
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as TData;
  }

  return {
    enqueue,
    readFileRaw,
    writeFileAtomic,
    ensureDataFile,
    filePath,
  };
}
