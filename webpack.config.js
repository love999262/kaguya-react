const webpack = require('webpack');
const path = require('path');
const ENV = process.env.NODE_ENV;
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');


const config = {
    mode: (ENV === 'production' ? 'production' : 'development'),
    entry: {
        kaguya: path.resolve(__dirname, './src/app.tsx'),
    },
    output: {
        filename: '[name].min.js',
        path: path.resolve(__dirname, 'dist/assets/'),
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
            }, ]
        }, {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: [{
                loader: 'babel-loader',
            }, {
                loader: 'ts-loader',
            }, {
                loader: 'tslint-loader',
            }, ],
        }, {
            test: /\.(png|jpg|gif|ttf|eot|svg|woff)$/,
            use: [{
                loader: 'url-loader',
                options: {
                    limit: 819200
                }
            }]
        }]
    },
    watchOptions: {
        ignored: [/node_modules/]
    },
    plugins: [],
};
if (ENV === 'development') {
    config.plugins.push(new webpack.HotModuleReplacementPlugin());
    config.devServer = {
        contentBase: path.resolve(__dirname, 'dist'),
        inline: true,
        host: 'localhost',
        port: 8089,
        open: true,
        hot: true,
        clientLogLevel: 'none',
        quiet: false,
        historyApiFallback: {
            disableDotRule: true
        },
        watchOptions: {
            ignored: /node_modules/
        }
    };
} else {
    config.optimization = {
        minimizer: [
            new UglifyJsPlugin({
                sourceMap: true,
                extractComments: false,
                uglifyOptions: {
                    compress: {
                        drop_console: true,
                        drop_debugger: true
                    },
                    output: {
                        /**
                         * @desc escape Unicode characters in strings and regexps
                         *       (affects directives with non-ascii characters becoming invalid)
                         */
                        ascii_only: false
                    }
                }
            })
        ]
    };
}
console.log(config);
module.exports = config;
