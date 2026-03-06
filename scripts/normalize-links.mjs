import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SEARCH_FILE = path.join(ROOT, 'searchengine-list.json');
const WEBSITES_FILE = path.join(ROOT, 'websites.json');

const toHttps = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim().replace(/^http:\/\//i, 'https://');
};

const normalizeSearchEngines = () => {
    const source = JSON.parse(fs.readFileSync(SEARCH_FILE, 'utf8'));
    const dedup = new Set();
    const normalized = source
        .map((item) => {
            return {
                name: typeof item.name === 'string' ? item.name.trim() : '',
                url: toHttps(item.url),
                href: toHttps(item.href),
            };
        })
        .filter((item) => item.name && item.url && item.href)
        .filter((item) => {
            const key = `${item.name}|${item.url}|${item.href}`;
            if (dedup.has(key)) {
                return false;
            }
            dedup.add(key);
            return true;
        });

    fs.writeFileSync(SEARCH_FILE, `${JSON.stringify(normalized, null, 2)}\n`);
};

const normalizeWebsites = () => {
    const source = JSON.parse(fs.readFileSync(WEBSITES_FILE, 'utf8'));
    const normalized = source.map((section) => {
        const seen = new Set();
        const content = Array.isArray(section.content) ? section.content : [];
        const normalizedContent = content
            .map((item) => {
                return {
                    name: typeof item.name === 'string' ? item.name.trim() : '',
                    url: toHttps(item.url),
                };
            })
            .filter((item) => item.name && item.url)
            .filter((item) => {
                const key = `${item.name}|${item.url}`;
                if (seen.has(key)) {
                    return false;
                }
                seen.add(key);
                return true;
            });

        return {
            title: typeof section.title === 'string' ? section.title.trim() : 'Untitled',
            content: normalizedContent,
        };
    });

    fs.writeFileSync(WEBSITES_FILE, `${JSON.stringify(normalized, null, 2)}\n`);
};

normalizeSearchEngines();
normalizeWebsites();
