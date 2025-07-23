# AI Agent Development Rules

## Overview
This document establishes mandatory protocols for AI agents working **ON** the development of the Grok CLI multi-LLM integration project. These rules ensure consistent progress tracking, context retention, and quality implementation throughout the development process.

**Note**: These are rules for AI agents developing the project, not for users of the Grok CLI tool itself.

## 🔴 CRITICAL REQUIREMENTS

### Documentation-First Protocol
**BEFORE ANY IMPLEMENTATION WORK:**

1. **READ** the roadmap documentation in `/roadmap/`
2. **UNDERSTAND** which phase the current work belongs to  
3. **REVIEW** the specific phase document and implementation guide
4. **IDENTIFY** which checklist items will be affected
5. **PLAN** how to maintain backward compatibility

### Progress Tracking Mandate
**AFTER COMPLETING ANY TASK:**

1. **IMMEDIATELY** update relevant checklists in roadmap documents
2. **MARK** completed items with `[x]` and add timestamp
3. **DOCUMENT** any architectural decisions or deviations
4. **VALIDATE** that implementation matches the planned approach

## 📋 Mandatory Pre-Work Checklist

**For every work session, verify:**

- [ ] I have read `/roadmap/README.md` for project context
- [ ] I understand the current vs target architecture  
- [ ] I have reviewed the relevant phase document
- [ ] I know which checklist items my work will complete
- [ ] I have a plan to maintain backward compatibility
- [ ] I understand how my changes impact future phases

## 🔄 Context Retention Protocol

### Regular Documentation Reviews
- **Every 30 minutes**: Re-read the current phase document
- **Before major changes**: Review the overall project roadmap
- **After completing tasks**: Update progress and validate against goals

### Context Commands
Use these to maintain awareness:

```bash
# Quick project state check
cat roadmap/README.md | head -50

# Current phase progress
grep -E "\[[ x]\]" roadmap/phase1-core-abstraction.md

# Understand project structure  
tree -I node_modules -L 3
```

## 🎯 Implementation Standards

### Code Quality Requirements
- Follow TypeScript strict mode - no `any` types
- Use the universal interfaces from Phase 1 abstractions
- Implement comprehensive error handling
- Write tests for all new functionality
- Maintain existing Grok functionality

### Architecture Compliance
- Adhere to the provider abstraction patterns
- Use the factory pattern for provider instantiation  
- Follow the modular structure outlined in roadmap
- Ensure clean separation of concerns

### Testing Standards
- Unit tests for all new classes and methods
- Integration tests for provider interactions
- Backward compatibility tests for existing features
- Performance tests for critical paths

## 📝 Progress Documentation Format

### Checklist Updates
```markdown
- [x] Create BaseLLMProvider abstract class (2025-01-23 14:30)
- [x] Define UniversalMessage interface (2025-01-23 14:45) 
- [ ] Implement provider factory pattern
```

### Architectural Decision Notes
```markdown
## Implementation Notes - Phase 1 Step 3

**Decision**: Used EventEmitter base class for providers
**Reason**: Enables error handling and provider status events
**Impact**: All providers can emit standardized events
**Date**: 2025-01-23
```

## 🚨 Quality Gates

### Before Committing Code
- [ ] All affected checklist items are updated
- [ ] Tests pass for new and existing functionality  
- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] Backward compatibility is verified

### Before Moving to Next Phase
- [ ] All checklist items in current phase are complete
- [ ] Integration tests pass with existing systems
- [ ] Documentation is updated with implementation notes
- [ ] Code review is completed (if working in team)

## 🔧 Development Workflow

### 1. Context Establishment
```bash
# Start each session by reviewing context
cat roadmap/README.md
cat roadmap/phase1-core-abstraction.md  # or current phase
```

### 2. Work Planning
- Identify 2-3 specific checklist items to complete
- Understand dependencies and integration points
- Plan testing approach for new functionality

### 3. Implementation
- Follow the detailed implementation guides
- Write code with proper TypeScript typing
- Implement error handling and validation
- Write tests as you develop

### 4. Progress Documentation
- Update checklists immediately upon completion
- Document any architectural decisions made
- Note any challenges or learnings

### 5. Validation
- Run tests to ensure nothing is broken
- Test backward compatibility with existing features
- Verify implementation matches roadmap specifications

## 🎖️ Success Metrics

### Individual Task Success
- Checklist item marked complete with timestamp
- Implementation matches roadmap specification  
- Tests written and passing
- No regression in existing functionality

### Phase Success
- All phase checklist items completed
- Integration tests pass
- Documentation updated with progress
- Ready for next phase implementation

## 🆘 Context Recovery Procedure

**If you lose context about project state:**

1. **STOP** current implementation work
2. **READ** `/roadmap/README.md` completely  
3. **REVIEW** current phase document thoroughly
4. **CHECK** git log for recent changes
5. **VALIDATE** current codebase state matches expectations
6. **UPDATE** your understanding before continuing

## 📞 Getting Help

### Documentation Hierarchy
1. **Project Rules** (this document) - Process and standards
2. **Roadmap README** - Project overview and current state  
3. **Phase Documents** - Detailed implementation guides
4. **Code Comments** - Implementation-specific details

### Common Issues
- **Lost context**: Follow context recovery procedure
- **Architecture questions**: Review phase documents and implementation guides
- **Testing issues**: Check existing test patterns in `/src/tests/`
- **Backward compatibility**: Test against existing Grok functionality

---

## ⚠️ REMINDER

This project is a complex architectural transformation that requires:
- **Consistent context awareness** of roadmap goals
- **Meticulous progress tracking** for accountability  
- **Quality implementation** following established patterns
- **Backward compatibility** with existing functionality

**Always prioritize understanding over speed.** Taking time to read documentation and update progress will lead to higher quality outcomes and successful project completion.

---

*These rules are mandatory for all AI agents working on this project. Adherence ensures consistent quality and successful completion of the multi-LLM integration roadmap.*
