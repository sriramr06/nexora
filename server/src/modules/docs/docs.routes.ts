import { Router } from "express";
import { openApiDocument } from "./openapi";

const SWAGGER = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14";

// Swagger UI from a pinned CDN build: no extra dependency, and this page's relaxed
// content security policy applies to this one route only.
const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nexora API</title>
  <link rel="stylesheet" href="${SWAGGER}/swagger-ui.css" />
</head>
<body>
  <div id="docs"></div>
  <script src="${SWAGGER}/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: "/api/v1/openapi.json", dom_id: "#docs", deepLinking: true });
  </script>
</body>
</html>`;

// GET /api/docs (Swagger UI) and GET /api/v1/openapi.json
export const createDocsRouter = (): Router => {
  const router = Router();

  router.get("/v1/openapi.json", (_req, res) => {
    res.json(openApiDocument());
  });

  router.get("/docs", (_req, res) => {
    res
      .set(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
          "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
          "img-src 'self' data: https://cdn.jsdelivr.net",
        ].join("; "),
      )
      .type("html")
      .send(page);
  });

  return router;
};
