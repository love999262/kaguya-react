import * as React from 'react';
import { StateInterface as Props } from './navigator';
import utils from './utils';
import websitesData from '../../websites.json';

interface WebsiteLink {
    name: string;
    url: string;
}

interface WebsiteSection {
    title: string;
    content: WebsiteLink[];
}

interface StateInterface {
    websites: WebsiteSection[];
}

class Navigates extends React.Component <Props, StateInterface> {
    state: StateInterface;

    constructor(props: Props) {
        super(props);
        this.state = {
            websites: [],
        };
    }

    componentDidMount() {
        const websites = websitesData as WebsiteSection[];
        if (Array.isArray(websites)) {
            this.setState({
                websites,
            });
        } else {
            this.setState({
                websites: [],
            });
            console.warn('Unexpected websites.json format.');
        }
    }

    handleNavClick(href: string) {
        utils.openExternalUrl(href);
    }
    renderWebSites() {
        const nav: JSX.Element[] = [];
        this.state.websites.forEach((item: WebsiteSection, sectionIndex: number) => {
            const listContainer: JSX.Element[] = [];
            const title = (
                <li
                    key={`title-${item.title}-${sectionIndex}`}
                    className={`${this.props.prefix}-panel-nav-list-title`}
                >
                    {item.title}
                </li>
            );
            listContainer.push(title);
            if (item.content && Array.isArray(item.content)) {
                item.content.forEach((entry: WebsiteLink, entryIndex: number) => {
                    const list = (
                        <li
                            key={`${entry.name}-${entryIndex}`}
                            className={`${this.props.prefix}-panel-nav-list`}
                            onClick={() => { this.handleNavClick(entry.url); }}
                        >
                            {entry.name}
                        </li>
                    );
                    listContainer.push(list);
                });
            }
            nav.push(<ul key={`${item.title}-${sectionIndex}`} className={`${this.props.prefix}-panel-nav`}>{listContainer}</ul>);
        });
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
