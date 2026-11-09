import mongoose from "mongoose";

async function db() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from the environment");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Database is connected");
}

export default db
