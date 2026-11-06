# User Journeys

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 2 — Requirements Engineering  
**Step:** 2.5 — User Journeys  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Describe complete end-to-end paths through Nexora. Journeys connect individual user stories, expose gaps between features and form the basis of end-to-end tests and the demo script.

## 2. Journey Overview

| ID | Journey | Primary Actor | Stories |
|---|---|---|---|
| J1 | Organization onboarding | Tenant Admin | US-01, US-02, US-06, US-07 |
| J2 | Organization approval | Application Owner | US-09, US-10 |
| J3 | Member invitation and joining | Tenant Admin, Invitee | US-12 – US-14 |
| J4 | Project setup, team invitation and task planning | Project Manager | US-14, US-17, US-18, US-21, US-22, US-34, US-35 |
| J5 | Daily task work | Team Member | US-23 – US-30 |
| J6 | Sudden unavailability (reassignment) | Project Manager | US-22, US-30 |
| J7 | Member offboarding | Tenant Admin | US-15 |
| J8 | Organization suspension | Application Owner | US-11 |
| J9 | Account recovery | Any user | US-04 |

## 3. Journeys

### J1 — Organization Onboarding

**Actor:** Priya, CTO of Acme Software (will become Tenant Admin)  
**Goal:** Get Acme onto Nexora.

| # | Step | System Response |
|---|---|---|
| 1 | Priya registers with name, email and password | Account created (unverified); verification email sent |
| 2 | Opens the verification link | Email verified |
| 3 | Logs in | No memberships → "Register your organization" or "Waiting for an invitation?" |
| 4 | Fills the organization form (name, type, size, industry, country, website, description) and submits | Organization created as **Pending Approval**; Priya is Tenant Admin |
| 5 | Sees the "Awaiting approval" page | No tenant features available |
| 6 | Receives the approval email (after J2) and logs in | Acme is Active; Priya sees an empty dashboard prompting her to invite members and create a project |

**Alternative paths**
- 2a. Link expired → Priya requests a new verification email.
- 6a. Acme is rejected → Priya sees the reason, edits the details and resubmits → back to Pending Approval.

### J2 — Organization Approval

**Actor:** Application Owner  
**Goal:** Allow only legitimate organizations.

| # | Step | System Response |
|---|---|---|
| 1 | Logs in to the platform dashboard | Organization list with status counts |
| 2 | Filters by Pending Approval | Pending organizations listed, oldest first |
| 3 | Opens Acme Software | Registration details, admin contact, status history (no tenant content) |
| 4 | Approves | Acme → Active; approval email sent to Priya |

**Alternative path**
- 4a. Rejects with a reason → Acme → Rejected; rejection email with the reason sent to Priya.

### J3 — Member Invitation and Joining

**Actors:** Priya (Tenant Admin); Arun (new to Nexora)  
**Goal:** Bring Acme's first Project Manager on board.

| # | Step | System Response |
|---|---|---|
| 1 | Priya invites `arun@acme.com` as Project Manager | Invitation created (Pending), Priya recorded as inviter; email sent |
| 2 | Arun opens his link | Registration form with the email pre-filled and locked |
| 3 | Arun sets his name and password | Account created and treated as verified; joins Acme as Project Manager |
| 4 | Priya views the invitation list | Invitation shows Accepted |

Arun then invites his own team members (J4), reducing the Tenant Admin's workload.

**Alternative paths**
- 1a. Priya mistyped an address → she revokes the invitation and sends a new one.
- 2a. Link older than 7 days → "Invitation expired, ask the person who invited you to resend".

### J4 — Project Setup, Team Invitation and Task Planning

**Actor:** Arun (Project Manager)  
**Goal:** Start the "Customer Portal" project.

