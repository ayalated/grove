import JSZip from 'jszip';

type ManifestItem = {
    id: string;
    href: string;
    mediaType: string;
    properties?: string;
};

type SpineItem = {
    idref: string;
    linear?: string | null;
};

type TocItem = {
    id: string;
    label: string;
    href: string;
};

export async function parseEpub(file: File) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const containerXml = await zip.file('META-INF/container.xml')!.async('string');
    const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const opfPath = containerDoc.querySelector('rootfile')!.getAttribute('full-path')!;

    const opfText = await zip.file(opfPath)!.async('string');
    const opfDoc = new DOMParser().parseFromString(opfText, 'application/xml');

    const rawTitle = opfDoc.querySelector('metadata > dc\\:title')?.textContent;
    const title = rawTitle && rawTitle.trim()
        ? rawTitle.trim()
        : file.name.replace(/\.epub$/i, '');

    const basePath = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

    const coverHref = findCoverHref(opfDoc);
    const coverBlob = coverHref
        ? await extractCover(zip, basePath, coverHref)
        : null;

    const manifest = extractManifest(opfDoc);
    const spine = extractSpine(opfDoc);
    const toc = await extractToc(zip, basePath, manifest);

    return {
        id: crypto.randomUUID(),
        title,
        epubBlob: file,
        opfPath,
        manifest,
        spine,
        toc,
        coverBlob,
        createdAt: Date.now()
    };
}

function findCoverHref(opfDoc: Document): string | null {
    const coverItem = opfDoc.querySelector(
        'manifest > item[properties~="cover-image"]'
    );
    if (coverItem) {
        return coverItem.getAttribute('href');
    }

    const metaCover = opfDoc.querySelector(
        'metadata > meta[name="cover"]'
    );
    if (metaCover) {
        const coverId = metaCover.getAttribute('content');
        const item = opfDoc.querySelector(`manifest > item[id="${coverId}"]`);
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
    const file = zip.file(resolvePath(basePath, coverHref));
    if (!file) return null;

    return await file.async('blob');
}

function extractManifest(opfDoc: Document): ManifestItem[] {
    const result: ManifestItem[] = [];
    const items = Array.from(opfDoc.querySelectorAll('manifest > item'));

    for (const item of items) {
        const id = item.getAttribute('id');
        const href = item.getAttribute('href');
        const mediaType = item.getAttribute('media-type');
        const properties = item.getAttribute('properties') ?? undefined;

        if (!id || !href || !mediaType) {
            continue;
        }

        result.push({
            id,
            href,
            mediaType,
            properties
        });
    }

    return result;
}

function extractSpine(opfDoc: Document): SpineItem[] {
    const result: SpineItem[] = [];
    const items = Array.from(opfDoc.querySelectorAll('spine > itemref'));

    for (const item of items) {
        const idref = item.getAttribute('idref');
        if (!idref) {
            continue;
        }

        result.push({
            idref,
            linear: item.getAttribute('linear')
        });
    }

    return result;
}

async function extractToc(
    zip: JSZip,
    basePath: string,
    manifest: ManifestItem[]
): Promise<TocItem[]> {
    const navItem = manifest.find((item) => item.properties?.split(' ').includes('nav'));
    if (!navItem) return [];

    const navFile = zip.file(resolvePath(basePath, navItem.href));
    if (!navFile) return [];

    const navHtml = await navFile.async('string');
    const navDoc = new DOMParser().parseFromString(navHtml, 'text/html');

    const links = Array.from(navDoc.querySelectorAll('nav a[href]'));
    return links.map((link, index) => ({
        id: `toc-${index + 1}`,
        label: link.textContent?.trim() || `Chapter ${index + 1}`,
        href: link.getAttribute('href') || ''
    }));
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
