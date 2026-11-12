# MVP Scope and Exclusions

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 2 — Requirements Engineering  
**Step:** 2.1 — MVP Scope and Exclusions  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define the exact boundary of the Minimum Viable Product (MVP), based on the scope approved in the Project Initiation Document (PID v1.2, Sections 3 and 4).

Anything not listed as in scope is excluded from the MVP by default.

## 2. Key Product Decisions

| # | Decision | Outcome |
|---|---|---|
| D1 | Role levels | Two levels: **platform** (Application Owner) and **tenant** (Tenant Admin, Project Manager, Team Member) |
| D2 | Project access model | **Project membership**: users access only projects they belong to; Tenant Admins access all projects in their organization |
| D3 | Tenant onboarding | Organizations require **Application Owner approval** before becoming active |
| D4 | Member onboarding | **Email-bound invitations**, single or bulk. Tenant Admins invite any role; Project Managers invite Team Members only, optionally into projects they manage |
| D5 | Tenant Admin count | An organization has **one or more** Tenant Admins and must always have at least one |
| D6 | Task assignment | Single assignee per task; Team Members may only self-assign |
| D7 | Task transfer | Direct reassignment by Project Manager / Tenant Admin only; transfer requests are a future enhancement |
| D8 | File storage | Only user avatars are stored, resized, in MongoDB (Cloudinary dropped 12 Nov 2026) |
| D9 | Application Owner data access | The Application Owner manages organizations but **cannot access tenant content** (projects, tasks, comments) |
| D10 | Team Lead role | Not a separate role in the MVP. Team leads use the Project Manager or Team Member role; a project-level Lead role is a future enhancement |
| D11 | Blocked / On hold | Modeled as a **flag** on the task, not as extra statuses. Flagged tasks stay in their board column with a badge; a "Blocked tasks" dialog lists them per project |
| D12 | Review workflow | Members submit work to **In Review**; only Project Managers / Tenant Admins approve to Done, request changes or reopen |

## 3. In-Scope Modules

### 3.1 Authentication and Account
- Registration with name, email and password.
- Email verification.
- Login and logout.
- Access and refresh token session handling.
- Password reset via email.
- Change password.

### 3.2 User Profile
- Update display name.
- Upload, replace and remove avatar (stored in MongoDB).

### 3.3 Organization (Tenant) Management
- Organization registration form.
- Approval lifecycle: Pending Approval → Active / Rejected; Active ⇄ Suspended.
- Edit and resubmit a rejected organization.
- Update organization details after approval.
- Membership in multiple organizations and organization switching.

### 3.4 Platform Administration (Application Owner)
- List and filter organizations by status.
- View organization metadata.
- Approve, reject (with reason), suspend (with reason) and reactivate organizations.
- Edit organization name.

### 3.5 Invitations and Membership
- Invite by email with an assigned role — single or bulk (up to 20 emails per batch).
- Project Manager invitations limited to the Team Member role, with optional automatic addition to projects they manage.
- Inviter recorded on every invitation.
- Resend and revoke invitations.
- Accept an invitation as a new or existing user.
- List members, change roles and remove members.
- Leave an organization.
- Last-admin protection.

### 3.6 Project Management
- Create, update, archive, restore and delete projects.
- Assign one Project Manager per project.
- Add and remove project members.
- Project summary: task counts by status, overdue and blocked tasks, and completion percentage.

### 3.7 Task Management
- Create, view, update and delete tasks.
- Fixed fields: title, description, status, priority, assignee, due date.
- Fixed statuses: To Do, In Progress, In Review, Done.
- Fixed priorities: Low, Medium, High, Urgent.
- Review workflow: submit for review, approve, request changes (with reason) and reopen.
- Task flags: Blocked and On hold, each with a required reason.
- Assignment, self-assignment and reassignment.
- "My Tasks" view across projects within the active organization.

### 3.8 Kanban Board
- One board per project with one column per status.
- Drag-and-drop status change, with a non-drag alternative.
- Filter by assignee, priority and flag.
- Blocked and On hold badges on cards; "Blocked tasks" dialog per project.

### 3.9 Collaboration
- Task comments: create, edit own, delete own; moderation by managers.
- Activity history per task and per project.

### 3.10 Notifications
- In-app notifications for defined events.
- Unread count, mark as read, mark all as read.
- Transactional emails: verification, invitation, password reset, organization approval / rejection.

## 4. Exclusions

| Excluded Item | Reason | Future Enhancement |
|---|---|---|
| Task file attachments | Scope and storage cost | Yes |
| Task transfer request workflow | Additional state machine and edge cases | Yes |
| Company email domain restriction | Domain ownership verification required | Yes |
| Real-time updates (WebSockets) | Infrastructure complexity; polling is sufficient | Yes |
| Manual card ordering within Kanban columns | Ordering complexity; cards are sorted automatically | Yes |
| Custom task statuses / workflows | PID excludes complex workflow customization | Yes |
| Subtasks, task dependencies, labels | Feature quantity over depth; blockers are reported manually with the Blocked flag | Yes |
| Additional statuses (Blocked, On Hold) as board columns | Replaced by task flags (D11) | No |
| Multiple assignees per task | Weakens clear ownership (Problem P2) | No |
| @mentions in comments | Notification complexity | Yes |
| Email notifications for task events | In-app notifications cover MVP needs | Yes |
| Team Lead role (project-level Lead) | Overlaps existing roles; PID risk: overcomplicated authorization | Yes |
| Organization setting to enable / disable Project Manager invitations | Not required while PM invitations are limited to Team Members | Yes |
| Project-level custom roles | PID risk: overcomplicated authorization | No |
| Hard deletion of organizations | Destructive cascading operation; suspension is used instead | Yes |
| Social login / SSO / two-factor authentication | Not required for MVP | Yes |
| Time tracking, sprints, Gantt charts, reports | Outside PID scope | No |
| Subscription billing | PID out of scope | No |
| Native mobile apps, AI features, integrations, marketplace | PID out of scope | No |

## 5. Assumptions

- The Application Owner account is created by a seed script, not by public registration.
- A user may belong to multiple organizations, with one active organization per request.
- An Application Owner account cannot hold tenant memberships.
- A transactional email provider with a free tier will be used.
- Kanban cards within a column are sorted by priority, then due date.

## 6. Conclusion

The MVP delivers a complete tenant lifecycle — registration, approval, invitation, project and task collaboration — with strict exclusions that protect the 6–8 week timeline.

**Next step:** Step 2.2 — Roles and Permission Requirements.
