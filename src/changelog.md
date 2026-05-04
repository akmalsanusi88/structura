# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Multi-Tenancy**: Implemented a company selection page and restructured the app to be multi-tenant. Each company now has its own workspace with pages nested under a dynamic `/[companyId]` route.
- **Changelog**: Created this `changelog.md` to track project modifications.
- **Subcontractor Creation from PO**: Subcontractors can now be created on-the-fly from the Purchase Order form if they don't exist in the directory.

### Changed
- **Projects Page UI**: Overhauled the Projects page with a new design featuring summary cards, improved filtering controls, and a more detailed project list, aligning with the latest mockups.
- **Plant Units UI**: Overhauled the Plant Units page to use a tabbed interface for categories, added client-specific filtering, and updated the table layout to match the new design.
- **Currency**: Updated all currency display from USD ($) to Malaysian Ringgit (RM).
- **Purchase Order Form**: Replaced the simple text input for subcontractors with a searchable combobox, allowing users to select from the directory or add a new entry.

### Fixed
- **Component Errors**: Resolved a "Super expression must either be null or a function" error in `src/components/ui/menubar.tsx` by correcting a duplicate component definition and a `displayName` typo.
- **Server/Client Component Boundaries**:
    - Addressed a runtime error by moving a `recharts` chart from a Server Component (`/app/page.tsx`) to its own Client Component (`/components/dashboard/performance-chart.tsx`).
    - Resolved a server startup failure by adding the `'use client'` directive to fundamental UI components: `Button`, `Input`, and `Textarea`.
    - Fixed "Failed to load chunk" errors by adding the `'use client'` directive to several UI components, including `Header`, `Alert`, `Badge`, `Card`, `Skeleton`, and `Table`, ensuring correct component boundaries.
- **React Context Stability**: Fixed a persistent "module factory is not available" error on the project detail page by removing the `ProjectProvider` and refactoring child components to accept props directly, stabilizing the component hierarchy.
- **Foreign Key Constraint on Purchase Orders**: Resolved a critical database error that occurred when creating a Purchase Order for a subcontractor not listed in the directory. The server action now correctly looks up or creates the subcontractor in the directory and uses the valid ID.
- **Schema Mismatch on Material Requisitions**: Fixed a database error caused by attempting to save a `company_id` to the `material_requisitions` table, which does not have this column. Removed the extraneous field from the server action.

