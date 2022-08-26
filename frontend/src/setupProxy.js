const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    createProxyMiddleware(
      [
        '/api/**',
        '/bo/files/**'
      ], {
      target: "http://localhost:5000",
      changeOrigin: true,
    })
  );
};
