import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const buildMongoUri = (rawUrl) => {
  if (!rawUrl) return `mongodb://localhost:27017/${DB_NAME}`;

  // If the URL already contains a database segment, use it as-is
  // e.g., mongodb://host:port/mydb or mongodb+srv://cluster/mydb
  const hasDbInPath = /mongodb(?:\+srv)?:\/\/[^/]+\/[A-Za-z0-9._-]+/.test(rawUrl);
  if (hasDbInPath) return rawUrl;

  // Ensure a single slash when appending DB_NAME
  const trimmed = rawUrl.replace(/\/+$/g, "");
  return `${trimmed}/${DB_NAME}`;
};

const connectDB = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017";
    const uri = buildMongoUri(mongoUrl);
    console.log("Attempting to connect with URL:", uri);

    const connectioninstance = await mongoose.connect(uri);
    console.log(`\n mongodb connected !! DB HOST: ${connectioninstance.connection.host}`);
  } catch (error) {
    console.log("MONGODB connection error", error);
    process.exit(1);
  }
};

export default connectDB