# Admin Role Management Setup Guide

## Overview
This backend now supports role-based access control with two roles: `user` (default) and `admin`.

## Initial Setup

### 1. Run the Migration Script
After deploying this update, run the migration script to add the `role` field to existing users:

```bash
# Set your admin email in environment
export ADMIN_EMAIL="your-admin@example.com"
export MONGODB_URI="your-mongodb-connection-string"

# Run migration
node scripts/migrate-add-role.js
```

This will:
- Add `role: 'user'` to all existing users without a role
- Promote the user with `ADMIN_EMAIL` to admin role

### 2. Environment Variables
Ensure your `.env` file includes:
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
ADMIN_EMAIL=admin@example.com  # Optional: for migration script
```

## API Endpoints

### Authentication Endpoints

#### GET /api/auth/me
Check current user's authentication status and role.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (authenticated):**
```json
{
  "success": true,
  "user": {
    "userId": "...",
    "id": "...",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

**Response (not authenticated):**
```json
{
  "success": false,
  "user": null
}
```

### Admin Endpoints (Admin Only)

#### GET /api/admin/users
List all users in the system.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### PUT /api/admin/users/:id/role
Update a user's role (promote to admin or demote to user).

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Body:**
```json
{
  "role": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin"
  }
}
```

## Error Responses

### 401 Unauthorized
No valid token provided:
```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden
Non-admin user attempting to access admin endpoint:
```json
{
  "error": "Forbidden - admin only"
}
```

### 400 Bad Request
Invalid role provided:
```json
{
  "error": "Invalid role"
}
```

### 404 Not Found
User not found:
```json
{
  "error": "User not found"
}
```

## Frontend Integration

### Checking User Role
Use the `/api/auth/me` endpoint to check if the current user is an admin:

```javascript
const checkAdmin = async () => {
  const response = await fetch('/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  
  if (data.success && data.user.role === 'admin') {
    // Show admin features
  }
};
```

### Listing Users (Admin)
```javascript
const listUsers = async () => {
  const response = await fetch('/api/admin/users', {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  const data = await response.json();
  return data.users;
};
```

### Promoting/Demoting Users (Admin)
```javascript
const updateUserRole = async (userId, newRole) => {
  const response = await fetch(`/api/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: newRole })
  });
  return await response.json();
};
```

## Security Notes

1. **Admin Protection**: All admin endpoints require both authentication (`auth` middleware) and admin role (`isAdmin` middleware)
2. **JWT Tokens**: After login/register, JWT tokens now include the `role` field
3. **Role Validation**: Only 'user' and 'admin' roles are accepted
4. **Default Role**: New users are created with 'user' role by default

## Testing

Test the implementation with curl:

```bash
# Login as admin
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.token')

# Check your role
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# List all users (admin only)
curl http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer $TOKEN"

# Promote a user to admin
curl -X PUT http://localhost:5000/api/admin/users/USER_ID/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```
