# 📧 Email Campaign System Setup Guide

## 🎉 **System Overview**

Your artist-events platform now has a **complete email campaign system** with admin moderation! Here's what you've got:

### ✨ **Features Built**
- 🎨 **Beautiful Email Templates** (Event announcements, Artist updates, Newsletters)
- 👨‍💻 **Artist Dashboard** for creating campaigns
- 🛡️ **Admin Approval Workflow** (prevent spam, maintain quality)
- 📊 **Email Analytics** (opens, clicks, unsubscribes)
- 📱 **Mobile-Responsive** emails
- 🎯 **Audience Targeting** (All subscribers, Event attendees, City-based)

---

## 🚀 **Quick Start Setup**

### **1. Get Your Free Resend API Key**

1. Go to [resend.com](https://resend.com) and sign up (FREE)
2. Verify your email
3. In the dashboard, click "API Keys" → "Create API Key"
4. Copy your API key (starts with `re_`)

**Resend Free Tier:**
- ✅ 3,000 emails/month
- ✅ 100 emails/day
- ✅ Perfect for starting out!

### **2. Add Environment Variables**

Add these to your `.env` file:

```bash
# Email Service (Required)
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=notifications@yourdomain.com

# Site URL (for unsubscribe links)
SITE_URL=https://your-site.vercel.app

# Database (Already configured)
NEON_DATABASE_URL=your_existing_database_url
```

### **3. Domain Setup (Optional for Production)**

For professional emails, verify your domain in Resend:
1. Go to Resend Dashboard → Domains
2. Add your domain (e.g., `yourdomain.com`)
3. Add the DNS records they provide
4. Update `FROM_EMAIL=notifications@yourdomain.com`

---

## 🎯 **How It Works**

### **Artist Workflow:**
1. **Create Campaign**: Artist picks a template (Event, Update, Newsletter)
2. **Fill Details**: Subject, content, target audience
3. **Submit for Review**: Goes to admin panel (⏳ Pending)
4. **Admin Reviews**: Approves ✅ or Rejects ❌ with feedback
5. **Send**: Admin clicks "Send" → Emails go out! 📧

### **Admin Workflow:**
1. **Review Queue**: See all pending campaigns at `/admin/email-campaigns`
2. **Preview**: Check email content before approval
3. **Approve/Reject**: With optional notes for artists
4. **Send**: One-click sending to audiences
5. **Analytics**: Track opens, clicks, engagement

---

## 📁 **What's Been Added**

### **Database Tables:**
- `email_templates` - Reusable email templates
- `email_campaigns` - Campaign tracking with admin workflow
- `email_recipients` - Individual email delivery tracking
- `email_subscriptions` - User preferences & unsubscribe management

### **New Pages:**
- `/dashboard/email-campaigns` - Artist campaign management
- `/admin/email-campaigns` - Admin review panel

### **API Endpoints:**
- `POST /api/email/create-campaign` - Create new campaign
- `POST /api/admin/email-campaigns/{id}/{action}` - Admin actions
- `GET /api/email/track-open` - Email open tracking
- `GET /api/email/unsubscribe` - One-click unsubscribe

---

## 🎨 **Email Templates Included**

### **1. Event Announcement - Modern**
Perfect for concert/show announcements
- **Variables**: `{{artist_name}}`, `{{event_title}}`, `{{venue_name}}`, etc.
- **Style**: Clean, professional with gradient header

### **2. Artist Update - Casual**
Friendly template for personal updates
- **Variables**: `{{artist_name}}`, `{{custom_content}}`, social links
- **Style**: Conversational, personal touch

### **3. Newsletter - Monthly Roundup**
Comprehensive template for regular newsletters
- **Variables**: `{{newsletter_title}}`, `{{newsletter_content}}`, `{{upcoming_events}}`
- **Style**: Professional newsletter layout

---

## 🛡️ **Admin Controls**

As an admin, you can:
- ✅ **Approve** campaigns (makes them ready to send)
- ❌ **Reject** campaigns with feedback for artists
- 📤 **Send** approved campaigns to audiences
- 👁️ **Preview** emails before approval
- 📊 **View** analytics and engagement stats

---

## 🎯 **Audience Targeting Options**

### **All Subscribers**
Send to everyone who signed up for emails

### **Event Attendees**
Target people who attended artist's previous events

### **City-Based**
Geographic targeting (e.g., "New York" for local shows)

---

## 📊 **Email Analytics**

Track these metrics for each campaign:
- 📧 **Emails Sent** - Total delivered
- 👁️ **Opens** - How many people opened
- 🔗 **Clicks** - Link clicks in emails
- 📈 **Open Rate** - Engagement percentage
- 📉 **Unsubscribes** - Opt-out tracking

---

## 🚨 **Important Notes**

### **For Artists:**
- All campaigns need admin approval (prevents spam)
- Be authentic and engaging in your content
- Respect your audience - quality over quantity
- Use templates as starting points, customize them!

### **For Admins:**
- Review campaigns for quality and appropriateness
- Provide constructive feedback if rejecting
- Monitor overall email performance and engagement
- Can send campaigns immediately after approval

---

## 🔧 **Testing the System**

### **1. Test Campaign Creation**
1. Go to `/dashboard/email-campaigns` as an artist
2. Select a template
3. Fill in details and submit

### **2. Test Admin Review**
1. Go to `/admin/email-campaigns` as admin
2. See pending campaigns
3. Preview, approve, and send

### **3. Test Email Delivery**
- Start with a small test audience
- Check spam folders initially
- Verify tracking pixels and unsubscribe links work

---

## 📈 **Scaling Tips**

### **When You Grow:**
- **Upgrade Resend Plan** for higher volume
- **Add More Templates** for different campaign types
- **Segment Audiences** more granularly
- **A/B Testing** different subject lines
- **Automated Campaigns** for events/milestones

### **Advanced Features to Add Later:**
- Email scheduling (send at optimal times)
- Rich text editor for template customization
- Image uploads for email content
- Automated welcome series for new subscribers
- Integration with event RSVP systems

---

## 🎉 **You're All Set!**

Your platform now has a **professional email marketing system** that:
- ✅ Maintains quality through admin moderation
- ✅ Provides beautiful, mobile-friendly templates
- ✅ Tracks engagement and analytics
- ✅ Handles unsubscribes automatically
- ✅ Scales with your platform's growth

**Happy Emailing!** 📧✨

---

## 📞 **Support**

If you need help:
1. Check the error logs for debugging info
2. Verify environment variables are set correctly
3. Ensure database migration ran successfully
4. Test with a small audience first

The system is designed to fail gracefully - if emails can't send, campaigns will be marked as failed with error details for debugging. 