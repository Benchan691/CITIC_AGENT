# Splunk MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to securely search, analyze, and validate Splunk queries with built-in safety guardrails.

## Overview

The Splunk MCP Server provides a standardized interface for AI assistants (like Claude, GitHub Copilot, etc.) to interact with Splunk Enterprise or Splunk Cloud. It implements the [Model Context Protocol](https://modelcontextprotocol.io/), allowing seamless integration between AI tools and your Splunk data.

## Key Features

- **Smart Search Integration**: Execute SPL queries with multiple output formats (JSON, Markdown, CSV, Summary)
- **Built-in Safety Guardrails**: Automatic validation to prevent destructive or resource-intensive queries
- **Data Protection**: Automatic sanitization of sensitive data (credit cards, SSNs)
- **Dual Transport Support**: Both SSE (Server-Sent Events) and stdio transports
- **Rich Splunk Features**: Access indexes, saved searches, and execute complex queries
- **Docker Ready**: Containerized deployment options for both implementations

## What is MCP?

The Model Context Protocol (MCP) is an open standard that enables seamless integration between AI assistants and external data sources. It provides:

- **Standardized Communication**: A common protocol for AI assistants to interact with external tools
- **Security**: Built-in authentication and authorization mechanisms
- **Flexibility**: Support for various transport mechanisms (stdio, SSE, WebSocket)
- **Tool Discovery**: Assistants can discover available tools and their capabilities

## Available Implementations

This project provides two feature-complete implementations:

### [Python Implementation](./python/README.md)

- Built with FastMCP framework for simplified development
- Async/await architecture for efficient performance
- Includes comprehensive test suite and interactive tools
- Docker support with management scripts

**[View Python Documentation](./python/README.md)**

### [TypeScript Implementation](./typescript/README.md)

- Full type safety with TypeScript
- Built on the official MCP SDK
- Compatible with Node.js 18+
- Production-ready with compiled JavaScript output

**[View TypeScript Documentation](./typescript/README.md)**

## Quick Start

Choose your preferred implementation:

### Python Quick Start
```bash
cd python
cp .env.example .env
# Edit .env with your Splunk credentials
pip install -e .
python server.py
```

### TypeScript Quick Start
```bash
cd typescript
cp .env.example .env
# Edit .env with your Splunk credentials
npm install
npm start
```

## Core Capabilities

### Available Tools

1. **`validate_spl`** - Validate SPL queries for risks before execution
2. **`search_oneshot`** - Execute blocking searches with immediate results
3. **`search_export`** - Stream large result sets efficiently
4. **`get_indexes`** - List available Splunk indexes with metadata
5. **`get_saved_searches`** - Access saved search configurations
6. **`run_saved_search`** - Execute pre-configured saved searches
7. **`get_config`** - Retrieve server configuration

### Safety Features

The server includes intelligent guardrails to protect your Splunk environment:

- **Risk Scoring**: Queries are analyzed and assigned risk scores (0-100)
- **Configurable Thresholds**: Set your own risk tolerance levels
- **Query Blocking**: Dangerous queries are blocked before execution
- **Performance Protection**: Detects resource-intensive patterns
- **Audit Trail**: All queries are validated and logged

### Supported Clients

- [Claude Desktop](https://claude.ai/desktop)
- [Claude Code](https://github.com/anthropics/claude-code)
- [VS Code Copilot](https://github.com/features/copilot)
- Any MCP-compatible client

## Architecture

Both implementations follow the same architecture:

```
┌─────────────┐     MCP Protocol    ┌─────────────┐     REST API    ┌──────────┐
│ AI Assistant│ ◄─────────────────► │ MCP Server  │ ◄─────────────► │  Splunk  │
│  (Client)   │    stdio/SSE/WS     │ (This Repo) │    Port 8089   │ Instance │
└─────────────┘                     └─────────────┘                 └──────────┘
```

## Security Considerations

- **Credentials**: Store securely in `.env` files (never commit to version control)
- **Network**: Use SSL/TLS for production deployments
- **Permissions**: Apply principle of least privilege for Splunk accounts
- **Validation**: All queries are validated before execution
- **Sanitization**: Sensitive data is automatically masked in outputs

## Project Structure

```
splunk-mcp-server/
├── README.md           # This file
├── LICENSE             # MIT License
├── python/             # Python implementation
│   ├── README.md       # Detailed Python documentation
│   ├── server.py       # Main server implementation
│   ├── guardrails.py   # Query validation logic
│   └── tests/          # Test suite and tools
└── typescript/         # TypeScript implementation
    ├── README.md       # Detailed TypeScript documentation
    ├── server.ts       # Main server implementation
    ├── guardrails.ts   # Query validation logic
    └── tests/          # Test scripts
```

## Contributing

We welcome contributions! Please see the implementation-specific README files for development setup and guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/gesman/splunk-mcp-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gesman/splunk-mcp-server/discussions)
- **MCP Documentation**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
- **Splunk REST API**: [Splunk Documentation](https://docs.splunk.com/Documentation/Splunk/latest/RESTREF/RESTprolog)

---

Choose your preferred implementation above to get started with detailed setup instructions, configuration options, and usage examples.