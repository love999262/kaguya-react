import * as React from 'react';
import { StateInterface as Props } from './navigator';
import utils from './utils';
import searchEngineData from '../../searchengine-list.json';
import { analyzeSearchContent } from './services/searchAnalysisService';

interface SearchEngleInterface {
    name: string;
    url: string;
    href: string;
}

interface BaiduSuPayload {
    s?: unknown[];
}

interface BaiduSugrecPayload {
    g?: Array<{ q?: unknown }>;
}

const DEFAULT_SEARCH_ENGINE: SearchEngleInterface = {
    name: 'Bing',
    url: 'https://www.bing.com/search?q=',
    href: 'https://www.bing.com/',
};

interface SearchInterface {
    searchEngleList: SearchEngleInterface[];
    searchInterface: string;
    searchBtnHref: string;
    searchBtnName: string;
}

interface StateInterface {
    search: SearchInterface;
    searchArray: string[];
    suggestArray: string[];
    activeSuggestIndex: number;
    inputVal: string;
    showDropMenu: boolean;
    showHistoryPanel: boolean;
    showSuggestPanel: boolean;
    dropMenuMaxHeight: number;
    historyPanelMaxHeight: number;
    suggestPanelMaxHeight: number;
}

class SearchEngle extends React.Component <Props, StateInterface> {
    input: HTMLInputElement | null;
    private barRef: HTMLDivElement | null;
    private dropMenuRef: HTMLUListElement | null;
    private historyPanelRef: HTMLUListElement | null;
    private suggestPanelRef: HTMLUListElement | null;
    private suggestDebounceTimer: number | null;
    private suggestRequestToken: number;

    constructor(props: Props, context: any) {
        super(props, context);
        this.input = null;
        this.barRef = null;
        this.dropMenuRef = null;
        this.historyPanelRef = null;
        this.suggestPanelRef = null;
        this.suggestDebounceTimer = null;
        this.suggestRequestToken = 0;
        this.state = {
            search: {
                searchInterface: DEFAULT_SEARCH_ENGINE.url,
                searchBtnHref: DEFAULT_SEARCH_ENGINE.href,
                searchBtnName: DEFAULT_SEARCH_ENGINE.name,
                searchEngleList: [],
            },
            searchArray: this.loadSearchHistory(),
            suggestArray: [],
            activeSuggestIndex: -1,
            inputVal: '',
            showDropMenu: false,
            showHistoryPanel: false,
            showSuggestPanel: false,
            dropMenuMaxHeight: 300,
            historyPanelMaxHeight: 300,
            suggestPanelMaxHeight: 300,
        };

        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
        this.handleWindowResize = this.handleWindowResize.bind(this);
    }
    
    componentDidMount() {
        const rawSearchEngleList = searchEngineData as SearchEngleInterface[];
        const searchEngleList = this.normalizeSearchEngineList(rawSearchEngleList);
        const searchFromStorage = this.loadSearchEngineFromStorage();
        const initialSearch = this.resolveInitialSearch(searchEngleList, searchFromStorage);

        this.setState({
            search: {
                searchInterface: initialSearch.url,
                searchBtnHref: initialSearch.href,
                searchBtnName: initialSearch.name,
                searchEngleList,
            },
        });

        document.addEventListener('click', this.handleDocumentClick);
        document.addEventListener('keydown', this.handleDocumentKeydown);
        window.addEventListener('resize', this.handleWindowResize);
    }

    componentWillUnmount() {
        document.removeEventListener('click', this.handleDocumentClick);
        document.removeEventListener('keydown', this.handleDocumentKeydown);
        window.removeEventListener('resize', this.handleWindowResize);
        if (this.suggestDebounceTimer !== null) {
            window.clearTimeout(this.suggestDebounceTimer);
            this.suggestDebounceTimer = null;
        }
    }

    private handleWindowResize() {
        if (this.state.showDropMenu) {
            this.updatePanelMaxHeight('drop');
        }
        if (this.state.showHistoryPanel) {
            this.updatePanelMaxHeight('history');
        }
        if (this.state.showSuggestPanel) {
            this.updatePanelMaxHeight('suggest');
        }
    }

