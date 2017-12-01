const webpack = require('webpack');
const path = require('path');
const ENV = process.env.NODE_ENV;

const plugins = [
    new webpack.ProgressPlugin(),
    new webpack.optimize.UglifyJsPlugin({
        sourceMap: true,
        compress: {
            warnings: false,
            drop_debugger: (ENV === 'dev' || ENV === 'watch') ? false : true,
            drop_console: (ENV === 'dev' || ENV === 'watch') ? false : true
        }
    }),
];

const config = {
    entry: {
        app: [
            path.resolve(__dirname, './src/app.tsx'),
        ]
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/assets/',
        filename: 'kaguya.min.js'
    },
    devtool: (ENV === 'dev' || ENV === 'watch') ? 'eval-source-map' : 'inline-source-map',
    devServer: {
        contentBase: './dist/',
        historyApiFallback: true,
        inline: true,
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.jsx', '.js']
    },
    module: {
        rules: [{
            test: /\.scss$/,
            use: [
                'style-loader',
                'css-loader',
                'postcss-loader',
                'sass-loader'
            ]
        }, {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: [
                'babel-loader',
                'ts-loader',
                'tslint-loader',
            ],
        }, {
            enforce: 'pre',
            test: /\.jsx?$/,
            exclude: /node_modules/,
            loader: 'eslint-loader',
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
    plugins: plugins,
};

module.exports = config;
