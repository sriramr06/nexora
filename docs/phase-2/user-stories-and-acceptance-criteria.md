# User Stories and Acceptance Criteria

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 2 — Requirements Engineering  
**Step:** 2.4 — User Stories and Acceptance Criteria  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Describe the MVP from the users' perspective. Each story references its functional requirements, and each acceptance criterion is written to become an automated test.

**Format:** As a *role*, I want *goal*, so that *benefit*. Acceptance criteria use Given / When / Then.

## 2. Epics

| Epic | Name | Stories |
|---|---|---|
| E1 | Authentication and Account | US-01 – US-05 |
| E2 | Organization Onboarding | US-06 – US-08 |
| E3 | Platform Administration | US-09 – US-11 |
| E4 | Invitations and Membership | US-12 – US-16, US-34 – US-35 |
| E5 | Projects | US-17 – US-20 |
| E6 | Tasks and Kanban | US-21 – US-27, US-36 – US-38 |
| E7 | Collaboration | US-28 – US-29 |
| E8 | Notifications and Profile | US-30 – US-32 |
| E9 | Tenant Isolation (cross-cutting) | US-33 |

## 3. E1 — Authentication and Account

### US-01 Register an account
As a *visitor*, I want to register with my name, email and password, so that I can use Nexora.  
**Refs:** FR-AUTH-01 – 04

- Given valid details, when I register, then my account is created as unverified and a verification email is sent.
- Given an email that is already registered, when I register, then I see an error and no account is created.
- Given a password that violates the policy, when I register, then I see the policy rules.

### US-02 Verify my email
As a *registered user*, I want to verify my email, so that I can register an organization.  
**Refs:** FR-AUTH-04 – 06

- Given a valid link, when I open it, then my account is marked verified.
- Given an expired or used link, when I open it, then I see an error and can request a new email.
- Given I am unverified, when I try to register an organization, then I am asked to verify first.

### US-03 Log in and out
As a *user*, I want to log in and out securely, so that only I can use my account.  
**Refs:** FR-AUTH-07 – 09

- Given correct credentials, when I log in, then I am signed in and stay signed in across page reloads.
- Given wrong credentials, when I log in, then I see a generic "invalid email or password" error.
- Given I log out, when the old refresh token is used, then it is rejected.

### US-04 Reset a forgotten password
As a *user*, I want to reset my password by email, so that I can regain access.  
**Refs:** FR-AUTH-10 – 12

- Given any email, when I request a reset, then I see the same confirmation message whether or not the account exists.
- Given a valid reset link, when I set a new password, then I can log in with it and all my other sessions are signed out.
- Given a link older than 1 hour or already used, when I open it, then it is rejected.

### US-05 Change my password
As a *user*, I want to change my password, so that I can keep my account secure.  
**Refs:** FR-AUTH-13

- Given the correct current password, when I submit a valid new password, then it is changed and other sessions are signed out.
- Given an incorrect current password, when I submit, then the change is rejected.

## 4. E2 — Organization Onboarding

### US-06 Register my organization
As a *verified user*, I want to submit my company's details, so that my team can use Nexora.  
**Refs:** FR-ORG-01 – 03

- Given all required fields are valid, when I submit, then the organization is created as Pending Approval and I am its Tenant Admin.
- Given my organization is pending, when I open Nexora, then I see an "awaiting approval" page and no tenant features.
- Given a required field is missing, when I submit, then I see field-level errors.

### US-07 Resubmit a rejected organization
As a *Tenant Admin*, I want to fix and resubmit a rejected organization, so that it can still be approved.  
**Refs:** FR-ORG-03, FR-ORG-04, FR-ORG-08

- Given my organization was rejected, when I open Nexora, then I see the rejection reason and an edit option.
- Given I edit and resubmit, then the status returns to Pending Approval.

### US-08 Switch between organizations
As a *user in several organizations*, I want to switch the active organization, so that I can work in each one separately.  
**Refs:** FR-ORG-06, FR-ORG-07

- Given I belong to two organizations, when I switch, then I see only the selected organization's projects, tasks and notifications.
- Given I belong to no organization, when I log in, then I can register an organization or wait for an invitation.

## 5. E3 — Platform Administration

### US-09 Review pending organizations
As the *Application Owner*, I want to see and review pending organizations, so that only legitimate companies use Nexora.  
**Refs:** FR-PLAT-02, FR-PLAT-03

- Given organizations in several statuses, when I filter by Pending, then only pending organizations are listed.
- Given I open an organization, then I see its registration details and admin contacts, but no projects or tasks.

