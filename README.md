# Aether C.A.D

Customer Audit Documentation

Visual rack inventory editor for fast rack documentation.

## What it does

- place devices visually into rack units
- prevent overlaps and out-of-bounds placement
- store rack layouts in PostgreSQL
- reload and edit existing racks
- export the current stored rack state to Excel and PDF

## Local development

1. `docker compose up -d aethercad-db`
2. `npm.cmd install`
3. `npm.cmd run dev`

The frontend runs on `http://localhost:5500`.
The development API runs on `http://localhost:5501`.
The PostgreSQL database is exposed on `localhost:5496`.

## Stack deployment

The repository includes [`compose.yml`](./compose.yml) and [`Dockerfile`](./Dockerfile) so Portainer can deploy it directly from a GitHub repository as a stack.

Recommended stack settings:

- repository URL: your GitHub repo
- compose path: `compose.yml`
- web app port: `5500`
- database port: `5496`
- persistent volume: `aethercad-db-data`

This compose setup is intentionally plain Compose spec, so it works for Docker-based Portainer and Podman-based environments that accept standard compose stacks.
The app listens on port `5500`, and PostgreSQL is published on `5496` to avoid collisions with other projects.
