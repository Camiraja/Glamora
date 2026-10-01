export function createAuthRateLimiter({ limit, windowMs }) {
  const requestsByIp = new Map();

  return (request, response, next) => {
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || "unknown";
    const current = requestsByIp.get(key);
    const record = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    if (record.count >= limit) {
      response.set("Retry-After", String(Math.max(1, Math.ceil((record.resetAt - now) / 1000))));
      return response.status(429).json({ message: "Too many requests. Please try again later." });
    }

    record.count += 1;
    requestsByIp.set(key, record);
    if (requestsByIp.size > 10_000) {
      for (const [ip, entry] of requestsByIp) {
        if (entry.resetAt <= now) requestsByIp.delete(ip);
      }
    }
    return next();
  };
}