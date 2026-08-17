#!/usr/bin/env python3
"""Quick smoke test for Splunk MCP server."""

import asyncio
import json
import sys
from mcp import ClientSession
from mcp.client.sse import sse_client
from dotenv import load_dotenv

load_dotenv()

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'
BOLD = '\033[1m'

async def quick_test():
    server_url = "http://localhost:8050/sse"
    
    print(f"{BOLD}🚀 Running Quick Smoke Test{RESET}")
    print("=" * 40)
    
    tests_passed = 0
    tests_failed = 0
    
    try:
        async with sse_client(server_url) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                # Test 1: Server connectivity
                print("\n1. Testing server connectivity...", end=" ")
                try:
                    result = await session.call_tool("get_config", arguments={})
                    config = json.loads(result.content[0].text)
                    if config.get('splunk_connected'):
                        print(f"{GREEN}✓ Connected{RESET}")
                        tests_passed += 1
                    else:
                        print(f"{RED}✗ Not connected to Splunk{RESET}")
                        tests_failed += 1
                except Exception as e:
                    print(f"{RED}✗ Failed: {e}{RESET}")
                    tests_failed += 1
                
                # Test 2: Basic search
                print("2. Testing basic search...", end=" ")
                try:
                    result = await session.call_tool(
                        "search_oneshot",
                        arguments={
                            "query": "index=_internal | head 1",
                            "earliest_time": "-1h",
                            "max_count": 1
                        }
                    )
                    search_result = json.loads(result.content[0].text)
                    if 'error' not in search_result:
                        print(f"{GREEN}✓ Search works{RESET}")
                        tests_passed += 1
                    else:
                        print(f"{RED}✗ Search error: {search_result['error']}{RESET}")
                        tests_failed += 1
                except Exception as e:
                    print(f"{RED}✗ Failed: {e}{RESET}")
                    tests_failed += 1
                
                # Test 3: List indexes
                print("3. Testing index listing...", end=" ")
                try:
                    result = await session.call_tool("get_indexes", arguments={})
                    indexes = json.loads(result.content[0].text)
                    if 'indexes' in indexes and indexes['count'] > 0:
                        print(f"{GREEN}✓ Found {indexes['count']} indexes{RESET}")
                        tests_passed += 1
                    else:
                        print(f"{YELLOW}⚠ No indexes found{RESET}")
                        tests_failed += 1
                except Exception as e:
                    print(f"{RED}✗ Failed: {e}{RESET}")
                    tests_failed += 1
                
                # Test 4: Resources
                print("4. Testing resources...", end=" ")
                try:
                    resource = await session.read_resource("splunk://indexes")
                    if resource.contents and len(resource.contents[0].text) > 0:
                        print(f"{GREEN}✓ Resources accessible{RESET}")
                        tests_passed += 1
                    else:
                        print(f"{YELLOW}⚠ Empty resource{RESET}")
                        tests_failed += 1
                except Exception as e:
                    print(f"{RED}✗ Failed: {e}{RESET}")
                    tests_failed += 1
                
                # Summary
                total_tests = tests_passed + tests_failed
                print(f"\n{BOLD}Summary:{RESET}")
                print(f"  Total: {total_tests}")
                print(f"  {GREEN}Passed: {tests_passed}{RESET}")
                print(f"  {RED}Failed: {tests_failed}{RESET}")
                
                if tests_failed == 0:
                    print(f"\n{GREEN}{BOLD}✅ All tests passed! Server is working correctly.{RESET}")
                    return True
                else:
                    print(f"\n{YELLOW}{BOLD}⚠ Some tests failed. Check server configuration.{RESET}")
                    return False
                    
    except Exception as e:
        print(f"\n{RED}Fatal error:{RESET} {str(e)}")
        print("Cannot connect to server. Make sure it's running on port 8050.")
        return False

if __name__ == "__main__":
    success = asyncio.run(quick_test())
    sys.exit(0 if success else 1)