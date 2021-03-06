import * as React from 'react';
import { render } from 'react-dom';
import { StateInterface as Props } from './navigator';
import utils from './utils';
interface SearchEngleInterface {
    name: string;
    url: string;
    href: string;
}
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
    showHistoryPanel: boolean;
}

class SearchEngle extends React.Component <Props, any> {
    state: StateInterface;
    input: HTMLElement;
    historyLists: JSX.Element[];
    private historyListStyle: HistoryListStyleInterface;
    searcEngle: SearchInterface;
    isMount: boolean;
    constructor(props: Props, context: any) {
        super(props, context);
        this.state = {
            search: this.searcEngle,
            currentDate: new Date().toString(),
            searchArray: JSON.parse(localStorage.getItem('searchHistory')) ? JSON.parse(localStorage.getItem('searchHistory')) : [],
            inputVal: '',
            dropmenuStyle: {
                display: 'none',
            },
            searchBtnStyle: {
                backgroundColor: utils.getRandomColor(),
            },
            historyPanelStyle: {

            },
            historyListStyle: {

            },
            showHistoryPanel: false,
        };
        // this.handleEngleClick = this.handleEngleClick.bind(this);
    }

    componentWillMount() {

    }
    
    componentDidMount() {
        this.isMount = true;
        utils.ajax({
            url: '/searchengine-list.json',
        }).then((res: any) => {
            this.searcEngle = (Object as any).assign({
                searchInterface: 'https://www.baidu.com/s?wd=',
                searchBtnHref: 'https://www.baidu.com/',
                searchBtnName: 'baidu',
                searchEngleList: res.data,
            }, JSON.parse(localStorage.getItem('searchEngle')));
            if (this.isMount) {
                this.setState({
                    search: this.searcEngle,
                });                
            }
        });
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
        this.isMount = false;
    }

    private handleEngleClick(engine: SearchEngleInterface) {
        const searchState = (Object as any).assign(this.state.search, {
            searchInterface: engine.url,
            searchBtnHref: engine.href,
            searchBtnName: engine.name,
        });
        this.setState({
            search: searchState,
            dropmenuStyle: {
                display: this.state.dropmenuStyle.display === 'none' ? 'block' : 'none',
            },
        });
        const searchEngle = {
            searchInterface: engine.url,
            searchBtnHref: engine.href,
            searchBtnName: engine.name,
        };
        localStorage.setItem('searchEngle', JSON.stringify(searchEngle));

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
            // if (!this.state.inputVal) {
            //     return;
            // }
            console.log('inputVal', this.state.inputVal);
            const val = typeof listInfo === 'string' ? encodeURIComponent(listInfo) : encodeURIComponent(this.state.inputVal);
            console.log('val', val);
            window.open(this.state.search.searchInterface + val);
            if (!this.state.inputVal) {
                return;
            }
            const searchHistory: string[] = JSON.parse(localStorage.getItem('searchHistory')) ? JSON.parse(localStorage.getItem('searchHistory')) : [];
            for (let i = 0; i < searchHistory.length; i++) {
                // Sticky Post
                if (this.state.inputVal === searchHistory[i]) {
                    searchHistory.splice(i, 1);
                }
            }
            const visualArray = (total: number) => {
                if (searchHistory.length > total) {
                    searchHistory.splice(total - 1);
                }
            };
            // only record recent 30 records.
            visualArray(30);
            searchHistory.unshift(this.state.inputVal);
            localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
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
    // private handleInputFocus() {
    //     this.setState({
    //         historyPanelStyle: {
    //             display: 'block',
    //         },
    //     });
    // }
    // private handleInputBlur() {
    //     setTimeout(() => {
    //         this.setState({
    //             historyPanelStyle: {
    //                 display: 'none',
    //             },
    //         });
    //     }, 300);
    // }
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
    private handleSpreadClick() {
        if (this.state.showHistoryPanel) {
            this.setState({
                showHistoryPanel: false,
                historyPanelStyle: {
                    display: 'none',
                },
            });
        } else {
            this.setState({
                showHistoryPanel: true,
                historyPanelStyle: {
                    display: 'block',
                },
            });
        }
    }

    render(): JSX.Element {
        const dropList = this.state.search && this.state.search.searchEngleList && this.state.search.searchEngleList.map((engine: SearchEngleInterface) => {
            return this.renderSearchEngles(engine);
        });
        return(
            <div className={`${this.props.prefix}-bar`}>
                <button className={`${this.props.prefix}-bar-container-btn`} onClick={() => { this.handleContainerBtnClick(); }}>{this.state.search && this.state.search.searchBtnName}</button>
                <ul className={`${this.props.prefix}-bar-container-dropmenu`} style={this.state.dropmenuStyle}>
                    {dropList}
                </ul>
                <button className={`${this.props.prefix}-bar-container-panel`} onClick={() => { this.handleContainerPanelClick(); }}></button>
                <div className={`${this.props.prefix}-bar-input-wrap`}>
                    <input 
                        type='text' 
                        ref={(ele) => { this.input = ele; }} 
                        className={`${this.props.prefix}-bar-input`} 
                        onKeyDown={(e) => { this.handleSearchEvent(e); }} 
                        placeholder='Open The Door To A Whole New World!!!' 
                        value={this.state.inputVal} 
                        onChange={(e) => {this.handleInputChange(e); }} 
                        /* onFocus={() => { this.handleInputFocus(); }} */ /* onBlur={() => { this.handleInputBlur(); }} */ 
                    />
                    <div className={`${this.props.prefix}-bar-spread`} style={{ display: (this.getSearchHistoryPanel().length > 0 ? 'block' : 'none') }} onClick={() => { this.handleSpreadClick(); }}><i className={`${this.props.prefix}-bar-spread-icon`}></i></div>
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
