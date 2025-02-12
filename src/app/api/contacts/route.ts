import { Hono } from 'hono'

const contactsAPI = new Hono()

// Authentication Middleware to Protect Routes
contactsAPI.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');  // Check for Authorization header
  if (!authHeader || authHeader !== 'Bearer my-secret-token') {
    return c.json({ error: 'Unauthorized: Invalid or missing token.' }, 401);  // Unauthorized if token is not present or invalid
  }
  return await next();  // If the token is valid, continue the request
})

// Create Contact (POST /api/contacts)
contactsAPI.post('/', async (c) => {
  try {
      const db = c.env.DB as D1Database;

      // Extract the form data
      const formData = await c.req.formData();
      const name = formData.get('name');
      const email = formData.get('email');
      const phone = formData.get('phone');
      const image = formData.get('image') as Blob | null;
      const details = formData.get('details');

      // Validate fields
      if (!name) {
          return c.json({ error: 'The contact name is required.' }, 400);
      }

      // Generate a unique ID for the new contact
      const id = crypto.randomUUID();

      // Prepare the SQL insert statement
      const insertSQL = `
          INSERT INTO contacts (id, name, email, phone, image, details)
          VALUES (?, ?, ?, ?, ?, ?)
      `;

      // If an image is uploaded, store it in R2 and get the public URL
      let imageUrl = null;
      if (image) {
          const r2 = c.env.R2_BUCKET;  // Access R2 bucket binding
          const fileData = await image.arrayBuffer(); // Convert file to ArrayBuffer
          const fileExtension = image.type.split('/')[1]; // Get file extension from mime type
          const fileName = `${id}-${Date.now()}.${fileExtension}`; // Generate a unique file name

          // Upload the file to R2
          await r2.put(fileName, fileData, {
              httpMetadata: { contentType: image.type }
          });

          // Construct the public URL for the image
          imageUrl = `https://pub-356a30c178a1423c9ee76545f181dc86.r2.dev/${fileName}`;  // Replace with your actual R2 endpoint
      }

      // Insert the new contact into the database
      await db
          .prepare(insertSQL)
          .bind(id, name, email || null, phone || null, imageUrl, details || null)
          .run();

      // Invalidate cache after creating the new contact
      const kv = c.env.CONTACT_CACHE_NEW;
      await kv.delete('contacts_list'); // Invalidate cache

      return c.json({ message: 'Contact created successfully!', id });
  } catch (error) {
      console.error(error);
      return c.json({ error: error.toString() }, 500);
  }
});

// Retrieve Contacts (GET /api/contacts)
contactsAPI.get('/', async (c) => {
  try {
      const db = c.env.DB as D1Database; // Access D1 database

      // Fetch contacts from D1 database
      const result = await db.prepare('SELECT * FROM contacts').all();
      const contacts = result.results;

      // Optionally: You can process the data here, e.g., adding a default image URL if not present
      const contactsWithImage = contacts.map((contact: any) => ({
          ...contact,
          image: contact.image || "https://via.placeholder.com/150", // Fallback image if no image is present
      }));

      return c.json({ contacts: contactsWithImage });

  } catch (error) {
      console.error(error);  // Log the error for debugging
      return c.json({ error: error.toString() }, 500);
  }
});

// Update Contact (PUT /api/contacts/:id)
contactsAPI.put('/:id', async (c) => {
  try {
      const db = c.env.DB as D1Database; // Access D1 database
      const contactId = c.req.param('id'); // Get the contact ID from the URL parameter

      // Parse form data (this will allow us to handle both text fields and files)
      const formData = await c.req.formData();
      const updatedData: any = {};
      
      // Get the text fields (name, email, etc.)
      updatedData.name = formData.get('name');
      updatedData.email = formData.get('email');
      updatedData.phone = formData.get('phone');
      updatedData.details = formData.get('details');

      // Check if an image file was uploaded
      const image = formData.get('image') as File | null;
      if (image) {
          const r2 = c.env.R2_BUCKET; // Access R2 bucket
          const fileExtension = image.type.split('/')[1]; // Get file extension (jpeg, png)
          const fileName = `${contactId}-${Date.now()}.${fileExtension}`; // Generate unique file name

          const fileBuffer = await image.arrayBuffer(); // Read file as arrayBuffer

          // Upload the image to R2
          await r2.put(fileName, fileBuffer, { httpMetadata: { contentType: image.type } });

          // Set the image URL (replace with your actual R2 endpoint)
          updatedData.image = `https://pub-356a30c178a1423c9ee76545f181dc86.r2.dev/${fileName}`;
      }

      // Ensure at least one field is provided for update
      if (Object.keys(updatedData).length === 0) {
          return c.json({ error: "No update data provided." }, 400);
      }

      // Construct SQL query to update the contact
      const setClauses: string[] = [];
      const values: any[] = [];

      for (const key in updatedData) {
          setClauses.push(`${key} = ?`);
          values.push(updatedData[key]);
      }

      values.push(contactId); // Add ID for WHERE id = ?

      const setClause = setClauses.join(", ");
      const updateSQL = `UPDATE contacts SET ${setClause} WHERE id = ?`;

      const result = await db.prepare(updateSQL).bind(...values).run();

      if (result.success && result.meta?.changes > 0) {
          return c.json({ message: "Contact updated successfully!" });
      } else {
          return c.json({ error: "No contact found with the provided ID." }, 404);
      }
  } catch (error) {
      console.error(error);  // Log the error for debugging
      return c.json({ error: error.toString() }, 500);
  }
});

// Delete Contact (DELETE /api/contacts/:id)
contactsAPI.delete('/:id', async (c) => {
  try {
      const db = c.env.DB as D1Database; // Access D1 database
      const contactId = c.req.param('id'); // Get the contact ID from the URL parameter

      // Delete the contact from D1
      const deleteSQL = `DELETE FROM contacts WHERE id = ?`;
      const result = await db.prepare(deleteSQL).bind(contactId).run();

      if (result.success && result.meta?.changes > 0) {
          return c.json({ message: 'Contact deleted successfully!' });
      } else {
          return c.json({ error: 'No contact found with the provided ID.' }, 404);
      }
  } catch (error) {
      console.error(error);  // Log the error for debugging
      return c.json({ error: error.toString() }, 500);
  }
});

export default contactsAPI;
