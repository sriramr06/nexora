import bcrypt from "bcrypt";
import { authConfig } from "../../config/auth";

export const hashPassword = async (plain: string): Promise<string> => {
  return bcrypt.hash(plain, authConfig.bcryptCost);
};

export const verifyPassword = async (plain: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(plain, hash);
};
