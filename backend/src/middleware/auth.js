import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

export async function requireAuth(request, response, next) {
  const authorization = request.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return response.status(401).json({ message: "Authentication is required." });
  }

  if (!process.env.JWT_SECRET) {
    return response.status(503).json({ message: "JWT authentication is not configured." });
  }

  try {
    const tokenUser = jwt.verify(token, process.env.JWT_SECRET);
    if (!tokenUser.sub || !tokenUser.role) {
      return response.status(401).json({ message: "The authentication token is invalid or expired." });
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenUser.sub },
      select: { id: true, role: true, activeMode: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return response.status(403).json({ message: "This account is inactive." });
    }
    if (tokenUser.role !== user.role) {
      return response.status(401).json({ message: "The authentication token has an invalid active mode." });
    }
    request.user = { sub: user.id, role: user.role, activeMode: user.activeMode };
    return next();
  } catch {
    return response.status(401).json({ message: "The authentication token is invalid or expired." });
  }
}
