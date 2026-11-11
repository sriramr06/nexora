import mongoose, { type ClientSession } from "mongoose";

export const withTransaction = async <T>(
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> => {
  const session = await mongoose.startSession();

  try {
    return (await session.withTransaction(() => fn(session))) as T;
  } finally {
    await session.endSession();
  }
};
