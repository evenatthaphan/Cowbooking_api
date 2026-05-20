import { Request, Response, NextFunction } from 'express';

export const requireAdminType = (maxType: number) =>
  (req: Request, res: Response, next: NextFunction) => {
    const adminType = Number(req.headers['admin-type']);

    if (!adminType || isNaN(adminType)) {
      return res.status(401).json({ error: "ไม่พบข้อมูล Admin" });
    }

    if (adminType > maxType) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์เข้าถึง" });
    }

    next();
};