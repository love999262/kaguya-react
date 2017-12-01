import * as React from 'react';
import { render } from 'react-dom';


interface InterfaceA {
    asd: number;
}
class A {
    // config: InterfaceA;
    constructor(a: InterfaceA) {
        console.log(console.log(a.asd));
    }
}

const aaa = new A({ asd: 123 });

// class App extends React.Component {
//   render(): JSX.Element {
//     return (
//       <div>
//         Hello world
//       </div>
//     );
//   }
// }

// render(<App />, document.getElementById('app'));
