import * as React from 'react';
import { render } from 'react-dom';
import Background from './background';
import Navigator from './navigator';

interface StateInterface {
    prefix: string;
}
class Kaguya extends React.Component <any, any> {
    state: StateInterface;
    constructor(props: any, context: any) {
        super(props, context);
        this.state = {
            prefix: 'kaguya',
        };
    }
    componentDidMount() {
        
    }
    render(): JSX.Element {
        return (
            <div className='kaguya'>
                <Background prefix={this.state.prefix} />
                <Navigator prefix={this.state.prefix} />
            </div>
        );
    }
}

export default Kaguya;
export { StateInterface as KaguyaProps };
