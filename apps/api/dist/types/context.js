import { prisma } from '../lib/prisma.js';
import { getRequestUserId } from '../lib/request-auth.js';
export const createContext = async ({ req }) => {
    const userId = await getRequestUserId(req);
    return { prisma, userId };
};
