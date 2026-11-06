# Quartz v4

> “[One] who works with the door open gets all kinds of interruptions, but [they] also occasionally gets clues as to what the world is and what might be important.” — Richard Hamming

Quartz is a set of tools that helps you publish your [digital garden](https://jzhao.xyz/posts/networked-thought) and notes as a website for free.

## Tony's Knowledge Garden

This is Tony Sheng's public knowledge garden — a living collection of ideas from **6000+ hours of teaching**, reading, and building.

### Quick Start

```bash
npm install
npx quartz build -d content --serve
```

### Testing

```bash
npm test
```

### Docker

```bash
docker build -t tony-knowledge-garden .
docker run -p 8080:80 tony-knowledge-garden
```

### Monitoring

```bash
bash scripts/monitor.sh 8080
```

### Features

- **Bilingual content** — English + Chinese with toggle
- **JSON-LD structured data** — SEO optimized
- **CI/CD** — GitHub Actions with build verification + GitHub Pages deploy
- **Multi-stage Docker build** — Nginx-based, health-checked
- **Content categories** — AI, Chinese teaching, CS, math, business, thinkers

---

🔗 Read the documentation and get started: https://quartz.jzhao.xyz/

[Join the Discord Community](https://discord.gg/cRFFHYye7t)

## Sponsors

<p align="center">
  <a href="https://github.com/sponsors/jackyzha0">
    <img src="https://cdn.jsdelivr.net/gh/jackyzha0/jackyzha0/sponsorkit/sponsors.svg" />
  </a>
</p>
