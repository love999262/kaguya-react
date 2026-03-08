type JokeAPIResponse = {
    success?: boolean;
    data?: {
        content?: string;
        text?: string;
        joke?: string;
    };
};

type JokeAPISource = {
    url: string;
    parser: (data: unknown) => string | null;
};

const jsonpRequest = <T>(url: string, callbackParam: string = 'callback'): Promise<T> => {
    return new Promise((resolve, reject) => {
        const callbackName = `jsonp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        
        const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error('JSONP request timeout'));
        }, 10000);

        const cleanup = () => {
            window.clearTimeout(timeout);
            delete (window as any)[callbackName];
            const script = document.getElementById(callbackName);
            if (script && script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };

        (window as any)[callbackName] = (data: T) => {
            cleanup();
            resolve(data);
        };

        const script = document.createElement('script');
        script.id = callbackName;
        script.src = url.includes('?')
            ? `${url}&${callbackParam}=${callbackName}`
            : `${url}?${callbackParam}=${callbackName}`;
        script.onerror = () => {
            cleanup();
            reject(new Error('JSONP request failed'));
        };

        document.body.appendChild(script);
    });
};

const shuffleArray = <T>(array: T[]): T[] => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

const parseVvhanJoke = (data: unknown): string | null => {
    const response = data as JokeAPIResponse;
    if (response?.success && response?.data?.content) {
        return response.data.content.trim();
    }
    if (response?.success && response?.data?.text) {
        return response.data.text.trim();
    }
    return null;
};

const JOKE_API_SOURCES: JokeAPISource[] = [
    {
        url: 'https://api.vvhan.com/api/text/joke',
        parser: parseVvhanJoke,
    },
    {
        url: 'https://api.vvhan.com/api/joke',
        parser: parseVvhanJoke,
    },
    {
        url: 'https://api.vvhan.com/api/text/one',
        parser: parseVvhanJoke,
    },
    {
        url: 'https://api.vvhan.com/api/text/dujitang',
        parser: parseVvhanJoke,
    },
    {
        url: 'https://api.vvhan.com/api/text/caixi',
        parser: parseVvhanJoke,
    },
];

const fetchFromAPI = async (source: JokeAPISource): Promise<string | null> => {
    try {
        const response = await jsonpRequest<unknown>(source.url);
        const joke = source.parser(response);
        if (joke && joke.length > 0 && joke.length < 500) {
            return joke;
        }
    } catch {
    }
    return null;
};

export const fetchJokeFromAPI = async (): Promise<string | null> => {
    const shuffledSources = shuffleArray(JOKE_API_SOURCES);
    
    for (const source of shuffledSources) {
        const joke = await fetchFromAPI(source);
        if (joke) {
            return joke;
        }
    }
    
    return null;
};

export { jsonpRequest };
