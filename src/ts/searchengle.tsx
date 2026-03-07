import * as React from 'react';
import { StateInterface as Props } from './navigator';
import utils from './utils';
import searchEngineData from '../../searchengine-list.json';

interface SearchEngleInterface {
    name: string;
    url: string;
    href: string;
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
    inputVal: string;
    showDropMenu: boolean;
    showHistoryPanel: boolean;
    dropMenuMaxHeight: number;
    historyPanelMaxHeight: number;
}

class SearchEngle extends React.Component <Props, StateInterface> {
    input: HTMLInputElement | null;
    private barRef: HTMLDivElement | null;
    private dropMenuRef: HTMLUListElement | null;
    private historyPanelRef: HTMLUListElement | null;

    constructor(props: Props, context: any) {
        super(props, context);
        this.input = null;
        this.barRef = null;
        this.dropMenuRef = null;
        this.historyPanelRef = null;
        this.state = {
            search: {
                searchInterface: DEFAULT_SEARCH_ENGINE.url,
                searchBtnHref: DEFAULT_SEARCH_ENGINE.href,
                searchBtnName: DEFAULT_SEARCH_ENGINE.name,
                searchEngleList: [],
            },
            searchArray: this.loadSearchHistory(),
            inputVal: '',
            showDropMenu: false,
            showHistoryPanel: false,
            dropMenuMaxHeight: 300,
            historyPanelMaxHeight: 300,
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
    }

    private handleWindowResize() {
        if (this.state.showDropMenu) {
            this.updatePanelMaxHeight('drop');
        }
        if (this.state.showHistoryPanel) {
            this.updatePanelMaxHeight('history');
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
        });
    }

    private updatePanelMaxHeight(panelType: 'drop' | 'history') {
        const panelElement = panelType === 'drop' ? this.dropMenuRef : this.historyPanelRef;
        if (!panelElement) {
            return;
        }
        const viewportBottomPadding = 12;
        const panelTop = panelElement.getBoundingClientRect().top;
        const availableHeight = Math.max(120, Math.floor(window.innerHeight - panelTop - viewportBottomPadding));

        if (panelType === 'drop') {
            this.setState({ dropMenuMaxHeight: availableHeight });
        } else {
            this.setState({ historyPanelMaxHeight: availableHeight });
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
            };
        }, () => {
            if (this.state.showDropMenu) {
                requestAnimationFrame(() => this.updatePanelMaxHeight('drop'));
            }
        });
    }

    private handleSearchEvent(event: any, listInfo?: string) {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.keyCode !== 13) {
            return;
        }

        const keyword = typeof listInfo === 'string' ? listInfo : this.state.inputVal.trim();
        if (!keyword) {
            return;
        }

        const encodedKeyword = encodeURIComponent(keyword);
        utils.openExternalUrl(`${this.state.search.searchInterface}${encodedKeyword}`);

        const searchHistory = this.loadSearchHistory().filter((item) => item !== keyword);
        searchHistory.unshift(keyword);
        if (searchHistory.length > 30) {
            searchHistory.splice(30);
        }
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        this.setState({
            searchArray: searchHistory,
            inputVal: typeof listInfo === 'string' ? listInfo : this.state.inputVal,
        });
    }
    
    private handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            inputVal: event.target.value,
        });
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
            };
        }, () => {
            if (this.state.showHistoryPanel) {
                requestAnimationFrame(() => this.updatePanelMaxHeight('history'));
            }
        });
    }

    render(): JSX.Element {
        const dropList = this.state.search.searchEngleList.map((engine) => {
            return this.renderSearchEngles(engine);
        });

        const historyList = this.state.searchArray.map((item, index) => {
            return this.renderHistoryPanel(item, index);
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
