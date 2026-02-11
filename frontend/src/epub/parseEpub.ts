import JSZip from 'jszip';

type ParsedChapter = {
    id: string;
    title: string;
    html: string;
};

export async function parseEpub(file: File) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    // container.xml
    const containerXml = await zip.file('META-INF/container.xml')!.async('string');
    const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const opfPath = containerDoc.querySelector('rootfile')!.getAttribute('full-path')!;

    const opfText = await zip.file(opfPath)!.async('string');
    const opfDoc = new DOMParser().parseFromString(opfText, 'application/xml');

    // ✅ 书名（去掉 .epub 兜底）
    const rawTitle =
        opfDoc.querySelector('metadata > dc\\:title')?.textContent;

    const title =
        rawTitle && rawTitle.trim()
            ? rawTitle.trim()
            : file.name.replace(/\.epub$/i, '');

    // base path
    const basePath = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

    // ✅ 封面
    const coverHref = findCoverHref(opfDoc);
    const coverBlob = coverHref
        ? await extractCover(zip, basePath, coverHref)
        : null;

    const chapters = await extractChapters(zip, basePath, opfDoc);

    // ……（spine / chapters 和之前一样）

    return {
        id: crypto.randomUUID(),
        title,
        coverBlob,
        chapters,

        // spine,
        // chapters,
        // isVertical,
        createdAt: Date.now()
    };
}
function detectVertical(htmlList: string[]) {
    return htmlList.some(html =>
        html.includes('writing-mode: vertical') ||
        html.includes('writing-mode:vertical')
    );
}

function findCoverHref(opfDoc: Document): string | null {
    // 方式 A：properties="cover-image"
    const coverItem = opfDoc.querySelector(
        'manifest > item[properties~="cover-image"]'
    );
    if (coverItem) {
        return coverItem.getAttribute('href');
    }

    // 方式 B：meta name="cover"
    const metaCover = opfDoc.querySelector(
        'metadata > meta[name="cover"]'
    );
    if (metaCover) {
        const coverId = metaCover.getAttribute('content');
        const item = opfDoc.querySelector(
            `manifest > item[id="${coverId}"]`
        );
        if (item) {
            return item.getAttribute('href');
        }
    }

    return null;
}


async function extractCover(
    zip: JSZip,
    basePath: string,
    coverHref: string
): Promise<Blob | null> {
    const file = zip.file(basePath + coverHref);
    if (!file) return null;

    return await file.async('blob');
}

async function extractChapters(
    zip: JSZip,
    basePath: string,
    opfDoc: Document
): Promise<ParsedChapter[]> {
    const manifest = new Map<string, string>();
    const manifestItems = opfDoc.querySelectorAll('manifest > item');

    manifestItems.forEach((item) => {
        const id = item.getAttribute('id');
        const href = item.getAttribute('href');
        if (id && href) {
            manifest.set(id, href);
        }
    });

    const spineItems = opfDoc.querySelectorAll('spine > itemref');
    const chapters: ParsedChapter[] = [];

    for (let index = 0; index < spineItems.length; index += 1) {
        const idref = spineItems[index].getAttribute('idref');
        if (!idref) continue;

        const href = manifest.get(idref);
        if (!href) continue;

        const chapterPath = resolvePath(basePath, href);
        const chapterFile = zip.file(chapterPath);
        if (!chapterFile) continue;

        const html = await chapterFile.async('string');
        const title = extractHtmlTitle(html) ?? `Chapter ${index + 1}`;

        chapters.push({
            id: idref,
            title,
            html
        });
    }

    return chapters;
}

function resolvePath(basePath: string, href: string): string {
    const combined = `${basePath}${href}`;
    const rawParts = combined.split('/');
    const normalized: string[] = [];

    for (const part of rawParts) {
        if (!part || part === '.') continue;
        if (part === '..') {
            normalized.pop();
            continue;
        }
        normalized.push(part);
    }

    return normalized.join('/');
}

function extractHtmlTitle(html: string): string | null {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = doc.querySelector('title')?.textContent?.trim();
    return title || null;
}
