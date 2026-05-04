# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Multi-Tenancy**: Implemented a company selection page and restructured the app to be multi-tenant. Each company now has its own workspace with pages nested under a dynamic `/[companyId]` route.
- Created this `changelog.md` to track project modifications.

### Changed
- **Projects Page UI**: Overhauled the Projects page with a new design featuring summary cards, improved filtering controls, and a more detailed project list, aligning with the latest mockups.
- **Plant Units UI**: Overhauled the Plant Units page to use a tabbed interface for categories, added client-specific filtering, and updated the table layout to match the new design.
- **Currency**: Updated all currency display from USD ($) to Malaysian Ringgit (RM).

### Fixed
- **Component Errors**: Resolved a "Super expression must either be null or a function" error in `src/components/ui/menubar.tsx` by correcting a duplicate component definition and a `displayName` typo.
- **Server/Client Component Boundaries**:
    - Addressed a runtime error by moving a `recharts` chart from a Server Component (`/app/page.tsx`) to its own Client Component (`/components/dashboard/performance-chart.tsx`).
    - Resolved a server startup failure by adding the `'use client'` directive to fundamental UI components: `Button`, `Input`, and `Textarea`.
    - Fixed "Failed to load chunk" errors by adding the `'use client'` directive to several UI components, including `Header`, `Alert`, `Badge`, `Card`, `Skeleton`, and `Table`, ensuring correct component boundaries.
