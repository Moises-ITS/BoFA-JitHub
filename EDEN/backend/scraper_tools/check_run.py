import requests, os, json
from dotenv import load_dotenv; load_dotenv()
token = os.getenv('APIFY_TOKEN')
resp = requests.get(f'https://api.apify.com/v2/acts/apify~instagram-scraper/runs/last?token={token}')
data = resp.json()['data']
print('Status:', data.get('status'))
print('Log URL:', f"https://api.apify.com/v2/logs/{data.get('id')}?token={token}")
