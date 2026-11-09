import express from "express"
const app=express()
app.use(express.json()) //middleware for parsing 

export default app