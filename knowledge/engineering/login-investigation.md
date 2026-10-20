# Login redirect investigation
Synthetic fixture. Engineering only.
The Cedar login reproduction shows a stale returnTo cookie sending users back to the sign-in route after success. Capture the route and browser; proposed remediation is to clear the redirect cookie after consumption and allow only local return paths. This is proposed engineering knowledge, not an approved customer resolution.
