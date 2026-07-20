// ═══════════════════════════════════════════════════════════════════════════════
// NEXUS — Database Seed Script
// ═══════════════════════════════════════════════════════════════════════════════
// Populates the database with sample items, collections, connections, and
// activity data for end-to-end testing and development.
//
// Usage:
//   1. Ensure .env.local has valid Supabase credentials
//   2. Run: npx tsx scripts/seed.ts
//
// Optionally specify a user email to associate data with an existing user:
//   EMAIL=user@example.com npx tsx scripts/seed.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// ═══════════════════════════════════════════════════════════════════════════════
// ── Config ──
// ═══════════════════════════════════════════════════════════════════════════════

const TARGET_EMAIL = process.env.EMAIL || "demo@nexus.app";
const BATCH_SIZE = 5; // Insert in batches to avoid request size limits

// ═══════════════════════════════════════════════════════════════════════════════
// ── Load environment variables from .env.local ──
// ═══════════════════════════════════════════════════════════════════════════════

function loadEnv(): { url: string; serviceKey: string } {
  try {
    const raw = readFileSync(".env.local", "utf8");
    const env: Record<string, string> = {};
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
        }
      }
    });

    return {
      url: env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    };
  } catch {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Seed Data — Items ──
// ═══════════════════════════════════════════════════════════════════════════════

interface SeedItem {
  type: string;
  title: string;
  content: string;
  extracted_text: string;
  metadata: Record<string, unknown>;
  is_favorite: boolean;
  category: string;
  tags: string[];
  summary: string;
  keyPoints: string[];
  sentiment: "positive" | "negative" | "neutral";
  embedding: number[];
}

// Generate a deterministic pseudo-embedding (768 dims) from a seed number
function generateEmbedding(seed: number): number[] {
  const embedding: number[] = [];
  let x = seed * 12345;
  for (let i = 0; i < 768; i++) {
    // Simple LCG pseudo-random that produces values in [-1, 1]
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    embedding.push((x / 0x7fffffff) * 2 - 1);
  }
  return embedding;
}

const SEED_ITEMS: SeedItem[] = [
  // ─── AI & Technology ───
  {
    type: "link",
    title: "The Rise of AI in Modern Software Development",
    content: "https://example.com/ai-software-dev",
    extracted_text:
      "AI is transforming how developers write code. From GitHub Copilot to GPT-based code generation, machine learning models are becoming an integral part of the development workflow. This article explores the current state of AI-assisted programming, the tools available, and what the future holds for human developers in an AI-augmented world.",
    metadata: {
      sourceUrl: "https://example.com/ai-software-dev",
      domain: "example.com",
      author: "Sarah Chen",
      publishedAt: "2025-11-15T10:00:00Z",
      readingTime: 8,
    },
    is_favorite: true,
    category: "AI",
    tags: ["ai", "software-development", "machine-learning", "coding", "future-of-tech"],
    summary:
      "Explores how AI is transforming software development through tools like GitHub Copilot and GPT-based code generation, the current state of AI-assisted programming, and what the future holds for developers.",
    keyPoints: [
      "AI code generation tools can increase developer productivity by up to 55%",
      "The market for AI-powered development tools is expected to reach $37B by 2028",
      "Human oversight remains critical for complex architectural decisions",
      "Prompt engineering is becoming an essential developer skill",
    ],
    sentiment: "positive",
    embedding: generateEmbedding(1),
  },
  {
    type: "link",
    title: "Understanding Transformer Architectures: A Practical Guide",
    content: "https://example.com/transformer-guide",
    extracted_text:
      "Transformers have revolutionized natural language processing. This guide breaks down the key components: multi-head attention, positional encoding, feed-forward networks, and layer normalization. We'll walk through how these components work together to enable models like GPT-4 and BERT to understand and generate human-like text with remarkable accuracy.",
    metadata: {
      sourceUrl: "https://example.com/transformer-guide",
      domain: "example.com",
      author: "Marcus Johnson",
      publishedAt: "2025-10-22T14:30:00Z",
      readingTime: 12,
    },
    is_favorite: false,
    category: "AI",
    tags: ["transformers", "nlp", "deep-learning", "attention", "gpt"],
    summary:
      "A practical guide to Transformer architectures covering multi-head attention, positional encoding, feed-forward networks, and how they enable models like GPT-4 and BERT.",
    keyPoints: [
      "Transformers process all tokens in parallel, not sequentially like RNNs",
      "Self-attention allows the model to weigh the importance of different input parts",
      "Positional encoding preserves sequence order information",
      "Layer normalization and residual connections are crucial for training stability",
    ],
    sentiment: "neutral",
    embedding: generateEmbedding(2),
  },
  {
    type: "note",
    title: "My thoughts on RAG (Retrieval-Augmented Generation) Systems",
    content:
      "RAG systems combine retrieval from a knowledge base with generative AI to produce grounded, accurate responses.\n\nKey benefits:\n- Reduces hallucinations by grounding responses in retrieved data\n- Allows knowledge updates without retraining the model\n- Provides transparency by citing sources\n\nArchitecture considerations:\n- Chunking strategy significantly impacts retrieval quality\n- Hybrid search (keyword + semantic) outperforms either alone\n- Reranking improves result relevance\n\nI'm excited about applying RAG to personal knowledge management - it's essentially what NEXUS should do!",
    extracted_text:
      "RAG systems combine retrieval from a knowledge base with generative AI to produce grounded, accurate responses. Key benefits: reduces hallucinations by grounding responses in retrieved data, allows knowledge updates without retraining the model, provides transparency by citing sources.",
    metadata: {
      wordCount: 420,
      readingTime: 2,
    },
    is_favorite: true,
    category: "AI",
    tags: ["rag", "retrieval-augmented-generation", "llm", "knowledge-management", "ai-architecture"],
    summary:
      "Personal notes on RAG systems: how they combine retrieval with generative AI, key benefits like reduced hallucinations and source transparency, and architecture considerations for effective implementation.",
    keyPoints: [
      "RAG reduces hallucinations by grounding LLM outputs in retrieved data",
      "Knowledge can be updated by changing the vector store, not retraining",
      "Hybrid search (semantic + keyword) gives better results than either alone",
      "Chunking strategy is the most important tuning parameter",
    ],
    sentiment: "positive",
    embedding: generateEmbedding(3),
  },
  {
    type: "pdf",
    title: "Deep Learning Research Paper: Efficient Attention Mechanisms",
    content: "",
    extracted_text:
      "This paper presents novel approaches to reducing the computational complexity of attention mechanisms in Transformer models. We introduce sparse attention patterns that achieve O(n log n) complexity while maintaining model quality. Experimental results on language modeling and machine translation tasks demonstrate comparable or superior performance to full attention at a fraction of the computational cost.",
    metadata: {
      author: "Zhang et al.",
      publishedAt: "2025-09-01T00:00:00Z",
      fileType: "application/pdf",
      fileSize: 2400000,
    },
    is_favorite: false,
    category: "Research",
    tags: ["deep-learning", "attention", "transformers", "efficiency", "research-paper"],
    summary:
      "Research paper introducing sparse attention patterns that achieve O(n log n) complexity in Transformers while maintaining model quality, with results comparable to full attention at reduced computational cost.",
    keyPoints: [
      "Novel sparse attention patterns reduce complexity from O(n²) to O(n log n)",
      "Maintains model quality while significantly reducing computational cost",
      "Validated on language modeling and machine translation benchmarks",
    ],
    sentiment: "neutral",
    embedding: generateEmbedding(4),
  },
  {
    type: "voice_memo",
    title: "Meeting Notes: AI Strategy Discussion",
    content: "",
    extracted_text:
      "Team meeting discussing our AI strategy for Q4 and beyond. Key decisions: invest more in fine-tuning for domain-specific tasks, evaluate open-source models like Llama and Mistral for cost efficiency, build a evaluation pipeline for model quality assessment, and explore multi-modal capabilities for product features.",
    metadata: {
      duration: 845,
      author: "Product Team",
      wordCount: 320,
    },
    is_favorite: false,
    category: "Business",
    tags: ["ai-strategy", "meeting-notes", "fine-tuning", "open-source", "product"],
    summary:
      "Team meeting notes on AI strategy: investing in fine-tuning, evaluating open-source models, building evaluation pipelines, and exploring multi-modal features.",
    keyPoints: [
      "Prioritize fine-tuning for domain-specific use cases",
      "Evaluate Llama and Mistral for cost efficiency",
      "Build automated evaluation pipeline for model quality",
      "Explore multi-modal capabilities for product differentiation",
    ],
    sentiment: "neutral",
    embedding: generateEmbedding(5),
  },

  // ─── Web Development ───
  {
    type: "link",
    title: "Getting Started with Next.js 14: App Router Deep Dive",
    content: "https://example.com/nextjs-14-guide",
    extracted_text:
      "Next.js 14 introduces the stable App Router, bringing React Server Components, streaming, and nested layouts to production. This guide covers file-based routing, server and client components, data fetching patterns, middleware, and deployment best practices for building modern full-stack applications.",
    metadata: {
      sourceUrl: "https://example.com/nextjs-14-guide",
      domain: "example.com",
      author: "David Kim",
      publishedAt: "2025-08-05T08:00:00Z",
      readingTime: 15,
    },
    is_favorite: true,
    category: "Programming",
    tags: ["nextjs", "react", "web-development", "full-stack", "app-router"],
    summary:
      "Comprehensive guide to Next.js 14's App Router covering React Server Components, streaming, nested layouts, data fetching patterns, and deployment best practices.",
    keyPoints: [
      "App Router is now stable and recommended for production",
      "React Server Components reduce client-side JavaScript by up to 80%",
      "Streaming enables progressive rendering for faster page loads",
      "Nested layouts persist state across navigations without full page reloads",
    ],
    sentiment: "positive",
    embedding: generateEmbedding(6),
  },
  {
    type: "video",
    title: "React Server Components Deep Dive",
    content: "https://youtube.com/watch?v=react-server-components",
    extracted_text:
      "A deep dive into React Server Components (RSC) and how they change the mental model for building web applications. We cover the difference between server and client components, when to use each, how data fetching works in RSC, and patterns for mixing interactive UI with server-rendered content.",
    metadata: {
      sourceUrl: "https://youtube.com/watch?v=react-server-components",
      domain: "youtube.com",
      duration: 3420,
      author: "React Conf",
      publishedAt: "2025-07-20T16:00:00Z",
    },
    is_favorite: false,
    category: "Programming",
    tags: ["react", "server-components", "rsc", "frontend", "architecture"],
    summary:
      "Deep dive into React Server Components covering the mental model shift, server vs client component patterns, data fetching strategies, and mixing interactivity with server-rendered content.",
    keyPoints: [
      "Server Components run on the server and send zero JavaScript to the client",
      "Client Components are still needed for interactivity and browser APIs",
      "Data fetching can happen directly in Server Components without useEffect",
      "The 'use client' directive marks the boundary between server and client",
    ],
    sentiment: "positive",
    embedding: generateEmbedding(7),
  },
  {
    type: "note",
    title: "API Design Guidelines & Best Practices",
    content:
      "Principles I follow when designing APIs:\n\n1. Consistency is king - use predictable naming, status codes, and error formats\n2. Version your APIs from day one (/v1/, /v2/)\n3. Use proper HTTP methods (GET for read, POST for create, PUT for full update, PATCH for partial)\n4. Paginate list endpoints with cursor-based pagination\n5. Return meaningful error messages with error codes\n6. Rate limiting is essential for production APIs\n7. Document with OpenAPI/Swagger from the start\n\nResources:\n- Google API Design Guide\n- Microsoft REST API Guidelines\n- JSON:API Specification",
    extracted_text:
      "Principles for designing good APIs: consistency, versioning, proper HTTP methods, cursor-based pagination, meaningful error messages, rate limiting, and OpenAPI documentation.",
    metadata: { wordCount: 380, readingTime: 2 },
    is_favorite: false,
    category: "Programming",
    tags: ["api-design", "rest", "best-practices", "backend", "architecture"],
    summary:
      "Personal reference for API design best practices: consistency, versioning, HTTP methods, pagination, error handling, rate limiting, and documentation.",
    keyPoints: [
      "Use cursor-based pagination instead of offset for consistent results",
      "Return structured errors with codes, not just HTTP status",
      "Document APIs with OpenAPI/Swagger before implementing",
      "Rate limiting prevents cascading failures in production",
    ],
    sentiment: "neutral",
    embedding: generateEmbedding(8),
  },
  {
    type: "image",
    title: "System Architecture Diagram — Microservices",
    content: "",
    extracted_text:
      "Architecture diagram showing a microservices system with API Gateway, service mesh, message queue, database per service, and monitoring stack. Services include: User Service, Item Service, Search Service, AI Processing Service, and Notification Service.",
    metadata: {
      fileType: "image/png",
      fileSize: 580000,
      author: "Architecture Team",
    },
    is_favorite: false,
    category: "Programming",
    tags: ["architecture", "microservices", "system-design", "infrastructure"],
    summary:
      "Architecture diagram of a microservices system with API Gateway, service mesh, message queue, and five core services with per-service databases.",
    keyPoints: [
      "API Gateway handles routing, auth, and rate limiting",
      "Each service has its own database to ensure loose coupling",
      "Message queue enables asynchronous processing",
      "Service mesh handles service-to-service communication",
    ],
    sentiment: "neutral",
    embedding: generateEmbedding(9),
  },
  {
    type: "link",
    title: "Understanding PostgreSQL Performance Tuning",
    content: "https://example.com/postgres-performance",
    extracted_text:
      "PostgreSQL performance tuning involves understanding query planning, index strategies, configuration parameters, and monitoring. Key areas: effective use of EXPLAIN ANALYZE, choosing the right index types (B-tree, GiST, GIN), configuring work_mem and shared_buffers, and setting up proper partitioning for large tables.",
    metadata: {
      sourceUrl: "https://example.com/postgres-performance",
      domain: "example.com",
      author: "PostgreSQL Team",
      publishedAt: "2025-06-10T09:00:00Z",
      readingTime: 10,
    },
    is_favorite: false,
    category: "Programming",
    tags: ["postgresql", "database", "performance", "sql", "tuning"],
    summary:
      "Guide to PostgreSQL performance tuning covering query planning, index selection, configuration parameters, and monitoring for optimal database performance.",
    keyPoints: [
      "EXPLAIN ANALYZE shows actual execution times, not just estimates",
      "Choose index types based on query patterns: B-tree for equality/range, GIN for full-text",
      "work_mem and shared_buffers are the most impactful configuration parameters",
      "Table partitioning improves query performance and maintenance on large datasets",
    ],
    sentiment: "neutral",
    embedding: generateEmbedding(10),
  },

  // ─── Design ───
  {
    type: "link",
    title: "Design Systems Best Practices in 2025",
    content: "https://example.com/design-systems-2025",
    extracted_text:
      "Modern design systems have evolved beyond component libraries. They now include design tokens, accessibility guidelines, animation specs, content patterns, and contribution workflows. This article covers how to build a scalable design system that your entire organization will adopt and maintain.",
    metadata: {
      sourceUrl: "https://example.com/design-systems-2025",
      domain: "example.com",
      author: "Elena Rodriguez",
      publishedAt: "2025-11-01T12:00:00Z",
      readingTime: 10,
    },
    is_favorite: true,
    category: "Design",
    tags: ["design-systems", "ui-design", "accessibility", "design-tokens", "figma"],
    summary:
      "Modern design system best practices covering design tokens, accessibility, animation specs, content patterns, and organizational adoption strategies.",
    keyPoints: [
      "Design tokens create a single source of truth for visual properties",
      "Accessibility should be built into the system, not added as an afterthought",
      "Animation specs should be as rigorous as color and typography tokens",
      "A contribution model enables the system to evolve with team needs",
    ],
    sentiment: "positive",
    embedding: generateEmbedding(11),
  },
  {
    type: "note",
    title: "Weekly Design Review — Nov 2025",
    content:
      "Design review notes from this week:\n\nHomepage Redesign:\n- Hero section animation needs performance optimization\n- Color contrast on CTA button doesn't meet WCAG AA (fix: use nexus-400 instead of nexus-300)\n- Mobile navigation feels cramped\n\nDashboard:\n- Stats cards look great, but the spacing feels inconsistent\n- Add micro-interactions on hover for cards\n- The graph view needs better empty state handling\n\nDesign System Updates:\n- New elevation tokens approved\n- Added focus ring styles for keyboard navigation\n- Updated shadow tokens to be more consistent",
    extracted_text:
      "Weekly design notes: homepage redesign needs hero animation optimization, CTA color contrast fix for WCAG AA, mobile nav spacing. Dashboard stat cards need consistent spacing and hover micro-interactions. Design system updates for elevation tokens and focus ring styles.",
    metadata: { wordCount: 450, readingTime: 2 },
    is_favorite: false,
    category: "Design",
    tags: ["design-review", "ui", "ux", "accessibility", "feedback"],
    summary:
      "Weekly design review notes covering homepage hero optimization, CTA accessibility fix, mobile nav improvements, dashboard micro-interactions, and design system token updates.",
    keyPoints: [
      "CTA button needs nexus-400 for WCAG AA color contrast compliance",
      "Dashboard stat cards need consistent spacing and hover animations",
      "New elevation tokens and focus ring styles approved for the design system",
    ],
    sentiment: "neutral",
    embedding: generateEmbedding(12),
  },
  {
    type: "screenshot",
    title: "Dashboard Analytics View — Mockup v3",
    content: "",
    extracted_text:
      "Dashboard analytics mockup showing key metrics: total items (1,247), active collections (12), AI connections discovered (89), weekly active users (342). Charts include: items saved over time, category distribution pie chart, and top tags bar chart.",
    metadata: {
      fileType: "image/png",
      fileSize: 1200000,
      author: "Product Design Team",
    },
    is_favorite: false,
    category: "Design",
    tags: ["mockup", "dashboard", "analytics", "ui-design", "data-viz"],
    summary:
      "Dashboard analytics mockup v3 showing key metrics and charts for items, collections, AI connections, and user activity.",
    keyPoints: [
      "Clean data visualization with consistent color coding",
      "Interactive charts with hover tooltips showing detailed data",
      "Responsive grid layout adapts from 4 columns to 1 on mobile",
    ],
    sentiment: "positive",
    embedding: generateEmbedding(13),
  },

  // ─── Science & Research ───
  {
    type: "link",
    title: "Climate Change: 2024 Annual Report Summary",
    content: "https://example.com/climate-report-2024",
    extracted_text:
      "The 2024 climate report shows that global temperatures have risen 1.3°C above pre-industrial levels. Key findings: Arctic sea ice continues to decline at 12% per decade, renewable energy now accounts for 30% of global electricity, and carbon emissions need to peak before 2025 to meet Paris Agreement goals.",
    metadata: {
      sourceUrl: "https://example.com/climate-report-2024",
      domain: "example.com",
      author: "Climate Research Institute",
      publishedAt: "2025-03-15T10:00:00Z",
      readingTime: 20,
    },
    is_favorite: false,
    category: "Science",
    tags: ["climate-change", "environment", "research", "global-warming", "renewable-energy"],
    summary:
      "2024 climate report: global temperatures 1.3°C above pre-industrial levels, Arctic ice declining at 12% per decade, renewable energy at 30% of global electricity.",
    keyPoints: [
      "Global temperatures have risen 1.3°C above pre-industrial levels",
      "Renewable energy now accounts for 30% of global electricity generation",
      "Carbon emissions must peak before 2025 to meet Paris Agreement goals",
      "Arctic sea ice continues to decline at 12% per decade",
    ],
    sentiment: "negative",
    embedding: generateEmbedding(14),
  },
  {
    type: "note",
    title: "Book Notes: Thinking in Systems by Donella Meadows",
    content:
      "Key concepts from Thinking in Systems:\n\n1. Stocks and Flows - The foundation of system thinking. Stocks are the elements that accumulate or deplete (like water in a bathtub), flows are the rates of change (like faucet and drain).\n\n2. Feedback Loops - Balancing loops resist change (stabilize), reinforcing loops amplify change (growth or collapse).\n\n3. Leverage Points - Places to intervene in a system. The most effective leverage points are changing the system's goals or mindset, not just adjusting parameters.\n\n4. System Traps - Common failure modes: policy resistance, tragedy of the commons, drift to low performance, escalation, and success to the successful.\n\nApplication to NEXUS: A personal knowledge base is a system. Inputs are saved items, outputs are retrieved knowledge. Feedback loops include AI connections and recommendations.",
    extracted_text:
      "Notes on Thinking in Systems by Donella Meadows covering stocks and flows, feedback loops, leverage points, and system traps. Applied to personal knowledge management.",
    metadata: { wordCount: 520, readingTime: 3 },
    is_favorite: true,
    category: "Science",
    tags: ["systems-thinking", "books", "feedback-loops", "mental-models", "complexity"],
    summary:
      "Book notes on Thinking in Systems: stocks and flows, feedback loops, leverage points for system intervention, common system traps, and application to personal knowledge management.",
    keyPoints: [
      "Leverage points: changing system goals is more effective than adjusting parameters",
      "Reinforcing feedback loops drive growth, balancing loops maintain stability",
      "System traps include policy resistance, tragedy of the commons, and escalation",
      "A knowledge base is a system with inputs and outputs that can be optimized",
    ],
    sentiment: "positive",
    embedding: generateEmbedding(15),
  },
  {
    type: "link",
    title: "Introduction to Quantum Computing for Developers",
    content: "https://example.com/quantum-computing-intro",
    extracted_text:
      "Quantum computing leverages qubits that can exist in superposition states, allowing for exponential parallel computation. This introduction covers qubits, quantum gates, entanglement, and key algorithms like Shor's algorithm for factoring and Grover's algorithm for search. Current challenges include qubit coherence times and error correction overhead.",
    metadata: {
      sourceUrl: "https://example.com/quantum-computing-intro",
      domain: "example.com",
      author: "Quantum Lab",
      publishedAt: "2025-05-20T11:00:00Z",
      readingTime: 10,
    },
    is_favorite: false,
    category: "Science",
    tags: ["quantum-computing", "qubits", "algorithms", "physics", "future-tech"],
    summary:
      "Introduction to quantum computing for developers covering qubits, superposition, entanglement, quantum gates, and key algorithms like Shor's and Grover's.",
    keyPoints: [
      "Qubits use superposition to represent 0 and 1 simultaneously",
      "Entanglement allows qubits to be correlated across distances",
      "Shor's algorithm could break current encryption standards",
      "Error correction remains the biggest challenge for practical quantum computers",
    ],
    sentiment: "neutral",
    embedding: generateEmbedding(16),
  },

  // ─── Productivity ───
  {
    type: "link",
    title: "Essential Productivity Tips for Remote Workers",
    content: "https://example.com/remote-productivity",
    extracted_text:
      "Working remotely requires intentional strategies for productivity. Key tips: establish a morning routine that separates personal from work time, use time blocking for deep work, create a dedicated workspace, take regular breaks using the Pomodoro technique, and over-communicate with your team through async documentation.",
    metadata: {
      sourceUrl: "https://example.com/remote-productivity",
      domain: "example.com",
      author: "Remote Work Guide",
      publishedAt: "2025-04-10T07:00:00Z",
      readingTime: 6,
    },
    is_favorite: false,
    category: "Productivity",
    tags: ["productivity", "remote-work", "time-management", "work-life-balance", "pomodoro"],
    summary:
      "Remote work productivity tips: morning routines, time blocking, dedicated workspace, Pomodoro technique, and async communication strategies.",
    keyPoints: [
      "Time blocking with deep work sessions improves output by 40%",
      "Pomodoro technique (25 min work, 5 min break) maintains focus",
      "Async documentation reduces meeting overhead by up to 60%",
      "A dedicated workspace improves work-life separation",
    ],
    sentiment: "positive",
    embedding: generateEmbedding(17),
  },
  {
    type: "note",
    title: "My Daily Workflow & Tools",
    content:
      "My current productivity stack:\n\nMorning (8-10 AM): Deep work - writing/planning\n- Focus app: Endel (focus mode)\n- Notes: Obsidian\n- Block: Deep Work Time on calendar (no meetings)\n\nMidday (10-12 PM): Collaboration\n- Slack for quick messages\n- Linear for task management\n- GitHub for code review\n\nAfternoon (1-4 PM): Meetings & Async\n- Notion for documentation\n- Figma for design collaboration\n- Loom for async video updates\n\nEvening (4-6 PM): Shallow work\n- Email processing\n- Inbox zero\n- Planning next day\n\nTools I want to try: Arc Browser, Raycast, Linear for personal tasks",
    extracted_text:
      "Daily productivity workflow: deep work in the morning (Endel, Obsidian), collaboration midday (Slack, Linear, GitHub), meetings and async work afternoon (Notion, Figma, Loom), shallow work evening (email, planning).",
    metadata: { wordCount: 380, readingTime: 2 },
    is_favorite: false,
    category: "Productivity",
    tags: ["workflow", "productivity-tools", "daily-routine", "time-management"],
    summary:
      "Personal productivity workflow: deep work mornings, collaboration midday, async afternoons, and shallow work evenings with specific tools for each block.",
    keyPoints: [
      "Deep work block from 8-10 AM with no meetings scheduled",
      "Async video updates with Loom reduce meeting time",
      "Using different tools for different types of work improves focus",
    ],
    sentiment: "positive",
    embedding: generateEmbedding(18),
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── Seed Data — Collections ──
// ═══════════════════════════════════════════════════════════════════════════════

interface SeedCollection {
  name: string;
  description: string;
  type: string;
  icon: string;
  color: string;
  visibility: string;
  itemIndices: number[]; // indices into SEED_ITEMS
}

const SEED_COLLECTIONS: SeedCollection[] = [
  {
    name: "AI & Machine Learning",
    description: "Articles, notes, and research about artificial intelligence and machine learning",
    type: "manual",
    icon: "🤖",
    color: "#6366f1",
    visibility: "private",
    itemIndices: [0, 1, 2, 3, 4], // All AI items
  },
  {
    name: "Web Development",
    description: "Resources for full-stack web development with React, Next.js, and friends",
    type: "manual",
    icon: "💻",
    color: "#22c55e",
    visibility: "private",
    itemIndices: [5, 6, 7, 8, 9], // All web dev items
  },
  {
    name: "Design Resources",
    description: "Design systems, UI patterns, and visual inspiration",
    type: "manual",
    icon: "🎨",
    color: "#ec4899",
    visibility: "private",
    itemIndices: [10, 11, 12], // All design items
  },
  {
    name: "Research Papers",
    description: "Academic papers and scientific research automatically collected",
    type: "auto",
    icon: "🔬",
    color: "#a855f7",
    visibility: "private",
    itemIndices: [3, 13, 14, 15], // Research-related items
  },
  {
    name: "Productivity & Workflow",
    description: "Tools, tips, and systems for getting things done",
    type: "manual",
    icon: "⚡",
    color: "#f97316",
    visibility: "private",
    itemIndices: [16, 17],
  },
  {
    name: "Favorites",
    description: "My most important and frequently accessed items",
    type: "manual",
    icon: "⭐",
    color: "#eab308",
    visibility: "private",
    itemIndices: [0, 2, 5, 10, 14], // Favorite items
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── Seed Data — Connections ──
// ═══════════════════════════════════════════════════════════════════════════════

interface SeedConnection {
  fromIndex: number;
  toIndex: number;
  strength: number;
  type: string;
  description: string;
}

// Connections based on thematic similarity between items
const SEED_CONNECTIONS: SeedConnection[] = [
  // AI cluster
  { fromIndex: 0, toIndex: 1, strength: 0.85, type: "semantic", description: "Both cover AI technology topics - software dev and transformers" },
  { fromIndex: 0, toIndex: 2, strength: 0.75, type: "semantic", description: "AI development tools relate to RAG systems architecture" },
  { fromIndex: 1, toIndex: 3, strength: 0.8, type: "semantic", description: "Transformer architectures are the foundation of modern deep learning" },
  { fromIndex: 2, toIndex: 4, strength: 0.7, type: "semantic", description: "RAG discussion relates to team's AI strategy decisions" },
  { fromIndex: 1, toIndex: 2, strength: 0.65, type: "semantic", description: "Understanding transformers helps in building RAG systems" },

  // Web Dev cluster
  { fromIndex: 5, toIndex: 6, strength: 0.9, type: "semantic", description: "Next.js and React Server Components are closely related" },
  { fromIndex: 5, toIndex: 7, strength: 0.6, type: "semantic", description: "API design is part of full-stack Next.js development" },
  { fromIndex: 6, toIndex: 8, strength: 0.55, type: "semantic", description: "React architecture relates to microservices system design" },
  { fromIndex: 7, toIndex: 9, strength: 0.65, type: "semantic", description: "API design and database performance are both backend concerns" },
  { fromIndex: 5, toIndex: 9, strength: 0.7, type: "semantic", description: "Next.js apps often use PostgreSQL for data persistence" },

  // Design cluster
  { fromIndex: 10, toIndex: 11, strength: 0.8, type: "semantic", description: "Design system implementation informs weekly design reviews" },
  { fromIndex: 10, toIndex: 12, strength: 0.75, type: "semantic", description: "Design systems produce dashboard mockups and patterns" },
  { fromIndex: 11, toIndex: 12, strength: 0.6, type: "semantic", description: "Design review feedback leads to updated mockups" },

  // Science cluster
  { fromIndex: 13, toIndex: 14, strength: 0.5, type: "semantic", description: "Climate science and systems thinking are connected through complex systems" },
  { fromIndex: 14, toIndex: 15, strength: 0.45, type: "semantic", description: "Systems thinking principles apply to understanding quantum mechanics" },

  // Productivity cluster
  { fromIndex: 16, toIndex: 17, strength: 0.85, type: "semantic", description: "Remote productivity tips directly inform personal workflow optimization" },

  // Cross-domain
  { fromIndex: 0, toIndex: 5, strength: 0.4, type: "semantic", description: "AI-assisted development relates to modern web frameworks" },
  { fromIndex: 2, toIndex: 16, strength: 0.35, type: "semantic", description: "Both discuss optimization and efficiency in different contexts" },
  { fromIndex: 10, toIndex: 5, strength: 0.5, type: "semantic", description: "Design systems and web development overlap in frontend implementation" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── Main Seed Logic ──
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   NEXUS — Database Seed Script                      ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // ── Connect to Supabase ──
  const { url, serviceKey } = loadEnv();
  if (!url || !serviceKey) {
    console.error("❌ Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local");
    process.exit(1);
  }

  console.log(`🔌 Connecting to Supabase: ${url}\n`);
  const supabase = createClient(url, serviceKey);

  // ── Step 1: Find or create user ──
  console.log(`👤 Setting up user: ${TARGET_EMAIL}`);

  // Try to find existing user
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("email", TARGET_EMAIL)
    .single();

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    console.log(`   ✅ Found existing user: ${existingUser.name || existingUser.email} (${userId})`);
  } else {
    // Check auth users table
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const usersList = (authUsers as { users: Array<{ id: string; email?: string }> } | null)?.users || [];
    const authUser = usersList.find((u) => u.email === TARGET_EMAIL);

    if (authUser) {
      userId = authUser.id;
      // Create the user record
      await supabase.from("users").upsert({
        id: userId,
        email: TARGET_EMAIL,
        name: "Demo User",
        plan: "pro",
      });
      console.log(`   ✅ Created user record for existing auth user: ${userId}`);
    } else {
      // Create both auth user and user record
      const { data: newAuth, error: authError } = await supabase.auth.admin.createUser({
        email: TARGET_EMAIL,
        password: "demo123456",
        email_confirm: true,
        user_metadata: { name: "Demo User" },
      });

      if (authError) {
        console.error(`   ❌ Failed to create auth user: ${authError.message}`);
        console.log("   ℹ️  You can create this user manually, then re-run the seed script.");
        process.exit(1);
      }

      userId = newAuth!.user.id;
      await supabase.from("users").upsert({
        id: userId,
        email: TARGET_EMAIL,
        name: "Demo User",
        plan: "pro",
      });
      console.log(`   ✅ Created new user: ${TARGET_EMAIL} / demo123456`);
    }
  }

  // ── Step 2: Create items ──
  console.log(`\n📦 Creating ${SEED_ITEMS.length} items...`);

  const itemIds: string[] = [];

  for (let i = 0; i < SEED_ITEMS.length; i += BATCH_SIZE) {
    const batch = SEED_ITEMS.slice(i, i + BATCH_SIZE);
    const records = batch.map((item, batchIdx) => {
      const idx = i + batchIdx;
      const aiData = {
        summary: item.summary,
        tags: item.tags,
        category: item.category,
        keyPoints: item.keyPoints,
        sentiment: item.sentiment,
        language: "en" as const,
        entities: [] as string[],
        embedding: item.embedding,
        processingVersion: 1,
        processedAt: new Date().toISOString(),
      };

      return {
        user_id: userId,
        type: item.type,
        title: item.title,
        content: item.content,
        extracted_text: item.extracted_text,
        metadata: item.metadata,
        ai_data: aiData,
        embedding: item.embedding,
        is_favorite: item.is_favorite,
        visibility: "private",
        created_at: new Date(Date.now() - (SEED_ITEMS.length - idx) * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from("items")
      .upsert(records, { onConflict: "user_id, title" })
      .select("id");

    if (error) {
      console.error(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      process.exit(1);
    }

    const batchIds = (data || []).map((r) => r.id);
    itemIds.push(...batchIds);
    console.log(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchIds.length} items synced`);
  }

  console.log(`   ✅ All ${itemIds.length} items synced successfully`);

  // ── Step 3: Create collections and link items ──
  console.log(`\n📁 Creating ${SEED_COLLECTIONS.length} collections...`);

  const collectionIds: string[] = [];

  for (const col of SEED_COLLECTIONS) {
    const { data, error } = await supabase
      .from("collections")
      .upsert({
        user_id: userId,
        name: col.name,
        description: col.description,
        type: col.type,
        icon: col.icon,
        color: col.color,
        visibility: col.visibility,
        item_count: col.itemIndices.length,
      }, { onConflict: "user_id, name" })
      .select("id")
      .single();

    if (error) {
      console.error(`   ❌ Failed to create collection "${col.name}":`, error.message);
      continue;
    }

    const collectionId = data.id;
    collectionIds.push(collectionId);

    // Link items to collection
    const linkedItemIds = col.itemIndices.map((idx) => itemIds[idx]).filter(Boolean);
    const junctionRecords = linkedItemIds.map((itemId) => ({
      collection_id: collectionId,
      item_id: itemId,
    }));

    if (junctionRecords.length > 0) {
      // Use upsert with on conflict do nothing to handle duplicates
      const { error: linkError } = await supabase
        .from("collection_items")
        .upsert(junctionRecords, { onConflict: "collection_id, item_id", ignoreDuplicates: true });

      if (linkError) {
        console.error(`   ⚠️  Warning linking items to "${col.name}":`, linkError.message);
      }
    }

    console.log(`   ✅ "${col.name}" (${linkedItemIds.length} items)`);
  }

  // ── Step 4: Create connections ──
  console.log(`\n🔗 Creating ${SEED_CONNECTIONS.length} connections...`);

  const connectionRecords = SEED_CONNECTIONS
    .map((conn) => {
      const fromId = itemIds[conn.fromIndex];
      const toId = itemIds[conn.toIndex];
      if (!fromId || !toId) return null;
      return {
        user_id: userId,
        from_item_id: fromId,
        to_item_id: toId,
        type: conn.type,
        strength: conn.strength,
        description: conn.description,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const { error: connError } = await supabase.from("connections").upsert(
    connectionRecords,
    { onConflict: "from_item_id, to_item_id, type", ignoreDuplicates: true }
  );

  if (connError) {
    console.error(`   ⚠️  Warning creating connections:`, connError.message);
  } else {
    console.log(`   ✅ ${connectionRecords.length} connections created`);
  }

  // ── Step 5: Create activity log entries ──
  console.log(`\n📋 Creating activity log entries...`);

  // Clear existing activity log for this user to keep re-runs clean
  await supabase.from("activity_log").delete().eq("user_id", userId);

  const activityEntries = [
    // Onboarding / setup activities
    {
      user_id: userId,
      action: "onboarding_completed",
      entity_type: "user",
      entity_id: userId,
      metadata: { completedSteps: 3, focus: "development" },
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      user_id: userId,
      action: "create",
      entity_type: "item",
      entity_id: itemIds[0],
      metadata: { type: "link", title: SEED_ITEMS[0].title },
      created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    },
    {
      user_id: userId,
      action: "ai_process",
      entity_type: "item",
      entity_id: itemIds[0],
      metadata: { processingTime: 2340, connectionsFound: 5, partialFailures: [] },
      created_at: new Date(Date.now() - 28 * 86400000 + 5000).toISOString(),
    },
    {
      user_id: userId,
      action: "create",
      entity_type: "collection",
      entity_id: collectionIds[0],
      metadata: { name: SEED_COLLECTIONS[0].name, type: "manual" },
      created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    },
    {
      user_id: userId,
      action: "search",
      entity_type: "search",
      metadata: { query: "machine learning transformers", mode: "semantic", resultCount: 8 },
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
    {
      user_id: userId,
      action: "create",
      entity_type: "item",
      entity_id: itemIds[5],
      metadata: { type: "link", title: SEED_ITEMS[5].title },
      created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    },
    {
      user_id: userId,
      action: "ai_process",
      entity_type: "item",
      entity_id: itemIds[5],
      metadata: { processingTime: 1890, connectionsFound: 3, partialFailures: [] },
      created_at: new Date(Date.now() - 15 * 86400000 + 3000).toISOString(),
    },
    {
      user_id: userId,
      action: "create",
      entity_type: "item",
      entity_id: itemIds[10],
      metadata: { type: "link", title: SEED_ITEMS[10].title },
      created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      user_id: userId,
      action: "ai_backfill",
      entity_type: "item",
      entity_id: itemIds[14],
      metadata: { duration: "4.2s", type: "note" },
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      user_id: userId,
      action: "search",
      entity_type: "search",
      metadata: { query: "remote work productivity tips 2025", mode: "fulltext", resultCount: 5 },
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      user_id: userId,
      action: "create",
      entity_type: "item",
      entity_id: itemIds[17],
      metadata: { type: "note", title: SEED_ITEMS[17].title },
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
    {
      user_id: userId,
      action: "ai_process",
      entity_type: "item",
      entity_id: itemIds[17],
      metadata: { processingTime: 1560, connectionsFound: 2, partialFailures: [] },
      created_at: new Date(Date.now() - 1 * 86400000 + 2000).toISOString(),
    },
  ];

  const { error: activityError } = await supabase.from("activity_log").insert(activityEntries);
  if (activityError) {
    console.error(`   ⚠️  Warning creating activity log entries:`, activityError.message);
  } else {
    console.log(`   ✅ ${activityEntries.length} activity entries created`);
  }

  // ── Step 6: Create AI queue entries ──
  console.log(`\n📋 Creating AI queue entries...`);

  // Clear existing queue entries for these items to keep re-runs clean
  await supabase.from("ai_queue").delete().in("item_id", itemIds);

  const queueEntries = itemIds.map((id, idx) => ({
    item_id: id,
    status: "completed" as const,
    priority: idx < 5 ? 1 : 0,
    started_at: new Date(Date.now() - (SEED_ITEMS.length - idx) * 86400000).toISOString(),
    completed_at: new Date(Date.now() - (SEED_ITEMS.length - idx) * 86400000 + 30000).toISOString(),
    created_at: new Date(Date.now() - (SEED_ITEMS.length - idx) * 86400000 - 1000).toISOString(),
  }));

  // Insert in batches (insert only, no upsert — ai_queue has no unique constraint on item_id)
  for (let i = 0; i < queueEntries.length; i += BATCH_SIZE) {
    const batch = queueEntries.slice(i, i + BATCH_SIZE);
    const { error: qError } = await supabase.from("ai_queue").insert(
      batch.map((e) => ({ item_id: e.item_id, status: e.status }))
    );
    if (qError) {
      console.error(`   ⚠️  Warning creating queue entries:`, qError.message);
    }
  }

  console.log(`   ✅ ${queueEntries.length} AI queue entries created`);

  // ═══════════════════════════════════════════════════════════════════
  // ── Summary ──
  // ═══════════════════════════════════════════════════════════════════

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   ✅ Seed Complete!                                  ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log(`   👤 User:           ${TARGET_EMAIL}`);
  console.log(`   📦 Items:          ${itemIds.length}`);
  console.log(`   📁 Collections:    ${collectionIds.length}`);
  console.log(`   🔗 Connections:    ${connectionRecords.length}`);
  console.log(`   📋 Activity Log:   ${activityEntries.length}`);
  console.log(`   📋 AI Queue:       ${queueEntries.length}\n`);
  console.log("   Sign in with: demo@nexus.app / demo123456\n");
  console.log("   If the user doesn't exist, create them in Supabase Auth first,\n   then re-run this script.\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
