import browser_cookie3

print("Testing Edge cookies...")
try:
    cookies = browser_cookie3.edge(domain_name=".instagram.com")
    cookie_list = list(cookies)
    print(f"Found {len(cookie_list)} Instagram cookies from Edge")
    for c in cookie_list:
        print(f"  {c.name} = {c.value[:20]}...")
except Exception as e:
    print(f"Edge failed: {e}")

print("\nTesting Chrome cookies...")
try:
    cookies = browser_cookie3.chrome(domain_name=".instagram.com")
    cookie_list = list(cookies)
    print(f"Found {len(cookie_list)} Instagram cookies from Chrome")
except Exception as e:
    print(f"Chrome failed: {e}")
