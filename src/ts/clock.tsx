import * as React from 'react';
import { KaguyaProps as Props } from './kaguya';
import Clock from 'kaguya-clock';

class Time extends React.Component <Props> {
    componentDidMount() {
        this.renderClock();
    }

    private renderClock() {
        new Clock({
            selector: '.kaguya-dial',
            type: 'dial',
            renderType: 'canvas',
            draggable: false,
            bgColor: 'rgba(5, 20, 35, 0.85)',
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
