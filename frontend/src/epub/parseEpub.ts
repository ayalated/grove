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
    children?: TocItem[];
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
    const isVertical = await detectVerticalWriting(zip, basePath, manifest, spine);

    return {
        id: crypto.randomUUID(),
        title,
        epubBlob: file,
        opfPath,
        manifest,
        spine,
        toc,
        coverBlob,
        isVertical,
        createdAt: Date.now()
    };
}


async function detectVerticalWriting(
    zip: JSZip,
    basePath: string,
    manifest: ManifestItem[],
    spine: SpineItem[]
): Promise<boolean> {
    const opfFiles = zip.file(/\.opf$/i);
    for (const opfFile of opfFiles) {
        const opfText = await opfFile.async('string');
        const opfDoc = new DOMParser().parseFromString(opfText, 'application/xml');
        if (hasVerticalMetadata(opfDoc)) {
            return true;
        }
    }

    const cssItems = manifest.filter((item) => item.mediaType.toLowerCase() === 'text/css');
    const verticalCssPatterns = [
        /writing-mode\s*:\s*vertical-rl/i,
        /writing-mode\s*:\s*vertical-lr/i,
        /-webkit-writing-mode\s*:\s*vertical-rl/i,
        /-webkit-writing-mode\s*:\s*tb-rl/i
    ];

    for (const cssItem of cssItems) {
        const cssPath = resolvePath(basePath, cssItem.href);
        const cssFile = zip.file(cssPath);
        if (!cssFile) continue;

        const cssText = await cssFile.async('string');
        if (verticalCssPatterns.some((pattern) => pattern.test(cssText))) {
            return true;
        }
    }

    const firstSpineItems = spine.slice(0, 3);
    for (const spineItem of firstSpineItems) {
        const manifestItem = manifest.find((item) => item.id === spineItem.idref);
        if (!manifestItem) continue;

        const docPath = resolvePath(basePath, manifestItem.href);
        const docFile = zip.file(docPath);
        if (!docFile) continue;

        const htmlText = await docFile.async('string');
        const htmlDoc = new DOMParser().parseFromString(htmlText, 'text/html');

        const styleMatch = htmlDoc.querySelector('[style*="writing-mode: vertical-rl" i]');
        if (styleMatch) {
            return true;
        }

        const classMatch = htmlDoc.querySelector('[class*="vertical" i]');
        if (classMatch) {
            return true;
        }
    }

    return false;
}

function hasVerticalMetadata(opfDoc: Document): boolean {
    const renditionLayoutMeta = opfDoc.querySelector('metadata > meta[property="rendition:layout"]')?.textContent?.trim().toLowerCase();
    if (renditionLayoutMeta === 'pre-paginated') {
        return true;
    }

    const writingModeMeta = opfDoc.querySelector('metadata > meta[property="writing-mode"]')?.textContent?.trim().toLowerCase();
    if (writingModeMeta === 'vertical-rl') {
        return true;
    }

    const primaryWritingModeMeta = opfDoc.querySelector('metadata > meta[name="primary-writing-mode"]')?.getAttribute('content')?.trim().toLowerCase();
    if (primaryWritingModeMeta === 'vertical-rl') {
        return true;
    }

    return false;
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
    // Priority order:
    // 1) EPUB3 nav document
    // 2) EPUB2 toc.ncx
    // 3) Fallback HTML/XHTML TOC scan
    // 4) Spine-based generation
    const spineLookup = buildSpineLookup(basePath, manifest, spine);

    const navToc = await extractNavToc(zip, basePath, manifest, spineLookup);
    if (navToc.length > 0) return toStoredToc(navToc);

    const ncxToc = await extractNcxToc(zip, basePath, manifest, spineLookup);
    if (ncxToc.length > 0) return ncxToc;

    const fallbackToc = await extractFallbackHtmlToc(zip, basePath, manifest, spineLookup);
    if (fallbackToc.length > 0) return toStoredToc(fallbackToc);

    return generateSpineToc(spine, spineLookup);
}

async function extractNavToc(
    zip: JSZip,
    basePath: string,
    manifest: ManifestItem[],
    spineLookup: SpineLookup
): Promise<NormalizedTocItem[]> {
    const navItem = manifest.find((item) => item.properties?.split(' ').includes('nav'));
    if (!navItem) return [];

    const navFilePath = resolvePath(basePath, navItem.href);
    const navFile = zip.file(navFilePath);
    if (!navFile) return [];

    const navHtml = await navFile.async('string');
    const navDoc = new DOMParser().parseFromString(navHtml, 'text/html');
    const navLinks = Array.from(navDoc.querySelectorAll('nav a[href]'));
    return normalizeTocLinks(navLinks, navFilePath, spineLookup);
}