### US-10 Approve or reject an organization
As the *Application Owner*, I want to approve or reject organizations, so that I control tenant onboarding.  
**Refs:** FR-PLAT-04, FR-PLAT-05, FR-ORG-08

- Given a pending organization, when I approve it, then it becomes Active and its admin receives an email.
- Given a pending organization, when I reject it without a reason, then the action is refused.
- Given I reject it with a reason, then it becomes Rejected and its admin receives an email with the reason.

### US-11 Suspend or reactivate an organization
As the *Application Owner*, I want to suspend and reactivate organizations, so that I can stop misuse.  
**Refs:** FR-PLAT-06, R9, R10

- Given an Active organization, when I suspend it with a reason, then its members immediately lose access to tenant resources on their next request.
- Given a suspended organization, when an invitation link is used, then acceptance is rejected.
- Given I reactivate it, then members regain access.

## 6. E4 — Invitations and Membership

### US-12 Invite a member
As a *Tenant Admin*, I want to invite people by email with a role, so that only the people I choose can join.  
**Refs:** FR-INV-01 – 04, FR-INV-09, FR-INV-11, FR-INV-13

- Given a valid email and role, when I invite, then an invitation email with a 7-day link is sent and I am recorded as the inviter.
- Given I pre-select projects, when the invitee accepts, then they are added to those projects.
- Given the email is already a member or has a pending invitation, when I invite, then I see an error.
- Given my organization is not Active, when I invite, then the action is refused.

### US-13 Manage invitations
As a *Tenant Admin or Project Manager*, I want to resend or revoke invitations, so that I can correct mistakes.  
**Refs:** FR-INV-05, FR-INV-13

- Given a pending invitation, when I resend it, then a new link is sent and the old link stops working.
- Given a pending invitation, when I revoke it, then its link is rejected.
- Given I am a Tenant Admin, when I view invitations, then I see all invitations with their inviter.
- Given I am a Project Manager, when I view or revoke invitations, then I can act only on invitations I sent.

### US-14 Accept an invitation
As an *invited person*, I want to join the organization from the invitation email, so that I can start working.  
**Refs:** FR-INV-06 – 08

- Given I have no account, when I open a valid link, then I register with the invited email pre-filled and locked, my email is treated as verified, and I join with the invited role.
- Given I have an account with the invited email, when I log in and accept, then I join with the invited role.
- Given I am logged in with a different email, when I try to accept, then I am refused.
- Given the link is expired, revoked or already used, when I open it, then I see an explanatory error.

### US-15 Manage member roles and removal
As a *Tenant Admin*, I want to change roles and remove members, so that access matches responsibilities.  
**Refs:** FR-MEM-01 – 03, R1, R5, R6

- Given another member, when I change their role, then their permissions change on their next request.
- Given I am the only Tenant Admin, when I try to demote or remove myself, then the action is refused.
- Given a member with open tasks, when I remove them, then those tasks become unassigned and the project managers are notified.
- Given a Project Manager managing projects, when I demote or remove them, then those projects have no manager and all Tenant Admins are notified.
- Given a Project Manager with pending invitations, when I demote or remove them, then their pending invitations are revoked.

### US-16 Leave an organization
As a *member*, I want to leave an organization, so that I no longer appear in it.  
**Refs:** FR-MEM-04, R1

- Given I am not the last Tenant Admin, when I leave, then my membership is removed and R5 / R6 are applied.
- Given I am the last Tenant Admin, when I try to leave, then I am refused.

### US-34 Invite members to my project
As a *Project Manager*, I want to invite Team Members directly into my projects, so that I can build my team without waiting for an admin.  
**Refs:** FR-INV-10, FR-INV-11, FR-INV-13, R11, R13

- Given I invite an email as Team Member and select a project I manage, when the invitee accepts, then they join the organization as Team Member and are added to that project.
- Given I try to invite someone as Project Manager or Tenant Admin, then I receive 403 and no invitation is created.
- Given I select a project I do not manage, then I receive 403 and no invitation is created.
- Given the selected project is archived or deleted before acceptance, when the invitee accepts, then they join the organization without being added to that project.

### US-35 Invite several people at once
As a *Tenant Admin or Project Manager*, I want to invite a list of emails in one step, so that onboarding a team is fast.  
**Refs:** FR-INV-12

- Given up to 20 valid emails, one role and optional projects, when I submit, then each address receives its own invitation.
- Given some addresses are invalid, already members or already invited, when I submit, then valid addresses are invited and the others are listed as skipped with a reason.
- Given more than 20 addresses, when I submit, then the request is rejected.
- Given I am a Project Manager, then the same role and project limits as US-34 apply to the whole batch.

## 7. E5 — Projects

