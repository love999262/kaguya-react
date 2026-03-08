import * as React from 'react';

const SHOW_MIN_WIDTH = 1320;
const LIVE2D_SCRIPT_URL = 'live2d/lib/L2Dwidget.min.js';

const MODEL_MAP: Record<'22' | '33', string> = {
    '22': 'live2d/model/bilibili-live/22/index.json',
    '33': 'live2d/model/bilibili-live/33/index.json',
};

type ModelId = '22' | '33';
type OffsetState = Record<ModelId, { x: number; y: number }>;

type DragState = {
    id: ModelId;
    startScreenX: number;
    startScreenY: number;
    baseX: number;
    baseY: number;
};

const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

const buildIframeDoc = (jsonPath: string): string => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
}
#live2d-widget {
    left: 0 !important;
    right: auto !important;
    top: auto !important;
    bottom: -24px !important;
}
#live2d-widget canvas {
    pointer-events: auto !important;
}
</style>
</head>
<body>
<script src="${LIVE2D_SCRIPT_URL}"><\/script>
<script>
window.addEventListener('load', function () {
    var w = window.L2Dwidget;
    if (!w || typeof w.init !== 'function') {
        return;
    }
    w.init({
        model: {
            jsonPath: ${JSON.stringify(jsonPath)},
            scale: 1
        },
        display: {
            position: 'left',
            width: 282,
            height: 548,
            hOffset: 0,
            vOffset: -24
        },
        mobile: { show: false },
        react: {
            opacityDefault: 1,
            opacityOnHover: 1
        },
        dialog: { enable: false }
    });
});
<\/script>
</body>
</html>`;

const Live2D = (): JSX.Element => {
    const [visible, setVisible] = React.useState<boolean>(window.innerWidth >= SHOW_MIN_WIDTH);
    const [offsets, setOffsets] = React.useState<OffsetState>({
        '22': { x: 0, y: 0 },
        '33': { x: 0, y: 0 },
    });

    const offsetsRef = React.useRef<OffsetState>(offsets);
    const dragRef = React.useRef<DragState | null>(null);
    const frame22Ref = React.useRef<HTMLIFrameElement | null>(null);
    const frame33Ref = React.useRef<HTMLIFrameElement | null>(null);
    const cleanupsRef = React.useRef<Array<() => void>>([]);

    React.useEffect(() => {
        offsetsRef.current = offsets;
    }, [offsets]);

    React.useEffect(() => {
        const onResize = (): void => {
            setVisible(window.innerWidth >= SHOW_MIN_WIDTH);
        };

        onResize();
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
        };
    }, []);

    const clearFrameListeners = React.useCallback((): void => {
        cleanupsRef.current.forEach((cleanup: () => void) => cleanup());
        cleanupsRef.current = [];
    }, []);

    const bindFrameDrag = React.useCallback((id: ModelId, frame: HTMLIFrameElement | null): void => {
        if (!frame || frame.dataset.dragBound === '1') {
            return;
        }

        const doc = frame.contentDocument;
        if (!doc || !doc.body) {
            return;
        }

        frame.dataset.dragBound = '1';
        doc.body.style.cursor = 'grab';

        const onPointerDown = (event: PointerEvent): void => {
            if (event.button !== 0) {
                return;
            }

            const current = offsetsRef.current[id];
            dragRef.current = {
                id,
                startScreenX: event.screenX,
                startScreenY: event.screenY,
                baseX: current.x,
                baseY: current.y,
            };

            doc.body.style.cursor = 'grabbing';
            const target = event.target as Element & { setPointerCapture?: (pointerId: number) => void };
            if (target && typeof target.setPointerCapture === 'function') {
                target.setPointerCapture(event.pointerId);
            }
        };

        const onPointerMove = (event: PointerEvent): void => {
            const state = dragRef.current;
            if (!state || state.id !== id) {
                return;
            }

            const nextX = clamp(state.baseX + (event.screenX - state.startScreenX), -460, 320);
            const nextY = clamp(state.baseY + (event.screenY - state.startScreenY), -240, 180);

            setOffsets((prev: OffsetState) => ({
                ...prev,
                [id]: { x: nextX, y: nextY },
            }));
        };

        const onPointerUp = (): void => {
            if (dragRef.current && dragRef.current.id === id) {
                dragRef.current = null;
            }
            doc.body.style.cursor = 'grab';
        };

        doc.addEventListener('pointerdown', onPointerDown);
        doc.addEventListener('pointermove', onPointerMove);
        doc.addEventListener('pointerup', onPointerUp);
        doc.addEventListener('pointercancel', onPointerUp);

        cleanupsRef.current.push(() => {
            doc.removeEventListener('pointerdown', onPointerDown);
            doc.removeEventListener('pointermove', onPointerMove);
            doc.removeEventListener('pointerup', onPointerUp);
            doc.removeEventListener('pointercancel', onPointerUp);
            frame.dataset.dragBound = '0';
        });
    }, []);

    React.useEffect(() => {
        if (!visible) {
            clearFrameListeners();
            return;
        }

        return () => {
            clearFrameListeners();
        };
    }, [clearFrameListeners, visible]);

    React.useEffect(() => {
        return () => {
            clearFrameListeners();
        };
    }, [clearFrameListeners]);

    const docs = React.useMemo(() => {
        return {
            '22': buildIframeDoc(MODEL_MAP['22']),
            '33': buildIframeDoc(MODEL_MAP['33']),
        };
    }, []);

    if (!visible) {
        return <></>;
    }

    return (
        <div className='kaguya-live2d-group'>
            <div
                className='kaguya-live2d-shell kaguya-live2d-shell-22'
                style={{ transform: `translate3d(${offsets['22'].x}px, ${offsets['22'].y}px, 0)` }}
            >
                <iframe
                    ref={frame22Ref}
                    className='kaguya-live2d-frame'
                    sandbox='allow-scripts allow-same-origin'
                    srcDoc={docs['22']}
                    title='live2d-2233-22'
                    onLoad={(): void => bindFrameDrag('22', frame22Ref.current)}
                />
            </div>
            <div
                className='kaguya-live2d-shell kaguya-live2d-shell-33'
                style={{ transform: `translate3d(${offsets['33'].x}px, ${offsets['33'].y}px, 0)` }}
            >
                <iframe
                    ref={frame33Ref}
                    className='kaguya-live2d-frame'
                    sandbox='allow-scripts allow-same-origin'
                    srcDoc={docs['33']}
                    title='live2d-2233-33'
                    onLoad={(): void => bindFrameDrag('33', frame33Ref.current)}
                />
            </div>
        </div>
    );
};

export default Live2D;