| # | Step | System Response |
|---|---|---|
| 1 | Creates project "Customer Portal" | Arun is manager and member; activity recorded |
| 2 | Bulk-invites `meena@acme.com`, `karthik@acme.com` and `ravi@acme.com` as Team Members, pre-selecting "Customer Portal" | Per-address results shown; invitations sent with Arun as inviter |
| 3 | Meena (existing Nexora account) opens her link and logs in with `meena@acme.com` | Joins Acme as Team Member and is added to "Customer Portal"; Acme appears in her organization switcher |
| 4 | Karthik and Ravi register through their links | Join Acme as Team Members and are added to "Customer Portal" |
| 5 | Adds an existing Acme member to the project | Member added and notified |
| 6 | Creates tasks with priorities and due dates, assigning several | Tasks appear in To Do; assignees notified |
| 7 | Leaves some tasks unassigned | Shown as "Unassigned" on the board |
| 8 | Opens the project summary | Counts per status, 0% complete, no overdue tasks |

**Alternative paths**
- 2a. One address is already an Acme member → skipped with reason; the others are sent.
- 2b. Arun tries to invite someone as Project Manager → refused (R11).
- 3a. Meena is logged in as `meena@gmail.com` → acceptance refused: "This invitation was sent to a different email".

### J5 — Daily Task Work

**Actor:** Meena (Team Member)  
**Goal:** Do and report her work.

| # | Step | System Response |
|---|---|---|
| 1 | Logs in and sees the notification badge | Unread count shown |
| 2 | Opens a notification "Arun assigned you: Login page UI" | Marked read; task detail opened |
| 3 | Opens My Tasks | All her Acme tasks, sorted by due date |
| 4 | Drags "Login page UI" to In Progress | Status updated; activity recorded |
| 5 | Comments "API contract needed for error states" | Comment shown; task creator Arun notified |
| 6 | Logs a bug as a new task and assigns it to herself | Task created in To Do with Meena as assignee |
| 7 | Self-assigns an unassigned task | Becomes the assignee |
| 8 | Moves "Login page UI" to In Review | Status updated; activity recorded |

**Alternative path**
- 4a. Meena tries to move a task assigned to someone else → card returns to its column with a permission error.

### J6 — Sudden Unavailability (Reassignment)

**Actor:** Arun (Project Manager)  
**Context:** Meena is suddenly unavailable with two tasks in progress.

| # | Step | System Response |
|---|---|---|
| 1 | Filters the board by assignee Meena | Her open tasks shown |
| 2 | Reassigns each task to Karthik | Assignee changes; activity records "Meena → Karthik" |
| 3 | — | Karthik notified of the new assignments; Meena notified of the reassignment |
| 4 | Karthik opens the task | Sees full history and Meena's comments to continue the work |

**Future enhancement:** a transfer request workflow, where an available member asks to hand off a task and the Project Manager approves it.

### J7 — Member Offboarding

**Actor:** Priya (Tenant Admin)  
**Context:** Karthik leaves the company.

| # | Step | System Response |
|---|---|---|
| 1 | Removes Karthik from Acme | Membership removed; his access ends on his next request |
| 2 | — | His open tasks become unassigned (R5); each affected project's manager is notified |
| 3 | Arun opens the board, filters "Unassigned" | Reassigns the tasks as in J6 |

**Alternative paths**
- 1a. Priya tries to remove herself as the only Tenant Admin → refused (R1). She must first promote another admin.
- 1b. The removed member was a Project Manager → their projects have no manager; all Tenant Admins notified (R6) and a new manager is assigned.

### J8 — Organization Suspension

**Actor:** Application Owner

| # | Step | System Response |
|---|---|---|
| 1 | Suspends an organization with a reason | Status → Suspended |
| 2 | — | Members' next requests are refused; they see a "Suspended" page |
| 3 | — | Pending invitation links are refused |
| 4 | Reactivates the organization later | Members regain access; data is unchanged |

### J9 — Account Recovery

**Actor:** Any user

| # | Step | System Response |
|---|---|---|
| 1 | Clicks "Forgot password" and enters an email | Same confirmation message whether or not the account exists |
| 2 | Opens the reset link within 1 hour | Sets a new password |
| 3 | — | All other sessions signed out; user logs in with the new password |

## 4. Demo Script

J1 → J2 → J3 → J4 → J5 → J6 forms a 10-minute portfolio demo covering tenancy, approval, invitations, RBAC, the Kanban board and collaboration. A second browser logged in as a user from another organization demonstrates tenant isolation (US-33).

**Next step:** Step 2.6 — Non-Functional Requirements.
