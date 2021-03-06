import axios from 'axios';

interface InterfaceParams {
    url: string;
}

const utils = {
    getRandomColor() {
        let r: string | number = Math.floor(Math.random() * 256);
        let g: string | number = Math.floor(Math.random() * 256);
        let b: string | number = Math.floor(Math.random() * 256);
        if (r < 16) {
            r = `0${r.toString(16)}`;
        } else {
            r = r.toString(16);
        }
        if (g < 16) {
            g = `0${g.toString(16)}`;
        } else {
            g = g.toString(16);
        }
        if (b < 16) {
            b = `0${b.toString(16)}`;
        } else {
            b = b.toString(16);
        }
        return `#${r}${g}${b}`;
    },
    ajax(para: InterfaceParams) {
        para = (<any>Object).assign({
            baseURL: '//love999262.github.io/kaguya-react/',
            url: '',
            method: 'get',
        }, para);
        return axios(para);
    },
};

export default utils;
