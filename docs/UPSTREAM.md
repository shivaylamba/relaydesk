# Upstream notes

RelayDesk is an independent application. It is not an OpenCrewBot fork and does not require OpenCrewBot at runtime.

The integration approach was informed by the local OpenCrewBot/OpenLore showcase: distinct credentials, deliberate shared-memory writes, structured exit-code handling, limited-shell discovery guidance, and recovery after cached MCP sessions disappear. RelayDesk’s implementation uses constrained domain tools and a fresh MCP client per run.

OpenLore: https://github.com/aakarim/OpenLore — Apache-2.0; pinned service version v0.7.5, official release checksums verified on download. OpenCrewBot reference: https://github.com/Studio1-OSS/OpenCrewBot — MIT. Slack Bolt, MCP SDK, React, Vite and fonts retain their respective dependency licenses. Dependencies and font license files are installed through the lockfile.
