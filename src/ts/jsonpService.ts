// 重新导出笑话服务，保持向后兼容
export {
    getCachedJoke,
    hasJokesCache,
    getJokesCacheInfo,
    clearJokesCache,
    preloadJokes,
    LOCAL_JOKE_FALLBACK,
} from './services/jokeService';

// 为了保持向后兼容，保留 fetchJokeFromAPI 函数
import { getCachedJoke as getJokeFromService } from './services/jokeService';

export async function fetchJokeFromAPI(): Promise<string | null> {
    return getJokeFromService();
}
