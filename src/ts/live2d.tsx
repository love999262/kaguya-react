import * as React from 'react';

interface Live2DWidgetConfig {
    model: {
        jsonPath: string;
    };
    display: {
        superSample: number;
        width: number;
        height: number;
        position: 'left' | 'right';
        hOffset: number;
        vOffset: number;
    };
    mobile: {
        show: boolean;
    };
    react: {
        opacityDefault: number;
        opacityOnHover: number;
    };
}

interface Live2DWidgetApi {
    init: (config: Live2DWidgetConfig) => void;
}

interface Live2DWindow extends Window {
    L2Dwidget?: Live2DWidgetApi;
    initDefine?: (resourcesPath: string, backImageName: string, modelDir: string[]) => void;
}

interface StateInterface {
    tipText: string;
    showTip: boolean;
}

const DESKTOP_MIN_WIDTH = 1320;
const MIKU_SCRIPT_ID = 'kaguya-live2d-miku-script';
const MIKU_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/live2d-widget@3.1.4/lib/L2Dwidget.min.js';
const MIKU_MODEL_URL = 'https://cdn.jsdelivr.net/npm/live2d-widget-model-miku@1.0.5/assets/miku.model.json';

const LUO_CORE_SCRIPT_ID = 'kaguya-live2d-luo-core-script';
const LUO_BUNDLE_SCRIPT_ID = 'kaguya-live2d-luo-bundle-script';
const LUO_CORE_SCRIPT_URL = 'https://cdn.jsdelivr.net/gh/x66ccff/lty-lv2d-v3@master/live2dcubismcore.js';
const LUO_BUNDLE_SCRIPT_URL = 'https://cdn.jsdelivr.net/gh/x66ccff/lty-lv2d-v3@master/bundle.js';
const LUO_RESOURCES_PATH = 'https://cdn.jsdelivr.net/gh/x66ccff/lty-lv2d-v3@master/';

const MIKU_TIPS = [
    '初音未来：我来陪你工作啦。',
    '初音未来：点我可以互动，拖我可以换位置。',
    '初音未来：今天也一起高效一点。',
];

const LUO_TIPS = [
    '洛天依：在呢，右侧随时待命。',
    '洛天依：拖拽我到你喜欢的位置吧。',
    '洛天依：要不要来点灵感？',
];

const scriptPromiseMap: Record<string, Promise<void>> = {};

class Live2D extends React.Component<object, StateInterface> {
    state: StateInterface;
    private mikuInitialized: boolean;
    private luoInitialized: boolean;
    private tipTimer: number | null;
    private removeListeners: Array<() => void>;

