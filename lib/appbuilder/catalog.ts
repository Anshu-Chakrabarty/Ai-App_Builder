// lib/appbuilder/catalog.ts — feature / stack / template catalogs from mockups
import type { FeatureItem } from "./types";
import { DOMAIN_TEMPLATES } from "./domain-catalog";

export const FEATURE_CATALOG: FeatureItem[] = [
  {
    id: "auth",
    name: "User Authentication",
    description: "Secure sign-up, login, password reset, and session management.",
    category: "core",
    icon: "🔐",
    capabilities: [
      "Secure login with password hashing",
      "Email verification",
      "Role-based access (Admin, Manager, Member)",
      "Password reset & session management",
    ],
    related: ["team", "tasks", "notifications", "activity"],
  },
  {
    id: "tasks",
    name: "Task Management",
    description: "Create, assign, prioritize, and track tasks end-to-end.",
    category: "core",
    icon: "✅",
    capabilities: [
      "Create / edit / archive tasks",
      "Priority & due dates",
      "Assignees and watchers",
      "Status workflow (Todo → Done)",
    ],
    related: ["auth", "projects", "notifications", "calendar"],
  },
  {
    id: "projects",
    name: "Project Management",
    description: "Organize work into projects with members and milestones.",
    category: "core",
    icon: "📁",
    capabilities: [
      "Project workspaces",
      "Milestones & progress",
      "Member roles",
      "Project dashboards",
    ],
    related: ["tasks", "team", "auth"],
  },
  {
    id: "team",
    name: "Team Management",
    description: "Invite teammates, manage roles, and collaboration settings.",
    category: "core",
    icon: "👥",
    capabilities: [
      "Invite by email",
      "Role management",
      "Team directory",
      "Permission matrix",
    ],
    related: ["auth", "tasks", "activity"],
  },
  {
    id: "calendar",
    name: "Calendar & Scheduling",
    description: "Calendar views for deadlines, meetings, and sprint planning.",
    category: "core",
    icon: "📅",
    capabilities: [
      "Month / week / day views",
      "Task due-date sync",
      "Meeting blocks",
      "Reminders",
    ],
    related: ["tasks", "notifications"],
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "In-app and email alerts for assignments and updates.",
    category: "core",
    icon: "🔔",
    capabilities: [
      "In-app notification center",
      "Email digests",
      "Mention alerts",
      "Mute / preference controls",
    ],
    related: ["auth", "tasks", "activity"],
  },
  {
    id: "activity",
    name: "Activity Log",
    description: "Audit trail of changes across tasks, projects, and users.",
    category: "core",
    icon: "📜",
    capabilities: [
      "Immutable activity feed",
      "Filter by user / entity",
      "Export audit logs",
    ],
    related: ["auth", "tasks", "team"],
  },
  {
    id: "dashboard",
    name: "Analytics Dashboard",
    description: "Charts and KPIs for workload, throughput, and priorities.",
    category: "core",
    icon: "📊",
    capabilities: [
      "KPI summary cards",
      "Task overview charts",
      "Priority breakdown",
      "Recent activity widgets",
    ],
    related: ["tasks", "projects"],
  },
  {
    id: "files",
    name: "File Attachments",
    description: "Upload and attach files to tasks and projects.",
    category: "optional",
    icon: "📎",
    capabilities: ["Drag-drop upload", "Preview", "Version history"],
    related: ["tasks", "projects"],
  },
  {
    id: "comments",
    name: "Comments & Mentions",
    description: "Threaded discussions with @mentions on tasks.",
    category: "optional",
    icon: "💬",
    capabilities: ["Threaded comments", "@mentions", "Reactions"],
    related: ["tasks", "notifications"],
  },
  {
    id: "reports",
    name: "Reports & Export",
    description: "Generate CSV/PDF reports for stakeholders.",
    category: "optional",
    icon: "📈",
    capabilities: ["CSV export", "PDF summaries", "Scheduled reports"],
    related: ["dashboard", "projects"],
  },
  {
    id: "integrations",
    name: "Third-party Integrations",
    description: "Connect Slack, GitHub, Google Calendar, and more.",
    category: "optional",
    icon: "🔌",
    capabilities: ["Slack", "GitHub", "Google Calendar", "Webhooks"],
    related: ["notifications", "calendar"],
  },
];

export const FRONTENDS = [
  { id: "react", name: "React", desc: "A popular library for building fast and interactive UIs.", recommended: true },
  { id: "angular", name: "Angular", desc: "Full-featured framework for enterprise SPAs.", recommended: false },
  { id: "next", name: "Next.js", desc: "React framework with SSR, routes, and API routes.", recommended: false },
];

