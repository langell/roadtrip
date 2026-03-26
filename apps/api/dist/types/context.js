import { prisma } from '../lib/prisma.js';
import { getRequestUserId } from '../lib/request-auth.js';
import { logger } from '../lib/logger.js';
import { getRequestContext } from '../lib/request-logging.js';
export const createContext = async ({ req, res }) => {
    const userId = await getRequestUserId(req);
    const requestContext = res ? getRequestContext(res) : undefined;
    return {
        prisma,
        userId,
        requestId: requestContext?.requestId,
        logger: requestContext?.logger ?? logger,
    };
};
