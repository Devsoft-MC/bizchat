# BizChat SDLC Plan

## 1. Goal
Create a reliable, scalable business communication platform for internal collaboration within one organization first, with clear ownership, quality gates, and phased delivery.

## 2. Delivery Method
- Use Agile with short sprints (1 or 2 weeks)
- Keep one main branch for stable code
- Use feature branches for each task
- Require pull request review before merge

## 3. SDLC Phases

### Phase 1: Discovery and Requirements
- Finalize MVP scope for internal business users
- Define user roles and permissions
- Confirm business rules for company, departments, users, groups, and messaging
- Document assumptions and out-of-scope items, including later vendor/external collaboration support

Outputs:
- Product requirements document
- User stories
- Acceptance criteria

### Phase 2: System Design
- Define architecture for backend, database, realtime messaging, web, and mobile
- Choose API patterns and authentication model
- Define data ownership, organization boundaries, and future expansion for external users

Outputs:
- Architecture document
- API contract draft
- Database schema draft

### Phase 3: Backend Foundation
- Set up repo structure
- Configure environment variables
- Create PostgreSQL schema for internal collaboration flows
- Implement auth, organization, department, and user management APIs

Outputs:
- Working backend foundation
- Testable API endpoints

### Phase 4: Core Messaging Features
- One-to-one chat APIs
- Group chat APIs
- Department/team-based conversation support
- Message send/receive flow
- Read/delivery status
- Realtime updates via Socket.IO

Outputs:
- Chat feature set
- Basic message lifecycle support

### Phase 5: Web and Mobile UI
- Web login and dashboard
- Mobile login and chat screens
- Internal user chat UX
- Group and department navigation
- Error handling and loading states

Outputs:
- MVP UI for web/mobile

### Phase 6: Testing and Quality Assurance
- Unit tests for business logic
- API integration tests
- Realtime flow checks
- Role/permission validation
- Manual QA for internal collaboration flows

Outputs:
- Verified MVP quality

### Phase 7: Deployment and Release
- Setup staging environment
- Run smoke tests
- Deploy backend and frontend
- Monitor logs and errors

Outputs:
- Staging release
- Production rollout checklist

### Phase 8: Monitoring and Maintenance
- Track crashes, API errors, message delivery failures
- Review performance and DB growth
- Plan next-phase features for calls, external access, and governance
- Plan separate future facility modules for light/electrical switch control and IP camera viewing

## 4. Quality Gates
- Every feature must have acceptance criteria
- Every PR must be reviewed
- No merge without tests passing
- No production deploy without staging validation

## 5. Suggested Team Workflow
- Product/owner defines priorities for internal collaboration first
- Backend and frontend work in parallel once APIs are stable
- QA validates critical user flows before release
- Later phases can revisit external/vendor workflows separately

## 6. Suggested Milestones
- Milestone 1: Project setup and architecture
- Milestone 2: Auth + company/user management
- Milestone 3: Messaging APIs + realtime
- Milestone 4: Web/mobile MVP
- Milestone 5: Testing + deployment
- Future milestone: Facility controls and IP camera viewing after the communication MVP is stable
