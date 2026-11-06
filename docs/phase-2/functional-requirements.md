# Functional Requirements

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 2 — Requirements Engineering  
**Step:** 2.3 — Functional Requirements  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define what the system shall do. Each requirement is uniquely identified, testable and traceable to user stories (Step 2.4) and automated tests.

Permissions referenced below are defined in Step 2.2 — Roles and Permission Requirements. Business rules are referenced as R1–R16.

**Priority:** M = Must (MVP), S = Should (MVP if time allows).

## 2. Authentication and Account (AUTH)

| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-01 | The system shall allow a visitor to register with name, email and password. | M |
| FR-AUTH-02 | The system shall reject registration if the email is already registered. | M |
| FR-AUTH-03 | The system shall enforce a password policy: minimum 8 characters, including at least one letter and one number. | M |
| FR-AUTH-04 | The system shall send an email verification link after registration, valid for 24 hours and usable once. | M |
| FR-AUTH-05 | The system shall prevent unverified users from creating an organization. | M |
| FR-AUTH-06 | The system shall allow a user to request a new verification email. | M |
| FR-AUTH-07 | The system shall authenticate users with email and password and issue an access token and a refresh token. | M |
| FR-AUTH-08 | The system shall issue new tokens using a valid refresh token and invalidate the used refresh token (rotation). | M |
| FR-AUTH-09 | The system shall allow a user to log out, invalidating their refresh token. | M |
| FR-AUTH-10 | The system shall allow a user to request a password reset email; the response shall not reveal whether the email is registered. | M |
| FR-AUTH-11 | The system shall allow a password reset using a link valid for 1 hour and usable once. | M |
| FR-AUTH-12 | The system shall invalidate all of a user's refresh tokens after a password reset or password change. | M |
| FR-AUTH-13 | The system shall allow an authenticated user to change their password by providing the current password. | M |

## 3. User Profile (PROF)

| ID | Requirement | Priority |
|---|---|---|
| FR-PROF-01 | The system shall allow a user to view and update their display name. | M |
| FR-PROF-02 | The system shall allow a user to upload an avatar image (JPEG, PNG or WebP, maximum 2 MB). | M |
| FR-PROF-03 | The system shall delete the previous avatar from storage when it is replaced or removed. | M |
| FR-PROF-04 | The system shall display a default avatar (initials) when no avatar exists. | M |

## 4. Organization Management (ORG)

| ID | Requirement | Priority |
|---|---|---|
| FR-ORG-01 | The system shall allow a verified user to register an organization with: name, type (Product / Service / Both), company size (1–10, 11–50, 51–200, 201–500, 500+), industry, country, timezone (pre-filled from the browser), website (optional) and description (optional). | M |
| FR-ORG-02 | The system shall create a submitted organization with status **Pending Approval** and make the submitter its Tenant Admin (R2). | M |
| FR-ORG-03 | The system shall show members of a non-Active organization a status page (awaiting approval, rejected with reason, or suspended) instead of tenant content (R9). | M |
| FR-ORG-04 | The system shall allow the Tenant Admin of a Rejected organization to edit its details and resubmit it, returning it to Pending Approval. | M |
| FR-ORG-05 | The system shall allow a Tenant Admin to update the organization's details while it is Active. | M |
| FR-ORG-06 | The system shall allow a user who belongs to multiple organizations to switch the active organization. | M |
| FR-ORG-07 | The system shall show a user with no memberships the options to register an organization or wait for an invitation. | M |
| FR-ORG-08 | The system shall email the submitting Tenant Admin when their organization is approved or rejected. | M |

## 5. Platform Administration (PLAT)

| ID | Requirement | Priority |
|---|---|---|
| FR-PLAT-01 | The system shall provide the Application Owner account through a seed script; public registration cannot create it. | M |
| FR-PLAT-02 | The system shall allow the Application Owner to list organizations, filter by status and search by name. | M |
| FR-PLAT-03 | The system shall allow the Application Owner to view organization metadata: registration details, status, status history, creation date, member count and Tenant Admin contacts. | M |
| FR-PLAT-04 | The system shall allow the Application Owner to approve a Pending organization. | M |
| FR-PLAT-05 | The system shall allow the Application Owner to reject a Pending organization with a mandatory reason. | M |
| FR-PLAT-06 | The system shall allow the Application Owner to suspend an Active organization with a mandatory reason, and to reactivate it. | M |
| FR-PLAT-07 | The system shall allow the Application Owner to edit an organization's name. | S |
| FR-PLAT-08 | The system shall prevent the Application Owner from accessing tenant projects, tasks, comments and activity (D9). | M |

## 6. Invitations and Membership (INV / MEM)

