import * as React from 'react';
import { KaguyaProps as Props } from './kaguya';
import { getThemeMode, onThemeChange, setThemeMode } from './theme';
import type { ThemeMode } from './theme';

interface StateInterface {
    mode: ThemeMode;
}

interface ModeOption {
    id: ThemeMode;
    label: string;
    icon: JSX.Element;
}

const MODE_OPTIONS: ModeOption[] = [
    {
        id: 'light',
        label: '日间',
        icon: (
            <svg viewBox='0 0 24 24' width='13' height='13' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                <circle cx='12' cy='12' r='5' />
                <line x1='12' y1='1' x2='12' y2='3' />
                <line x1='12' y1='21' x2='12' y2='23' />
                <line x1='4.22' y1='4.22' x2='5.64' y2='5.64' />
                <line x1='18.36' y1='18.36' x2='19.78' y2='19.78' />
                <line x1='1' y1='12' x2='3' y2='12' />
                <line x1='21' y1='12' x2='23' y2='12' />
                <line x1='4.22' y1='19.78' x2='5.64' y2='18.36' />
                <line x1='18.36' y1='5.64' x2='19.78' y2='4.22' />
            </svg>
        ),
    },
    {
        id: 'dark',
        label: '夜间',
        icon: (
            <svg viewBox='0 0 24 24' width='13' height='13' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
            </svg>
        ),
    },
    {
        id: 'system',
        label: '跟随系统',
        icon: (
            <svg viewBox='0 0 24 24' width='13' height='13' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                <rect x='2' y='3' width='20' height='14' rx='2' ry='2' />
                <line x1='8' y1='21' x2='16' y2='21' />
                <line x1='12' y1='17' x2='12' y2='21' />
            </svg>
        ),
    },
];

class ThemeToggle extends React.Component<Props, StateInterface> {
    private unsubscribeTheme: (() => void) | null;

    constructor(props: Props, context: any) {
        super(props, context);
        this.unsubscribeTheme = null;
        this.state = {
            mode: getThemeMode(),
        };
    }

    componentDidMount() {
        this.unsubscribeTheme = onThemeChange((detail) => {
            this.setState({ mode: detail.mode });
        });
    }

    componentWillUnmount() {
        if (this.unsubscribeTheme) {
            this.unsubscribeTheme();
            this.unsubscribeTheme = null;
        }
    }

    private handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
        const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
        if (!keys.includes(event.key)) {
            return;
        }
        event.preventDefault();
        const currentIndex = MODE_OPTIONS.findIndex((option) => option.id === this.state.mode);
        const delta = (event.key === 'ArrowRight' || event.key === 'ArrowDown') ? 1 : -1;
        const nextIndex = (currentIndex + delta + MODE_OPTIONS.length) % MODE_OPTIONS.length;
        setThemeMode(MODE_OPTIONS[nextIndex].id);
    };

    render(): JSX.Element {
        const prefix = this.props.prefix;
        return (
            <div
                className={`${prefix}-theme-toggle`}
                role='radiogroup'
                aria-label='主题模式'
                onKeyDown={this.handleKeyDown}
            >
                {MODE_OPTIONS.map((option) => {
                    const isActive = option.id === this.state.mode;
                    return (
                        <button
                            key={option.id}
                            type='button'
                            role='radio'
                            aria-checked={isActive}
                            title={option.label}
                            tabIndex={isActive ? 0 : -1}
                            className={`${prefix}-theme-toggle-item${isActive ? ` ${prefix}-theme-toggle-item-active` : ''}`}
                            onClick={() => { setThemeMode(option.id); }}
                        >
                            {option.icon}
                        </button>
                    );
                })}
            </div>
        );
    }
}

export default ThemeToggle;
