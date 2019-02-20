import * as React from 'react';
import { render } from 'react-dom';
import { KaguyaProps as Props } from './kaguya';
import Clock from 'kaguya-clock';
import utils from './utils';
interface StateInterface {
    prefix: string;
}

class Time extends React.Component <Props, any> {
    state: StateInterface;
    clock: Clock;
    constructor(props: Props, context: any) {
        super(props, context);
        this.state = {
            prefix: `${this.props.prefix}-search`,
        };
    }

    componentWillMount() {

    }
    
    componentDidMount() {
        // console.log(window.Clock);
        this.renderClock();
    }

    componentWillUnmount() {
    }
    renderClock() {
        new Clock({
            selector: '.kaguya-dial',
            type: 'dial',
            renderType: 'canvas',
            draggable: false,
            // color: utils.getRandomColor(),
            bgColor: utils.getRandomColor(),
            dial: {
                hasTimeLabel: true,
                hasBorder: false,
            },
            digital: {
                fontSize: 12,
            },
        });
        new Clock({
            selector: '.kaguya-digital',
            type: 'digital',
            renderType: 'canvas',
            draggable: false,
            // color: 'rgba(255, 255, 255, 1)',
            // bgColor: 'rgba(0, 0, 0, 0.3)',
            // bgColor: utils.getRandomColor(),
            dial: {
                hasTimeLabel: true,
                hasBorder: true,
            },
            digital: {
                fontSize: 24,
            },
        });
    }
    render(): JSX.Element {
        return(
            <>
                <div className={`${this.props.prefix}-dial`}></div>
                <div className={`${this.props.prefix}-digital`}></div>
            </>
        );
    }
}

export default  Time;
export { StateInterface };
