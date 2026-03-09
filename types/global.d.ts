import * as React from 'react';

declare global {
    namespace JSX {
        type Element = React.JSX.Element;
    }
}

interface Window {
    // TODO: 推荐定义所需的变量、方法等的详细类型
    // @deprecated [key: string]: any; 仅仅是方便 TypeScript 化写的，后面会去掉
    [key: string]: any;
    Object: {
        assign: any;
    }
}