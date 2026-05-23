import * as React from 'react';
import { KaguyaProps as Props } from './kaguya';
import Clock from 'kaguya-clock';

interface ClockTheme {
    dialBg: string;
    digitalBg: string;
    textColor: string;
}

const THEMES: ClockTheme[] = [
    { dialBg: 'rgba(14, 34, 59, 0.92)', digitalBg: 'rgba(14, 34, 59, 0.9)', textColor: 'rgba(236, 245, 255, 0.98)' },
    { dialBg: 'rgba(22, 41, 70, 0.92)', digitalBg: 'rgba(19, 38, 66, 0.9)', textColor: 'rgba(229, 250, 255, 0.98)' },
    { dialBg: 'rgba(27, 36, 64, 0.92)', digitalBg: 'rgba(24, 33, 62, 0.9)', textColor: 'rgba(241, 236, 255, 0.98)' },
    { dialBg: 'rgba(21, 44, 56, 0.92)', digitalBg: 'rgba(17, 39, 51, 0.9)', textColor: 'rgba(230, 253, 247, 0.98)' },
];

class Time extends React.Component <Props, any> {
    dialRef: React.RefObject<HTMLDivElement>;
    digitalRef: React.RefObject<HTMLDivElement>;

    constructor(props: Props, context: any) {
        super(props, context);
        this.dialRef = React.createRef();
        this.digitalRef = React.createRef();
    }
    
    componentDidMount() {
        this.renderClock();
    }

    componentWillUnmount() {
        this.destroyClock();
    }

    private destroyClock() {
        if (this.dialRef.current) this.dialRef.current.innerHTML = '';
        if (this.digitalRef.current) this.digitalRef.current.innerHTML = '';
    }

    private renderClock() {
        const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
        new Clock({
            selector: '.kaguya-dial',
            type: 'dial',
            renderType: 'canvas',
            draggable: false,
            bgColor: theme.dialBg,
            dial: { hasTimeLabel: true, hasBorder: false },
            digital: { fontSize: 12 },
        });
        new Clock({
            selector: '.kaguya-digital',
            type: 'digital',
            renderType: 'canvas',
            draggable: false,
            color: theme.textColor,
            bgColor: theme.digitalBg,
            dial: { hasTimeLabel: true, hasBorder: false },
            digital: { fontSize: 24 },
        });
    }

    render(): JSX.Element {
        return(
            <>
                <div className={`${this.props.prefix}-dial`} ref={this.dialRef}></div>
                <div className={`${this.props.prefix}-digital`} ref={this.digitalRef}></div>
            </>
        );
    }
}

export default  Time;
