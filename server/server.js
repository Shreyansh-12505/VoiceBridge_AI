import "dotenv/config";
import { createServer } from "node:http";
import app from "./src/app.js";
import db from "./src/db/db.js";
import attachRealtimeSTT from "./src/realtime/sttWebSocket.js";

app.get('/', (req, res) => {
  res.status(200).json({ status: 'online', message: 'VoiceBridge AI API is running' });
});
const PORT = process.env.PORT || 3000;
const server = createServer(app);
attachRealtimeSTT(server);

try {
  await db();
  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
} catch (error) {
  console.error("Could not connect to the database:", error.message);
  process.exit(1);
}