| ID | Requirement | Priority |
|---|---|---|
| FR-INV-01 | The system shall allow a Tenant Admin of an Active organization to invite a person by email with a role: Tenant Admin, Project Manager or Team Member (R10). | M |
| FR-INV-10 | The system shall allow a Project Manager of an Active organization to invite a person by email with the Team Member role only (R11). | M |
| FR-INV-11 | The system shall allow the inviter to pre-select projects for the invitation — any project for Tenant Admins, managed projects only for Project Managers — and add the new member to them on acceptance (R13). | M |
| FR-INV-12 | The system shall allow bulk invitations of up to 20 email addresses with one role and one project selection, validate each address independently, and report per-address results (sent, or skipped with reason). | M |
| FR-INV-13 | The system shall record the inviter on every invitation and display it in the invitation list. | M |
| FR-INV-02 | The system shall generate a random, single-use invitation token, store only its hash, and expire it after 7 days. | M |
| FR-INV-03 | The system shall send the invitation link to the invited email address. | M |
| FR-INV-04 | The system shall reject an invitation for an email that is already a member or already has a pending invitation to the same organization. | M |
| FR-INV-05 | The system shall allow Tenant Admins (all invitations) and Project Managers (own invitations) to list invitations with status (Pending, Accepted, Revoked, Expired), resend a pending invitation (issuing a new token) and revoke it. | M |
| FR-INV-06 | The system shall allow an invited person without an account to register through the invitation; the registration email must equal the invited email and is treated as verified. | M |
| FR-INV-07 | The system shall allow an invited person with an existing account to accept the invitation after logging in with the invited email. | M |
| FR-INV-08 | The system shall reject invitation acceptance when the token is invalid, expired, revoked, already used, the email does not match, or the organization is not Active. | M |
| FR-INV-09 | The system shall reject invitations to the Application Owner's email (R8). | M |
| FR-MEM-01 | The system shall list organization members with name, email, avatar and role. | M |
| FR-MEM-02 | The system shall allow a Tenant Admin to change a member's role, subject to R1, and apply R6 and R12. | M |
| FR-MEM-03 | The system shall allow a Tenant Admin to remove a member, subject to R1, and apply R5, R6 and R12. | M |
| FR-MEM-04 | The system shall allow a member to leave an organization, subject to R1, and apply R5, R6 and R12. | M |

## 7. Project Management (PROJ)

| ID | Requirement | Priority |
|---|---|---|
| FR-PROJ-01 | The system shall allow Tenant Admins and Project Managers to create a project with name (required, unique within the organization) and description (optional). | M |
| FR-PROJ-02 | The system shall set a Project Manager who creates a project as its manager; a Tenant Admin may assign any Project Manager or Tenant Admin as manager (R3). | M |
| FR-PROJ-03 | The system shall allow authorized users to update a project's name and description. | M |
| FR-PROJ-04 | The system shall allow authorized users to add organization members to a project and remove them, applying R5. | M |
| FR-PROJ-05 | The system shall list only projects the user may access: all projects for Tenant Admins; member projects for others. | M |
| FR-PROJ-06 | The system shall allow authorized users to archive and restore a project; archived projects are read-only (R7). | M |
| FR-PROJ-07 | The system shall allow a Tenant Admin to permanently delete a project and all its tasks, comments and activity after explicit confirmation. | M |
| FR-PROJ-08 | The system shall display a project summary: task count per status, overdue task count, blocked task count and completion percentage. | M |

## 8. Task Management (TASK)

| ID | Requirement | Priority |
|---|---|---|
| FR-TASK-01 | The system shall allow authorized users to create a task with title (required, 1–200 characters), description (optional, up to 5,000 characters), priority (default Medium), due date (optional) and assignee (optional). | M |
| FR-TASK-02 | The system shall create new tasks with status **To Do**. | M |
| FR-TASK-03 | The system shall support the statuses To Do, In Progress, In Review and Done, and enforce the status transition permissions of the review rule (R14). | M |
| FR-TASK-04 | The system shall support the priorities Low, Medium, High and Urgent. | M |
| FR-TASK-05 | The system shall allow a task to have at most one assignee, who must be a project member (R4). | M |
| FR-TASK-06 | The system shall restrict Team Members to leaving a task unassigned or assigning it to themselves. | M |
| FR-TASK-07 | The system shall allow Tenant Admins and the project's manager to reassign or unassign a task. | M |
| FR-TASK-08 | The system shall allow authorized users to edit task details according to the permission matrix. | M |
| FR-TASK-09 | The system shall allow Tenant Admins and the project's manager to delete a task after confirmation. | M |
| FR-TASK-10 | The system shall mark a task as overdue when its status is not Done and its due date is earlier than the current date in the organization's timezone. | M |
| FR-TASK-11 | The system shall provide a "My Tasks" list of the user's assigned tasks across accessible projects in the active organization, filterable by status and sortable by due date. | M |
| FR-TASK-12 | The system shall allow the assignee to submit a task for review by moving it to In Review, and to withdraw it to In Progress before it is reviewed. | M |
| FR-TASK-13 | The system shall allow only the project's manager or a Tenant Admin to move a task to Done, to request changes (In Review → In Progress with a required reason of 1–500 characters), and to reopen a Done task. | M |
| FR-TASK-14 | The system shall allow a task to carry at most one flag — Blocked or On hold — with a required reason (1–500 characters), the user who set it and the time it was set (R15). | M |
| FR-TASK-15 | The system shall allow the assignee, the project's manager and Tenant Admins to mark a task Blocked or On hold, and to clear On hold; only the project's manager and Tenant Admins can clear Blocked (R16). | M |
| FR-TASK-16 | The system shall prevent the assignee from changing the status of a Blocked task, prevent flagging Done tasks, and clear any flag when a task moves to Done. | M |

