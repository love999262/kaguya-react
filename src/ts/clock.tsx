import * as React from 'react';
import { render } from 'react-dom';
import { KaguyaProps as Props } from './kaguya';
import Clock from 'syg-clock';
interface StateInterface {
    prefix: string;
}

class Time extends React.Component <Props, any> {
    state: StateInterface;
    clock: Clock;
    constructor(props: Props, context: any) {
        super(props, context);
        Clock;
        this.state = {
            prefix: `${this.props.prefix}-search`,
        };
    }

    componentWillMount() {

    }
    
    componentDidMount() {
        // console.log(window.Clock);
        this.renderClock();
    }

    componentWillUnmount() {
        
    }
    renderClock() {
        this.clock = new window.Clock({
            selector: '.kaguya-clock',
            type: 'dial',
            // color: '#000',
            // bgColor: 'rgba(255, 255, 255, .2)',
        });
    }
    render(): JSX.Element {
        return(
            <div className={`${this.props.prefix}-clock`}>
            </div>
        );
    }
}

export default  Time;
export { StateInterface };