    private loadSearchEngineFromStorage() {
        const emptySearch = {
            searchInterface: '',
            searchBtnHref: '',
            searchBtnName: '',
        };
        try {
            const searchEngle = localStorage.getItem('searchEngle');
            if (!searchEngle) {
                return emptySearch;
            }
            const parsed = JSON.parse(searchEngle);
            return {
                searchInterface: typeof parsed.searchInterface === 'string' ? parsed.searchInterface : '',
                searchBtnHref: typeof parsed.searchBtnHref === 'string' ? parsed.searchBtnHref : '',
                searchBtnName: typeof parsed.searchBtnName === 'string' ? parsed.searchBtnName : '',
            };
        } catch (error) {
            return emptySearch;
        }
    }

    private loadSearchHistory() {
        try {
            const searchHistory = localStorage.getItem('searchHistory');
            if (!searchHistory) {
                return [];
            }
            const parsed = JSON.parse(searchHistory);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed.filter((item: any) => typeof item === 'string');
        } catch (error) {
            return [];
        }
    }

    private handleDocumentClick(event: MouseEvent) {
        if (!this.barRef || this.barRef.contains(event.target as Node)) {
            return;
        }
        this.setState({
            showDropMenu: false,
            showHistoryPanel: false,
            showSuggestPanel: false,
            activeSuggestIndex: -1,
        });
    }

    private updatePanelMaxHeight(panelType: 'drop' | 'history' | 'suggest') {
        const panelElement = panelType === 'drop'
            ? this.dropMenuRef
            : (panelType === 'history' ? this.historyPanelRef : this.suggestPanelRef);
        if (!panelElement) {
            return;
        }
        const viewportBottomPadding = 12;
        const panelTop = panelElement.getBoundingClientRect().top;
        const availableHeight = Math.max(120, Math.floor(window.innerHeight - panelTop - viewportBottomPadding));
        const viewportRatioCap = Math.floor(window.innerHeight * 0.72);
        const hardCap = 620;
        const heightCap = Math.max(120, Math.min(viewportRatioCap, hardCap));
        const cappedHeight = Math.min(availableHeight, heightCap);
        const rowHeight = 40;
        const finalHeight = Math.max(120, Math.floor(cappedHeight / rowHeight) * rowHeight);

        if (panelType === 'drop') {
            this.setState({ dropMenuMaxHeight: finalHeight });
        } else if (panelType === 'history') {
            this.setState({ historyPanelMaxHeight: finalHeight });
        } else {
            this.setState({ suggestPanelMaxHeight: finalHeight });
        }
    }

    private normalizeSearchEngineList(list: SearchEngleInterface[]) {
        const fallbackList = [DEFAULT_SEARCH_ENGINE];
        if (!Array.isArray(list)) {
            return fallbackList;
        }

        const normalizedList: SearchEngleInterface[] = [];
        const seen = new Set<string>();

        list.forEach((item) => {
            if (!item || typeof item.name !== 'string' || typeof item.url !== 'string' || typeof item.href !== 'string') {
                return;
            }

            const name = item.name.trim();
            const url = item.url.trim();
            const href = item.href.trim();
            if (!name || !url || !href) {
                return;
            }

            const dedupeKey = url.toLowerCase();
            if (seen.has(dedupeKey)) {
                return;
            }
            seen.add(dedupeKey);
            normalizedList.push({ name, url, href });
        });

        return normalizedList.length > 0 ? normalizedList : fallbackList;
    }

    private resolveInitialSearch(
        searchEngleList: SearchEngleInterface[],
        searchFromStorage: { searchInterface: string; searchBtnHref: string; searchBtnName: string; },
    ) {
        const matched = searchEngleList.find((item) => {
            const sameName = searchFromStorage.searchBtnName && item.name.toLowerCase() === searchFromStorage.searchBtnName.toLowerCase();
            const sameUrl = searchFromStorage.searchInterface && item.url === searchFromStorage.searchInterface;
            const sameHref = searchFromStorage.searchBtnHref && item.href === searchFromStorage.searchBtnHref;
            return sameName || (sameUrl && sameHref);
        });

        if (matched) {
            return matched;
        }

        const defaultEngine = searchEngleList.find((item) => item.url === DEFAULT_SEARCH_ENGINE.url);
        return defaultEngine || searchEngleList[0] || DEFAULT_SEARCH_ENGINE;
    }

