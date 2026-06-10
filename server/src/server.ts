import "dotenv/config";
import { createApp } from "./app.js";
import * as userStore from "./services/userStore.js";

const PORT = process.env.PORT ?? 4000;

async function main() {
  await userStore.init();
  const app = await createApp();

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`API docs available at http://localhost:${PORT}/api/docs`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