export const BACKENDS = [
  { id: "go", name: "Go", desc: "Fast, scalable and efficient. Great for high-performance applications.", recommended: true },
  { id: "python", name: "Python", desc: "Flexible and great for AI-heavy backends.", recommended: false },
  { id: "nestjs", name: "NestJS", desc: "Structured Node.js framework with TypeScript.", recommended: false },
  { id: "node", name: "Node.js", desc: "JavaScript everywhere — rapid full-stack delivery.", recommended: false },
];

export const DATABASES = {
  relational: [
    { id: "mysql", name: "MySQL" },
    { id: "postgres", name: "PostgreSQL" },
  ],
  nosql: [
    { id: "mongo", name: "MongoDB" },
    { id: "cosmos", name: "Cosmos DB" },
  ],
};

export const STACK_EXTRAS = [
  { id: "authentication", name: "Authentication" },
  { id: "file-storage", name: "File Storage" },
  { id: "realtime", name: "Real-time Support" },
  { id: "email", name: "Email Service" },
];

export const ARCHITECTURES = [
  { id: "monolithic", name: "Monolithic", desc: "Single deployable unit — simple to build and operate.", recommended: true },
  { id: "microservices", name: "Microservices", desc: "Independent services that scale separately.", recommended: false },
  { id: "modular", name: "Modular Monolith", desc: "Clear module boundaries inside one deployable.", recommended: false },
];

export const CLOUDS = [
  { id: "aws", name: "AWS", price: "Starting from ~$18/month", services: ["EC2", "Lambda", "RDS"] },
  { id: "azure", name: "Microsoft Azure", price: "Starting from ~$20/month", services: ["App Service", "Functions", "SQL"] },
  { id: "gcp", name: "Google Cloud", price: "Starting from ~$19/month", services: ["Cloud Run", "GKE", "Cloud SQL"] },
  { id: "other", name: "Other / Classic Cloud", price: "Varies", services: ["VPS", "Docker", "Managed DB"] },
];

export const COMPUTE_OPTIONS: Record<string, { id: string; name: string; price: string; desc: string }[]> = {
  aws: [
    { id: "ec2", name: "EC2 Virtual Machine", price: "$18–45/mo", desc: "Full control VM hosting" },
    { id: "lambda", name: "Lambda Serverless", price: "Pay per use", desc: "Event-driven compute" },
    { id: "beanstalk", name: "Elastic Beanstalk", price: "$20–60/mo", desc: "Managed app platform" },
  ],
  azure: [
    { id: "app-service", name: "App Service", price: "$20–55/mo", desc: "Managed web hosting" },
    { id: "functions", name: "Azure Functions", price: "Pay per use", desc: "Serverless functions" },
    { id: "aks", name: "AKS", price: "$40–120/mo", desc: "Kubernetes cluster" },
  ],
  gcp: [
    { id: "cloud-run", name: "Cloud Run", price: "Pay per use", desc: "Container serverless" },
    { id: "gce", name: "Compute Engine", price: "$18–50/mo", desc: "VM instances" },
    { id: "gke", name: "GKE", price: "$40–120/mo", desc: "Managed Kubernetes" },
  ],
  other: [
    { id: "vps", name: "VPS / Droplet", price: "$12–40/mo", desc: "Simple VM hosting" },
    { id: "docker", name: "Docker Host", price: "$15–45/mo", desc: "Container on VPS" },
  ],
};

export const DEPLOY_EXTRAS = [
  { id: "autoscaling", name: "Auto Scaling" },
  { id: "backup", name: "Backup & Recovery" },
  { id: "monitoring", name: "Monitoring & Alerts" },
  { id: "cicd", name: "CI/CD Pipeline" },
];

export type CatalogTemplate = {
  id: string;
  name: string;
  source: string;
  price: string;
  stack: string[];
  description: string;
  category: string;
  siteTemplateId: string;
  pages: string[];
  features: string[];
  /** Visual preview image for gallery cards */
  previewImage: string;
  /** Accent used in preview chrome */
  accent: string;
  /** Short eyebrow for the card */
  badge?: string;
  /** Keywords for idea → domain matching */
  keywords?: string[];
  /** Domain pack key (hospital, saas, …) */
  domainKey?: string;
};

