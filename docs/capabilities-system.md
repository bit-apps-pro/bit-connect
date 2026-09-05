# Forum Capabilities System

## Overview

This plugin uses **WordPress's native capability system** — no custom session logic, no separate user tables. Access control is entirely driven by `current_user_can()` and WordPress role/capability APIs.

---

## The Three Layers

### 1. Role Capabilities (defaults for everyone in a role)

Stored in `wp_options` under `bit_connect_capability_settings`.

```php
// Example stored value:
[
  'subscriber' => ['forum_create_post' => true, 'forum_vote_post' => true, ...],
  'editor'     => ['forum_moderate' => true, 'forum_manage' => true, ...],
]
```

When the admin saves Role Capabilities, `CapabilityService::applySettings()` runs:

```php
// For every WP role, add or remove each forum_* cap
$role->add_cap('forum_create_post', true);   // grants to all subscribers
$role->remove_cap('forum_moderate');          // removes from all subscribers
```

WordPress stores role capabilities in `wp_options` under `wp_user_roles`. Every user in that role inherits the caps automatically — no per-user migration needed.

**How to change:** Admin panel → Manager → Role Capabilities button.

---

### 2. Per-User Capability Overrides (individual exceptions)

Stored in `wp_usermeta` under `wp_capabilities` (WordPress's own meta key).

When the admin saves caps for a specific user via the Manager popover:

```php
$user->add_cap('forum_create_post', true);   // grant above role
$user->add_cap('forum_create_post', false);  // revoke even if role grants it
$user->remove_cap('forum_create_post');      // remove override, fall back to role
```

The critical difference between `add_cap(false)` and `remove_cap()`:

| Method | Effect |
|--------|--------|
| `add_cap('forum_create_post', true)` | User always has this cap, even if role doesn't |
| `add_cap('forum_create_post', false)` | User never has this cap, even if role does |
| `remove_cap('forum_create_post')` | Remove user-level override — falls back to role |

**How to change:** Admin panel → Manager → click the `X/12 caps` button on any user row.

**Reset to role:** Clicking "Reset to role" calls `remove_cap()` for all `forum_*` caps — wipes all user-level overrides, restoring pure role defaults.

---

### 3. Capability Check (runtime)

Every forum action checks via WordPress core:

```php
current_user_can('forum_create_post')
current_user_can('forum_moderate')
```

WordPress resolves caps in this order:
1. User-level explicit override (`wp_usermeta`) — **wins if present**
2. Role-level caps (inherited from the user's role)
3. `user_has_cap` filters (third-party plugins can add/remove caps here)

---

## All Forum Capabilities

| Capability | Purpose |
|---|---|
| `forum_create_post` | Submit new topics |
| `forum_edit_own_post` | Edit own topics |
| `forum_delete_own_post` | Delete own topics |
| `forum_create_comment` | Post comments |
| `forum_edit_own_comment` | Edit own comments |
| `forum_delete_own_comment` | Delete own comments |
| `forum_vote_post` | Vote on topics |
| `forum_vote_comment` | Vote on comments |
| `forum_moderate` | Moderate content (edit/delete any post/comment) |
| `forum_pin_post` | Pin topics |
| `forum_lock_post` | Lock topics |
| `forum_manage` | Access admin panel, manage all settings |

---

## Default Role Mapping (first activation)

`CapabilityService::buildDefaultSettings()` assigns defaults based on existing WP capabilities — no role names are hardcoded:

| Role has this WP cap | Gets these forum caps |
|---|---|
| `manage_options` (admin) | All 12 caps |
| `edit_others_posts` (editor) | Moderator caps |
| `read` (subscriber, customer, member, etc.) | Basic member caps |

This works automatically with WooCommerce, MemberPress, Ultimate Member, and any custom role plugin.

---

## Key Files

| File | Responsibility |
|---|---|
| `backend/app/Enum/Capabilities.php` | Single source of truth — all cap constants, groups, labels |
| `backend/app/Services/CapabilityService.php` | Role cap settings: save, apply, migrate, reset |
| `backend/app/Http/Controller/CapabilitySettingsController.php` | API: GET/POST role caps |
| `backend/app/Http/Controller/UserManagementController.php` | API: GET users, POST per-user caps, POST reset |
| `frontend/admin/src/pages/manager/` | Manager page UI |
| `frontend/admin/src/pages/manager/ui/role-capabilities-modal.tsx` | Role Capabilities modal |

---

## Common Admin Scenarios

**Give all subscribers voting access:**
Manager → Role Capabilities → Subscriber row → check Vote Posts + Vote Comments → Save.

**Remove Create Posts from one specific user:**
Manager → find user → click caps button → uncheck Create Posts → Save.
This stores `add_cap('forum_create_post', false)` on that user — they cannot create posts even though subscriber role grants it.

**Restore a user to their role defaults:**
Manager → find user → click caps button → click "Reset to role".
This calls `remove_cap()` for all forum caps, removing all user-level overrides.

**Give one user moderator access without changing their role:**
Manager → find user → click caps button → check Moderate, Pin Topics, Lock Topics → Save.
