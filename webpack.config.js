const webpack = require('webpack');
const path = require('path');
const ENV = process.env.NODE_ENV;


const config = {
    mode: (ENV === 'production' ? 'production' : 'development'),
    entry: {
        app: path.resolve(__dirname, './src/app.tsx'),
    },
    output: {
        filename: '[name].min.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/assets/',
    },
    devtool: (ENV === 'dev' || ENV === 'watch') ? 'eval-source-map' : 'inline-source-map',
    resolve: {
        extensions: ['.tsx', '.ts', '.jsx', '.js'],
    },
    module: {
        rules: [{
            test: /\.scss$/,
            use: [{
                loader: 'style-loader',
            }, {
                loader: 'css-loader',
                options: {
                    minimize: {
                        discardComments: {
                            removeAll: true
                        },
                    },
                    importLoaders: 2,
                }
            }, {
                loader: 'postcss-loader',
            }, {
                loader: 'sass-loader',
            },
            ]
        }, {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: [{
                loader: 'babel-loader',
            }, {
                loader: 'ts-loader',
            }, {
                loader: 'tslint-loader',
            },
            ],
        }, {
            test: /\.(png|jpg|gif|ttf|eot|svg|woff)$/,
            use: [
                {
                    loader: 'url-loader',
                    options: { limit: 819200 }
                }
            ]
        }]
    },
    watchOptions: {
        ignored: [/node_modules/]
    },
};
if (ENV === 'production') {
    config.devServer = {
        contentBase: '/dist/',
        historyApiFallback: true,
        inline: true,
        host: 'localhost',
        port: 8080,
        open: true,
        openPage: '/dist/',
    };
}
console.log(config);
module.exports = config;
