import * as React from 'react';
import { KaguyaProps as Props } from './kaguya';
import CONSTANTS from './CONSTANTS';

interface ImgStyleInterface {
    backgroundImage?: string;
}

interface StateInterface {
    bgImgStyle: ImgStyleInterface;
    totalPic: number;
}

class Background extends React.Component <Props, StateInterface> {
    constructor(props: Props) {
        super(props);
        this.state = {
            bgImgStyle: {},
            totalPic: CONSTANTS.IMAGE_LIST.length,
        };
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }
    
    componentDidMount() {
        this.setBackground();
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (event.key !== '`' && event.keyCode !== 192) {
            return;
        }
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement && activeElement.className === `${this.props.prefix}-search-bar-input`) {
            return;
        }
        this.setBackground();
    }

    private setBackground() {
        const num = Math.floor(Math.random() * this.state.totalPic);
        this.setState({
            bgImgStyle: {
                backgroundImage: `url(${CONSTANTS.IMAGE_LIST[num]})`,
            },
        });
    }

    render(): JSX.Element {
        return (
            <div className={`${this.props.prefix}-img`} style={this.state.bgImgStyle}></div>
        );
    }
}

export default Background;
