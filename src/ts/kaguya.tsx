import * as React from 'react';
import { render } from 'react-dom';
import Background from './background';

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
    render(): JSX.Element {
        return (
            <Background prefix={this.state.prefix} />
        );
    }
}

export default Kaguya;
export { StateInterface as KaguyaProps };