### US-17 Create a project
As a *Project Manager*, I want to create a project, so that I can organize my team's work.  
**Refs:** FR-PROJ-01, FR-PROJ-02

- Given a unique name, when I create a project, then I become its manager and a member.
- Given a name already used in my organization, when I create a project, then I see an error.
- Given I am a Team Member, when I try to create a project, then I receive 403.

### US-18 Manage project members
As a *Project Manager*, I want to add and remove project members, so that the right people see the project.  
**Refs:** FR-PROJ-04, R5

- Given a member of my organization, when I add them to my managed project, then they can see its board.
- Given a project member with open tasks, when I remove them, then those tasks become unassigned.
- Given a project I do not manage, when I try to change its members, then I receive 403.

### US-19 View project progress
As a *Project Manager*, I want a project summary, so that I can spot delays.  
**Refs:** FR-PROJ-08, FR-TASK-10

- Given tasks in several statuses, when I open the summary, then I see counts per status, the overdue count, the blocked count and the completion percentage (Done / total).

### US-20 Archive or delete a project
As a *Tenant Admin*, I want to archive or delete projects, so that the workspace stays relevant.  
**Refs:** FR-PROJ-06, FR-PROJ-07, R7

- Given an archived project, when anyone tries to change it, then the change is refused until it is restored.
- Given I delete a project after confirming, then its tasks, comments and activity are removed.
- Given I am a Project Manager, when I try to delete a project, then I receive 403.

## 8. E6 — Tasks and Kanban

### US-21 Create a task
As a *project member*, I want to create tasks, so that work is captured.  
**Refs:** FR-TASK-01 – 02, FR-TASK-05 – 06

- Given a valid title, when I create a task, then it appears in the To Do column.
- Given I am a Team Member, when I assign the new task to myself or leave it unassigned, then it is created.
- Given I am a Team Member, when I assign the new task to someone else, then I receive 403.
- Given an assignee who is not a project member, when anyone creates the task, then it is rejected.

### US-22 Assign and reassign tasks
As a *Project Manager*, I want to assign and reassign tasks, so that work continues when someone is unavailable.  
**Refs:** FR-TASK-05, FR-TASK-07, FR-ACT-01, FR-NOT-01

- Given a task assigned to Member A, when I reassign it to Member B, then B becomes the assignee, an activity entry records "A → B", B is notified of the assignment and A is notified of the reassignment.
- Given a user outside the project, when I try to assign to them, then the request is rejected.

### US-23 Pick up an unassigned task
As a *Team Member*, I want to assign an unassigned task to myself, so that I can take ownership.  
**Refs:** FR-TASK-06

- Given an unassigned task in my project, when I self-assign, then I become the assignee.
- Given a task assigned to someone else, when I try to self-assign, then I receive 403.

### US-24 Edit task details
As a *task assignee or creator*, I want to edit task details, so that information stays accurate.  
**Refs:** FR-TASK-08

- Given I am a Team Member assigned to or creator of the task, when I edit title, description, priority or due date, then the change is saved and recorded in activity.
- Given I am a Team Member unrelated to the task, when I try to edit it, then I receive 403.

### US-25 Move tasks on the board
As an *assignee*, I want to drag my task to another column, so that my team sees its status.  
**Refs:** FR-BOARD-01 – 05, FR-TASK-03, FR-TASK-12

- Given I am assigned to a task, when I drag it to In Progress, then its status updates and activity is recorded.
- Given I am assigned to a task in progress, when I drag it to In Review, then it is submitted for review and the project's manager is notified.
- Given I am a Team Member, when I drag my task to Done, then it returns to its column with the message "Submit for review instead".
- Given I am a Team Member not assigned to the task, when I try to move it, then it returns to its original column with an error.
- Given I cannot use drag-and-drop, when I change status from the task menu, then the result is the same.

### US-26 Filter the board
As a *project member*, I want to filter the board, so that I can focus on relevant work.  
**Refs:** FR-BOARD-06, FR-BOARD-07

- Given filters for assignee "me" and priority "High", when applied, then only matching cards are shown.
- Given a task past its due date and not Done, then its card shows an overdue indicator.

### US-27 See my tasks
As a *member*, I want one list of my assigned tasks, so that I know my responsibilities.  
**Refs:** FR-TASK-11

- Given tasks assigned to me in several projects, when I open My Tasks, then I see them all for the active organization, sortable by due date.
- Given a task in another organization, then it does not appear.

### US-36 Review submitted work
As a *Project Manager*, I want to approve or send back work submitted for review, so that Done means accepted.  
**Refs:** FR-TASK-13, R14

