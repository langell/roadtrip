import type { Request, Response } from 'express';

export const withAsyncHandler =
  <TReq extends Request, TRes extends Response>(
    handler: (req: TReq, res: TRes) => Promise<void>,
  ) =>
  (req: TReq, res: TRes) => {
    void handler(req, res);
  };
