import * as React from 'react';
import { render } from 'react-dom';
import { KaguyaProps as Props } from './kaguya';
import SearchEngle from './searchengle';
import Navigates from './navigates';
interface StateInterface {
    prefix: string;
}

class Navigator extends React.Component <Props, any> {
    state: StateInterface;

    constructor(props: Props, context: any) {
        super(props, context);
        this.state = {
            prefix: `${this.props.prefix}-search`,
        };
    }

    componentWillMount() {

    }
    
    componentDidMount() {

    }

    componentWillUnmount() {}

    handleSearchEvent() {

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
export { StateInterface };
