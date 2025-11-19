# Event Management System

A modern, full-stack event management platform built with Next.js, Supabase, and React. Organizers can create, manage, and analyze events, while attendees can RSVP, join waitlists, and interact with event content.

---

## Features

### For Attendees
- **Browse Events:** View public and private events with rich details, images, and schedules.
- **RSVP & Waitlist:** Request to join events. Organizers approve or reject requests.
- **Profile Management:** Manage your user profile and see your event history.
- **Event Chatbot:** Interact with an AI-powered chatbot for event info (if enabled).

### For Organizers
- **Event Creation:** Create and edit events with images, schedules, performers, and FAQs.
- **Guest Management:** Approve, reject, or waitlist RSVPs. Export guest lists.
- **Analytics Dashboard:** View stats on attendance, engagement, and more.
- **Access Control:** Manage public, private, and invite-only events.

### General
- **Mobile Responsive:** Works great on all devices.
- **Secure:** Uses Supabase Auth and Row Level Security (RLS).
- **Extensible:** Easily add features like email notifications, calendar integration, and more.

---

## Tech Stack
- **Frontend:** Next.js 14+, React, Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Storage)
- **State Management:** React Context, Hooks
- **Other:** Recharts (analytics), Lucide Icons, OpenAI/Ollama (optional chatbot)

---


## Folder Structure
```
├── src/
│   ├── app/                # Next.js app routes (pages, API, layouts)
│   ├── components/         # Reusable React components
│   ├── context/            # React context providers
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Supabase client, utilities, types
│   └── ...
├── public/                 # Static assets
├── supabase/               # SQL migrations, policies
├── types/                  # TypeScript type declarations
├── package.json
├── README.md
└── ...
```

---


## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## License
[MIT](LICENSE)

---

## Credits
- Built by GIRISHRV and contributors.
- Uses [Supabase](https://supabase.com/), [Next.js](https://nextjs.org/), [Recharts](https://recharts.org/), [Lucide Icons](https://lucide.dev/), and more.
