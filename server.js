import express from "express"
import app from "./src/app.js";
import db from "./src/db/db.js";
import dotenv from "dotenv"
dotenv.config();
db();
app.use(express.json())



app.listen(3000,()=>{
    console.log("server is running");
    
})