export const TEMPLATES: CatalogTemplate[] = [
  {
    id: "taskflow-pro",
    name: "TaskFlow Pro",
    source: "Our Templates",
    price: "Free",
    stack: ["Next.js", "Tailwind CSS", "TypeScript"],
    description: "Modern task management dashboard with charts, calendar, and team views.",
    category: "project-management",
    siteTemplateId: "agency",
    pages: ["Dashboard", "Tasks List", "Task Details", "Calendar", "Team", "Projects", "Settings", "Auth"],
    features: ["Fully responsive design", "Dark & Light mode", "Authentication pages", "Chart widgets"],
    previewImage:
      "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=1200&q=80",
    accent: "#4F46E5",
    badge: "Productivity",
  },
  {
    id: "saas-pulse",
    name: "SaaS Pulse",
    source: "Our Templates",
    price: "Free",
    stack: ["React", "Tailwind", "Recharts"],
    description: "Clean SaaS admin with billing-ready layout patterns.",
    category: "saas",
    siteTemplateId: "agency",
    pages: ["Dashboard", "Customers", "Billing", "Settings"],
    features: ["Responsive", "Dark mode", "Auth pages"],
    previewImage:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    accent: "#0EA5E9",
    badge: "SaaS",
  },
  {
    id: "admin-nova",
    name: "Admin Nova",
    source: "Our Templates",
    price: "Free",
    stack: ["Next.js", "Chart.js"],
    description: "Premium admin dashboard with dense data tables.",
    category: "admin",
    siteTemplateId: "education",
    pages: ["Dashboard", "Tables", "Forms", "Profile"],
    features: ["Premium UI kits", "Multiple layouts"],
    previewImage:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    accent: "#7C3AED",
    badge: "Admin",
  },
  {
    id: "minimal-board",
    name: "Minimal Board",
    source: "Our Templates",
    price: "Free",
    stack: ["React", "CSS Modules"],
    description: "Minimal & clean project board for focused workflows.",
    category: "minimal",
    siteTemplateId: "agency",
    pages: ["Board", "List", "Settings"],
    features: ["Minimal UI", "Keyboard shortcuts"],
    previewImage:
      "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80",
    accent: "#334155",
    badge: "Minimal",
  },
  {
    id: "corp-atlas",
    name: "Atlas Corporate",
    source: "Our Templates",
    price: "Free",
    stack: ["Next.js", "Tailwind"],
    description: "Polished corporate marketing site with services and contact.",
    category: "corporate",
    siteTemplateId: "agency",
    pages: ["Home", "Services", "About", "Careers", "Contact"],
    features: ["Brand-first hero", "Service grid", "Contact form"],
    previewImage:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    accent: "#C45C26",
    badge: "Agency",
  },
  {
    id: "clinic-willow",
    name: "Willow Clinic",
    source: "Our Templates",
    price: "Free",
    stack: ["HTML", "CSS", "Healthcare"],
    description: "Primary-care clinic site with bookings, providers, and patient info.",
    category: "corporate",
    siteTemplateId: "primary-care",
    pages: ["Home", "Services", "Providers", "Patients", "Contact"],
    features: ["Healthcare layouts", "Booking CTAs", "Insurance info"],
    previewImage:
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80",
    accent: "#2F6F5E",
    badge: "Healthcare",
  },
  {
    id: "shop-meridian",
    name: "Meridian Shop",
    source: "Our Templates",
    price: "Free",
    stack: ["HTML", "E-commerce"],
    description: "Product-focused storefront with shop and product pages.",
    category: "saas",
    siteTemplateId: "ecommerce",
    pages: ["Home", "Shop", "Product", "Contact"],
    features: ["Product grid", "CTA bands", "Contact form"],
    previewImage:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
    accent: "#B45309",
    badge: "Shop",
  },
  {
    id: "harbor-homes",
    name: "Harbor Homes",
    source: "Our Templates",
    price: "Free",
    stack: ["HTML", "Real estate"],
    description: "Real-estate listings site with neighborhoods and agents.",
    category: "corporate",
    siteTemplateId: "realestate",
    pages: ["Home", "Listings", "Neighborhoods", "Agents", "Contact"],
    features: ["Listing cards", "Agent directory", "Lead form"],
    previewImage:
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
    accent: "#1D4ED8",
    badge: "Real estate",
  },
  {
    id: "starter-agency-sample",
    name: "Harbor Studio",
    source: "Sample ZIP",
    price: "Free",
    stack: ["HTML", "CSS", "AI-ready"],
    description: "Bundled sample agency site — ingestable ZIP with bindings for AI edits.",
    category: "corporate",
    siteTemplateId: "agency",
    pages: ["Home", "About", "Contact"],
    features: ["ZIP ingest ready", "Bound {{fields}}", "Design DNA knowledge"],
    previewImage:
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80",
    accent: "#0F766E",
    badge: "Sample ZIP",
  },
];

