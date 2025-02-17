# Bee Agent Framework Crash Course

## Overview
Bee Agent Framework is a framework that supports AI-based agent development. This tutorial focuses on integration with IBM watsonx.ai and has been tested on macOS 15.1.1 (14-inch, 2023 M2 Pro 32GB). This document provides a quick start guide to using the Bee Agent Framework.

Official documentation: [Bee Agent Framework Official Page](https://i-am-bee.github.io/bee-agent-framework/#/)

---

## Installation & Setup
### 1. Install Packages
First, check the `package.json` file and install the required dependencies:
```sh
npm install
```

### 2. Set Environment Variables
Create a `.env` file and fill in the following details:
```ini
WATSONX_API_KEY=
WATSONX_PROJECT_ID=
WATSONX_REGION=
WATSONX_URL=
WATSONX_AI_APIKEY=
WATSONX_AI_AUTH_TYPE=iam
WATSONX_AI_PROJECT_ID=
CODE_INTERPRETER_URL=
MILVUS_HOST=
MILVUS_PORT=
MILVUS_USERNAME=
MILVUS_PASSWORD=
MILVUS_COLLECTION=
MILVUS_ADDRESS=
MILVUS_SSL=
```

### 3. Run Scripts
To execute JavaScript or TypeScript files:
- JavaScript:
  ```sh
  node xxxx.js
  ```
- TypeScript:
  ```sh
  node --loader ts-node/esm xxxx.ts
  ```

---

## Tutorial Structure
The tutorial directory structure is as follows:
```plaintext
.
├── README.md
├── helpers
│   └── io.ts
├── package-lock.json
├── package.json
├── tsconfig.json
└── tutorial
    ├── v0
    │   ├── bee-agent-sample.js
    │   ├── custom-tool-travel-agent.ts
    │   ├── text-generation.js
    │   └── workflow-multi-agent.js
    └── v1
        ├── bee-agent-sample.js
        ├── custom-agent-milvus-critique-console.ts
        ├── custom-agent-milvus-critique.ts
        ├── custom-agent-sample.ts
        ├── custom-tool-advanced.ts
        ├── custom-tool-basic.ts
        ├── custom-tool-travel-agent.ts
        ├── milvus-search.js
        ├── text-embedding.js
        ├── text-generation-console.ts
        ├── text-generation.js
        ├── workflow-agent-delegation.ts
        ├── workflow-basic.ts
        ├── workflow-multi-agent-content-creator.ts
        ├── workflow-multi-agent.ts
        └── workflow-nested.ts
```
- `v0` folder: Code tested on Bee Agent Framework 0.0.x version
- `v1` folder: Code tested on the current 0.1.1 version

---

## Key Features & Extensions
- `bee-agent-sample.js`: Basic Bee Agent sample
- `custom-agent-milvus-critique.ts`: Custom agent using Milvus
- `custom-tool-travel-agent.ts`: Travel assistant functionality ([Reference](https://suedbroecker.net/2024/11/22/bee-agent-example-for-a-simple-travel-assistant-using-a-custom-tool-and-observe-the-agent-behavior-in-detail-bee-framework-0-0-34-and-watsonx-ai/))
- `workflow-multi-agent.ts`: Multi-agent workflow example

---

## References
- [Bee Agent Framework Official Documentation](https://i-am-bee.github.io/bee-agent-framework/#/)
- [Milvus Vector Search Engine](https://milvus.io/)
- [IBM watsonx.ai](https://www.ibm.com/watsonx/)

Use this document as a guide to get started with developing agents using the Bee Agent Framework.

