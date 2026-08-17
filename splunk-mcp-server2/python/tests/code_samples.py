#!/usr/bin/env python3
"""Display code samples for using the Splunk MCP server with Python and curl."""

import sys

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
CYAN = '\033[96m'
GRAY = '\033[37m'  # Light gray for code (more visible)
RESET = '\033[0m'
BOLD = '\033[1m'
DIM = '\033[2m'

def print_section(title):
    """Print a section header."""
    print(f"\n{BOLD}{CYAN}{'=' * 70}{RESET}")
    print(f"{BOLD}{CYAN}{title.center(70)}{RESET}")
    print(f"{BOLD}{CYAN}{'=' * 70}{RESET}\n")

def print_subsection(title):
    """Print a subsection header."""
    print(f"\n{BOLD}{GREEN}▸ {title}{RESET}")
    print(f"{DIM}{'-' * (len(title) + 2)}{RESET}")

def print_code(code, language=""):
    """Print code with formatting."""
    print(f"{GRAY}{code}{RESET}")

def show_python_samples():
    """Display Python code samples."""
    
    print_section("PYTHON CODE SAMPLES FOR SPLUNK MCP SERVER")
    
    print(f"\n{BOLD}{GREEN}Transport Mode:{RESET} These examples use {BOLD}SSE (Server-Sent Events){RESET} transport")
    print(f"{DIM}The examples below connect to http://localhost:8050/sse (default mode){RESET}")
    print(f"{DIM}To use STDIO transport instead, import from mcp.client.stdio and use stdio_client(){RESET}\n")
    
    print_subsection("1. Basic Setup and Connection (SSE)")
    print_code("""
import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def connect_to_splunk_mcp():
    server_url = "http://localhost:8050/sse"
    
    async with sse_client(server_url) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            # Your code here
            return session
""")
    
    print_subsection("2. Simple Search Query (SSE)")
    print_code("""
async def search_errors():
    async with sse_client("http://localhost:8050/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            result = await session.call_tool("search_oneshot", arguments={
                "query": "index=_internal error | head 10",
                "earliest_time": "-1h",
                "output_format": "json"
            })
            
            import json
            data = json.loads(result.content[0].text)
            print(f"Found {data['event_count']} errors")
            
            for event in data['events']:
                print(f"- {event.get('_time')}: {event.get('_raw')[:100]}...")
""")
    
    print_subsection("3. Export Large Result Sets (SSE)")
    print_code("""
async def export_all_errors_today():
    async with sse_client("http://localhost:8050/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Use search_export for streaming large result sets
            result = await session.call_tool("search_export", arguments={
                "query": "index=_internal level=ERROR",
                "earliest_time": "-24h",
                "max_count": 10000,  # or 0 for unlimited
                "output_format": "json"
            })
            
            import json
            data = json.loads(result.content[0].text)
            return data['events']
""")
    
    print_subsection("4. Get Indexes with Filtering (SSE)")
    print_code("""
async def get_large_indexes():
    async with sse_client("http://localhost:8050/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            result = await session.call_tool("get_indexes", arguments={})
            
            import json
            data = json.loads(result.content[0].text)
            
            # Filter indexes with more than 1GB of data
            large_indexes = [
                idx for idx in data['indexes'] 
                if idx.get('currentDBSizeMB', 0) > 1024
            ]
            
            for idx in large_indexes:
                print(f"Index: {idx['name']}")
                print(f"  Size: {idx['currentDBSizeMB']:,.2f} MB")
                print(f"  Events: {idx['totalEventCount']:,}")
""")
    
    print_subsection("5. Work with Saved Searches (SSE)")
    print_code("""
async def list_and_run_saved_search():
    async with sse_client("http://localhost:8050/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Get all saved searches
            result = await session.call_tool("get_saved_searches", arguments={})
            saved_searches = json.loads(result.content[0].text)['saved_searches']
            
            # Find a specific saved search
            target_search = next(
                (s for s in saved_searches if 'errors' in s['name'].lower()), 
                None
            )
            
            if target_search:
                # Run the saved search
                result = await session.call_tool("run_saved_search", arguments={
                    "search_name": target_search['name'],
                    "trigger_actions": False
                })
                print(f"Ran search: {target_search['name']}")
""")
    
    print_subsection("6. Different Output Formats (SSE)")
    print_code("""
async def search_with_formats():
    query = "index=_internal | stats count by sourcetype | head 5"
    
    async with sse_client("http://localhost:8050/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # JSON format
            result = await session.call_tool("search_oneshot", arguments={
                "query": query,
                "earliest_time": "-1h",
                "output_format": "json"
            })
            
            # Markdown format
            result = await session.call_tool("search_oneshot", arguments={
                "query": query,
                "earliest_time": "-1h",
                "output_format": "markdown"
            })
            
            # CSV format
            result = await session.call_tool("search_oneshot", arguments={
                "query": query,
                "earliest_time": "-1h",
                "output_format": "csv"
            })
            
            # Summary format
            result = await session.call_tool("search_oneshot", arguments={
                "query": query,
                "earliest_time": "-1h",
                "output_format": "summary"
            })
""")
    
    print_subsection("7. Read Resources (SSE)")
    print_code("""
async def read_splunk_resources():
    async with sse_client("http://localhost:8050/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Read saved searches resource
            saved_searches = await session.read_resource("splunk://saved-searches")
            print("Saved Searches:")
            print(saved_searches.contents[0].text[:500])
            
            # Read indexes resource
            indexes = await session.read_resource("splunk://indexes")
            print("\\nIndexes:")
            print(indexes.contents[0].text[:500])
""")
    
    print_subsection("8. STDIO Transport Example")
    print_code("""
# Example using STDIO transport instead of SSE
import asyncio
from mcp import ClientSession
from mcp.client.stdio import stdio_client
import subprocess

async def connect_via_stdio():
    # Note: Server must be configured with TRANSPORT=stdio
    server_path = "python"
    server_args = ["server.py"]
    
    async with stdio_client(server_path, server_args) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Now you can use the same methods as SSE
            result = await session.call_tool("get_config", arguments={})
            config = json.loads(result.content[0].text)
            print(f"Connected via STDIO: {config}")
            
# Alternative: Connect to running STDIO server via subprocess
async def connect_to_stdio_server():
    # This connects to an already running STDIO server
    process = subprocess.Popen(
        ["python", "-m", "mcp.client.stdio"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    # Use process for communication
""")
    
    # Advanced Examples
    print_section("ADVANCED PYTHON EXAMPLES")
    
    print(f"\n{DIM}Note: These advanced examples also use SSE transport by default.{RESET}\n")
    
    print_subsection("Error Handling in Python (SSE)")
    print_code("""
async def search_with_error_handling():
    try:
        async with sse_client("http://localhost:8050/sse") as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                try:
                    result = await session.call_tool("search_oneshot", arguments={
                        "query": "invalid query syntax [[[",
                        "earliest_time": "-1h"
                    })
                    data = json.loads(result.content[0].text)
                    
                    if 'error' in data:
                        print(f"Search error: {data['error']}")
                        if 'details' in data:
                            print(f"Details: {data['details']}")
                    else:
                        print(f"Found {data['event_count']} events")
                        
                except Exception as e:
                    print(f"Tool execution error: {e}")
                    
    except Exception as e:
        print(f"Connection error: {e}")
        print("Is the server running on port 8050?")
""")
    
    print_subsection("Async Batch Processing (SSE)")
    print_code("""
async def batch_search_indexes():
    async with sse_client("http://localhost:8050/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Get all indexes first
            result = await session.call_tool("get_indexes", arguments={})
            indexes = json.loads(result.content[0].text)['indexes']
            
            # Search each index concurrently
            async def search_index(index_name):
                result = await session.call_tool("search_oneshot", arguments={
                    "query": f"index={index_name} | stats count",
                    "earliest_time": "-24h",
                    "max_count": 1
                })
                return index_name, json.loads(result.content[0].text)
            
            # Run searches concurrently
            import asyncio
            results = await asyncio.gather(
                *[search_index(idx['name']) for idx in indexes[:5]]
            )
            
            for index_name, data in results:
                print(f"{index_name}: {data}")
""")
    
    print_subsection("Stream Processing with Export (SSE)")
    print_code("""
async def process_large_dataset():
    async with sse_client("http://localhost:8050/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Export search for streaming large datasets
            result = await session.call_tool("search_export", arguments={
                "query": "index=_internal | head 100000",
                "earliest_time": "-7d",
                "max_count": 0,  # Unlimited
                "output_format": "json"
            })
            
            data = json.loads(result.content[0].text)
            
            # Process in chunks
            chunk_size = 1000
            for i in range(0, len(data['events']), chunk_size):
                chunk = data['events'][i:i+chunk_size]
                # Process chunk
                process_chunk(chunk)
                
def process_chunk(events):
    # Your processing logic here
    pass
""")
    
    print(f"\n{BOLD}{GREEN}✅ Python code samples displayed successfully!{RESET}")
    print(f"\n{DIM}For more examples, check the examples/ directory in the repository.{RESET}\n")