// Merge classic cards + expansive domain packs (hospital×styles, saas×styles, …)
export const ALL_TEMPLATES: CatalogTemplate[] = [...TEMPLATES, ...DOMAIN_TEMPLATES];

export const TEMPLATE_CATEGORIES = [
  { id: "all", label: "All templates" },
  { id: "healthcare", label: "Healthcare" },
  { id: "admin", label: "Admin Dashboards" },
  { id: "project-management", label: "Project Management" },
  { id: "saas", label: "SaaS Applications" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "education", label: "Education" },
  { id: "hospitality", label: "Hospitality" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "minimal", label: "Minimal & Clean" },
  { id: "corporate", label: "Corporate & Sites" },
];

export const GIT_PROVIDERS = [
  { id: "github", name: "GitHub", recommended: true },
  { id: "gitlab", name: "GitLab", recommended: false },
  { id: "bitbucket", name: "Bitbucket", recommended: false },
  { id: "azure-devops", name: "Azure DevOps", recommended: false },
  { id: "other", name: "Other Git", recommended: false },
];

export const MOCK_REPOS = [
  { id: "1", name: "abhishek/task-management", private: true, updated: "2 days ago" },
  { id: "2", name: "abhishek/ecommerce-app", private: false, updated: "1 week ago" },
  { id: "3", name: "abhishek/hospital-hms", private: true, updated: "3 weeks ago" },
];

export const CICD_PROVIDERS = [
  { id: "github-actions", name: "GitHub Actions", recommended: true },
  { id: "gitlab-ci", name: "GitLab CI/CD", recommended: false },
  { id: "jenkins", name: "Jenkins", recommended: false },
  { id: "azure-pipelines", name: "Azure DevOps", recommended: false },
  { id: "custom", name: "Custom / Other", recommended: false },
];

export const CICD_ADVANCED = [
  { id: "sast", name: "Code Quality & Security (SAST/linting)" },
  { id: "tests", name: "Automated Testing (unit/e2e)" },
  { id: "docker", name: "Docker Build & Push" },
  { id: "notify", name: "Notifications (email/slack)" },
  { id: "rollback", name: "Auto Rollback" },
];

export const THEME_PRESETS = [
  { id: "ocean", name: "Ocean", color: "#0EA5E9" },
  { id: "sunset", name: "Sunset", color: "#F97316" },
  { id: "forest", name: "Forest", color: "#10B981" },
  { id: "royal", name: "Royal", color: "#7C3AED" },
];

export const PRICING = {
  generation: {
    starter: { name: "Starter", price: 0 },
    professional: { name: "Professional", price: 249 },
    enterprise: { name: "Enterprise", price: 499 },
  },
  amc: {
    starter: 0,
    professional: 99,
    enterprise: 199,
  },
};

export const SEED_PROJECTS = [
  {
    id: "p1",
    name: "Task Management App",
    status: "live" as const,
    url: "taskflow.appbuilder.ai",
    tech: ["React", "Node.js", "PostgreSQL", "AWS"],
    updatedAt: Date.now() - 2 * 86400000,
  },
  {
    id: "p2",
    name: "E-commerce Platform",
    status: "deploying" as const,
    url: "shop.appbuilder.ai",
    tech: ["Next.js", "Go", "PostgreSQL", "AWS"],
    updatedAt: Date.now() - 3600000,
  },
  {
    id: "p3",
    name: "Restaurant Booking System",
    status: "preview" as const,
    url: "dine.appbuilder.ai",
    tech: ["React", "NestJS", "MongoDB"],
    updatedAt: Date.now() - 5 * 86400000,
  },
  {
    id: "p4",
    name: "Learning Management System",
    status: "draft" as const,
    tech: ["Angular", "Python", "MySQL"],
    updatedAt: Date.now() - 10 * 86400000,
  },
  {
    id: "p5",
    name: "Real Estate Marketplace",
    status: "failed" as const,
    tech: ["React", "Go", "PostgreSQL"],
    updatedAt: Date.now() - 4 * 86400000,
  },
];

export const QUICK_IDEAS = [
  "Build an e-commerce platform",
  "Create a CRM system",
  "Hospital management system",
  "Task management application",
  "Learning management system",
];

export const DEFAULT_PAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "tasks", label: "Tasks" },
  { key: "calendar", label: "Calendar" },
  { key: "projects", label: "Projects" },
  { key: "team", label: "Team" },
];
