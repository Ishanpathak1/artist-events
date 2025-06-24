# Contributing to Artist Events Platform

Thank you for your interest in contributing to the Artist Events Platform! We welcome contributions from the community.

## 🎯 How to Contribute

### 1. Fork the Repository
- Fork the repository on GitHub
- Clone your fork locally: `git clone https://github.com/yourusername/artist-events.git`

### 2. Set Up Development Environment
```bash
# Install dependencies
npm install

# Set up database (see database/README.md)
createdb artist_events
psql -d artist_events -f database/schema.sql

# Create environment file
cp .env.example .env
# Edit .env with your database credentials

# Start development server
npm run dev
```

### 3. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 4. Make Your Changes
- Write clean, readable code
- Follow the existing code style
- Add comments for complex logic
- Update documentation if needed

### 5. Test Your Changes
```bash
# Build the project
npm run build

# Preview the build
npm run preview

# Test database operations
node database/migrate-from-json.js
```

### 6. Commit Your Changes
```bash
git add .
git commit -m "feat: add new feature description"
# or
git commit -m "fix: resolve issue description"
```

Use conventional commit messages:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding tests
- `chore:` for maintenance tasks

### 7. Push and Create Pull Request
```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear description of changes
- Screenshots if UI changes
- Link to related issues

## 🛠️ Development Guidelines

### Code Style
- Use TypeScript for type safety
- Follow existing naming conventions
- Use meaningful variable and function names
- Keep functions small and focused

### Database Changes
- Always create migration scripts for schema changes
- Test migrations with sample data
- Update database documentation
- Include rollback procedures

### Frontend Guidelines
- Use semantic HTML
- Maintain responsive design
- Optimize for performance
- Test across different browsers

### API Guidelines
- Follow RESTful principles
- Include proper error handling
- Document API endpoints
- Use appropriate HTTP status codes

## 🐛 Bug Reports

When reporting bugs, please include:
- Steps to reproduce the issue
- Expected vs actual behavior
- Browser/OS information
- Screenshots if applicable
- Error messages or logs

## 💡 Feature Requests

For new features:
- Describe the problem you're solving
- Explain the proposed solution
- Consider implementation complexity
- Discuss potential alternatives

## 📚 Areas for Contribution

### High Priority
- [ ] Web scraping modules for venue websites
- [ ] Social media integration (Facebook, Instagram)
- [ ] AI-powered duplicate detection
- [ ] Mobile-responsive improvements

### Medium Priority
- [ ] Event recommendation engine
- [ ] Advanced search filters
- [ ] Analytics dashboard
- [ ] User authentication system

### Documentation
- [ ] API documentation
- [ ] Deployment guides
- [ ] Video tutorials
- [ ] Code examples

### Testing
- [ ] Unit tests for database functions
- [ ] Integration tests for API endpoints
- [ ] End-to-end testing for user flows
- [ ] Performance testing

## 🔍 Code Review Process

1. **Automated Checks**: Your PR will run automated checks
2. **Peer Review**: Code will be reviewed by maintainers
3. **Testing**: Changes will be tested in development environment
4. **Documentation**: Ensure documentation is updated
5. **Merge**: Approved changes will be merged to main branch

## 📞 Getting Help

- **Documentation**: Check the [README](README.md) and [Database Guide](database/README.md)
- **Issues**: Browse existing issues for solutions
- **Discussions**: Use GitHub Discussions for questions
- **Contact**: Reach out to maintainers for complex issues

## 🏆 Recognition

Contributors will be recognized in:
- README contributors section
- Release notes for significant contributions
- Project documentation

## 📋 Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] Database migrations tested

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings/errors
```

## 🚀 Release Process

1. Features are merged to `main` branch
2. Releases are tagged with semantic versioning
3. Changelog is updated for each release
4. Production deployment follows testing

Thank you for contributing to the Artist Events Platform! 🎵 