async function extractNcxToc(
    zip: JSZip,
    basePath: string,
    manifest: ManifestItem[],
    spineLookup: SpineLookup
): Promise<TocItem[]> {
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
    // NCX files often define a default namespace, so CSS selectors like
    // querySelector('navPoint') may miss nodes. Use namespace-aware APIs.
    const navMap = ncxDoc.getElementsByTagNameNS('*', 'navMap')[0];
    if (!navMap) return [];

    const dedupe = new Set<string>();
    const rootNavPoints = Array.from(navMap.children).filter(
        (node): node is Element => node.localName === 'navPoint'
    );

    // Recursively parse hierarchical NCX navPoint tree.
    function parseNavPointElement(el: Element, parentId: string): TocItem | null {
        const labelNode = el.getElementsByTagNameNS('*', 'text')[0];
        const contentNode = el.getElementsByTagNameNS('*', 'content')[0];
        const label = labelNode?.textContent?.trim() || 'Untitled';
        const src = contentNode?.getAttribute('src') || '';
        const href = normalizeNcxHref(src, ncxPath, spineLookup);

        const childNodes = Array.from(el.children).filter(
            (child): child is Element => child.localName === 'navPoint'
        );
        const children = childNodes
            .map((child, index) => parseNavPointElement(child, `${parentId}-${index + 1}`))
            .filter((item): item is TocItem => item !== null);

        if (!href && children.length === 0) return null;

        const uniqueKey = href;
        if (uniqueKey && dedupe.has(uniqueKey) && children.length === 0) {
            return null;
        }
        if (uniqueKey) dedupe.add(uniqueKey);

        return {
            id: parentId,
            label,
            href,
            ...(children.length > 0 ? { children } : {})
        };
    }

    return rootNavPoints
        .map((navPoint, index) => parseNavPointElement(navPoint, `toc-${index + 1}`))
        .filter((item): item is TocItem => item !== null);
}

async function extractFallbackHtmlToc(
    zip: JSZip,
    basePath: string,
    manifest: ManifestItem[],
    spineLookup: SpineLookup
): Promise<NormalizedTocItem[]> {
    const htmlItems = manifest.filter((item) =>
        item.mediaType.toLowerCase().includes('html') ||
        item.mediaType.toLowerCase().includes('xhtml') ||
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
            if (spineLookup.pathToSpineIndex.has(resolved)) {
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

    return normalizeTocLinks(best.anchors, best.path, spineLookup);
}

function normalizeTocLinks(
    links: Element[],
    sourcePath: string,
    spineLookup: SpineLookup
): NormalizedTocItem[] {
    const dedupe = new Set<string>();
    const tocItems: NormalizedTocItem[] = [];

    for (const link of links) {
        const href = link.getAttribute('href');
        if (!href || !/\.x?html?(#|$)/i.test(href)) continue;

        const hrefWithoutHash = href.split('#')[0].split('?')[0];
        const resolvedPath = resolvePath(dirname(sourcePath), hrefWithoutHash);
        const spineIndex = spineLookup.pathToSpineIndex.get(resolvedPath);
        if (spineIndex === undefined) continue;

        const manifestHref = spineLookup.spineIndexToManifestHref.get(spineIndex);
        if (!manifestHref) continue;

        const hash = href.includes('#') ? `#${href.split('#').slice(1).join('#')}` : '';
        const fullHref = `${manifestHref}${hash}`;

        if (dedupe.has(fullHref)) continue;
        dedupe.add(fullHref);
        tocItems.push({
            title: link.textContent?.trim() || `Chapter ${spineIndex + 1}`,
            // Store href normalized to OPF-relative manifest href so reader-side
            // TOC->spine matching works for nav/ncx/fallback consistently.
            href: fullHref,
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

function normalizeNcxHref(src: string, ncxPath: string, spineLookup: SpineLookup): string {
    if (!src) return '';

    const srcPath = src.split('#')[0].split('?')[0];
    const resolvedPath = resolvePath(dirname(ncxPath), srcPath);
    const spineIndex = spineLookup.pathToSpineIndex.get(resolvedPath);
    const manifestHref = spineIndex !== undefined
        ? spineLookup.spineIndexToManifestHref.get(spineIndex)
        : undefined;
    const baseHref = manifestHref ?? '';
    const hash = src.includes('#') ? `#${src.split('#').slice(1).join('#')}` : '';
    return `${baseHref}${hash}`;
}

function getSpineIndexByNormalizedHref(href: string, spineLookup: SpineLookup): number | undefined {
    const baseHref = href.split('#')[0].split('?')[0];
    for (const [spineIndex, manifestHref] of spineLookup.spineIndexToManifestHref.entries()) {
        if (manifestHref === baseHref) {
            return spineIndex;
        }
    }
    return undefined;
}

function generateSpineToc(spine: SpineItem[], spineLookup: SpineLookup): TocItem[] {
    return spine
        .map((spineItem, index) => {
            const manifestHref = spineLookup.spineIndexToManifestHref.get(index);
            if (!manifestHref) return null;

            return {
                id: `chapter-${index + 1}`,
                label: `Chapter ${index + 1}`,
                href: manifestHref
            };
        })
        .filter((item): item is TocItem => item !== null);
}

type SpineLookup = {
    pathToSpineIndex: Map<string, number>;
    spineIndexToManifestHref: Map<number, string>;
};

function buildSpineLookup(
    basePath: string,
    manifest: ManifestItem[],
    spine: SpineItem[]
): SpineLookup {
    const manifestMap = new Map(manifest.map((item) => [item.id, item]));
    const pathToSpineIndex = new Map<string, number>();
    const spineIndexToManifestHref = new Map<number, string>();

    spine.forEach((spineItem, index) => {
        const manifestItem = manifestMap.get(spineItem.idref);
        if (!manifestItem) return;

        pathToSpineIndex.set(resolvePath(basePath, manifestItem.href), index);
        spineIndexToManifestHref.set(index, manifestItem.href);
    });

    return {
        pathToSpineIndex,
        spineIndexToManifestHref
    };
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
