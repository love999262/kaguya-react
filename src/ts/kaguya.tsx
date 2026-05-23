import * as React from 'react';
import Background from './background';
import Navigator from './navigator';
import Clock from './clock';
import Calendar from './calendar';
import Live2D from './live2d';

// 深度模式面板懒加载，避免 WebLLM 大模块打包进首屏 bundle
const DeepMode = React.lazy(() => import('./deepmode'));
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
            <div className='kaguya'>
                <Background prefix={this.state.prefix} />
                <Calendar prefix={this.state.prefix} />
                <Navigator prefix={this.state.prefix} />
                <Clock prefix={this.state.prefix} />
                {/* <Live2D /> */}
                <React.Suspense fallback={null}>
                    <DeepMode />
                </React.Suspense>
            </div>
        );
    }
}

export default Kaguya;
export type { StateInterface as KaguyaProps };

