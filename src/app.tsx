/// <reference path="./../types/global.d.ts"/>

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './scss/index.scss';
import Kaguya from './ts/kaguya';

const rootElement = document.getElementById('kaguya');

if (!rootElement) {
    throw new Error('Missing root element #kaguya');
}

const root = createRoot(rootElement);
root.render(<Kaguya />);

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((error: unknown) => {
            console.error('Service worker registration failed:', error);
        });
    });
}
