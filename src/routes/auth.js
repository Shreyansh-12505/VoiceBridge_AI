import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.models.js";

const router = Router();

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

function createToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from the environment");
  }

  return jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    creditTotal: user.creditTotal,
  };
}

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!username || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return res.status(400).json({
        error: "Enter a username, valid email, and password of at least 8 characters",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, passwordHash });

    res.cookie("token", createToken(user._id), cookieOptions);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Username or email is already registered" });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }

    console.error("Registration error:", error);
    return res.status(500).json({ error: "Could not create account" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Incorrect email or password" });
    }

    res.cookie("token", createToken(user._id), cookieOptions);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Could not log in" });
  }
});


router.get("/me", async (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "Please log in first" });
  }

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(userId);
    if (!user) {
      res.clearCookie("token", cookieOptions);
      return res.status(401).json({ error: "Account not found" });
    }

    return res.json({ user: publicUser(user) });
  } catch {
    res.clearCookie("token", cookieOptions);
    return res.status(401).json({ error: "Your login has expired" });
  }
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", cookieOptions);
  return res.json({ message: "Logged out" });
});

export default router;
