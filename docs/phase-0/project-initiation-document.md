# Project Initiation Document (PID)

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Document Version:** 1.2  
**Status:** Approved  
**Development Approach:** Agile  
**Platform:** Responsive Web Application

## 1. Project Overview

A multi-tenant SaaS platform enabling multiple organizations to manage projects, teams, tasks and collaborative workflows through independent, secure workspaces.

Each organization operates within its own isolated environment while sharing the underlying application infrastructure.

**Terminology:** In Nexora, each *organization* is a *tenant*. An organization's *workspace* is its isolated environment containing its members, projects and tasks.

## 2. Project Objectives

- Build a functional multi-tenant SaaS application.
- Enable organizations to manage workspaces.
- Support project and team collaboration.
- Implement role-based access control.
- Ensure tenant-level data isolation.
- Demonstrate production-minded engineering practices.

## 3. Approved MVP Scope

- User registration and authentication.
- Organization and workspace management.
- Team member invitations.
- Role and permission management.
- Project management.
- Task creation, assignment and tracking.
- Kanban board.
- Comments and activity tracking.
- In-app notifications.

### 3.1 Approved Scope Additions (v1.2)

Approved by the Project Owner during Phase 2 — Requirements Engineering:

- Application Owner (platform-level) role with tenant approval and basic tenant management.
- Organization registration form submitted for Application Owner approval.
- Email-bound member invitations.
- Transactional email: email verification, invitations and password reset.
- User profile avatars stored via Cloudinary.

## 4. Out of Scope

- Native mobile applications.
- AI-powered functionality.
- Advanced subscription billing.
- Third-party application marketplace.
- Complex workflow automation.
- Enterprise-level custom integrations.
- Task file attachments (future enhancement).
- Task transfer request and approval workflow (future enhancement).
- Company email domain restriction for invitations (future enhancement).

## 5. Stakeholders

| Stakeholder   | Responsibility                            |
| ------------- | ----------------------------------------- |
| Project Owner | Product decisions and approvals           |
| Developer     | Design, implementation and maintenance    |
| End Users     | Organizations, administrators and members |

**Project ownership:** Individual portfolio project.

## 6. Constraints

- Individual development.
- Full-time availability.
- Strict MVP scope.
- Budget-conscious infrastructure.
- Security and tenant isolation requirements.
- Copyright and licensing compliance.

## 7. Feasibility Assessment

| Area        | Assessment                         |
| ----------- | ---------------------------------- |
| Technical   | Feasible                           |
| Operational | Feasible                           |
| Financial   | Feasible                           |
| Development | Feasible with strict scope control |

## 8. Timeline and Resources

- Target duration: 6–8 weeks.
- Availability: Full-time.
- Execution: Agile development.
- Delivery strategy: Incremental MVP development.
- Quality priority: High.

## 9. Success Criteria

- Multiple organizations operate independently.
- Tenant data isolation is verified.
- Role-based permissions function correctly.
- Core project workflows work end-to-end.
- Critical workflows have automated tests.
- Application is deployed.
- Technical documentation is available.

## 10. Initial Risks

- Scope creep.
- Tenant isolation vulnerabilities.
- Overcomplicated authorization.
- Insufficient testing.
- Deployment complexity.
- Inadequate stabilization time.

## 11. Approval

**Decision:** Approved.

**Approved approach:** Strict MVP — prioritize quality.

**Approved deadline:** 6–8 weeks.

**Phase 0 completion:** 6 November 2026.

The project initiation stage is formally closed. Product Discovery is authorized to begin.

## 12. Revision History

| Version | Date            | Change                                                                                                        |
| ------- | --------------- | ------------------------------------------------------------------------------------------------------------- |
| 1.0     | 6 November 2026 | Initial approved document.                                                                                    |
| 1.1     | 6 November 2026 | Project name confirmed as Nexora; terminology clarified. No change to approved scope, timeline or decisions. |
| 1.2     | 6 November 2026 | Scope additions approved during Phase 2 (Section 3.1); out-of-scope list extended. Timeline unchanged.        |
