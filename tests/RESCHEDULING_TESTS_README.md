# Comprehensive Test Suite for Intelligent Rescheduling System

This document provides complete documentation for the comprehensive test suite that validates the intelligent rescheduling system's functionality, safety, and reliability.

## 🎯 Overview

The intelligent rescheduling system is a critical component that handles overdue study sessions by intelligently redistributing them while preserving learning continuity and respecting all scheduling constraints. This test suite ensures the system works correctly and safely without risking existing schedules or learning progress.

## 📋 Test Requirements Fulfilled

### ✅ Core Requirements Met

1. **Database Integrity Tests**: Ensures no existing non-overdue sessions are moved or modified
2. **API Endpoint Tests**: Complete validation of POST /plans/:planId/replan endpoint
3. **Constraint Validation**: Daily study time limits, session count limits, exam date boundaries
4. **Intelligent Logic Tests**: Subject-aware grouping and intelligent slot assignment
5. **Edge Case Handling**: No overdue tasks, no available slots, maximum capacity scenarios
6. **User 3@3.com Validation**: Specific test with 7 overdue tasks as requested
7. **Load Balancing**: Maximum 2 sessions per subject per day rule enforcement
8. **Spaced Repetition**: Learning continuity and memory consolidation preservation

## 🏗️ Test Suite Architecture

```
tests/
├── unit/rescheduling/                    # Unit Tests
│   ├── rescheduling-endpoint.test.js     # API endpoint validation
│   ├── database-integrity.test.js        # Database safety tests
│   ├── intelligent-logic.test.js         # Core rescheduling logic
│   ├── constraint-validation.test.js     # All constraint types
│   ├── edge-cases.test.js               # Edge cases and error handling
│   └── spaced-repetition.test.js        # Learning continuity
│
├── integration/                         # Integration Tests
│   └── rescheduling-workflow.test.js    # End-to-end workflows
│
├── fixtures/                           # Test Data
│   └── rescheduling-data-factory.js    # Realistic scenario generator
│
├── manual/                             # Manual Testing Scripts
│   └── rescheduling-manual-tests.js   # Real database validation
│
├── helpers/                           # Test Utilities
│   └── database-helper.js             # Enhanced for rescheduling
│
└── run-rescheduling-tests.js          # Complete test runner
```

## 🚀 Running the Tests

### Complete Test Suite
```bash
# Run all rescheduling tests with comprehensive reporting
node tests/run-rescheduling-tests.js
```

### Individual Test Categories
```bash
# Unit tests only
npm test unit/rescheduling

# Integration tests only
npm test integration/rescheduling-workflow.test.js

# Specific test files
npm test unit/rescheduling/rescheduling-endpoint.test.js
npm test unit/rescheduling/database-integrity.test.js
npm test unit/rescheduling/intelligent-logic.test.js
npm test unit/rescheduling/constraint-validation.test.js
npm test unit/rescheduling/edge-cases.test.js
npm test unit/rescheduling/spaced-repetition.test.js
```

### Manual Testing
```bash
# Create test data for manual validation
node scripts/create-rescheduling-test-data.js create

# Test specific user scenario (3@3.com)
node tests/manual/rescheduling-manual-tests.js user3

# Test all users with overdue sessions
node tests/manual/rescheduling-manual-tests.js allusers

# Performance testing
node tests/manual/rescheduling-manual-tests.js performance

# Database health check
node tests/manual/rescheduling-manual-tests.js health

# Test specific plan workflow
node tests/manual/rescheduling-manual-tests.js workflow <planId>
```

## 📊 Test Coverage Areas

### 🔒 Safety & Security Tests
- **Authentication**: JWT token validation and user authorization
- **Authorization**: Plan ownership verification
- **Data Protection**: No modification of non-overdue sessions
- **Integrity**: Database constraints and relationships preserved
- **Input Validation**: Malformed requests and edge cases

### 🧠 Intelligent Logic Tests
- **Subject Grouping**: Overdue sessions grouped by subject
- **Priority Ordering**: Sessions prioritized by date and importance
- **Slot Assignment**: Intelligent placement before future sessions
- **Fallback Strategies**: Alternative scheduling when preferred slots unavailable
- **Context Awareness**: Considers existing schedule patterns

