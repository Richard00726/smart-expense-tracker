const jwt = require("jsonwebtoken");
const prisma = require("../prismaClient");

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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");

      // Get user from the token
      req.user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });
      
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
      res.status(401).json({ error: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ error: "Not authorized, no token" });
  }
};

module.exports = { protect };
