import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { hashPassword } from "../utils/password.js";
import type { User } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "users.json");

interface DataFile {
  users: User[];
}

// Serializes all reads/writes so concurrent requests can't interleave file access.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.catch(() => undefined);
  return result;
}

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  let needsSeed = false;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as DataFile;
    if (!parsed || !Array.isArray(parsed.users)) {
      needsSeed = true;
    }
  } catch {
    needsSeed = true;
  }

  if (needsSeed) {
    const now = new Date().toISOString();
    const admin: User = {
      id: uuidv4(),
      username: "admin",
      passwordHash: await hashPassword("admin123"),
      fullName: "Administrator",
      role: "admin",
      createdAt: now,
      updatedAt: now,
    };
    await writeFileAtomic({ users: [admin] });
  }
}

async function writeFileAtomic(data: DataFile): Promise<void> {
  const tmpFile = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmpFile, DATA_FILE);
}

async function readFileRaw(): Promise<DataFile> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as DataFile;
}

export function init(): Promise<void> {
  return enqueue(() => ensureDataFile());
}

export function readUsers(): Promise<User[]> {
  return enqueue(async () => {
    const data = await readFileRaw();
    return data.users;
  });
}

export function getUserById(id: string): Promise<User | undefined> {
  return enqueue(async () => {
    const data = await readFileRaw();
    return data.users.find((u) => u.id === id);
  });
}

export function getUserByUsername(username: string): Promise<User | undefined> {
  return enqueue(async () => {
    const data = await readFileRaw();
    return data.users.find((u) => u.username === username);
  });
}

export function addUser(user: User): Promise<User> {
  return enqueue(async () => {
    const data = await readFileRaw();
    data.users.push(user);
    await writeFileAtomic(data);
    return user;
  });
}

export function updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
  return enqueue(async () => {
    const data = await readFileRaw();
    const index = data.users.findIndex((u) => u.id === id);
    if (index === -1) return undefined;

    data.users[index] = { ...data.users[index], ...updates, id: data.users[index].id };
    await writeFileAtomic(data);
    return data.users[index];
  });
}

export function deleteUser(id: string): Promise<boolean> {
  return enqueue(async () => {
    const data = await readFileRaw();
    const index = data.users.findIndex((u) => u.id === id);
    if (index === -1) return false;

    data.users.splice(index, 1);
    await writeFileAtomic(data);
    return true;
  });
}

export function countAdmins(users: User[]): number {
  return users.filter((u) => u.role === "admin").length;
}
