import express from "express";
import cors from "cors";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import tenantsRoutes from "./routes/tenants.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    })
  );
  app.use(express.json());

  const openapiRaw = await fs.readFile(path.join(__dirname, "docs", "openapi.yaml"), "utf-8");
  const openapiDoc = YAML.parse(openapiRaw);
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/users", usersRoutes);
  app.use("/api/v1/tenants", tenantsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
