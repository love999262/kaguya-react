const utils = {
    getRandomColor() {
        let r: string | number = Math.floor(Math.random() * 256);
        let g: string | number = Math.floor(Math.random() * 256);
        let b: string | number = Math.floor(Math.random() * 256);
        if (r < 16) {
            r = `0${r.toString(16)}`;
        } else {
            r = r.toString(16);
        }
        if (g < 16) {
            g = `0${g.toString(16)}`;
        } else {
            g = g.toString(16);
        }
        if (b < 16) {
            b = `0${b.toString(16)}`;
        } else {
            b = b.toString(16);
        }
        return `#${r}${g}${b}`;
    },
    openExternalUrl(url: string) {
        try {
            const parsed = new URL(url, window.location.href);
            const isSafeProtocol = parsed.protocol === 'http:' || parsed.protocol === 'https:';
            if (!isSafeProtocol) {
                return;
            }
            const newWindow = window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
            if (newWindow) {
                newWindow.opener = null;
            }
        } catch (error) {
            // Ignore malformed URLs from external data sources.
        }
    },
};

export default utils;
