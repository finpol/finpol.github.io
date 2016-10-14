module.exports = {
    entry: './src/js/main.js',
    output: {
        path: './dist',
        publicPath: '/',
        filename: 'main.js'
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: 'babel',
                query: {
                    cacheDirectory: true,
                    presets: ['es2015']
                }
            }
        ]
    }
};
