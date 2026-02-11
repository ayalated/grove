import {openDB} from 'idb';

export type StoredBook = {
    id: string;
    title: string;
    epubBlob: Blob;
    opfPath: string;
    manifest: Array<{
        id: string;
        href: string;
        mediaType: string;
        properties?: string;
    }>;
    spine: Array<{
        idref: string;
        linear?: string | null;
    }>;
    toc: Array<{
        id: string;
        label: string;
        href: string;
    }>;
    coverBlob?: Blob | null;
    isVertical?: boolean;
    createdAt: number;
};

export const db = await openDB('liora-reader', 3, {
    async upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('books')) {
            db.createObjectStore('books', {keyPath: 'id'});
        }

        if (oldVersion < 2) {
            const store = transaction.objectStore('books');
            let cursor = await store.openCursor();
            while (cursor) {
                const value = cursor.value;
                if (value && 'coverUrl' in value) {
                    delete value.coverUrl;
                    if (!('coverBlob' in value)) {
                        value.coverBlob = null;
                    }
                    await cursor.update(value);
                }
                cursor = await cursor.continue();
            }
        }

        if (oldVersion < 3) {
            const store = transaction.objectStore('books');
            let cursor = await store.openCursor();
            while (cursor) {
                const value = cursor.value;
                if (value && 'chapters' in value) {
                    delete value.chapters;
                }
                await cursor.update(value);
                cursor = await cursor.continue();
            }
        }
    }
});

export async function saveBook(book: StoredBook) {
    await db.put('books', book);
}

export async function getAllBooks(): Promise<StoredBook[]> {
    return await db.getAll('books');
}

export async function getBook(id: string): Promise<StoredBook | undefined> {
    return await db.get('books', id);
}