### ⚖️ Constraint Validation Tests
- **Daily Time Limits**: Respects study_hours_per_day configuration
- **Session Counts**: Maximum sessions per day based on duration
- **Subject Limits**: Maximum 2 sessions per subject per day
- **Exam Date Boundary**: No sessions scheduled beyond exam date
- **Capacity Management**: Handles full schedule scenarios

### 🧬 Spaced Repetition Tests
- **Interval Preservation**: Maintains scientifically-backed review intervals
- **Session Sequences**: Preserves primeira_vez → revisao → aprofundamento flow
- **Learning Momentum**: Protects established study patterns
- **Memory Consolidation**: Considers consolidation windows
- **Adaptive Intervals**: Adjusts based on performance history

### 🎯 Realistic Scenario Tests
- **User 3@3.com**: Exact scenario with 7 overdue tasks
- **Concurso Student**: Public exam preparation scenario
- **Working Professional**: Limited time availability
- **ENEM Student**: High school exam preparation
- **Procrastinator**: Many overdue sessions with tight deadlines
- **Perfectionist**: Detailed study plan with long timeline
- **Stress Test**: Large datasets for performance validation

## 🎪 Test Scenarios in Detail

### User 3@3.com Scenario (As Specified)
- **Email**: 3@3.com
- **Overdue Tasks**: Exactly 7 sessions
- **Subjects**: 
  - Direito Constitucional (2 sessions)
  - Direito Administrativo (2 sessions)
  - Matemática e RLM (2 sessions)
  - Português (1 session)
- **Timeline**: 45 days until exam
- **Study Hours**: 4h weekdays, 6h Saturday, 3h Sunday
- **Session Duration**: 75 minutes
- **Previous Postponements**: 2 times

### Concurso Student Scenario
- **Profile**: Dedicated public exam candidate
- **Overdue Count**: 15 sessions across 5 subjects
- **Timeline**: 60 days preparation
- **Challenge**: Balance multiple law subjects

### Working Professional Scenario
- **Profile**: Limited study time (evenings/weekends)
- **Overdue Count**: 20 sessions
- **Timeline**: 90 days with restricted daily hours
- **Challenge**: Maximize limited available time

### ENEM Student Scenario
- **Profile**: High school student preparing for university entrance
- **Overdue Count**: 28 sessions across 8 subjects
- **Timeline**: 240 days (8 months)
- **Challenge**: Wide subject variety

### Procrastinator Scenario
- **Profile**: Student who fell behind significantly
- **Overdue Count**: 45 sessions
- **Timeline**: Only 30 days left
- **Challenge**: Intensive recovery schedule

## 🛡️ Safety Guarantees Tested

### Database Integrity Protection
✅ **Non-overdue sessions never modified**
- Future sessions remain untouched
- Completed sessions preserved
- Session metadata maintained
- Foreign key relationships intact

✅ **Constraint compliance verified**
- Daily time limits respected
- Session count limits enforced
- Subject distribution rules followed
- Exam date boundaries maintained

✅ **Transaction safety ensured**
- Atomic operations with rollback capability
- Concurrent access protection
- Data consistency checks
- Error recovery mechanisms

### Learning Continuity Preservation
✅ **Spaced repetition maintained**
- Review intervals preserved
- Session type sequences intact
- Memory consolidation windows respected
- Performance-based adaptations

✅ **Study momentum protected**
- Subject learning patterns maintained
- Cognitive load optimization
- Circadian rhythm considerations
- Progress tracking continuity

## 📈 Performance Benchmarks

### Test Execution Performance
- **Small datasets** (< 10 sessions): < 100ms
- **Medium datasets** (10-50 sessions): < 500ms  
- **Large datasets** (50-100 sessions): < 2 seconds
- **Stress test** (100+ sessions): < 5 seconds

### Algorithm Efficiency
- **Subject grouping**: O(n) complexity
- **Slot finding**: O(d×s) where d=days, s=subjects
- **Constraint checking**: O(1) per slot
- **Memory usage**: Linear with session count

## 🔧 Test Configuration

