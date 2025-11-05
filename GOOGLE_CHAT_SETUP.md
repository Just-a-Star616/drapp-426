# Google Chat Webhook Setup Guide

This guide shows you how to set up Google Chat notifications for new driver applications.

## Step 1: Create a Google Chat Space Webhook

1. Open Google Chat and go to the space where you want to receive notifications
   - Or create a new space for driver applications

2. Click on the space name at the top → **Manage webhooks**

3. Click **Add webhook** or **+ Incoming webhook**

4. Give your webhook a name (e.g., "Driver Applications")

5. Optionally add an avatar URL

6. Click **Save**

7. **Copy the webhook URL** - it will look like:
   ```
   https://chat.googleapis.com/v1/spaces/XXXXX/messages?key=YYYYY&token=ZZZZZ
   ```

8. Click **Done**

## Step 2: Upgrade Firebase to Blaze Plan (Pay-as-you-go)

Cloud Functions require the Blaze plan, but it's very cheap:
- 2 million function invocations/month FREE
- After that: $0.40 per million invocations
- For a small recruitment app, you'll likely stay in the free tier

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (drapp-426)
3. Click **Upgrade** (bottom left)
4. Select **Blaze** plan
5. Add payment method
6. Click **Purchase**

## Step 3: Install Firebase CLI

```bash
npm install -g firebase-tools
```

## Step 4: Login to Firebase

```bash
firebase login
```

## Step 5: Initialize Firebase in Your Project

```bash
cd /media/konichi/Data/driver-recruitment-app
firebase init
```

Select:
- **Functions** (use arrow keys and space to select)
- Use existing project → Select **drapp-426**
- Language: **JavaScript**
- Use ESLint: **Yes**
- Install dependencies: **Yes**

## Step 6: Install Function Dependencies

```bash
cd functions
npm install
cd ..
```

## Step 7: Configure the Google Chat Webhook

Set the webhook URL as an environment variable:

```bash
firebase functions:config:set googlechat.webhook="YOUR_WEBHOOK_URL_HERE"
```

Replace `YOUR_WEBHOOK_URL_HERE` with the webhook URL you copied in Step 1.

## Step 8: Deploy the Cloud Function

```bash
firebase deploy --only functions
```

This will deploy the `notifyNewApplication` function that triggers whenever an application is submitted.

## Step 9: Test It!

1. Go to your app: https://drapp-426.vercel.app
2. Submit a test application
3. Check your Google Chat space - you should receive a notification card with:
   - Applicant details
   - License information (if applicable)
   - Links to view documents
   - Link to Firebase Console

## How It Works

The Cloud Function triggers when:
- A new application document is created in Firestore
- AND status is "Submitted"
- AND isPartial is false

It sends a rich card to Google Chat with:
- 👤 Applicant name, email, phone, area
- 🚗 License details (if licensed driver)
- 📄 Links to view uploaded documents
- 🔗 Link to Firebase Console

## Troubleshooting

### Function not triggering

Check the logs:
```bash
firebase functions:log
```

### Webhook URL not configured

Make sure you ran:
```bash
firebase functions:config:set googlechat.webhook="YOUR_URL"
```

Then redeploy:
```bash
firebase deploy --only functions
```

### Check webhook is set correctly

```bash
firebase functions:config:get
```

Should show:
```json
{
  "googlechat": {
    "webhook": "https://chat.googleapis.com/..."
  }
}
```

## Cost Estimate

For a small recruitment app with ~10-50 applications per month:
- **Cost: $0** (within free tier)

The free tier includes:
- 2M function invocations/month
- 400,000 GB-seconds/month
- 200,000 CPU-seconds/month

## Alternative: Email Notifications

If you prefer email instead of Google Chat, we can set up email notifications using:
- SendGrid
- Mailgun
- Firebase Extensions (Trigger Email)
- Or Gmail SMTP

Let me know if you want email instead!
