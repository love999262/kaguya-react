import * as React from 'react';
import { KaguyaProps as Props } from './kaguya';
import SearchEngle from './searchengle';
import Navigates from './navigates';
interface StateInterface {
    prefix: string;
}

class Navigator extends React.Component <Props, StateInterface> {
    state: StateInterface;

    constructor(props: Props) {
        super(props);
        this.state = {
            prefix: `${this.props.prefix}-search`,
        };
    }

    render(): JSX.Element {
        return(
            <div className={`${this.props.prefix}-search`}>
                <SearchEngle prefix={this.state.prefix} />
                <Navigates prefix={this.state.prefix} />
            </div>
        );
    }
}

export default  Navigator;
export type { StateInterface };
