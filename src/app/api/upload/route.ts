import { Hono } from 'hono'

const uploadAPI = new Hono()

// File Upload Endpoint (POST /api/upload-photo)
uploadAPI.post('/photo', async (c) => {
  try {
    const r2 = c.env.R2_BUCKET // ✅ Get R2 binding

    // Ensure the uploaded file is an image.
    const contentType = c.req.header('content-type')
    if (!contentType || !contentType.startsWith('image/')) {
      return c.json(
        { error: 'Invalid file type. Only images are allowed.' },
        400
      )
    }

    // Read the request body as an ArrayBuffer.
    const fileData = await c.req.arrayBuffer()

    // Ensure the uploaded file size is less than 5MB
    const fileSize = fileData.byteLength
    if (fileSize > 5 * 1024 * 1024) { // 5MB limit
      return c.json({ error: 'File size exceeds 5MB limit.' }, 400)
    }

    const fileExtension = contentType.split('/')[1]; // e.g., 'jpeg', 'png'

    if (!fileExtension) {
      return c.json({ error: 'Unable to determine file type.' }, 400);
    }

    const validExtensions = ['jpeg', 'jpg', 'png'];
    if (!validExtensions.includes(fileExtension)) {
      return c.json({ error: 'Invalid file type. Only JPG, JPEG, and PNG are allowed.' }, 400)
    }

    // Generate a unique file name.
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExtension}`

    // Upload the file to Cloudflare R2.
    await r2.put(fileName, fileData, {
      httpMetadata: { contentType },
    })

    // Construct the public URL for the uploaded file.
    const publicUrl = `https://pub-356a30c178a1423c9ee76545f181dc86.r2.dev/${fileName}` // 🔴 Replace with your R2 endpoint

    return c.json({ message: 'Photo uploaded successfully!', url: publicUrl })
  } catch (error) {
    return c.json({ error: error.toString() }, 500)
  }
})

export default uploadAPI
