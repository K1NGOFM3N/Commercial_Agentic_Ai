# Commercial Agentic AI

[![Built with Architect by Lyzr](https://img.shields.io/badge/Built%20with-Architect%20by%20Lyzr-6f42c1.svg)](https://www.lyzr.ai/)
[![Framework](https://img.shields.io/badge/Framework-Next.js%2014-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An enterprise-ready, multi-agent AI application designed to automate commercial workflows, lead scoring, market intelligence, and business execution. Built with **Next.js** and powered by **Architect by Lyzr**, this application provides a complete full-stack interface and backend orchestration layer for autonomous AI agents.

---

## 🌟 Key Features

* **🤖 Autonomous Multi-Agent Orchestration:** Powered by the Lyzr Agent Framework, coordinating specialized sub-agents (e.g., Prospecting, Competitor Intelligence, Outreach).
* **🖥️ Interactive Dashboard:** Full Next.js user interface to launch agent tasks, monitor execution pipelines, and review generated insights in real time.
* **🛡️ Governance & Guardrails:** Native integration with the Lyzr Control Plane for safety checks, prompt governance, and output verification.
* **🔍 Contextual Knowledge (RAG):** Capabilities to ground agent decisions in internal commercial documents, sales decks, and market data.
* **📊 Observability & Logging:** Trace agent reasoning steps, API integrations, and model interactions.

---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend Framework** | [Next.js](https://nextjs.org/) (React, TypeScript) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
| **Agent Engine** | [Lyzr Agent Framework](https://www.lyzr.ai/) |
| **LLM Provider** | Configurable via Lyzr (OpenAI GPT-4o, Anthropic Claude, AWS Bedrock) |
| **State & API Handling** | Next.js App Router & Server Actions |

---

## 📁 Project Structure

```text
Commercial_Agentic_Ai/
├── src/
│   ├── app/              # Next.js App Router pages and API routes
│   │   ├── api/          # Backend API endpoints for agent execution
│   │   ├── dashboard/    # Agent control center and reporting UI
│   │   └── page.tsx      # Main application landing page
│   ├── components/       # Reusable UI components & agent status feeds
│   ├── lib/              # Lyzr SDK initializers, tool definitions, and helpers
│   └── types/            # TypeScript interfaces for agent inputs/outputs
├── public/               # Static assets and icons
├── .env.example          # Environment variables template
├── package.json          # Project dependencies and scripts
└── README.md             # Project documentation
