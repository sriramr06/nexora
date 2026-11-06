# Roles and Permission Requirements

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 2 — Requirements Engineering  
**Step:** 2.2 — Roles and Permission Requirements  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define the roles in Nexora, the actions each role may perform, and the rules the backend must enforce.

## 2. Authorization Model

Access to any tenant resource requires **all** of the following checks, in order:

1. **Authentication** — the request carries a valid access token.
2. **Organization status** — the organization is Active.
3. **Tenant membership** — the user is a member of the organization being accessed.
4. **Role permission** — the user's organization role permits the action.
5. **Resource access** — for project resources, the user is a project member, the project's manager, or a Tenant Admin.

Roles describe **permissions, not job titles**. For example, an HR employee who manages joiners and leavers is a Tenant Admin.

The role is always read from the stored membership, never trusted from the token, so that role changes and removals take effect immediately.

## 3. Role Definitions

### 3.1 Platform Level

| Role | Description |
|---|---|
| **Application Owner** | Operates the Nexora platform. Approves and manages organizations. Has no access to tenant content. Created by seed script. |

### 3.2 Tenant Level (per organization)

| Role | Description |
|---|---|
| **Tenant Admin** | Manages the organization, its members and all its projects. One or more per organization. |
| **Project Manager** | Creates projects and fully manages the projects they are assigned to manage. May invite Team Members. |
| **Team Member** | Works within projects they are members of: creates tasks, updates their assigned tasks and collaborates. |

### 3.3 Definitions

- **Managed project** — a project whose Project Manager field is the user.
- **Member project** — a project whose member list includes the user. The project's manager is always a member.
- In a member project they do **not** manage, a Project Manager has the same permissions as a Team Member.

## 4. Permission Matrix — Platform

| Action | Application Owner | Tenant roles |
|---|---|---|
| List / filter organizations | ✅ | ❌ |
| View organization metadata | ✅ | ❌ |
| Approve / reject organization | ✅ | ❌ |
| Suspend / reactivate organization | ✅ | ❌ |
| Edit organization name | ✅ | ❌ |
| Access projects, tasks, comments, activity | ❌ | Per tenant matrix |

## 5. Permission Matrix — Tenant

Legend: ✅ allowed · ⚪ conditional (see note) · ❌ not allowed

### 5.1 Organization and Members

| Action | Tenant Admin | Project Manager | Team Member |
|---|---|---|---|
| View organization details | ✅ | ✅ | ✅ |
| Update organization details | ✅ | ❌ | ❌ |
| View member list | ✅ | ✅ | ✅ |
| Invite members (single or bulk) | ✅ any role | ⚪ 4 | ❌ |
| View invitations | ✅ all | Own invitations | ❌ |
| Resend / revoke invitations | ✅ all | Own invitations | ❌ |
| Change member roles | ⚪ 1 | ❌ | ❌ |
| Remove members | ⚪ 1 | ❌ | ❌ |
| Leave organization | ⚪ 1 | ✅ | ✅ |

### 5.2 Projects

| Action | Tenant Admin | Project Manager | Team Member |
|---|---|---|---|
| View project list | ✅ all | Member projects | Member projects |
| Create project | ✅ | ✅ (becomes its manager) | ❌ |
| Update project details | ✅ | Managed projects | ❌ |
| Assign / change project manager | ✅ | ❌ | ❌ |
| Add / remove project members | ✅ | Managed projects | ❌ |
| Archive / restore project | ✅ | Managed projects | ❌ |
| Delete project | ✅ | ❌ | ❌ |
| View project summary and activity | ✅ | Member projects | Member projects |

### 5.3 Tasks and Board

