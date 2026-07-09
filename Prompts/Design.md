# Frontend UI/UX Refactoring Master Prompt

You are a Senior Product Designer, Senior Frontend Engineer, and SaaS Dashboard UI/UX Expert.

Your objective is to completely redesign the frontend of the existing application. The functionality, business logic, APIs, and backend are already completed. Your responsibility is ONLY to improve the frontend so that it looks like a premium enterprise SaaS retail analytics platform instead of an AI-generated dashboard.

The redesign must follow enterprise UI/UX standards and should be implemented in structured phases. Complete one phase at a time before moving to the next.

---

## Primary Objective

Transform the existing UI into a modern, premium, enterprise-grade Retail Analytics Dashboard.

The final result should resemble products like:

- Power BI
- Tableau Cloud
- Looker Studio
- Microsoft Fabric
- Shopify Analytics
- Stripe Dashboard
- Linear
- Vercel Dashboard
- Retool
- Datadog
- Grafana
- HubSpot Analytics

Avoid generic AI-generated layouts.

---

# IMPORTANT

Before writing any code:

1. Analyze the complete frontend.
2. Identify all UI inconsistencies.
3. Create a redesign roadmap.
4. Divide the redesign into multiple implementation phases.
5. Explain what will be done in each phase.
6. Wait until the roadmap is complete internally before implementation.

Each phase should have a clear scope and should not overlap with another phase.

---

# PHASE STRUCTURE

Example structure (modify if needed):

Phase 1
• Design System
• Color Palette
• Typography
• Spacing
• Icons
• Theme Architecture

Phase 2
• Overall Layout
• Sidebar
• Navbar
• Header
• Breadcrumbs
• Responsive Structure

Phase 3
• Cards
• KPIs
• Statistics
• Widgets
• Hover Effects

Phase 4
• Charts
• Tables
• Graphs
• Filters
• Date Pickers

Phase 5
• Animations
• Loading States
• Empty States
• Skeletons
• Micro Interactions

Phase 6
• Mobile Responsiveness
• Tablet
• Accessibility
• Final Polish

Do NOT mix multiple phases together.

---

# Brand Theme

Primary Brand Color:

Use MBazars brand red as the primary accent color throughout the application.

Use the red only for:

• Primary buttons
• Active navigation
• Important KPIs
• Active filters
• Hover states
• Links
• Progress indicators
• Highlights

Do NOT overuse the red.

Maintain a premium SaaS appearance.

---

# Light Mode + Dark Mode

The application MUST fully support both themes.

Requirements:

✔ Proper contrast ratios
✔ Readable typography
✔ Correct icon colors
✔ Correct border colors
✔ Proper card backgrounds
✔ Proper hover colors
✔ Proper chart colors

Never allow situations like:

Dark mode
❌ Black text on dark background

Light mode
❌ White text on white background

Audit every component for theme compatibility.

---

# Design System

Build a reusable design system.

Include:

Typography scale

Spacing scale

Border radius

Elevation

Shadow system

Icon sizes

Button hierarchy

Badge variants

Alert variants

Card variants

Status colors

Chart palette

Use design tokens wherever possible.

---

# Recommended Libraries

Use modern production-ready libraries wherever appropriate.

Examples:

ShadCN UI

Radix UI

Tailwind CSS

Tailwind Animate

Framer Motion

Motion One

Lucide Icons

Chart.js

React Chart.js

React Spring (if required)

Floating UI

TanStack Table

Sonner

React Hook Form

Class Variance Authority

Do not introduce unnecessary dependencies.

---

# Layout

Redesign the entire dashboard layout.

Include:

Professional Sidebar

Compact Navigation

Responsive Header

Workspace Feel

Better Page Padding

Visual Hierarchy

Card Grid

Widget Alignment

Proper White Space

Consistent Margins

Nothing should feel crowded.

---

# Dashboard Cards

Every metric card should be redesigned.

Improve:

Padding

Typography

Spacing

Icon placement

Trend indicators

Growth badges

Hover animation

Shadows

Rounded corners

Status colors

Visual balance

Cards should look premium.

---

# Charts

Improve every chart.

Use Chart.js professionally.

Include:

Smooth animations

Responsive resizing

Beautiful tooltips

Better legends

Interactive hover

Gradient fills

Rounded bars

Proper grid styling

Proper color palette

Better axis styling

Consistent spacing

If multiple charts appear on a page, ensure visual variety so they do not all look identical.

---

# Tables

Improve every table.

Include:

Sticky headers

Hover effects

Rounded containers

Pagination

Search

Column sorting

Better spacing

Status badges

Icons

Responsive behavior

Professional empty states

---

# Micro Animations

Avoid excessive animations.

Use subtle professional motion.

Examples:

Card fade-in

Scale on hover

Button ripple

Chart load animation

Counter animation

Progress animation

Page transition

Accordion animation

Sidebar collapse animation

Modal animation

Toast animation

Tooltip animation

Everything should feel polished.

---

# Number Animations

Whenever displaying numbers:

Animate:

Revenue

Sales

Orders

Inventory

Profit

KPIs

Statistics

Use count-up animations where appropriate.

Animations should be smooth and performant.

---

# Chart Animations

Charts should animate on load.

Examples:

Bar growth

Line drawing

Pie expansion

Donut fill

Area reveal

Use subtle easing.

---

# Icons

Replace generic icons.

Use Lucide Icons consistently.

Maintain consistent sizing and spacing.

---

# Typography

Use professional typography.

Examples:

Inter

Geist

Manrope

Do not mix multiple font families unnecessarily.

Maintain clear hierarchy.

---

# Colors

Use semantic colors.

Success

Warning

Danger

Info

Neutral

Do not rely only on the primary red.

---

# Responsiveness

Support:

Desktop

Laptop

Tablet

Mobile

No overflow.

No broken grids.

No clipped charts.

---

# Accessibility

Ensure:

Keyboard navigation

Focus indicators

ARIA where applicable

Proper contrast

Readable font sizes

Large clickable areas

---

# Performance

Do not sacrifice performance.

Lazy load where appropriate.

Avoid unnecessary rerenders.

Optimize animations.

Optimize chart rendering.

---

# Polish

Ensure:

Consistent border radius

Consistent shadows

Consistent spacing

Consistent animations

Consistent colors

Consistent icon sizes

Consistent typography

No AI-generated appearance.

Everything should resemble a premium enterprise SaaS product.

---

# Final Quality Checklist

Before considering any phase complete, verify:

✔ Enterprise-level UI
✔ Professional SaaS appearance
✔ MBazars branding
✔ Fully working Light Mode
✔ Fully working Dark Mode
✔ Proper text visibility in both themes
✔ Responsive layout
✔ Premium charts
✔ Animated KPIs
✔ Smooth micro interactions
✔ Visual consistency
✔ Accessibility
✔ Performance optimization
✔ No placeholder styling
✔ No monotonous layouts
✔ No generic AI-generated design patterns

The final frontend should be production-ready and comparable to modern enterprise retail analytics dashboards used by large organizations.
