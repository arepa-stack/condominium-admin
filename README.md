# Condominio Admin Panel V.1

A modern, minimalist admin panel for managing condominium payments, buildings, and users. Built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- 🔐 **Authentication**: JWT-based authentication with automatic token refresh
- 👥 **Role-Based Access Control**: Support for Super Admin, Board Member, and Resident roles
- 🏢 **Buildings Management**: CRUD operations for condominium buildings (Admin only)
- 👤 **Users Management**: Manage users, approve registrations, and assign roles
- 💳 **Payments Management**: Review and approve/reject payment submissions
- 📊 **Dashboard**: Role-specific statistics and recent activity
- 📱 **Responsive Design**: Works on mobile, tablet, and desktop
- 🎨 **Modern UI**: Clean, minimalist design with shadcn/ui components

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios
- **State Management**: React Context API
- **Notifications**: Sonner (toast notifications)
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend API running at `http://18.221.223.44:3000`

### Installation

1. Clone the repository and navigate to the project:
```bash
cd condominio-panel-admin
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file (copy from `.env.example`):
```bash
cp .env.example .env.local
```

4. Configure environment variables in `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://18.221.223.44:3000
NEXT_PUBLIC_APP_NAME=Condominio Admin
NEXT_PUBLIC_USE_MOCK_API=true
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Test Credentials

Use any valid credentials from your backend. For testing:
- Email: `admin@example.com`
- Password: Your backend password

## Project Structure

```
condominio-panel-admin/
├── app/
│   ├── (auth)/
│   │   └── login/          # Login page
│   ├── (dashboard)/
│   │   ├── dashboard/      # Dashboard page
│   │   ├── buildings/      # Buildings management
│   │   ├── users/          # Users management
│   │   └── payments/       # Payments management
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page (redirects)
│   └── providers.tsx       # Context providers
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components (Sidebar, Header)
│   └── dashboard/          # Dashboard components
├── lib/
│   ├── api/
│   │   └── client.ts       # Axios instance with interceptors
│   ├── services/           # API services
│   ├── hooks/              # Custom hooks (useAuth, usePermissions)
│   └── utils/              # Utilities (format, validation, constants)
├── types/
│   └── models.ts           # TypeScript type definitions
└── .env.local              # Environment variables
```

## User Roles & Permissions

### Super Admin (`role: 'admin'`, no `building_id`)
- View all buildings, users, and payments system-wide
- Create, edit, and delete buildings
- Manage all users and change roles
- Approve/reject any payment

### Board Member (`role: 'board'` or `role: 'admin'` with `building_id`)
- View only their assigned building
- Manage users within their building
- Approve/reject payments for their building residents
- Cannot manage buildings or change user roles

### Resident (`role: 'resident'`)
- No admin panel access (uses mobile app only)

## API Integration

### Real Endpoints (Working)
- `POST /auth/login` - User login
- `GET /users/me` - Get current user profile
- `GET /buildings` - List all buildings
- `GET /buildings/:id` - Get building details
- `GET /payments/:id` - Get payment details

### Mock Endpoints (Logged to Console)
All mock API calls are logged to the browser console with the prefix `MOCK API:` for debugging.

- `GET /admin/users` - List all users with filters
- `PATCH /users/:id` - Update user
- `POST /users/:id/approve` - Approve user registration
- `DELETE /users/:id` - Delete user
- `GET /admin/payments` - List all payments with filters
- `PATCH /payments/:id` - Update payment status
- `POST /buildings` - Create building
- `PATCH /buildings/:id` - Update building
- `DELETE /buildings/:id` - Delete building

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Adding New Components

To add shadcn/ui components:
```bash
npx shadcn@latest add <component-name>
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://18.221.223.44:3000` |
| `NEXT_PUBLIC_APP_NAME` | Application name | `Condominio Admin` |
| `NEXT_PUBLIC_USE_MOCK_API` | Use mock API for missing endpoints | `true` |

## Future Enhancements

- [ ] Advanced data tables with TanStack Table (sorting, filtering, pagination)
- [ ] Payment proof image viewer with zoom/lightbox
- [ ] Building and user CRUD forms with full validation
- [ ] Confirmation dialogs for destructive actions
- [ ] Export data to CSV
- [ ] Dark mode support
- [ ] Email notifications
- [ ] Audit logs
- [ ] Advanced analytics and reports

## License

Private - All rights reserved
