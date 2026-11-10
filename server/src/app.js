import express from "express"
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import authRoutes from "./routes/auth.js";
import speechRoutes from "./routes/speech.js";




const app = express()
app.get('/', (req, res) => {
  res.status(200).json({ status: 'online', message: 'VoiceBridge AI API is running' });
});

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRoutes);
app.use("/speech", speechRoutes);
export default app