def show_curl_samples():
    """Display curl code samples."""
    
    print_section("CURL CODE SAMPLES FOR SPLUNK MCP SERVER")
    
    print(f"\n{BOLD}{RED}Important: SSE vs STDIO Mode{RESET}")
    print(f"{DIM}The Splunk MCP server can run in two modes:{RESET}")
    print(f"{DIM}1. SSE mode (default): HTTP server with Server-Sent Events on http://localhost:8050/sse{RESET}")
    print(f"{DIM}2. STDIO mode: Communicates via standard input/output (no HTTP endpoints){RESET}")
    print(f"\n{BOLD}{YELLOW}Note: STDIO mode CANNOT be tested with curl!{RESET}")
    print(f"{DIM}In STDIO mode, the server communicates through stdin/stdout with its parent process.{RESET}")
    print(f"{DIM}It does NOT expose any HTTP endpoints. The client must spawn the server as a subprocess.{RESET}\n")
    
    print(f"{BOLD}Curl can only be used with SSE mode (shown below).{RESET}\n")
    
    print(f"\n{BOLD}{CYAN}═══ SSE Mode Commands (default mode) ═══{RESET}\n")
    
    print_subsection("1. Test if SSE Server is Running")
    print_code("""timeout 2 curl -s -I http://localhost:8050/sse | grep -q "text/event-stream" && echo "SSE server is running" || echo "Server not found\"""", "bash")
    
    print_subsection("2. Connect to SSE Stream (will stream events)")
    print_code("""# Connect and show raw SSE events (Ctrl+C to stop)
curl -N -H "Accept: text/event-stream" http://localhost:8050/sse

# Connect and format the output (shows event types and data)
curl -N -s http://localhost:8050/sse 2>/dev/null | while read -r line; do
    if [[ $line == event:* ]]; then
        echo -e "\\n[EVENT] ${line#event: }"
    elif [[ $line == data:* ]]; then
        echo "[DATA] ${line#data: }"
    fi
done""", "bash")
    
    print_subsection("3. Connect with Timeout (useful for testing)")
    print_code("""# Connect for 5 seconds and show events
timeout 5 curl -N -s http://localhost:8050/sse | grep -E "^(event:|data:)"

# Connect and count events for 10 seconds
timeout 10 curl -N -s http://localhost:8050/sse | grep -c "^event:\"""", "bash")
    
    print(f"\n{YELLOW}Note: SSE is a one-way streaming protocol. You cannot send commands via curl in SSE mode.{RESET}")
    print(f"{YELLOW}To interact with the MCP server, use the Python client examples.{RESET}")
    
    print(f"\n{BOLD}{CYAN}═══ STDIO Mode Testing ═══{RESET}\n")
    
    print(f"{BOLD}{RED}STDIO mode cannot be tested with curl!{RESET}")
    print(f"{DIM}In STDIO mode, the server communicates through stdin/stdout pipes, not HTTP.{RESET}")
    print(f"{DIM}To test STDIO mode, you must:{RESET}")
    print(f"{DIM}1. Use the Python client with stdio_client() - see Python examples{RESET}")
    print(f"{DIM}2. Or use a tool that can communicate via process stdin/stdout{RESET}")
    
    print_subsection("Example: Testing STDIO mode with Python")
    print_code("""# Set TRANSPORT=stdio in .env, then run:
python -c "
import subprocess
import json

# Start server as subprocess
proc = subprocess.Popen(
    ['python', 'server.py'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# Send initialize request
request = {'jsonrpc': '2.0', 'method': 'initialize', 'params': {}, 'id': 1}
proc.stdin.write(json.dumps(request) + '\\n')
proc.stdin.flush()

# Read response
response = proc.stdout.readline()
print('Response:', response)
""", "python")
    
    print(f"\n{DIM}For interactive STDIO testing, use the Python client examples instead of curl.{RESET}")
    
    
    print(f"\n{BOLD}{GREEN}✅ Curl code samples displayed successfully!{RESET}")
    print(f"\n{DIM}For more examples, check the examples/ directory in the repository.{RESET}\n")