| Action | Tenant Admin | Project Manager | Team Member |
|---|---|---|---|
| View board and tasks | ✅ | Member projects | Member projects |
| Create task | ✅ | Managed projects | Member projects ⚪ 2 |
| Edit task details | ✅ | Managed projects | ⚪ 3 |
| Change status: To Do ↔ In Progress → In Review, or withdraw In Review → In Progress | ✅ | Managed projects | Tasks assigned to them ⚪ 5 |
| Approve: move to Done (from any status) | ✅ | Managed projects | ❌ |
| Request changes: In Review → In Progress (reason required) | ✅ | Managed projects | ❌ |
| Reopen: Done → To Do / In Progress | ✅ | Managed projects | ❌ |
| Mark task Blocked (reason required) | ✅ | Managed projects | Tasks assigned to them |
| Clear Blocked | ✅ | Managed projects | ❌ |
| Mark / clear On hold (reason required) | ✅ | Managed projects | Tasks assigned to them |
| Assign / reassign task to anyone in project | ✅ | Managed projects | ❌ |
| Self-assign an unassigned task | ✅ | Managed projects | Member projects |
| Unassign task | ✅ | Managed projects | ❌ |
| Delete task | ✅ | Managed projects | ❌ |

### 5.4 Comments, Activity and Notifications

| Action | Tenant Admin | Project Manager | Team Member |
|---|---|---|---|
| Comment on task | ✅ | Member projects | Member projects |
| Edit own comment | ✅ | ✅ | ✅ |
| Delete own comment | ✅ | ✅ | ✅ |
| Delete any comment | ✅ | Managed projects | ❌ |
| View activity history | ✅ | Member projects | Member projects |
| View / manage own notifications | ✅ | ✅ | ✅ |

### 5.5 Notes

1. Subject to **last-admin protection** (Section 6, R1).
2. A Team Member may leave the task unassigned or assign it to themselves only.
3. A Team Member may edit title, description, priority and due date of tasks **assigned to them or created by them**.
4. A Project Manager may invite with the **Team Member** role only, and may pre-select only projects they manage (R11).
5. A Team Member cannot change the status of a task while it is flagged Blocked (R16).

## 6. Business Rules

| ID | Rule |
|---|---|
| R1 | An organization must always have at least one Tenant Admin. The last admin cannot leave, be removed or be demoted. |
| R2 | The user who registers an organization becomes its first Tenant Admin. |
| R3 | A project's manager must hold the Project Manager or Tenant Admin role and is automatically a project member. |
| R4 | A task may only be assigned to a member of the task's project. |
| R5 | When a member is removed from a project or organization, their open (not Done) tasks in the affected projects become unassigned and the project's manager is notified. |
| R6 | When a Project Manager is removed or demoted to Team Member, the projects they manage have their manager unset, and all Tenant Admins are notified. |
| R7 | Archived projects are read-only for all roles until restored. |
| R8 | The Application Owner cannot hold tenant memberships and cannot be invited. |
| R9 | Members of a non-Active organization (Pending, Rejected, Suspended) cannot access its tenant resources. |
| R10 | Only Active organizations can issue invitations; pending invitations stop working while the organization is Suspended. |
| R11 | An inviter cannot grant more access than they are permitted to: Project Managers may invite only as Team Member and may pre-select only projects they manage; Tenant Admins may invite any role and pre-select any project. |
| R12 | When a Project Manager is removed or demoted, their pending invitations are automatically revoked. |
| R13 | On acceptance, the new member is added only to pre-selected projects that still exist and are not archived. |
| R14 | **Review rule:** Team Members submit work by moving it to In Review. Only the project's manager or a Tenant Admin can move a task to Done, request changes (In Review → In Progress, with a reason) or reopen a Done task. |
| R15 | A task can have at most one flag (Blocked or On hold), always with a reason. Done tasks cannot be flagged, and moving a task to Done clears its flag. |
| R16 | Blocked is reported by the assignee (or a manager) and cleared only by the project's manager or a Tenant Admin. While Blocked, the assignee cannot change the task's status. Marking a task Blocked notifies the project's manager. |

## 7. Error Response Rules

| Situation | Response |
|---|---|
| Not authenticated / invalid token | 401 Unauthorized |
| Resource belongs to another organization, or user is not a member of the target organization or project | **404 Not Found** (existence is not revealed) |
| User can see the resource but lacks the permission for the action | 403 Forbidden |
| Organization not Active | 403 Forbidden with an organization-status error code |

## 8. Conclusion

The two-level role model and the five-step authorization check provide clear, testable rules. Each matrix cell and business rule will be covered by automated authorization tests, including privilege-escalation attempts such as a Project Manager inviting a Tenant Admin.

**Next step:** Step 2.3 — Functional Requirements.
