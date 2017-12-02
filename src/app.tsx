import * as React from 'react';
import { render } from 'react-dom';
import './scss/index.scss';
import Kaguya from './ts/kaguya';
class App extends React.Component {
    render(): JSX.Element {
        return (
            <Kaguya />
        );
    }
}

render(<App />, document.querySelectorAll('#kaguya')[0]);
