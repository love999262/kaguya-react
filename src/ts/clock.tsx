import * as React from 'react';
import { KaguyaProps as Props } from './kaguya';
import Clock from 'kaguya-clock';
import { getResolvedTheme, onThemeChange } from './theme';
import type { ResolvedTheme } from './theme';

interface ClockTheme {
    dialBg: string;
    digitalBg: string;
    textColor: string;
}

const CLOCK_THEMES: Record<ResolvedTheme, ClockTheme[]> = {
    dark: [
        { dialBg: 'rgba(28, 30, 34, 0.55)', digitalBg: 'rgba(28, 30, 34, 0.5)', textColor: 'rgba(242, 244, 248, 0.98)' },
        { dialBg: 'rgba(34, 36, 40, 0.55)', digitalBg: 'rgba(34, 36, 40, 0.5)', textColor: 'rgba(240, 242, 246, 0.98)' },
        { dialBg: 'rgba(24, 26, 30, 0.55)', digitalBg: 'rgba(24, 26, 30, 0.5)', textColor: 'rgba(244, 246, 250, 0.98)' },
        { dialBg: 'rgba(30, 32, 36, 0.55)', digitalBg: 'rgba(30, 32, 36, 0.5)', textColor: 'rgba(242, 244, 248, 0.98)' },
    ],
    light: [
        { dialBg: 'rgba(255, 255, 255, 0.55)', digitalBg: 'rgba(255, 255, 255, 0.5)', textColor: 'rgba(28, 43, 64, 0.96)' },
        { dialBg: 'rgba(246, 250, 255, 0.55)', digitalBg: 'rgba(244, 249, 255, 0.86)', textColor: 'rgba(31, 47, 69, 0.96)' },
        { dialBg: 'rgba(250, 248, 255, 0.55)', digitalBg: 'rgba(248, 246, 255, 0.86)', textColor: 'rgba(40, 36, 66, 0.96)' },
        { dialBg: 'rgba(244, 252, 250, 0.55)', digitalBg: 'rgba(240, 250, 247, 0.86)', textColor: 'rgba(28, 58, 52, 0.96)' },
    ],
};

class Time extends React.Component <Props, any> {
    dialRef: React.RefObject<HTMLDivElement>;
    digitalRef: React.RefObject<HTMLDivElement>;
    unsubscribeTheme: (() => void) | null;

    constructor(props: Props, context: any) {
        super(props, context);
        this.dialRef = React.createRef();
        this.digitalRef = React.createRef();
        this.unsubscribeTheme = null;
    }

    componentDidMount() {
        this.renderClock();
        this.unsubscribeTheme = onThemeChange(() => {
            this.destroyClock();
            this.renderClock();
        });
    }

    componentWillUnmount() {
        if (this.unsubscribeTheme) {
            this.unsubscribeTheme();
            this.unsubscribeTheme = null;
        }
        this.destroyClock();
    }

    private destroyClock() {
        if (this.dialRef.current) this.dialRef.current.innerHTML = '';
        if (this.digitalRef.current) this.digitalRef.current.innerHTML = '';
    }

    private renderClock() {
        const themeList = CLOCK_THEMES[getResolvedTheme()];
        const theme = themeList[Math.floor(Math.random() * themeList.length)];
        new Clock({
            selector: '.kaguya-dial',
            type: 'dial',
            renderType: 'canvas',
            draggable: false,
            bgColor: theme.dialBg,
            color: theme.textColor,
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
