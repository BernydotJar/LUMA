# LUMA — First academy onboarding user journey

This guide describes the verified-request **pilot workflow**, not public self-service activation. The first verified owner must use an approved staging environment; institutional features are disabled in production until approval.

1. **Request an academy.** Select **«¿Diriges una academia? Solicitar un espacio institucional»** from the login screen. Authenticate with a verified account. Enter the academy's name, contact role, location, estimated learner count and live/evergreen/hybrid delivery. The response says **Solicitud registrada** with a pending status. Repeating the request will not create duplicates.
2. **Wait for human review.** A platform operator reviews organization identity and reserves an internal organization ID. A different platform operator confirms the decision, issues a private invitation and delivers it by an approved channel. The applicant cannot approve their own request.
3. **Accept the invitation.** Open the link with the same verified account. It expires after 72 hours and works once. If lost or expired, ask the institution team to reissue it. Acceptance does not automatically give admin permissions.
4. **Institutional activation.** An authorized platform operator independently verifies the reviewed plan and grants the admin role to the existing verified identity. Sign out and sign back in after confirmation. The applicant can refresh their status at `/academia/solicitud`.
5. **Prepare the academy.** After the operator initializes the institution draft, open `/academia/primer-curso`. Enter the academy's visible name and name of the first course, select evergreen, live/premium or hybrid, and save the cohort. No Firebase knowledge or tenant IDs are required from the owner.
6. **Academic publication is a separate gate.** A saved cohort is a **draft**, not a published learning curriculum. The currently available studio console can manage cohorts and sessions, but tenant-owned lesson/question/rubric authoring and independent release remain pending. Do not enroll a real learner until verified course content and entitlement behavior pass #57 and #63.

If an operator declines the application, the applicant sees the rejected state. No educational history or customer data should be created from a rejected application.