## 9. Kanban Board (BOARD)

| ID | Requirement | Priority |
|---|---|---|
| FR-BOARD-01 | The system shall display each project's tasks on a board with one column per status. | M |
| FR-BOARD-02 | The system shall sort cards within a column by priority (Urgent first), then due date (earliest first). | M |
| FR-BOARD-03 | The system shall allow authorized users to change a task's status by dragging its card to another column; drops the user is not permitted to make (e.g. a Team Member dropping onto Done) are reverted with an explanatory message. | M |
| FR-BOARD-04 | The system shall provide a non-drag way to change status from the card or task detail view. | M |
| FR-BOARD-05 | The system shall revert a card to its original column and show an error if a status change fails. | M |
| FR-BOARD-06 | The system shall allow filtering the board by assignee (including "Unassigned"), priority and flag (Blocked, On hold). | M |
| FR-BOARD-07 | Each card shall show title, priority, assignee avatar, due date, an overdue indicator and a Blocked or On hold badge with its reason. | M |
| FR-BOARD-08 | The system shall keep flagged tasks in their status column. | M |
| FR-BOARD-09 | The system shall provide a "Blocked tasks" control showing the project's blocked task count, which opens a list of blocked tasks with reason, assignee, who flagged it and since when. | M |

## 10. Comments (COM)

| ID | Requirement | Priority |
|---|---|---|
| FR-COM-01 | The system shall allow authorized users to add a plain-text comment (1–2,000 characters) to a task. | M |
| FR-COM-02 | The system shall display a task's comments in chronological order with author, avatar and timestamp. | M |
| FR-COM-03 | The system shall allow authors to edit their comments and mark edited comments as "edited". | M |
| FR-COM-04 | The system shall allow authors, the project's manager and Tenant Admins to delete comments. | M |

## 11. Activity History (ACT)

| ID | Requirement | Priority |
|---|---|---|
| FR-ACT-01 | The system shall record an activity entry (actor, action, target, changes, timestamp) for: task created, updated, status changed, changes requested (with reason), flagged / unflagged (with reason), assigned / reassigned / unassigned, deleted; comment added / deleted; project created, updated, archived, restored; project member added / removed. | M |
| FR-ACT-02 | The system shall record activity entries in the same transaction as the change they describe. | M |
| FR-ACT-03 | The system shall display a task's activity history in the task detail view. | M |
| FR-ACT-04 | The system shall display a paginated project activity feed. | M |
| FR-ACT-05 | The system shall not allow activity entries to be edited or deleted by any user (except through project deletion). | M |

## 12. Notifications (NOT)

| ID | Requirement | Priority |
|---|---|---|
| FR-NOT-01 | The system shall create in-app notifications for the events in Section 12.1. | M |
| FR-NOT-02 | The system shall not notify users about their own actions. | M |
| FR-NOT-03 | The system shall display an unread notification count. | M |
| FR-NOT-04 | The system shall list notifications newest first, with pagination. | M |
| FR-NOT-05 | The system shall allow users to mark one or all notifications as read. | M |
| FR-NOT-06 | The system shall link each notification to its related resource and refresh the unread count periodically (polling). | M |
| FR-NOT-07 | The system shall show only notifications belonging to the active organization. | M |

### 12.1 Notification Events

| Event | Recipient(s) |
|---|---|
| Task assigned to a user | New assignee |
| Task reassigned away from or unassigned from a user | Previous assignee |
| Status of an assigned task changed by someone else | Assignee |
| Task submitted for review (moved to In Review) | Project's manager |
| Changes requested on a task (with reason) | Assignee |
| Task marked Blocked (with reason) | Project's manager |
| Task unblocked | Assignee |
| Comment added to a task | Assignee and task creator |
| User added to a project | Added user |
| User removed from a project | Removed user |
| Member's open tasks unassigned due to removal (R5) | Project's manager |
| Project manager unset (R6) | All Tenant Admins |

## 13. Conclusion

These requirements define the complete MVP behavior. Changes after approval require Project Owner approval and must be reflected in the PID scope where they affect it.

**Next step:** Step 2.4 — User Stories and Acceptance Criteria.
