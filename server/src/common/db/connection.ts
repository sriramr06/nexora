import mongoose from "mongoose";
import { env, isProduction } from "../../config/env";
import { logger } from "../logger";

// Registered once at module load, so repeated connectDb() calls don't add duplicate listeners.
mongoose.connection.on("error", (error) => {
  logger.error({ err: error }, "MongoDB connection error");
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});

export const connectDb = async (uri: string = env.MONGODB_URI): Promise<void> => {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: !isProduction, // production indexes are synced by script (DEP-9)
  });

  logger.info("Connected to MongoDB");
};

export const disconnectDb = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info("Disconnected from MongoDB");
};

export const isDbConnected = (): boolean => mongoose.connection.readyState === 1;
