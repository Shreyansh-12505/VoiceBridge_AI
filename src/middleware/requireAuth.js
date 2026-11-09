import jwt from "jsonwebtoken";

export default function requireAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Please log in first" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.userId };
    next();
  } catch {
    return res.status(401).json({ error: "Your login has expired" });
  }
}