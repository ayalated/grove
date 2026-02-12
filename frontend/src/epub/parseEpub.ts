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

type NormalizedTocItem = {
    title: string;
    href: string;
    spineIndex: number;
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
    const toc = await extractToc(zip, basePath, manifest, spine);

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
    manifest: ManifestItem[],
    spine: SpineItem[]
): Promise<TocItem[]> {
    const spinePathIndexMap = buildSpinePathIndexMap(basePath, manifest, spine);

    const navItem = manifest.find((item) => item.properties?.split(' ').includes('nav'));
    if (navItem) {
        const navFilePath = resolvePath(basePath, navItem.href);
        const navFile = zip.file(navFilePath);
        if (navFile) {
            const navHtml = await navFile.async('string');
            const navDoc = new DOMParser().parseFromString(navHtml, 'text/html');

            const navLinks = Array.from(navDoc.querySelectorAll('nav a[href]'));
            const normalized = normalizeTocLinks(navLinks, navFilePath, spinePathIndexMap);
            if (normalized.length > 0) {
                return toStoredToc(normalized);
            }
        }
    }

    const ncxToc = await extractNcxToc(zip, basePath, manifest, spinePathIndexMap);
    if (ncxToc.length > 0) {
        return toStoredToc(ncxToc);
    }

    const fallbackToc = await extractFallbackToc(zip, basePath, manifest, spinePathIndexMap);
    return toStoredToc(fallbackToc);
}

async function extractNcxToc(
    zip: JSZip,
    basePath: string,
    manifest: ManifestItem[],
    spinePathIndexMap: Map<string, number>
): Promise<NormalizedTocItem[]> {
    const ncxItem = manifest.find((item) =>
        item.mediaType === 'application/x-dtbncx+xml' ||
        item.href.toLowerCase().endsWith('.ncx')
    );
    if (!ncxItem) return [];

    const ncxPath = resolvePath(basePath, ncxItem.href);
    const ncxFile = zip.file(ncxPath);
    if (!ncxFile) return [];

    const ncxText = await ncxFile.async('string');
    const ncxDoc = new DOMParser().parseFromString(ncxText, 'application/xml');
    const navPoints = Array.from(ncxDoc.querySelectorAll('navPoint'));
    const tocItems: NormalizedTocItem[] = [];
    const dedupe = new Set<number>();

    for (const navPoint of navPoints) {
        const src = navPoint.querySelector('content')?.getAttribute('src');
        if (!src) continue;

        const title = navPoint.querySelector('text')?.textContent?.trim() || 'Untitled';
        const hrefWithoutHash = src.split('#')[0].split('?')[0];
        const resolvedPath = resolvePath(dirname(ncxPath), hrefWithoutHash);
        const spineIndex = spinePathIndexMap.get(resolvedPath);
        if (spineIndex === undefined || dedupe.has(spineIndex)) continue;

        dedupe.add(spineIndex);
        tocItems.push({
            title,
            href: src,
            spineIndex
        });
    }

    return tocItems;
}

async function extractFallbackToc(
    zip: JSZip,
    basePath: string,
    manifest: ManifestItem[],
    spinePathIndexMap: Map<string, number>
): Promise<NormalizedTocItem[]> {
    const htmlItems = manifest.filter((item) =>
        item.mediaType === 'application/xhtml+xml' ||
        item.mediaType === 'text/html' ||
        item.href.toLowerCase().endsWith('.xhtml') ||
        item.href.toLowerCase().endsWith('.html')
    );

    const candidates: Array<{ path: string; score: number; anchors: HTMLAnchorElement[] }> = [];

    for (const item of htmlItems) {
        const itemPath = resolvePath(basePath, item.href);
        const htmlFile = zip.file(itemPath);
        if (!htmlFile) continue;

        const html = await htmlFile.async('string');
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const title = `${doc.querySelector('title')?.textContent || ''} ${doc.body?.textContent || ''}`.toLowerCase();
        const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'));

        const htmlAnchors = anchors.filter((anchor) => {
            const href = anchor.getAttribute('href') || '';
            return /\.x?html?(#|$)/i.test(href);
        });

        let linksToSpine = 0;
        for (const anchor of htmlAnchors) {
            const href = anchor.getAttribute('href') || '';
            const resolved = resolvePath(dirname(itemPath), href.split('#')[0].split('?')[0]);
            if (spinePathIndexMap.has(resolved)) {
                linksToSpine += 1;
            }
        }

        const hasTocTitle = title.includes('目次') || title.includes('contents');
        const hasManyLinks = htmlAnchors.length >= 5;
        const pointsToSpine = linksToSpine >= 3;

        if (!(hasTocTitle || hasManyLinks || pointsToSpine)) {
            continue;
        }

        const score =
            (hasTocTitle ? 3 : 0) +
            (pointsToSpine ? 2 : 0) +
            Math.min(Math.floor(htmlAnchors.length / 5), 3);

        candidates.push({
            path: itemPath,
            score,
            anchors: htmlAnchors
        });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) return [];

    return normalizeTocLinks(best.anchors, best.path, spinePathIndexMap);
}

function normalizeTocLinks(
    links: Element[],
    sourcePath: string,
    spinePathIndexMap: Map<string, number>
): NormalizedTocItem[] {
    const dedupe = new Set<number>();
    const tocItems: NormalizedTocItem[] = [];

    for (const link of links) {
        const href = link.getAttribute('href');
        if (!href || !/\.x?html?(#|$)/i.test(href)) continue;

        const hrefWithoutHash = href.split('#')[0].split('?')[0];
        const resolvedPath = resolvePath(dirname(sourcePath), hrefWithoutHash);
        const spineIndex = spinePathIndexMap.get(resolvedPath);
        if (spineIndex === undefined || dedupe.has(spineIndex)) continue;

        dedupe.add(spineIndex);
        tocItems.push({
            title: link.textContent?.trim() || `Chapter ${spineIndex + 1}`,
            href,
            spineIndex
        });
    }

    return tocItems.sort((a, b) => a.spineIndex - b.spineIndex);
}

function toStoredToc(items: NormalizedTocItem[]): TocItem[] {
    return items.map((item, index) => ({
        id: `toc-${index + 1}`,
        label: item.title,
        href: item.href
    }));
}

function buildSpinePathIndexMap(
    basePath: string,
    manifest: ManifestItem[],
    spine: SpineItem[]
): Map<string, number> {
    const manifestMap = new Map(manifest.map((item) => [item.id, item]));
    const map = new Map<string, number>();

    spine.forEach((spineItem, index) => {
        const manifestItem = manifestMap.get(spineItem.idref);
        if (!manifestItem) return;

        map.set(resolvePath(basePath, manifestItem.href), index);
    });

    return map;
}

function dirname(path: string): string {
    const idx = path.lastIndexOf('/');
    if (idx < 0) return '';
    return path.slice(0, idx + 1);
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