- Given a task In Review in my managed project, when I move it to Done, then it is complete and the assignee is notified.
- Given a task In Review, when I request changes with a reason, then it returns to In Progress, the reason is recorded in activity and the assignee is notified with the reason.
- Given I request changes without a reason, then the request is rejected.
- Given a Done task, when I reopen it, then it returns to To Do or In Progress; when a Team Member tries to reopen it, then they receive 403.
- Given the work should go to someone else, when I reassign the task, then the new assignee is notified (US-22).

### US-37 Report a blocker or put a task on hold
As an *assignee*, I want to flag my task as Blocked or On hold with a reason, so that my manager knows why it is not progressing.  
**Refs:** FR-TASK-14 – 16, FR-BOARD-07, FR-BOARD-08, R15, R16

- Given my task is not Done, when I mark it Blocked with a reason, then the card stays in its column with a Blocked badge and the project's manager is notified.
- Given I try to flag a task without a reason, then the request is rejected.
- Given my task is Blocked, when I try to change its status or clear the flag, then I receive 403.
- Given my task is On hold, when I clear the flag, then the badge is removed and the task stays in its column.
- Given a Done task, when anyone tries to flag it, then the request is rejected.

### US-38 Resolve blocked tasks
As a *Project Manager*, I want to see all blocked tasks in one place and unblock them, so that blockers are resolved quickly.  
**Refs:** FR-BOARD-09, FR-PROJ-08, FR-TASK-15

- Given my project has 3 blocked tasks, when I open the board, then the "Blocked tasks" control shows 3 and opens a list with each reason, assignee, who flagged it and since when.
- Given a blocked task, when I clear the flag, then it is removed, activity is recorded and the assignee is notified.
- Given a flagged task, when it is moved to Done, then its flag is cleared automatically.
- Given the project summary, then it shows the blocked task count.

## 9. E7 — Collaboration

### US-28 Comment on a task
As a *project member*, I want to comment on tasks, so that discussion stays with the work.  
**Refs:** FR-COM-01 – 04

- Given a task in my project, when I add a comment, then it appears with my name and avatar, and the assignee and creator are notified.
- Given my own comment, when I edit it, then it shows "edited".
- Given someone else's comment, when I (a Team Member) try to delete it, then I receive 403; when the project's manager deletes it, then it is removed.
- Given a comment containing HTML or script, when displayed, then it is shown as plain text.

### US-29 View activity history
As a *project member*, I want to see who changed what, so that I understand how work progressed.  
**Refs:** FR-ACT-01 – 05

- Given a task was created, reassigned and moved, when I open it, then its activity lists these changes with actors and timestamps.
- Given the project activity feed, when I scroll, then older entries load page by page.

## 10. E8 — Notifications and Profile

### US-30 Receive notifications
As a *member*, I want in-app notifications, so that I notice work that concerns me.  
**Refs:** FR-NOT-01 – 07

- Given someone assigns a task to me, then my unread count increases within the polling interval.
- Given I assign a task to myself, then I receive no notification.
- Given I open a notification, then it is marked read and I am taken to the related task.
- Given I click "mark all as read", then my unread count becomes zero.

### US-31 Manage my avatar
As a *user*, I want to upload an avatar, so that teammates recognize me.  
**Refs:** FR-PROF-02 – 04

- Given a JPEG, PNG or WebP under 2 MB, when I upload it, then it becomes my avatar everywhere.
- Given a file over 2 MB or of another type, when I upload it, then it is rejected.
- Given I replace or remove my avatar, then the old image is deleted from storage and initials are shown when none exists.

### US-32 Update my name
As a *user*, I want to update my display name, so that my profile is correct.  
**Refs:** FR-PROF-01

- Given a valid name, when I save, then it is shown across all organizations I belong to.

## 11. E9 — Tenant Isolation (Cross-Cutting)

### US-33 Keep each organization's data private
As a *Tenant Admin*, I want my organization's data to be inaccessible to other organizations, so that our work stays confidential.  
**Refs:** FR-PLAT-08, Roles document Sections 2 and 7

- Given a user of Organization A, when they request any project, task, comment, activity entry, member or notification of Organization B by ID, then they receive 404.
- Given a user of Organization A, when they list any resource, then no records from Organization B appear.
- Given a user of Organization A, when they try to assign a task to a user of Organization B, then the request is rejected.
- Given the Application Owner, when they request tenant projects or tasks, then access is denied.

## 12. Definition of Done (per story)

- All acceptance criteria are covered by automated tests and pass.
- Authorization is enforced on the backend, not only hidden in the UI.
- Input validation and consistent error responses are in place.
- Activity and notifications are produced where required.
- The feature works at mobile (360 px) and desktop widths.

**Next step:** Step 2.5 — User Journeys.
