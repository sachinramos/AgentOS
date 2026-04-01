# Contributing to AgentOS

Thank you for your interest in contributing to AgentOS! We welcome contributions of all kinds.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/AgentOS.git`
3. **Install** dependencies: `npm install`
4. **Create** a branch: `git checkout -b feature/my-feature`
5. **Make** your changes
6. **Test** your changes locally
7. **Commit** with a clear message: `git commit -m "feat: add my feature"`
8. **Push** to your fork: `git push origin feature/my-feature`
9. **Open** a Pull Request

## Development Setup

```bash
npm install
cp .env.example .env
# Edit .env with your local PostgreSQL connection string
npm run db:push
npm run dev
```

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation changes
- `style:` — formatting, no code change
- `refactor:` — code restructuring
- `test:` — adding or updating tests
- `chore:` — tooling, dependencies, CI

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Update documentation if you change public APIs
- Add tests for new functionality
- Ensure the app builds without errors before submitting

## Reporting Bugs

Use the [Bug Report](https://github.com/sachinramos/AgentOS/issues/new?template=bug_report.md) template and include:

- Steps to reproduce
- Expected vs actual behaviour
- Screenshots if applicable
- Environment details (OS, Node version, browser)

## Feature Requests

Use the [Feature Request](https://github.com/sachinramos/AgentOS/issues/new?template=feature_request.md) template and describe:

- The problem you are trying to solve
- Your proposed solution
- Any alternatives you have considered

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions?

Join our [Discord](https://discord.gg/vbdV7YyW) for help and discussion.

---

Thank you for helping make AgentOS better!
