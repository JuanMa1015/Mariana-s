import urllib.request
import json
try:
    req = urllib.request.Request('http://localhost:8000/auth/register', data=json.dumps({'email':'test@test.com','password':'123'}).encode(), headers={'Content-Type': 'application/json'})
    print(urllib.request.urlopen(req).read().decode())
except Exception as e:
    print(e.read().decode())
