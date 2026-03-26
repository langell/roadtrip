import { prisma } from '../lib/prisma.js';
export const createContext = ({ req }) => {
  const userId = req.header('x-user-id');
  return { prisma, userId };
};