    constructor(props: object) {
        super(props);
        this.state = {
            tipText: '',
            showTip: false,
        };
        this.mikuInitialized = false;
        this.luoInitialized = false;
        this.tipTimer = null;
        this.removeListeners = [];

        this.handleResize = this.handleResize.bind(this);
        this.handleMikuButtonClick = this.handleMikuButtonClick.bind(this);
        this.handleLuoButtonClick = this.handleLuoButtonClick.bind(this);
    }

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
        this.bootstrap();
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
        if (this.tipTimer !== null) {
            window.clearTimeout(this.tipTimer);
            this.tipTimer = null;
        }
        this.removeListeners.forEach((removeFn) => removeFn());
        this.removeListeners = [];
    }

    private isDesktopWidth() {
        return window.innerWidth > DESKTOP_MIN_WIDTH;
    }

    private async bootstrap() {
        if (!this.isDesktopWidth()) {
            this.syncVisibility();
            return;
        }
        try {
            await this.initMiku();
            await this.initLuoTianyi();
            this.syncVisibility();
        } catch (error) {
            console.warn('Live2D bootstrap failed:', error);
        }
    }

    private loadScript(scriptId: string, scriptUrl: string) {
        if (scriptPromiseMap[scriptId]) {
            return scriptPromiseMap[scriptId];
        }

        scriptPromiseMap[scriptId] = new Promise<void>((resolve, reject) => {
            const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
            if (existingScript) {
                if ((existingScript as any).dataset.loaded === '1' || this.isRuntimeReady(scriptId)) {
                    resolve();
                    return;
                }
                existingScript.addEventListener('load', () => resolve(), { once: true });
                existingScript.addEventListener('error', () => reject(new Error(`Script load failed: ${scriptUrl}`)), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.id = scriptId;
            script.async = true;
            script.src = scriptUrl;
            script.onload = () => {
                (script as any).dataset.loaded = '1';
                resolve();
            };
            script.onerror = () => reject(new Error(`Script load failed: ${scriptUrl}`));
            document.body.appendChild(script);
        });

        return scriptPromiseMap[scriptId];
    }

    private isRuntimeReady(scriptId: string) {
        const runtimeWindow = window as Live2DWindow;
        if (scriptId === MIKU_SCRIPT_ID) {
            return Boolean(runtimeWindow.L2Dwidget);
        }
        if (scriptId === LUO_BUNDLE_SCRIPT_ID) {
            return typeof runtimeWindow.initDefine === 'function';
        }
        return false;
    }

    private async initMiku() {
        if (this.mikuInitialized) {
            this.bindMikuInteractions();
            return;
        }
        await this.loadScript(MIKU_SCRIPT_ID, MIKU_SCRIPT_URL);
        const runtimeWindow = window as Live2DWindow;
        if (!runtimeWindow.L2Dwidget) {
            return;
        }

        runtimeWindow.L2Dwidget.init({
            model: {
                jsonPath: MIKU_MODEL_URL,
            },
            display: {
                superSample: 2,
                width: 220,
                height: 420,
                position: 'right',
                hOffset: 18,
                vOffset: -20,
            },
            mobile: {
                show: false,
            },
            react: {
                opacityDefault: 0.95,
                opacityOnHover: 0.2,
            },
        });

        this.mikuInitialized = true;
        window.setTimeout(() => {
            this.bindMikuInteractions();
            this.syncVisibility();
        }, 280);
    }

    private bindMikuInteractions() {
        const widgetElement = document.getElementById('live2d-widget');
        if (!widgetElement) {
            return;
        }
        widgetElement.classList.add('kaguya-live2d-miku');
        this.enableDragAndTip(widgetElement, 'miku');
    }

    private async initLuoTianyi() {
        if (this.luoInitialized) {
            this.bindLuoInteractions();
            return;
        }
        await this.loadScript(LUO_CORE_SCRIPT_ID, LUO_CORE_SCRIPT_URL);
        await this.loadScript(LUO_BUNDLE_SCRIPT_ID, LUO_BUNDLE_SCRIPT_URL);

        const runtimeWindow = window as Live2DWindow;
        if (typeof runtimeWindow.initDefine !== 'function') {
            return;
        }

        runtimeWindow.initDefine(LUO_RESOURCES_PATH, '', ['Hiyori']);
        this.luoInitialized = true;

        window.setTimeout(() => {
            this.bindLuoInteractions();
            this.syncVisibility();
        }, 360);
    }

    private bindLuoInteractions() {
        const luoCanvas = document.getElementById('live2d');
        if (!luoCanvas) {
            return;
        }
        luoCanvas.classList.add('kaguya-live2d-luo');
        this.enableDragAndTip(luoCanvas, 'luo');
    }

    private enableDragAndTip(element: HTMLElement, role: 'miku' | 'luo') {
        if (element.dataset.kaguyaDragBound === '1') {
            return;
        }
        element.dataset.kaguyaDragBound = '1';

        let startX = 0;
        let startY = 0;
        let baseLeft = 0;
        let baseTop = 0;
        let moved = false;
        let dragging = false;

        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0) {
                return;
            }
            startX = event.clientX;
            startY = event.clientY;
            const rect = element.getBoundingClientRect();
            baseLeft = rect.left;
            baseTop = rect.top;
            moved = false;
            dragging = true;
            element.style.right = 'auto';
            element.style.bottom = 'auto';
            if (event.pointerId >= 0 && element.setPointerCapture) {
                element.setPointerCapture(event.pointerId);
            }
        };

        const onPointerMove = (event: PointerEvent) => {
            if (!dragging) {
                return;
            }
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            if (!moved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
                moved = true;
            }
            if (!moved) {
                return;
            }
            element.style.left = `${Math.max(0, baseLeft + deltaX)}px`;
            element.style.top = `${Math.max(0, baseTop + deltaY)}px`;
        };

        const onPointerUp = (event: PointerEvent) => {
            if (!dragging) {
                return;
            }
            dragging = false;
            if (event.pointerId >= 0 && element.releasePointerCapture) {
                try {
                    element.releasePointerCapture(event.pointerId);
                } catch (error) {
                    // Ignore pointer capture release edge cases.
                }
            }
            if (moved) {
                this.showTip(role === 'miku' ? '初音未来：位置已更新。' : '洛天依：位置已更新。');
            } else {
                this.showTip(this.pickRoleTip(role));
            }
        };

        element.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);

        this.removeListeners.push(() => element.removeEventListener('pointerdown', onPointerDown));
        this.removeListeners.push(() => window.removeEventListener('pointermove', onPointerMove));
        this.removeListeners.push(() => window.removeEventListener('pointerup', onPointerUp));
    }

    private pickRoleTip(role: 'miku' | 'luo') {
        const list = role === 'miku' ? MIKU_TIPS : LUO_TIPS;
        return list[Math.floor(Math.random() * list.length)];
    }

    private showTip(text: string) {
        if (this.tipTimer !== null) {
            window.clearTimeout(this.tipTimer);
            this.tipTimer = null;
        }
        this.setState({
            tipText: text,
            showTip: true,
        });
        this.tipTimer = window.setTimeout(() => {
            this.setState({ showTip: false });
        }, 2200);
    }

    private syncVisibility() {
        const visible = this.isDesktopWidth();
        const luoCanvas = document.getElementById('live2d');
        const mikuElement = document.getElementById('live2d-widget');
        const panel = document.getElementById('kaguya-live2d-panel');

        if (luoCanvas) {
            luoCanvas.style.display = visible ? 'block' : 'none';
        }
        if (mikuElement) {
            mikuElement.style.display = visible ? 'block' : 'none';
        }
        if (panel) {
            panel.style.display = visible ? 'flex' : 'none';
        }
        if (!visible && this.state.showTip) {
            this.setState({ showTip: false });
        }
    }

    private handleResize() {
        if (this.isDesktopWidth()) {
            this.bootstrap();
        } else {
            this.syncVisibility();
        }
    }

    private handleMikuButtonClick() {
        this.showTip(this.pickRoleTip('miku'));
    }

    private handleLuoButtonClick() {
        this.showTip(this.pickRoleTip('luo'));
    }

    render(): JSX.Element {
        return (
            <>
                <canvas id='live2d' width={320} height={520} className='kaguya-live2d-luo'></canvas>
                <div id='kaguya-live2d-panel' className='kaguya-live2d-panel'>
                    <button className='kaguya-live2d-btn' onClick={this.handleLuoButtonClick}>洛天依</button>
                    <button className='kaguya-live2d-btn' onClick={this.handleMikuButtonClick}>初音未来</button>
                </div>
                <div className={`kaguya-live2d-tip${this.state.showTip ? ' kaguya-live2d-tip-visible' : ''}`}>
                    {this.state.tipText}
                </div>
            </>
        );
    }
}

export default Live2D;
