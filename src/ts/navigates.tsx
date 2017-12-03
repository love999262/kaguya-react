import * as React from 'react';
import { render } from 'react-dom';
import { StateInterface as Props } from './navigator';
import websites from './websites';

interface StateInterface {
    websites: any;
    titleStyle: {
        backgroundColor?: string;
    };
}

class Navigates extends React.Component <Props, any> {
    state: StateInterface;

    constructor(props: Props, context: any) {
        super(props, context);
        this.state = {
            websites: websites,
            titleStyle: {},
        };
        // this.handleEngleClick = this.handleEngleClick.bind(this);
    }

    componentWillMount() {

        
    }
    
    componentDidMount() {

    }

    componentWillUnmount() {}

    handleNavClick(href: string) {
        window.open(href);
    }
    
    renderWebSites() {
        let listContainer = [];
        const nav = [];
        for (const i in this.state.websites) {
            if (i) {
                listContainer = [];
                const title = <li className={`${this.props.prefix}-panel-nav-list-title`} style={this.state.titleStyle}>{i}</li>;
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