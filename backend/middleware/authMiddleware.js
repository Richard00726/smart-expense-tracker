const jwt = require("jsonwebtoken");
const prisma = require("../prismaClient");

// In-memory user cache with 60s TTL to prevent connection pool exhaustion from parallel requests
const userCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function getCachedUser(id) {
  const item = userCache.get(id);
  if (item && Date.now() - item.time < CACHE_TTL_MS) {
    return item.user;
  }
  return null;
}

function setCachedUser(id, user) {
  userCache.set(id, { user, time: Date.now() });
}

function invalidateUserCache(id) {
  if (id) userCache.delete(id);
  else userCache.clear();
}

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
      } catch (jwtErr) {
        return res.status(401).json({ error: "Not authorized, token invalid or expired" });
      }

      // Check fast in-memory cache first
      let user = getCachedUser(decoded.id);

      if (!user) {
        // Query DB with quick retry
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            user = await prisma.user.findUnique({
              where: { id: decoded.id }
            });
            if (user) {
              setCachedUser(decoded.id, user);
            }
            break;
          } catch (dbErr) {
            console.warn(`Auth middleware DB retry (${attempt}/3):`, dbErr.message);
            if (attempt === 3) {
              return res.status(503).json({ error: "Database temporarily busy, retrying..." });
            }
            await new Promise(r => setTimeout(r, 400));
          }
        }
      }

      req.user = user ? { ...user } : null;

      // Don't send password hash back in req.user
      if (req.user) {
        delete req.user.password;
      }

      if (!req.user) {
        return res.status(401).json({ error: "Not authorized, user not found" });
      }

      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      res.status(500).json({ error: "Server authentication error" });
    }
  } else {
    res.status(401).json({ error: "Not authorized, no token" });
  }
};

module.exports = { protect, invalidateUserCache };
