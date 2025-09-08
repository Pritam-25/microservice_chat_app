import express, { Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 8080;

const routes = {
  "/auth": { target: "http://localhost:5000/api/v1", rewrite: { "^/auth": "/auth" } },
  "/conversations": { target: "http://localhost:4000/api/v1", rewrite: { "^/conversations": "/conversations" } },
  "/messages": { target: "http://localhost:4000/api/v1", rewrite: { "^/messages": "/messages" } },
}

app.get("/", (req: Request, res: Response) => {
  res.send("🚀 Hello from API Gateway");
});


for (const [route, cfg] of Object.entries(routes)) {
  app.use(
    route,
    createProxyMiddleware({
      target: cfg.target,
      changeOrigin: true,
      pathRewrite: cfg.rewrite,
      timeout: 15000,
      proxyTimeout: 15000,
      on: {
        error: (err, _req, res, _target) => {
          // Robust custom error handling per docs (HTTP and WS)
          try {
            // HTTP response path
            if (res && typeof (res as any).writeHead === "function") {
              if (!(res as any).headersSent) {
                (res as any).writeHead(502, { "Content-Type": "text/plain" });
              }
              (res as any).end(
                `Something went wrong while proxying to ${cfg.target}.\n${(err as any)?.message ?? "Proxy error"}`
              );
              return;
            }
            // WebSocket path: best effort close
            if (res && typeof (res as any).end === "function") {
              (res as any).end();
            }
          } catch {
            // noop
          }
        },
      },
    })
  );
}

app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
