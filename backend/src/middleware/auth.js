import jwt from "jsonwebtoken";

export function requireAuth(request, response, next) {
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
    request.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return response.status(401).json({ message: "The authentication token is invalid or expired." });
  }
}
