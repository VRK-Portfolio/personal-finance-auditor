import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Add MONGODB_URI to .env.local");
}

// Reuse existing connection across hot reloads & serverless calls
const globalForMongoose = globalThis as { mongooseConn?: typeof mongoose };

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!globalForMongoose.mongooseConn) {
    globalForMongoose.mongooseConn = await mongoose.connect(MONGODB_URI);
  }
  console.log("Connected to MongoDB");
  return globalForMongoose.mongooseConn;
}