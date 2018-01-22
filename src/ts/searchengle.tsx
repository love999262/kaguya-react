import * as React from 'react';
import { render } from 'react-dom';
import { StateInterface as Props } from './navigator';
import searchEngineList, { SearchEngleInterface } from './searchengle-list';
import Utils from './utils';

interface DropMenuStyleInterface {
    display: string;
}

interface SearchBtnStyleInterface {
    backgroundColor?: string;
}

interface HistoryPanelInterface {
    display?: string;
}

interface SearchInterface {
    searchEngleList: SearchEngleInterface[];
    searchInterface: string;
    searchBtnHref: string;
    searchBtnName: string;
}

interface HistoryListStyleInterface {
    backgroundColor?: string;
    color?: string;
}

interface StateInterface {
    search: SearchInterface;
    currentDate: string;
    searchArray: string[];
    dropmenuStyle: DropMenuStyleInterface;
    searchBtnStyle: SearchBtnStyleInterface;
    inputVal: string;
    historyPanelStyle: HistoryPanelInterface;
    historyListStyle: HistoryListStyleInterface;
}

class SearchEngle extends React.Component <Props, any> {
    state: StateInterface;
    input: HTMLElement;
    historyLists: JSX.Element[];
    private historyListStyle: HistoryListStyleInterface;
    constructor(props: Props, context: any) {
        super(props, context);
        this.state = {
            search: {
                searchInterface: 'https://www.baidu.com/s?wd=',
                searchBtnHref: 'https://www.baidu.com/',
                searchBtnName: 'baidu',
                searchEngleList: searchEngineList,
            },
            currentDate: new Date().toString(),
            searchArray: [],
            inputVal: '',
            dropmenuStyle: {
                display: 'none',
            },
            searchBtnStyle: {
                backgroundColor: Utils.getRandomColor(),
            },
            historyPanelStyle: {

            },
            historyListStyle: {

            },
        };
        // this.handleEngleClick = this.handleEngleClick.bind(this);
    }

    componentWillMount() {

    }
    
    componentDidMount() {
        document.addEventListener('click', (e: any) => {
            if (e.target.className !== `${this.props.prefix}-bar-container-panel`) {
                this.setState({
                    dropmenuStyle: {
                        display: 'none',
                    },
                });
            }
        });
        document.addEventListener('keydown', (e: any) => {
            if (e.keyCode !== 192) {
                if (document.activeElement.className !== `${this.props.prefix}-bar-input`) {
                    this.input.focus();
                }
            }
        });
    }

    componentWillUnmount() {

    }

    private handleEngleClick(engine: SearchEngleInterface) {
        this.setState({
            search: {
                searchInterface: engine.url,
                searchBtnHref: engine.href,
                searchBtnName: engine.name,
            },
            dropmenuStyle: {
                display: this.state.dropmenuStyle.display === 'none' ? 'block' : 'none',
            },
        });

    }
    private handleContainerBtnClick() {
        window.open(this.state.search.searchBtnHref);
    }
    private handleContainerPanelClick() {
        this.setState({
            dropmenuStyle: {
                display: this.state.dropmenuStyle.display === 'none' ? 'block' : 'none',
            },
        });
    }
    private handleSearchEvent(e: any, listInfo?: string) {
        if ((e.type === 'keydown' && e.keyCode === 13) || e.type === 'click') {
            if (!this.state.inputVal) {
                return;
            }
            console.log('inputVal', this.state.inputVal);
            const val = typeof listInfo === 'string' ? encodeURIComponent(listInfo) : encodeURIComponent(this.state.inputVal);
            console.log('val', val);
            window.open(this.state.search.searchInterface + val);
            const searchHistory = this.state.searchArray.slice();
            for (let i = 0; i < searchHistory.length; i++) {
                if (this.state.inputVal === searchHistory[i]) {
                    return;
                }
            }
            searchHistory.push(this.state.inputVal);
            this.setState({
                searchArray: searchHistory,
            });
        }

    }
    
    private handleInputChange(e: any) {
        this.setState({
            inputVal: e.target.value,
        });

    }
    private handleInputFocus() {
        this.setState({
            historyPanelStyle: {
                display: 'block',
            },
        });
    }
    private handleInputBlur() {
        setTimeout(() => {
            this.setState({
                historyPanelStyle: {
                    display: 'none',
                },
            });
        }, 300);
    }
    private highlightHistoryPanel(val: string) {
        const inputValTransFerred = val.split('').map((item) => {
            return item.replace(item, `\\${item}`);
        }).join('');
        const inputVal = new RegExp(inputValTransFerred, 'g');
        console.log(inputValTransFerred, inputVal, inputVal.test(val));
        if (this.state.inputVal && inputVal.test(val)) {
            this.historyListStyle = {
                backgroundColor: '#62e092',
                color: '#fff',
            };
        } else {
            this.historyListStyle = {
            };
        }
    }
    private renderSearchEngles(engine: SearchEngleInterface): JSX.Element {
        const list = <li 
                        key={engine.name} 
                        className={`${this.props.prefix}-bar-container-dropmenu-searchengine`} 
                        onClick={() => { 
                            this.handleEngleClick(engine);
                        }}>
                            {engine.name}
                        </li>;
        return list;
    }

    private getSearchHistoryPanel() {
        this.historyLists = this.state.searchArray.map((item) => {
            return this.renderHistoryPanel(item);
        });
        return this.historyLists;
    }

    private renderHistoryPanel(listInfo: string) {
        // this.highlightHistoryPanel(listInfo);
        const list = <li className={`${this.props.prefix}-bar-search-history-list`} key={listInfo} title={listInfo} style={this.historyListStyle} onClick={(e) => { this.handleSearchEvent(e, listInfo); }}>{listInfo}</li>;
        return list;
    }

    render(): JSX.Element {
        const dropList = searchEngineList.map((engine: SearchEngleInterface) => {
            return this.renderSearchEngles(engine);
        });
        return(
            <div className={`${this.props.prefix}-bar`}>
                <button className={`${this.props.prefix}-bar-container-btn`} onClick={() => { this.handleContainerBtnClick(); }}>{this.state.search.searchBtnName}</button>
                <ul className={`${this.props.prefix}-bar-container-dropmenu`} style={this.state.dropmenuStyle}>
                    {dropList}
                </ul>
                <button className={`${this.props.prefix}-bar-container-panel`} onClick={() => { this.handleContainerPanelClick(); }}></button>
                <div>
                    <input type='text' ref={(ele) => { this.input = ele; }} className={`${this.props.prefix}-bar-input`} onFocus={() => { this.handleInputFocus(); }} onBlur={() => { this.handleInputBlur(); }} onKeyDown={(e) => { this.handleSearchEvent(e); }} placeholder='Open The Door To A Whole New World!!!' value={this.state.inputVal} onChange={(e) => {this.handleInputChange(e); }} />
                    <ul className={`${this.props.prefix}-bar-search-history`} style={this.state.historyPanelStyle}>
                        {this.getSearchHistoryPanel()}
                    </ul>
                </div>
                <button className={`${this.props.prefix}-bar-btn`} onClick={(e) => { this.handleSearchEvent(e); }} style={this.state.searchBtnStyle}></button>
            </div>
        );
    }
}

export default  SearchEngle;
