import * as React from 'react';
import Background from './background';
import Navigator from './navigator';
import Clock from './clock';

interface StateInterface {
    prefix: string;
}

class Kaguya extends React.Component<Record<string, never>, StateInterface> {
    state: StateInterface = {
        prefix: 'kaguya',
    };

    render(): JSX.Element {
        return (
            <div className='kaguya'>
                <Background prefix={this.state.prefix} />
                <Navigator prefix={this.state.prefix} />
                <Clock prefix={this.state.prefix} />
            </div>
        );
    }
}

export default Kaguya;
export type { StateInterface as KaguyaProps };