### Environment Variables
```env
NODE_ENV=test
JWT_SECRET=test-secret-key-for-jwt-tokens-in-testing-environment
JWT_REFRESH_SECRET=test-refresh-secret-key-for-jwt-refresh-tokens
SESSION_SECRET=test-session-secret-key-for-express-sessions
```

### Database Setup
- **Type**: SQLite in-memory for fast execution
- **Schema**: Identical to production
- **Data**: Realistic test scenarios
- **Cleanup**: Automatic between tests

### Test Data Factory
- **Realistic profiles**: Different user types and scenarios
- **Configurable overdue**: Customizable session counts and subjects  
- **Historical context**: Previous study patterns and performance
- **Future sessions**: Existing schedule for intelligent placement

## 📝 Test Reports

### Automated Reporting
The test suite generates comprehensive reports including:

- **Success/failure rates** by test category
- **Performance metrics** and execution times
- **Coverage analysis** of all requirements
- **Safety guarantee validation**
- **Deployment readiness assessment**

### Report Locations
- **Console output**: Real-time progress and summary
- **JSON report**: `tests/reports/rescheduling-test-report.json`
- **Coverage report**: Available via `npm run test:coverage`

## 🚨 Common Issues and Solutions

### Test Failures

**"User 3@3.com not found"**
```bash
# Create test data first
node scripts/create-rescheduling-test-data.js create
```

**"Database connection failed"**
```bash
# Ensure database file exists and has proper permissions
ls -la db.sqlite
```

**"JWT token invalid"**
```bash
# Check JWT_SECRET environment variable
echo $JWT_SECRET
```

### Performance Issues

**Tests running slowly**
- Check database cleanup between tests
- Verify memory database configuration
- Review test data size and complexity

**Memory usage high**
- Monitor test data factory output
- Check for memory leaks in test setup/teardown
- Verify database connections are properly closed

## 🎉 Deployment Validation

### Pre-deployment Checklist
- [ ] All unit tests passing
- [ ] All integration tests passing  
- [ ] Manual validation successful
- [ ] User 3@3.com scenario verified
- [ ] Performance benchmarks met
- [ ] Safety guarantees confirmed
- [ ] Edge cases handled properly
- [ ] Database integrity validated

### Deployment Readiness Criteria
The system is considered ready for deployment when:

1. **100% test success rate** across all categories
2. **Performance meets benchmarks** for all scenario sizes
3. **Safety guarantees verified** for all constraint types
4. **User scenarios validated** including 3@3.com
5. **Error handling confirmed** for all edge cases

## 🤝 Contributing to Tests

### Adding New Test Cases
1. **Identify the category**: Unit, integration, or manual
2. **Create test file**: Follow naming convention
3. **Use test factories**: Leverage existing data generators
4. **Document scenario**: Add clear descriptions
5. **Update test runner**: Include in comprehensive suite

### Test Writing Guidelines
- **Descriptive names**: Tests should clearly state what they validate
- **Isolated execution**: Each test should be independent
- **Realistic data**: Use representative scenarios
- **Comprehensive assertions**: Verify all relevant aspects
- **Performance awareness**: Include timing expectations

## 📞 Support and Maintenance

### Test Maintenance
- **Regular execution**: Run tests before any rescheduling changes
- **Data updates**: Keep test scenarios current with real usage
- **Performance monitoring**: Track execution time trends
- **Coverage analysis**: Ensure new features are tested

### Getting Help
- **Documentation**: This README covers all scenarios
- **Code comments**: Detailed explanations in test files
- **Test output**: Descriptive messages for failures
- **Manual scripts**: Interactive validation tools

---

## 🎯 Conclusion

This comprehensive test suite provides complete validation of the intelligent rescheduling system, ensuring it works safely and effectively across all user scenarios while preserving learning continuity and respecting all scheduling constraints. The tests cover everything from basic API functionality to complex learning science principles, giving confidence in the system's reliability and safety.

The suite is designed to be:
- **Comprehensive**: Covers all requirements and edge cases
- **Maintainable**: Clear structure and documentation
- **Reliable**: Consistent results across runs
- **Fast**: Efficient execution for rapid feedback
- **Realistic**: Based on actual user scenarios

By running these tests, you can be confident that the rescheduling system will work correctly in production and provide a safe, intelligent solution for managing overdue study sessions.