import * as React from 'react';
import { render } from 'react-dom';
import { KaguyaProps as Props } from './kaguya';
import searchEngineList, { SearchEngleInterface } from './searchengle-list';



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

interface StateInterface {
    search: SearchInterface;
    currentDate: string;
    searchArray: string[];
    dropmenuStyle: DropMenuStyleInterface;
    searchBtnStyle: SearchBtnStyleInterface;
    inputVal: string;
    historyPanelStyle: HistoryPanelInterface;
}

class SearchEngle extends React.Component <Props, any> {
    state: StateInterface;

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
                
            },
            historyPanelStyle: {

            },
        };
        // this.handleEngleClick = this.handleEngleClick.bind(this);
    }

    componentWillMount() {

        
    }
    
    componentDidMount() {

    }

    componentWillUnmount() {}

    private handleEngleClick(engine: SearchEngleInterface) {
        console.log('state', this.state);
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
    private handleSearchEvent(e: any) {
        if ((e.type === 'keydown' && e.keyCode === 13) || e.type === 'click') {
            window.open(this.state.search.searchInterface + this.state.inputVal);
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
        this.setState({
            historyPanelStyle: {
                display: 'none',
            },
        });
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
        console.log(this.state.searchArray);
        const historyLists = this.state.searchArray.map((item) => {
            return this.renderHistoryPanel(item);
        });
        return historyLists;
    }

    private renderHistoryPanel(listInfo: string) {
        const list = <li className={`${this.props.prefix}-bar-search-history-list`} key={listInfo} title={listInfo} onClick={(e) => { this.handleSearchEvent(e); }}>{listInfo}</li>;
        return list;
    }

    // private renderDropMenu() {
    //     return(

    //     );
    // }

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
                    <input type='text' className={`${this.props.prefix}-bar-input`} onFocus={() => { this.handleInputFocus(); }} onBlur={() => { this.handleInputBlur(); }} onKeyDown={(e) => { this.handleSearchEvent(e); }} placeholder='Open The Door To A Whole New World!!!' value={this.state.inputVal} onChange={(e) => {this.handleInputChange(e); }} />
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
