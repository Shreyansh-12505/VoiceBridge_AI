import jwt from "jsonwebtoken";

export default function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = req.cookies?.token || bearerToken;

  if (!token) {
    return res.status(401).json({ error: "Please log in first" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { _id: payload.userId };
    next();
  } catch {
    return res.status(401).json({ error: "Your login has expired" });
  }
}