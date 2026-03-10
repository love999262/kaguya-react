import * as React from 'react';
import { StateInterface as Props } from './navigator';
import utils from './utils';
import websitesData from '../../websites.json';
import adultWebsitesData from '../../adult-websites.json';

interface WebsiteLink {
    name: string;
    url: string;
}

interface WebsiteSection {
    title: string;
    content: WebsiteLink[];
}

const CATEGORY_GRADIENTS = [
    'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)',
];

interface StateInterface {
    defaultWebsites: WebsiteSection[];
    adultWebsites: WebsiteSection[];
    websites: WebsiteSection[];
    isAdultMode: boolean;
}

class Navigates extends React.Component<Props, StateInterface> {
    constructor(props: Props, context: any) {
        super(props, context);
        this.state = {
            defaultWebsites: [],
            adultWebsites: [],
            websites: [],
            isAdultMode: false,
        };
        this.handleDocumentKeyDown = this.handleDocumentKeyDown.bind(this);
    }

    componentDidMount() {
        const websites = websitesData as WebsiteSection[];
        const adultWebsites = adultWebsitesData as WebsiteSection[];
        if (Array.isArray(websites) && Array.isArray(adultWebsites)) {
            this.setState({
                defaultWebsites: websites,
                adultWebsites,
                websites,
            });
        } else {
            this.setState({
                defaultWebsites: [],
                adultWebsites: [],
                websites: [],
            });
            console.warn('Unexpected websites data format.');
        }
        document.addEventListener('keydown', this.handleDocumentKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleDocumentKeyDown);
    }

    private handleDocumentKeyDown(event: KeyboardEvent) {
        const activeElement = document.activeElement as HTMLElement | null;
        const isTypingElement = !!activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );
        if (isTypingElement) {
            return;
        }
        // 成人模式快捷键：Shift + \ (反斜杠)
        if (event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && event.keyCode === 220) {
            event.preventDefault();
            this.setState((previousState) => {
                const nextAdultMode = !previousState.isAdultMode;
                return {
                    isAdultMode: nextAdultMode,
                    websites: nextAdultMode ? previousState.adultWebsites : previousState.defaultWebsites,
                };
            });
        }
    }

    private handleNavClick(href: string) {
        utils.openExternalUrl(href);
    }

    private getCategoryTitleStyle(sectionIndex: number): React.CSSProperties {
        return {
            backgroundImage: CATEGORY_GRADIENTS[sectionIndex % CATEGORY_GRADIENTS.length],
            color: '#ffffff',
            fontWeight: 600,
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
        };
    }

    private renderWebSites() {
        const nav: JSX.Element[] = [];
        this.state.websites.forEach((item: WebsiteSection, sectionIndex: number) => {
            const listContainer: JSX.Element[] = [];
            const title = (
                <li
                    key={`title-${item.title}-${sectionIndex}`}
                    className={`${this.props.prefix}-panel-nav-list-title`}
                    style={this.getCategoryTitleStyle(sectionIndex)}
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
            <>
                <div
                    className={`${this.props.prefix}-panel-mode`}
                    style={{ display: this.state.isAdultMode ? 'block' : 'none' }}
                >
                    ADULT MODE (Press "Shift+\" to exit)
                </div>
                <div className={`${this.props.prefix}-panel`}>
                    {this.renderWebSites()}
                </div>
            </>
        );
    }
}

export default  Navigates;
