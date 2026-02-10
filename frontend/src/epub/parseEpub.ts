import JSZip from 'jszip';

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

    // ……（spine / chapters 和之前一样）

    return {
        id: crypto.randomUUID(),
        title,
        coverBlob,

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
