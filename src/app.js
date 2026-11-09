import express from "express"
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import speechRoutes from "./routes/speech.js";



const app=express()
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRoutes);
app.use("/speech", speechRoutes);
export default app
