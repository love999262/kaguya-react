import * as React from 'react';
import { StateInterface as Props } from './navigator';
import utils from './utils';
import searchEngineData from '../../searchengine-list.json';

interface SearchEngleInterface {
    name: string;
    url: string;
    href: string;
}

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
}

type SearchTriggerEvent = React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLElement>;

class SearchEngle extends React.Component <Props, StateInterface> {
    input: HTMLInputElement | null;
    private barRef: HTMLDivElement | null;

    constructor(props: Props) {
        super(props);
        this.input = null;
        this.barRef = null;
        this.state = {
            search: {
                searchInterface: 'https://www.bing.com/search?q=',
                searchBtnHref: 'https://www.bing.com/',
                searchBtnName: 'bing',
                searchEngleList: [],
            },
            searchArray: this.loadSearchHistory(),
            inputVal: '',
            showDropMenu: false,
            showHistoryPanel: false,
        };

        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
    }
    
    componentDidMount() {
        const searchEngleList = searchEngineData as SearchEngleInterface[];
        const searchFromStorage = this.loadSearchEngineFromStorage();
        const defaultSearch = {
            searchInterface: 'https://www.bing.com/search?q=',
            searchBtnHref: 'https://www.bing.com/',
            searchBtnName: 'bing',
        };

        this.setState({
            search: {
                searchInterface: searchFromStorage.searchInterface || defaultSearch.searchInterface,
                searchBtnHref: searchFromStorage.searchBtnHref || defaultSearch.searchBtnHref,
                searchBtnName: searchFromStorage.searchBtnName || defaultSearch.searchBtnName,
                searchEngleList,
            },
        });

        document.addEventListener('click', this.handleDocumentClick);
        document.addEventListener('keydown', this.handleDocumentKeydown);
    }

    componentWillUnmount() {
        document.removeEventListener('click', this.handleDocumentClick);
        document.removeEventListener('keydown', this.handleDocumentKeydown);
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
            return parsed.filter((item: unknown): item is string => typeof item === 'string');
        } catch (error) {
            return [];
        }
    }

    private isTypingTarget(target: EventTarget | null) {
        if (!(target instanceof HTMLElement)) {
            return false;
        }
        const tagName = target.tagName.toLowerCase();
        return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
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

    private handleDocumentKeydown(event: KeyboardEvent) {
        if (event.key !== '/') {
            return;
        }
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }
        if (this.isTypingTarget(event.target)) {
            return;
        }
        if (!this.input) {
            return;
        }
        event.preventDefault();
        this.input.focus();
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
        });
    }

    private handleSearchEvent(event: SearchTriggerEvent, listInfo?: string) {
        if (event.type === 'keydown' && (event as React.KeyboardEvent<HTMLInputElement>).key !== 'Enter') {
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
                    style={{ display: this.state.showDropMenu ? 'block' : 'none' }}
                >
                    {dropList}
                </ul>
                <button className={`${this.props.prefix}-bar-container-panel`} onClick={() => { this.handleContainerPanelClick(); }}></button>
                <div className={`${this.props.prefix}-bar-input-wrap`}>
                    <input
                        type='text'
                        ref={(element) => { this.input = element; }}
                        className={`${this.props.prefix}-bar-input`}
                        onKeyDown={(event) => { this.handleSearchEvent(event); }}
                        placeholder='Search the web... (press /)'
                        value={this.state.inputVal}
                        onChange={(event) => { this.handleInputChange(event); }}
                    />
                    <button
                        className={`${this.props.prefix}-bar-spread`}
                        style={{ display: this.state.searchArray.length > 0 ? 'block' : 'none' }}
                        onClick={() => { this.handleSpreadClick(); }}
                        aria-label='Toggle search history'
                    >
                        <i className={`${this.props.prefix}-bar-spread-icon`}></i>
                    </button>
                    <ul
                        className={`${this.props.prefix}-bar-search-history`}
                        style={{ display: this.state.showHistoryPanel ? 'block' : 'none' }}
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
