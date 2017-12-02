import * as React from 'react';
import { render } from 'react-dom';
import { KaguyaProps as Props } from './kaguya';
import SearchEngle from './searchengle';

interface StateInterface {
    prefix: string;
    searchArray: string[];
}

class Navigator extends React.Component <Props, any> {
    state: StateInterface;

    constructor(props: Props, context: any) {
        super(props, context);
        this.state = {
            prefix: `${this.props.prefix}-search`,
            searchArray: [],
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
                <SearchEngle prefix={this.state.prefix}/>
            </div>
        );
    }
}

export default  Navigator;
