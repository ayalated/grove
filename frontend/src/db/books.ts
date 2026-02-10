import {openDB} from 'idb';

export const db = await openDB('liora-reader', 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
            db.createObjectStore('books', {keyPath: 'id'});
        }
    }
});

export async function saveBook(book) {
    await db.put('books', book);
}

export async function getAllBooks() {
    return await db.getAll('books');
}

export async function getBook(id: string) {
    return await db.get('books', id);
}