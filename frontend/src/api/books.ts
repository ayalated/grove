export async function uploadBook(file: File) {
    const fd = new FormData();
    fd.append('file', file);

    const resp = await fetch('/api/books', {
        method: 'POST',
        body: fd
    });

    if (!resp.ok) {
        throw new Error('Upload failed');
    }

    return resp.json(); // { id, title, isVertical }
}