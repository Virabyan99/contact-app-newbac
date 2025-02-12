import { Hono } from 'hono';

const dbAPI = new Hono();

// SQL query to create the 'contacts' table if it doesn't exist
const createTableSQL = `
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    image TEXT,
    details TEXT
  );
`;

// Route to initialize the database (GET /api/db/init)
dbAPI.get("/init", async (c) => {
  try {
    const db = c.env.DB; // ✅ Retrieve DB from request context
    await db.prepare(createTableSQL).run();
    return c.json({ message: "Database initialized successfully!" });
  } catch (error) {
    return c.json({ error: error.toString() }, 500);
  }
});

export default dbAPI;
