import "dotenv/config";
import app from "./src/app.js";
import db from "./src/db/db.js";

const PORT = process.env.PORT || 3000;

try {
  await db();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
} catch (error) {
  console.error("Could not connect to the database:", error.message);
  process.exit(1);
}
