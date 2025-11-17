# Event Banner Image Upload - Storage Setup

## ✅ New Features

- Image upload directly from the form (no more URL links)
- Drag and drop support
- File size validation (max 5MB)
- Image preview before upload
- Auto-saved to Supabase Storage
- User organizer details auto-filled from account

## 📋 Setup Instructions

### Step 1: Create Storage Bucket

1. **Open Supabase Console**
   - Go to your Supabase project
   - Click **Storage** in the left sidebar

2. **Create New Bucket**
   - Click **Create a new bucket**
   - Name: `event-banners`
   - Choose: **Public bucket** (so images are publicly accessible)
   - Click **Create bucket**

3. **Set Storage Policies** (Optional but recommended)
   - Click the `event-banners` bucket
   - Go to **Policies**
   - Add a policy to allow authenticated users to upload:
     ```sql
     CREATE POLICY "Authenticated users can upload event banners"
     ON storage.objects
     FOR INSERT
     TO authenticated
     WITH CHECK (bucket_id = 'event-banners');
     ```

### Step 2: Update Database Schema

1. **Run the updated SQL**
   - Go to **SQL Editor** → **New Query**
   - Copy from `supabase-events-setup.sql`
   - Execute the query
   - This removes organizer fields since they're auto-filled now

### Step 3: Test Image Upload

1. Sign in as a customer
2. Click **Create Event**
3. You'll see:
   - **Organizer Information** section (auto-filled with your email)
   - Event details form
   - **Drag & drop** area for banner image
4. Click the upload area or drag/drop an image
5. Image will upload and show a preview
6. Click the X on preview to remove if needed
7. Submit the form to create the event

## 📝 Form Fields (Updated)

### Event Details
- Event Name *
- Event Description
- (Organizer Email - auto-filled from your account)

### Schedule
- Start Date *
- Start Time *
- End Date *
- End Time *
- Timezone

### Media
- Event Banner Image (drag & drop upload)
- Supports: PNG, JPG, GIF
- Max size: 5MB
- Optional

## 🔒 Security

- Images are stored in Supabase Storage
- Public bucket means images are accessible via URL
- Only authenticated users can upload
- Images are associated with events that belong to the user

## 🗄️ Updated Database

Removed fields:
- `organizer_name`
- `organizer_email`
- `organizer_phone`
- `attachments`

These are no longer needed since:
- Organizer email comes from the authenticated user
- Name/phone can be added to profiles table later if needed
- Banner image is now the only media field

## ⚙️ How It Works

1. User selects image from computer
2. Image is validated (type and size)
3. Image is uploaded to Supabase Storage
4. Public URL is generated
5. URL is stored in the `event_banner_url` field
6. Image displays as preview in the list

## 🚀 Next Steps

1. Create the `event-banners` storage bucket in Supabase
2. Run the updated SQL schema
3. Start uploading event images!

## 🐛 Troubleshooting

### "Failed to upload image"
- Check that `event-banners` bucket exists and is public
- Verify bucket name is exact (no spaces)
- Check file size (max 5MB)

### Image not showing in list
- Verify storage bucket is public
- Check that upload completed successfully
- Clear browser cache

### Permission denied uploading
- Verify you're signed in
- Check storage bucket policies
- Make sure bucket is public for authenticated users

## 📞 File Structure

```
Storage:
  event-banners/
    event-banner-1234567-abc123.jpg
    event-banner-1234568-def456.jpg
    (auto-named with timestamp and random ID)
```

All set! Start uploading event banners! 🎉
