import * as React from 'react';
import { render } from 'react-dom';

class App extends React.Component {
    render(): JSX.Element {
        return (
            <div>
                Hello R挖冲突
            </div>
        );
    }
}

render(<App />, document.getElementById('root'));