def show_menu():
    """Display code samples menu."""
    while True:
        print_section("CODE SAMPLES - SPLUNK MCP SERVER")
        
        print(f"{BOLD}Select an option:{RESET}")
        print(f"  {GREEN}1{RESET}) Python Examples")
        print(f"  {GREEN}2{RESET}) Curl Examples")
        print(f"  {GREEN}3{RESET}) Show All Examples")
        print(f"  {RED}q{RESET}) Return to main menu")
        print()
        
        choice = input("Enter your choice: ").strip().lower()
        
        if choice == '1':
            show_python_samples()
            print(f"\n{YELLOW}Press Enter to continue...{RESET}")
            input()
        elif choice == '2':
            show_curl_samples()
            print(f"\n{YELLOW}Press Enter to continue...{RESET}")
            input()
        elif choice == '3':
            show_python_samples()
            show_curl_samples()
            print(f"\n{YELLOW}Press Enter to continue...{RESET}")
            input()
        elif choice == 'q':
            break
        else:
            print(f"\n{RED}Invalid choice. Please try again.{RESET}")
            print(f"\n{YELLOW}Press Enter to continue...{RESET}")
            input()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "python":
            show_python_samples()
        elif sys.argv[1] == "curl":
            show_curl_samples()
        elif sys.argv[1] == "all":
            show_python_samples()
            show_curl_samples()
        else:
            show_menu()
    else:
        show_menu()