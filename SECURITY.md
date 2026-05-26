# Security Policy

SuperPrint OS connects web software to real manufacturing equipment. Treat security issues as physical-world issues, not only app bugs.

## Please Report Privately

Do not open a public issue for vulnerabilities involving:

- authentication bypass
- admin permission bypass
- printer control or job dispatch without authorization
- leaked API keys, node secrets, private LAN addresses, or customer data
- media token bypasses for private uploads, videos, or timelapses

Use GitHub private vulnerability reporting if it is enabled for the repository. If it is not enabled yet, contact the maintainers through the project Discord and ask for a private security channel before sharing details.

## Public Repo Hygiene

- Never commit `.env`, `.env.production`, `.env.supernode`, mobile signing assets, certificates, provisioning profiles, or generated production logs.
- Use placeholders in examples. Real SuperNode secrets must be generated per node.
- Keep direct printer control disabled by default in public Docker examples.
- Keep production deployment values in untracked environment files.

## Supported Scope

Security fixes are welcome for the public code in this repository, including:

- SuperPrint Cloud
- SuperNode
- SuperQueue
- SuperVision
- SuperSlice
- SuperMaintain
- deployment and Docker configuration

Hardware-specific firmware vulnerabilities should also be reported to the hardware vendor.
