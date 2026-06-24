// src/postsDB.js — IndexedDB wrapper for scraped posts
// Stores posts keyed by username so they survive page refreshes.

const DB_NAME = "oxinap_posts";
const DB_VER  = 1;
const STORE   = "ig_posts";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // Single keyPath "uid" = "<username>|||<id>" — avoids compound key delete issues
        const store = db.createObjectStore(STORE, { keyPath: "uid" });
        store.createIndex("by_username", "username", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function makeUid(username, id) {
  return `${username}|||${id}`;
}

/** Save an array of posts for a username (upsert). */
export async function saveIgPosts(username, posts) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const post of posts) {
    store.put({ ...post, username, uid: makeUid(username, post.id) });
  }
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

/** Retrieve all stored posts for a username using the index. */
export async function getIgPosts(username) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx    = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const index = store.index("by_username");
    const req   = index.getAll(username);
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => rej(req.error);
  });
}

/** Clear all stored posts for a username using a cursor on the index. */
export async function clearIgPosts(username) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx    = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const index = store.index("by_username");
    const req   = index.openKeyCursor(username);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}