    private handleDocumentKeydown(event: KeyboardEvent) {
        if (event.key === '`' || event.keyCode === 192 || event.key === '\\' || event.keyCode === 220) {
            return;
        }

        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (target) {
            const tag = target.tagName;
            const isTypingNode = tag === 'INPUT'
                || tag === 'TEXTAREA'
                || tag === 'SELECT'
                || target.isContentEditable
                || !!target.closest('.kaguya-deep-panel');
            if (isTypingNode) {
                return;
            }
        }

        if (!this.input) {
            return;
        }
        if (document.activeElement !== this.input) {
            this.input.focus();
        }
    }

    private handleEngleClick(engine: SearchEngleInterface) {
        this.setState({
            search: {
                searchInterface: engine.url,
                searchBtnHref: engine.href,
                searchBtnName: engine.name,
                searchEngleList: this.state.search.searchEngleList,
            },
            showDropMenu: false,
            showSuggestPanel: false,
            activeSuggestIndex: -1,
        });
        const searchEngle = {
            searchInterface: engine.url,
            searchBtnHref: engine.href,
            searchBtnName: engine.name,
        };
        localStorage.setItem('searchEngle', JSON.stringify(searchEngle));
    }

    private handleContainerBtnClick() {
        utils.openExternalUrl(this.state.search.searchBtnHref);
    }

    private handleContainerPanelClick() {
        this.setState((previousState) => {
            return {
                showDropMenu: !previousState.showDropMenu,
                showHistoryPanel: false,
                showSuggestPanel: false,
                activeSuggestIndex: -1,
            };
        }, () => {
            if (this.state.showDropMenu) {
                requestAnimationFrame(() => this.updatePanelMaxHeight('drop'));
            }
        });
    }

    private handleSearchEvent(event: any, listInfo?: string) {
        if (event.type === 'keydown') {
            const key = event.key;
            const keyCode = event.keyCode;
            const hasSuggest = this.state.showSuggestPanel && this.state.suggestArray.length > 0;

            if (key === 'ArrowDown' || keyCode === 40) {
                if (!hasSuggest) {
                    return;
                }
                event.preventDefault();
                const nextIndex = this.state.activeSuggestIndex < this.state.suggestArray.length - 1
                    ? this.state.activeSuggestIndex + 1
                    : 0;
                this.setState({
                    activeSuggestIndex: nextIndex,
                    inputVal: this.state.suggestArray[nextIndex],
                }, () => {
                    this.scrollActiveSuggestIntoView(nextIndex);
                });
                return;
            }

            if (key === 'ArrowUp' || keyCode === 38) {
                if (!hasSuggest) {
                    return;
                }
                event.preventDefault();
                const nextIndex = this.state.activeSuggestIndex > 0
                    ? this.state.activeSuggestIndex - 1
                    : this.state.suggestArray.length - 1;
                this.setState({
                    activeSuggestIndex: nextIndex,
                    inputVal: this.state.suggestArray[nextIndex],
                }, () => {
                    this.scrollActiveSuggestIntoView(nextIndex);
                });
                return;
            }

            if (key === 'Escape' || keyCode === 27) {
                if (!this.state.showSuggestPanel) {
                    return;
                }
                event.preventDefault();
                this.setState({
                    showSuggestPanel: false,
                    activeSuggestIndex: -1,
                });
                return;
            }

            if (key !== 'Enter' && keyCode !== 13) {
                return;
            }
        }

        const hasActiveSuggest = this.state.showSuggestPanel
            && this.state.activeSuggestIndex >= 0
            && this.state.activeSuggestIndex < this.state.suggestArray.length;
        const keyword = typeof listInfo === 'string'
            ? listInfo
            : (hasActiveSuggest ? this.state.suggestArray[this.state.activeSuggestIndex] : this.state.inputVal.trim());
        if (!keyword) {
            return;
        }

        const encodedKeyword = encodeURIComponent(keyword);
        utils.openExternalUrl(`${this.state.search.searchInterface}${encodedKeyword}`);

        // AI分析搜索内容，学习用户偏好
        analyzeSearchContent(keyword, this.state.search.searchBtnName).catch(() => {
            // 静默处理分析错误，不影响搜索功能
        });

        // 触发搜索提交事件，通知AI角色
        window.dispatchEvent(new CustomEvent('kaguya:search-submit', {
            detail: {
                keyword: keyword,
                searchEngine: this.state.search.searchBtnName,
            },
        }));

        const searchHistory = this.loadSearchHistory().filter((item) => item !== keyword);
        searchHistory.unshift(keyword);
        if (searchHistory.length > 30) {
            searchHistory.splice(30);
        }
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        this.setState({
            searchArray: searchHistory,
            inputVal: keyword,
            suggestArray: [],
            showSuggestPanel: false,
            showHistoryPanel: false,
            showDropMenu: false,
            activeSuggestIndex: -1,
        });
    }
    
