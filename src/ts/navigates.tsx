import * as React from 'react';
import { render } from 'react-dom';
import { StateInterface as Props } from './navigator';
import utils from './utils';

interface StateInterface {
    websites: any;
}

class Navigates extends React.Component <Props, any> {
    state: StateInterface;
    isMount: boolean;
    constructor(props: Props, context: any) {
        super(props, context);
        this.state = {
            websites: [],
        };
    }

    componentWillMount() {

    }
    
    componentDidMount() {
        this.isMount = true;
        utils.ajax({
            url: '/websites.json',
        }).then((res: any) => {
            if (this.isMount) {
                this.setState({
                    websites: res.data,
                });
            }
        });
    }

    componentWillUnmount() {
        this.isMount = false;
    }

    handleNavClick(href: string) {
        window.open(href);
    }
    renderWebSites() {
        let listContainer: any = [];
        const nav: any = [];
        console.log('this.state.websites', this.state.websites);
        // this.state.websites.forEach((item: any, i: number) => {
        //     listContainer = [];
        //     const title = <li key={i + item.content.length} className={`${this.props.prefix}-panel-nav-list-title`} style={{ backgroundColor: utils.getRandomColor() }}>{item.title}</li>;
        //     listContainer.push(title);
        //     item.content && Array.isArray(item.content) && item.content.forEach((ite: any, idx: number) => {
        //         const list = <li key={idx} className={`${this.props.prefix}-panel-nav-list`} onClick={() => { this.handleNavClick(ite.url); }}>{ite.name}</li>;
        //         listContainer.push(list);
        //     });
        //     nav.push(<ul key={i} className={`${this.props.prefix}-panel-nav`}>{listContainer}</ul>);
        //     // for (const i in item) {
        //     //     if (i) {
        //     //         listContainer = [];
        //     //         const title = <li key={i} className={`${this.props.prefix}-panel-nav-list-title`} style={{ backgroundColor: utils.getRandomColor() }}>{i}</li>;
        //     //         listContainer.push(title);
        //     //         for (const j in item[i]) {
        //     //             if (j) {
        //     //                 const list = <li key={j} className={`${this.props.prefix}-panel-nav-list`} onClick={() => { this.handleNavClick(item[i][j]); }}>{j}</li>;
        //     //                 listContainer.push(list);
        //     //             }
        //     //         }
        //     //         nav.push(<ul key={i} className={`${this.props.prefix}-panel-nav`}>{listContainer}</ul>);
        //     //     }
        //     // }
        // });
        for (const i in this.state.websites) {
            if (i) {
                listContainer = [];
                const title = <li key={i} className={`${this.props.prefix}-panel-nav-list-title`} style={{ backgroundColor: utils.getRandomColor() }}>{i}</li>;
                listContainer.push(title);
                for (const j in this.state.websites[i]) {
                    if (j) {
                        const list = <li key={j} className={`${this.props.prefix}-panel-nav-list`} onClick={() => { this.handleNavClick(this.state.websites[i][j]); }}>{j}</li>;
                        listContainer.push(list);
                    }
                }
                nav.push(<ul key={i} className={`${this.props.prefix}-panel-nav`}>{listContainer}</ul>);
            }
        }
        return nav;
    }

    render(): JSX.Element {
        return(
            <div className={`${this.props.prefix}-panel`}>
                {this.renderWebSites()}
            </div>
        );
    }
}

export default  Navigates;
