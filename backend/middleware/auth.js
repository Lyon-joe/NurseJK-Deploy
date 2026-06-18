import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
  try {
    // 1. Get the token from the Authorization header (Format: Bearer <token>)
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      return res.status(401).json({ error: "No token, authorization denied" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token missing or malformed" });
    }

    // 2. Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Attach the decoded user data (userId) to the request object
    req.user = decoded;

    // 4. Move to the next middleware/route handler
    next();
  } catch (err) {
    console.error("🔥 Auth Middleware Error:", err.message);
    res.status(401).json({ error: "Token is not valid" });
  }
};