    private handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const nextValue = event.target.value;
        this.setState({
            inputVal: nextValue,
            showHistoryPanel: false,
            activeSuggestIndex: -1,
        }, () => {
            this.handleInputSuggest(nextValue);
            window.dispatchEvent(new CustomEvent('kaguya:search-input', {
                detail: {
                    value: nextValue,
                },
            }));
        });
    }

    private normalizeSuggestList(input: unknown[]): string[] {
        return input
            .filter((item) => typeof item === 'string')
            .map((item) => (item as string).trim())
            .filter((item) => item);
    }

    private fetchBaiduSuggestByJsonp(keyword: string, sourceUrl: (callbackName: string) => string, timeoutMs: number = 2800): Promise<string[]> {
        return new Promise<string[]>((resolve) => {
            const callbackName = `kaguyaBaiduSug_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
            const runtimeWindow = window as Window & Record<string, unknown>;
            let script: HTMLScriptElement | null = null;
            let timeoutId: number | null = null;

            const cleanup = () => {
                if (timeoutId !== null) {
                    window.clearTimeout(timeoutId);
                }
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                try {
                    delete runtimeWindow[callbackName];
                } catch {
                    runtimeWindow[callbackName] = undefined;
                }
            };

            runtimeWindow[callbackName] = (payload: BaiduSuPayload) => {
                const list = Array.isArray(payload?.s) ? this.normalizeSuggestList(payload.s) : [];
                cleanup();
                resolve(list);
            };

            script = document.createElement('script');
            script.src = sourceUrl(callbackName);
            script.async = true;
            script.onerror = () => {
                cleanup();
                resolve([]);
            };

            timeoutId = window.setTimeout(() => {
                cleanup();
                resolve([]);
            }, timeoutMs);

            document.body.appendChild(script);
        });
    }

    private async fetchBaiduSuggestByFetch(keyword: string): Promise<string[]> {
        try {
            const endpoint = `https://www.baidu.com/sugrec?prod=pc&wd=${encodeURIComponent(keyword)}`;
            const response = await fetch(endpoint);
            if (!response.ok) {
                return [];
            }
            const payload = await response.json() as BaiduSugrecPayload;
            if (!Array.isArray(payload.g)) {
                return [];
            }
            return payload.g
                .map((item) => (typeof item?.q === 'string' ? item.q.trim() : ''))
                .filter((item) => item);
        } catch {
            return [];
        }
    }

    private async fetchRemoteSuggestWithFallback(keyword: string): Promise<string[]> {
        const strategyList: Array<() => Promise<string[]>> = [
            async () => this.fetchBaiduSuggestByJsonp(
                keyword,
                (callbackName) => `https://suggestion.baidu.com/su?wd=${encodeURIComponent(keyword)}&cb=${callbackName}`,
            ),
            async () => this.fetchBaiduSuggestByJsonp(
                keyword,
                (callbackName) => `https://www.baidu.com/su?wd=${encodeURIComponent(keyword)}&cb=${callbackName}`,
            ),
            async () => this.fetchBaiduSuggestByFetch(keyword),
        ];

        for (let index = 0; index < strategyList.length; index++) {
            const currentList = await strategyList[index]();
            if (currentList.length > 0) {
                return currentList;
            }
        }
        return [];
    }

    private async loadSuggestList(keyword: string, requestToken: number) {
        const remoteList = await this.fetchRemoteSuggestWithFallback(keyword);
        if (requestToken !== this.suggestRequestToken) {
            return;
        }

        const keywordLower = keyword.toLowerCase();
        const localHistoryList = this.state.searchArray
            .filter((item) => item.toLowerCase().includes(keywordLower))
            .slice(0, 8);

        const mergedList: string[] = [];
        const seen = new Set<string>();
        [...remoteList, ...localHistoryList].forEach((item) => {
            const normalized = item.trim();
            if (!normalized) {
                return;
            }
            const dedupeKey = normalized.toLowerCase();
            if (seen.has(dedupeKey)) {
                return;
            }
            seen.add(dedupeKey);
            mergedList.push(normalized);
        });

        const limitedList = mergedList.slice(0, 12);
        this.setState({
            suggestArray: limitedList,
            showSuggestPanel: limitedList.length > 0,
            showDropMenu: false,
            activeSuggestIndex: -1,
        }, () => {
            if (this.state.showSuggestPanel) {
                requestAnimationFrame(() => this.updatePanelMaxHeight('suggest'));
            }
        });
    }

    private handleInputSuggest(inputValue: string) {
        const keyword = inputValue.trim();
        if (this.suggestDebounceTimer !== null) {
            window.clearTimeout(this.suggestDebounceTimer);
            this.suggestDebounceTimer = null;
        }

        if (!keyword) {
            this.suggestRequestToken += 1;
            this.setState({
                suggestArray: [],
                showSuggestPanel: false,
                activeSuggestIndex: -1,
            });
            return;
        }

        const nextRequestToken = this.suggestRequestToken + 1;
        this.suggestRequestToken = nextRequestToken;
        this.suggestDebounceTimer = window.setTimeout(() => {
            this.loadSuggestList(keyword, nextRequestToken);
        }, 150);
    }

    private renderSearchEngles(engine: SearchEngleInterface): JSX.Element {
        return (
            <li
                key={engine.name}
                className={`${this.props.prefix}-bar-container-dropmenu-searchengine`}
                onClick={() => {
                    this.handleEngleClick(engine);
                }}
            >
                {engine.name}
            </li>
        );
    }

    private renderHistoryPanel(listInfo: string, index: number) {
        return (
            <li
                className={`${this.props.prefix}-bar-search-history-list`}
                key={`${listInfo}-${index}`}
                title={listInfo}
                onClick={(event) => {
                    this.handleSearchEvent(event, listInfo);
                }}
            >
                {listInfo}
            </li>
        );
    }

    private handleSpreadClick() {
        this.setState((previousState) => {
            return {
                showHistoryPanel: !previousState.showHistoryPanel,
                showSuggestPanel: false,
                showDropMenu: false,
                activeSuggestIndex: -1,
            };
        }, () => {
            if (this.state.showHistoryPanel) {
                requestAnimationFrame(() => this.updatePanelMaxHeight('history'));
            }
        });
    }

    private scrollActiveSuggestIntoView(activeIndex: number) {
        const panel = this.suggestPanelRef;
        if (!panel) {
            return;
        }
        const activeItem = panel.querySelector(`[data-suggest-index="${activeIndex}"]`) as HTMLLIElement | null;
        if (!activeItem) {
            return;
        }
        const panelTop = panel.scrollTop;
        const panelBottom = panelTop + panel.clientHeight;
        const itemTop = activeItem.offsetTop;
        const itemBottom = itemTop + activeItem.offsetHeight;
        if (itemTop < panelTop) {
            panel.scrollTop = itemTop;
        } else if (itemBottom > panelBottom) {
            panel.scrollTop = itemBottom - panel.clientHeight;
        }
    }

    render(): JSX.Element {
        const dropList = this.state.search.searchEngleList.map((engine) => {
            return this.renderSearchEngles(engine);
        });

        const historyList = this.state.searchArray.map((item, index) => {
            return this.renderHistoryPanel(item, index);
        });
        const suggestList = this.state.suggestArray.map((item, index) => {
            return (
                <li
                    className={`${this.props.prefix}-bar-search-suggest-list${this.state.activeSuggestIndex === index ? ` ${this.props.prefix}-bar-search-suggest-list-active` : ''}`}
                    key={`${item}-${index}`}
                    title={item}
                    data-suggest-index={index}
                    onClick={(event) => {
                        this.handleSearchEvent(event, item);
                    }}
                    onMouseEnter={() => {
                        this.setState({ activeSuggestIndex: index });
                    }}
                >
                    {item}
                </li>
            );
        });

        return (
            <div className={`${this.props.prefix}-bar`} ref={(element) => { this.barRef = element; }}>
                <button className={`${this.props.prefix}-bar-container-btn`} onClick={() => { this.handleContainerBtnClick(); }}>
                    {this.state.search.searchBtnName}
                </button>
                <ul
                    className={`${this.props.prefix}-bar-container-dropmenu`}
                    ref={(element) => { this.dropMenuRef = element; }}
                    style={{
                        display: this.state.showDropMenu ? 'block' : 'none',
                        maxHeight: `${this.state.dropMenuMaxHeight}px`,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                    }}
                >
                    {dropList}
                </ul>
                <button
                    className={`${this.props.prefix}-bar-container-panel${this.state.showDropMenu ? ` ${this.props.prefix}-bar-container-panel-open` : ''}`}
                    onClick={() => { this.handleContainerPanelClick(); }}
                    aria-label='Toggle search engine list'
                    aria-expanded={this.state.showDropMenu}
                ></button>
                <div className={`${this.props.prefix}-bar-input-wrap`}>
                    <input
                        type='text'
                        ref={(element) => { this.input = element; }}
                        className={`${this.props.prefix}-bar-input`}
                        onKeyDown={(event) => { this.handleSearchEvent(event); }}
                        placeholder='Search the web...'
                        value={this.state.inputVal}
                        onChange={(event) => { this.handleInputChange(event); }}
                        onFocus={() => { this.handleInputSuggest(this.state.inputVal); }}
                    />
                    <button
                        className={`${this.props.prefix}-bar-spread${this.state.showHistoryPanel ? ` ${this.props.prefix}-bar-spread-open` : ''}`}
                        style={{ display: this.state.searchArray.length > 0 ? 'inline-flex' : 'none' }}
                        onClick={() => { this.handleSpreadClick(); }}
                        aria-label='Toggle search history'
                        aria-expanded={this.state.showHistoryPanel}
                    >
                        <i className={`${this.props.prefix}-bar-spread-icon`}></i>
                    </button>
                    <ul
                        className={`${this.props.prefix}-bar-search-suggest`}
                        ref={(element) => { this.suggestPanelRef = element; }}
                        style={{
                            display: this.state.showSuggestPanel ? 'block' : 'none',
                            maxHeight: `${this.state.suggestPanelMaxHeight}px`,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                        }}
                    >
                        {suggestList}
                    </ul>
                    <ul
                        className={`${this.props.prefix}-bar-search-history`}
                        ref={(element) => { this.historyPanelRef = element; }}
                        style={{
                            display: this.state.showHistoryPanel ? 'block' : 'none',
                            maxHeight: `${this.state.historyPanelMaxHeight}px`,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                        }}
                    >
                        {historyList}
                    </ul>
                </div>
                <button className={`${this.props.prefix}-bar-btn`} onClick={(event) => { this.handleSearchEvent(event); }}></button>
            </div>
        );
    }
}

export default SearchEngle;
