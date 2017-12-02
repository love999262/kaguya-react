import * as React from 'react';
import { render } from 'react-dom';
import { KaguyaProps as Props } from './kaguya';

interface StateInterface {
    imgIndex: number;
    isLocal: boolean;
    bgImgStyle: any;
    totalPic: number;
    qiniuURL: string;
    localPicDir: string;
}

class Background extends React.Component <Props, any> {
    state: StateInterface;

    constructor(props: Props, context: any) {
        super(props, context);
        this.state = {
            imgIndex: 0,
            isLocal: false,
            bgImgStyle: {},
            totalPic: 713,
            qiniuURL: 'http://omltgvp37.bkt.clouddn.com/',
            localPicDir: '../img',
        };
    }
    
    componentDidMount() {
        this.getBackground();
    }

    componentWillUnmount() {}

    private getBackground() {
        const num = Math.round(Math.random() * this.state.totalPic);
        let style: object;
        let assets: string;
        this.state.isLocal ? assets = this.state.localPicDir : assets = this.state.qiniuURL;
        style = {
            backgroundImage: `url(${assets}bg${num.toString()}.jpg)`,
        };
        this.setState({
            imgIndex: num,
            bgImgStyle: style,
        });
        console.log('state', this.setState);
    }

    render(): JSX.Element {
        return(
            <div className={`${this.props.prefix}-img`} style={this.state.bgImgStyle}></div>
        );
    }
}

export default  Background;
