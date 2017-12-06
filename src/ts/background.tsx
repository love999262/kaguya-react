import * as React from 'react';
import { render } from 'react-dom';
import { KaguyaProps as Props } from './kaguya';

interface ImgStyleInterface {
    backgroundImage?: string;
}

interface StateInterface {
    imgIndex: number;
    isLocal: boolean;
    bgImgStyle: ImgStyleInterface;
    totalPic: number;
    qiniuURL: string;
    localPicDir: string;
}

class Background extends React.Component <Props, any> {
    state: StateInterface;
    private eliminateImg: number[];
    constructor(props: Props, context: any) {
        super(props, context);
        this.eliminateImg = [4, 5, 7, 10, 11, 19, 27, 28, 29, 37,
                             45, 46, 47, 48, 49, 55, 66, 70, 71, 72,
                             74, 75, 76, 77, 81, 82, 88, 93, 94, 96,
                             102, 106, 108, 114, 116, 118, 119, 123, 124, 125,
                             131, 132, 136, 137, 138, 140, 141, 145, 146, 147,
                             150, 153, 155, 168, 169, 178, 183, 199, 200, 201,
                             202, 205, 211, 214, 215, 224, 236, 241, 243, 251,
                             275, 289, 296, 304, 323, 327, 335, 338, 348, 349,
                             359, 361, 362, 364, 374, 375, 377, 378, 382, 385,
                             386, 387, 388, 389, 405, 414, 437, 438, 442, 467,
                             470, 473, 476, 482, 483, 484, 498, 499, 500, 501,
                             506, 508, 515, 519, 520, 524, 527, 528, 530, 531,
                             533, 534, 537, 538, 541, 542, 546, 557, 558, 562,
                             563, 564, 573, 576, 585, 587, 588, 594, 647, 660,
                             664, 672, 682, 683,
                            ];
        this.state = {
            imgIndex: 0,
            isLocal: true,
            bgImgStyle: {},
            totalPic: 830,
            qiniuURL: 'http://omltgvp37.bkt.clouddn.com/',
            localPicDir: '../img/',
        };
    }
    
    componentDidMount() {
        this.setBackground();
        document.addEventListener('keydown', (e: any) => {
            if (e.keyCode === 192) {
                if (document.activeElement.className !== `${this.props.prefix}-search-bar-input`) {
                    this.setBackground();
                }
            }
        });
    }

    componentWillUnmount() {

    }

    private setBackground() {
        const num = Math.round(Math.random() * this.state.totalPic);
        console.log(num, this.eliminateImg);
        if (this.eliminateImg.indexOf(num) > -1) {
            console.log('eliminateImg');
            this.setBackground();
            return false;
        }
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
    }

    render(): JSX.Element {
        return(
            <div className={`${this.props.prefix}-img`} style={this.state.bgImgStyle}></div>
        );
    }
}

export default  Background;
